/**
 * Goal-driven plan generator (spec §6.6) — pure engine module.
 *
 * `generatePlan(catalog, profile, preferences)` turns a lifter's profile + training
 * preferences into a structured multi-day program with exercises curated per goal,
 * profile-scaled starting weights, and a Week-1 calibration descriptor. It returns
 * the full coached-plan CONTRACT — { program, cardioProtocol, goals, calibrationWeek }
 * — the shape every later wave fills:
 *   - cardioProtocol : empty-but-valid here; goal-dosed cardio lands in S7.
 *   - goals          : []; the generator auto-creates goals in S9.
 *   - calibrationWeek: real descriptor; the engine derives weeks 2+ at completion.
 *
 * ENGINE PURITY: no IO / Date.now / randomness / Dexie / DOM. The catalog, profile,
 * and any time are passed in. Inputs are engine-local structural types so this module
 * imports nothing from /src/db (the catalog passes db.Exercise[], which conforms).
 */
import type { Muscle, ProgressionRule } from '../types';
import {
  buildMesocyclePlan,
  landmarksFor,
  type Phase,
  type VolumeLandmarks,
} from '../mesocycle';

export type TrainingGoal =
  | 'Build muscle'
  | 'Lose fat'
  | 'Recomposition'
  | 'Get stronger'
  | 'General fitness';
export type EquipmentProfile = 'Full gym' | 'Home rack' | 'Minimal';
export type Experience = 'Novice' | 'Intermediate' | 'Advanced';
export type Sex = 'male' | 'female';
/** User split preference (mirrors db `SplitChoice`; engine may not import db). 'auto'
 *  (or omitted) lets the split designer choose by goal / days / training-age. */
export type SplitChoice =
  | 'auto'
  | 'fullBody'
  | 'upperLower'
  | 'pushPullLegs'
  | 'pplArms'
  | 'bodyPart';

/** Catalog fields the generator reads — a structural subset of db `Exercise`, kept
 *  engine-local so /src/engine imports nothing from /src/db. db.Exercise[] conforms. */
export interface GenExercise {
  id: string;
  name: string;
  nameNorm: string;
  primaryMuscles: readonly Muscle[];
  equipment?: string;
  mechanic?: 'compound' | 'isolation';
  isBodyweight?: boolean;
}

/** Body/goal profile (subset of db `Profile` + the latest bodyweight). */
export interface GenProfile {
  goal: TrainingGoal;
  sex?: Sex;
  /** Derived from DOB by the caller (now passed in there, never the engine). */
  ageYears?: number;
  bodyweightLb?: number;
  /** Physique-target extension (carried in the contract; drives bands/nutrition later). */
  targetBodyFatPct?: number;
  goalTimeframeWeeks?: number;
}

export interface GenPreferences {
  days: number;
  equipment: EquipmentProfile;
  experience: Experience;
  /** Per-type rest defaults (seconds) from settings; omitted → built-in defaults. */
  rest?: { compoundSec: number; isolationSec: number };
  /** Split preference (R1 input); omitted/'auto' → composer chooses. */
  splitChoice?: SplitChoice;
  /** Lagging/priority muscles to bias the split toward (R1 input); omitted → none. */
  priorityMuscles?: readonly Muscle[];
}

/** Rest-tier buckets (§3.7) — re-declared engine-local (engine may not import db). */
export type RestTier = 'heavy' | 'compound' | 'accessory' | 'isolation' | 'pump';

export interface GeneratedSlot {
  exerciseId: string;
  exerciseName: string;
  compound: boolean;
  rule: ProgressionRule;
  scheme: { sets: number; repTarget?: number; repRange?: [number, number] };
  rest: { warmupSec: number; workSec: number };
  startWeightLb: number;
  /** §3.4 — 4-digit tempo, per movement pattern. */
  tempo: string;
  /** §3.3 — one-line coaching cue, per movement pattern. */
  coachingCue: string;
  /** §3.7 — rest-tier classification driving the rest shown pre-set. */
  restTier: RestTier;
}
export interface GeneratedDay {
  name: string;
  slots: GeneratedSlot[];
}
export interface GeneratedProgram {
  name: string;
  days: GeneratedDay[];
}

/** Cardio dosing — SHAPE ONLY this session (empty-but-valid). S7 fills sessions/dosing. */
export interface CardioSession {
  kind: string;
  minutes: number;
  note: string;
}
export interface CardioProtocol {
  weeklyMinutesTarget: number;
  dailyStepTarget: number;
  sessions: CardioSession[];
}

/** Auto-goal — SHAPE ONLY this session (generator returns none). S9 fills these. */
export interface GeneratedGoal {
  type: string;
  target: number;
  direction: 'increase' | 'decrease';
}

/** Week-1 calibration descriptor: ramp to a top set to set working weights; the
 *  engine derives weeks 2+ from the logged result at completion. */
export interface CalibrationWeek {
  isCalibrationWeek: boolean;
  topSetRepRange: [number, number];
  note: string;
}

/** Initial mesocycle written onto the program (structurally matches db `Mesocycle`).
 *  Null for self-periodizing programs (GZCLP) that carry no block mesocycle. */
export interface GeneratedMesocycle {
  phase: Phase;
  weekIndex: number;
  totalWeeks: number;
  volumeTargets: Partial<Record<Muscle, VolumeLandmarks>>;
}

export interface GeneratorResult {
  program: GeneratedProgram;
  cardioProtocol: CardioProtocol;
  goals: GeneratedGoal[];
  calibrationWeek: CalibrationWeek;
  mesocycle: GeneratedMesocycle | null;
  /** R3 — per-muscle weekly *effective* sets the allocator distributed (fractional for
   *  hypertrophy, direct for strength). The static block-start allocation; the per-muscle
   *  temporal ramp is R3.5. Empty for GZCLP (tier-structured, not volume-allocated). */
  weeklyVolumeByMuscle: Partial<Record<Muscle, number>>;
}

const DEFAULT_REST = { compoundSec: 180, isolationSec: 90 } as const;

/** Equipment usable per gym profile. */
const EQUIPMENT_POOL: Record<EquipmentProfile, ReadonlySet<string>> = {
  'Full gym': new Set([
    'barbell', 'dumbbell', 'machine', 'cable', 'bodyweight', 'kettlebell', 'bands', 'ezBar',
  ]),
  'Home rack': new Set(['barbell', 'dumbbell', 'bodyweight', 'kettlebell', 'bands', 'ezBar']),
  Minimal: new Set(['dumbbell', 'bodyweight', 'kettlebell', 'bands']),
};

interface Pattern {
  key: string;
  compound: boolean;
  muscles: Muscle[];
  includes: string[];
  excludes?: string[];
  /** Curated, preferred name-matches in priority order — the "pool" the resolver
   *  prefers before falling back to a generic muscle match (spec §6.6 curation). */
  prefer?: string[];
}

/* Movement patterns. `prefer` is the curated shortlist; `includes` is the broader
   eligibility net; `muscles` is the fallback. */
const P: Record<string, Pattern> = {
  horizPress: { key: 'horizPress', compound: true, muscles: ['chest'], prefer: ['barbell bench press', 'flat bench press', 'dumbbell bench press'], includes: ['bench press', 'push-up', 'push up', 'chest press', 'dip', 'chest dip'] },
  inclPress: { key: 'inclPress', compound: true, muscles: ['chest'], prefer: ['incline dumbbell press', 'incline barbell bench press'], includes: ['incline'] },
  vertPress: { key: 'vertPress', compound: true, muscles: ['shoulders'], prefer: ['standing military press', 'overhead press', 'seated dumbbell press', 'arnold dumbbell press'], includes: ['overhead press', 'shoulder press', 'military', 'push press', 'arnold'] },
  lateralRaise: { key: 'lateralRaise', compound: false, muscles: ['shoulders'], prefer: ['side lateral raise', 'cable seated lateral raise'], includes: ['lateral raise', 'side lateral', 'side raise'] },
  rearDelt: { key: 'rearDelt', compound: false, muscles: ['shoulders'], prefer: ['face pull', 'cable rear delt fly'], includes: ['rear delt', 'reverse fly', 'face pull', 'rear lateral'] },
  tricep: { key: 'tricep', compound: false, muscles: ['triceps'], prefer: ['triceps pushdown', 'cable rope overhead triceps extension'], includes: ['pushdown', 'triceps extension', 'skullcrusher', 'kickback', 'triceps'] },
  biceps: { key: 'biceps', compound: false, muscles: ['biceps'], prefer: ['barbell curl', 'incline dumbbell curl', 'hammer curls'], includes: ['curl'], excludes: ['leg curl', 'wrist'] },
  squat: { key: 'squat', compound: true, muscles: ['quadriceps'], prefer: ['barbell squat', 'barbell full squat', 'front barbell squat'], includes: ['squat'], excludes: ['sissy', 'jump'] },
  legPress: { key: 'legPress', compound: true, muscles: ['quadriceps'], prefer: ['leg press', 'dumbbell lunges', 'barbell walking lunge'], includes: ['leg press', 'lunge', 'split squat', 'hack squat', 'bulgarian'] },
  legExt: { key: 'legExt', compound: false, muscles: ['quadriceps'], prefer: ['leg extensions'], includes: ['leg extension'] },
  hinge: { key: 'hinge', compound: true, muscles: ['hamstrings', 'glutes'], prefer: ['romanian deadlift', 'barbell deadlift', 'hip thrust'], includes: ['deadlift', 'romanian', 'good morning', 'hip thrust'] },
  legCurl: { key: 'legCurl', compound: false, muscles: ['hamstrings'], prefer: ['lying leg curls', 'seated leg curl'], includes: ['leg curl', 'lying leg curl', 'seated leg curl'] },
  calf: { key: 'calf', compound: false, muscles: ['calves'], prefer: ['standing calf raises', 'seated calf raise'], includes: ['calf raise', 'calf press', 'calf'] },
  vertPull: { key: 'vertPull', compound: true, muscles: ['lats'], prefer: ['pullups', 'wide-grip lat pulldown', 'chin-up'], includes: ['pulldown', 'pull-up', 'pull up', 'pullup', 'chin up', 'chin-up'] },
  horizRow: { key: 'horizRow', compound: true, muscles: ['middleBack', 'lats'], prefer: ['bent over barbell row', 'seated cable rows', 'one-arm dumbbell row'], includes: ['row'], excludes: ['upright'] },
  abs: { key: 'abs', compound: false, muscles: ['abdominals'], prefer: ['hanging leg raise', 'cable crunch', 'plank'], includes: ['crunch', 'plank', 'leg raise', 'sit-up', 'situp', 'hanging'] },
};

/** Per-pattern coaching data (§3.3/§3.4/§3.7): tempo string, one-line cue, rest tier.
 *  Keyed by pattern key so each generated slot gets per-exercise values, not one
 *  hardcoded default. Tempos follow the blueprints (compounds controlled-eccentric +
 *  pause; isolations a touch faster with a squeeze). */
const COACHING: Record<string, { tempo: string; cue: string; tier: RestTier }> = {
  horizPress: { tempo: '3-1-1-0', cue: 'Tuck elbows ~45°; touch the chest, drive up.', tier: 'heavy' },
  inclPress: { tempo: '3-1-1-0', cue: 'Full stretch at the bottom, squeeze at the top.', tier: 'accessory' },
  vertPress: { tempo: '2-1-1-0', cue: 'Brace hard; press in a straight line past the forehead.', tier: 'heavy' },
  lateralRaise: { tempo: '2-1-1-0', cue: 'Lead with the elbows; pinky-high, no swing.', tier: 'pump' },
  rearDelt: { tempo: '2-1-1-0', cue: 'Elbows slightly bent; squeeze the rear delts, not the traps.', tier: 'pump' },
  tricep: { tempo: '2-1-1-0', cue: 'Pin the elbows; lock out hard and squeeze.', tier: 'isolation' },
  biceps: { tempo: '2-0-1-0', cue: 'No swing; control the negative, squeeze at the top.', tier: 'isolation' },
  squat: { tempo: '3-1-1-0', cue: 'Brace, sit between the hips, knees track over toes.', tier: 'heavy' },
  legPress: { tempo: '2-1-1-0', cue: 'Full ROM; don’t let the knees cave or the low back round.', tier: 'accessory' },
  legExt: { tempo: '2-1-1-0', cue: 'Pause and squeeze the quad at the top.', tier: 'isolation' },
  hinge: { tempo: '3-1-1-0', cue: 'Hips back, flat back, feel the hamstring stretch.', tier: 'heavy' },
  legCurl: { tempo: '2-1-1-0', cue: 'Squeeze the hamstrings; slow the negative.', tier: 'isolation' },
  calf: { tempo: '2-1-1-1', cue: 'Full stretch at the bottom, pause at the top.', tier: 'pump' },
  vertPull: { tempo: '2-1-1-0', cue: 'Drive the elbows down; lead with the lats, not the arms.', tier: 'compound' },
  horizRow: { tempo: '2-1-1-0', cue: 'Pull to the lower ribs; retract the shoulder blades.', tier: 'compound' },
  abs: { tempo: '2-1-2-0', cue: 'Move slowly; brace and exhale through the crunch.', tier: 'pump' },
};
const DEFAULT_COACHING = { tempo: '2-0-1-0', cue: 'Control the weight through a full range of motion.', tier: 'accessory' as RestTier };

/* Day archetypes — each an ordered Pattern[] the per-pattern fill consumes (repeating a
   pattern is fine: the `used` set makes the 2nd pick a different exercise for that pattern,
   so a doubled slot adds variety/volume for that muscle). Push/Pull/Legs/Upper/Lower/Full
   are the base set; Arms + the body-part days (Chest/Back/Shoulders) power pplArms /
   bodyPart splits and priority arm-specialization. */
const DAY_TEMPLATES: Record<string, Pattern[]> = {
  Push: [P.horizPress!, P.vertPress!, P.inclPress!, P.lateralRaise!, P.tricep!, P.rearDelt!],
  Pull: [P.vertPull!, P.horizRow!, P.hinge!, P.biceps!, P.rearDelt!, P.abs!],
  Legs: [P.squat!, P.hinge!, P.legPress!, P.legCurl!, P.calf!, P.legExt!],
  Upper: [P.horizPress!, P.vertPull!, P.vertPress!, P.horizRow!, P.biceps!, P.tricep!],
  Lower: [P.squat!, P.hinge!, P.legPress!, P.legCurl!, P.calf!, P.abs!],
  Full: [P.squat!, P.horizPress!, P.horizRow!, P.vertPress!, P.hinge!, P.abs!],
  Arms: [P.tricep!, P.biceps!, P.tricep!, P.biceps!, P.tricep!, P.biceps!],
  Chest: [P.horizPress!, P.inclPress!, P.horizPress!, P.inclPress!, P.lateralRaise!, P.tricep!],
  Back: [P.vertPull!, P.horizRow!, P.vertPull!, P.horizRow!, P.biceps!, P.rearDelt!],
  Shoulders: [P.vertPress!, P.lateralRaise!, P.rearDelt!, P.lateralRaise!, P.vertPress!, P.tricep!],
};

/* Representative pattern per priority muscle — inserted as an emphasis slot near the
   front of a day that already trains the muscle, so after the per-day cap it pushes out a
   tail accessory (priority "modulates within structure"; it never adds a day). */
const PRIORITY_PATTERN: Partial<Record<Muscle, Pattern>> = {
  chest: P.inclPress!, lats: P.vertPull!, middleBack: P.horizRow!, shoulders: P.lateralRaise!,
  biceps: P.biceps!, triceps: P.tricep!, quadriceps: P.legExt!, hamstrings: P.legCurl!,
  glutes: P.hinge!, calves: P.calf!, abdominals: P.abs!,
};

const alternate = (pair: string[], n: number): string[] =>
  Array.from({ length: n }, (_, i) => pair[i % pair.length]!);
const cycle = (seq: string[], n: number): string[] =>
  Array.from({ length: n }, (_, i) => seq[i % seq.length]!);

/** Honor an explicit split choice ONLY when it cleanly fits the day count; otherwise
 *  return null so the composer falls back to the auto split (the conflict rule —
 *  `days` is the hard constraint, `splitChoice` a preference). */
function fitChoice(choice: SplitChoice, days: number): string[] | null {
  switch (choice) {
    case 'fullBody': return Array.from({ length: days }, () => 'Full');
    case 'upperLower': return days === 4 || days === 6 ? alternate(['Upper', 'Lower'], days) : null;
    case 'pushPullLegs': return days === 3 || days === 6 ? cycle(['Push', 'Pull', 'Legs'], days) : null;
    case 'pplArms':
      if (days === 4) return ['Push', 'Pull', 'Legs', 'Arms'];
      if (days === 5) return ['Push', 'Pull', 'Legs', 'Arms', 'Upper'];
      return null;
    case 'bodyPart':
      if (days === 5) return ['Chest', 'Back', 'Shoulders', 'Legs', 'Arms'];
      if (days === 6) return ['Chest', 'Back', 'Shoulders', 'Legs', 'Arms', 'Upper'];
      return null;
    default: return null; // 'auto'
  }
}

/** The auto split by class + goal + days. Novices, strength, and general-fitness lean to
 *  full-body / upper-lower (high frequency, compounds recur); hypertrophy/recomp/fat-loss
 *  for trained lifters distribute volume via push/pull/legs. `days` is always honored. */
function autoSequence(goal: TrainingGoal, exp: Experience, days: number): string[] {
  const balanced = exp === 'Novice' || goal === 'Get stronger' || goal === 'General fitness';
  if (balanced) {
    switch (days) {
      case 3: return ['Full', 'Full', 'Full'];
      case 4: return ['Upper', 'Lower', 'Upper', 'Lower'];
      case 5: return ['Upper', 'Lower', 'Upper', 'Lower', 'Full'];
      default: return ['Upper', 'Lower', 'Upper', 'Lower', 'Upper', 'Lower']; // 6
    }
  }
  switch (days) { // hypertrophy / recomp / fat-loss, trained
    case 3: return ['Push', 'Pull', 'Legs'];
    case 4: return ['Upper', 'Lower', 'Upper', 'Lower'];
    case 5: return ['Push', 'Pull', 'Legs', 'Upper', 'Lower'];
    default: return ['Push', 'Pull', 'Legs', 'Push', 'Pull', 'Legs']; // 6
  }
}

/** Reallocate one secondary day to a dedicated Arms day when arm priority + day-budget
 *  warrant it (priority "earns a dedicated day only with budget"): trained lifter, ≥5
 *  days, arms flagged, and no Arms day already. Never adds a day — replaces one. */
function withArmsSpecialization(
  seq: string[], priority: readonly Muscle[], exp: Experience, days: number,
): string[] {
  const armPriority = priority.includes('biceps') || priority.includes('triceps');
  if (!armPriority || exp === 'Novice' || days < 5 || seq.includes('Arms')) return seq;
  // Reallocate the most redundant secondary day first (Upper/Full before a primary Pull),
  // and never the leading day — so we don't sacrifice a primary movement day.
  let idx = -1;
  for (const t of ['Upper', 'Full', 'Pull']) {
    idx = seq.findIndex((d, i) => i > 0 && d === t);
    if (idx >= 0) break;
  }
  if (idx < 0) return seq;
  const out = [...seq];
  out[idx] = 'Arms';
  return out;
}

/** Compose the week's day-type sequence from the goal-aware inputs. Deterministic:
 *  same inputs → same sequence (exercise-level variety/rotation is R4, not here).
 *  Exported for the split-matrix tests. */
export function splitSequence(
  goal: TrainingGoal, exp: Experience, days: number,
  splitChoice: SplitChoice, priority: readonly Muscle[],
): string[] {
  // fitChoice returns null for 'auto' (and for any choice that doesn't fit the days),
  // so the composer falls through to the auto split.
  const base = fitChoice(splitChoice, days) ?? autoSequence(goal, exp, days);
  return withArmsSpecialization(base, priority, exp, days);
}

/** Insert an emphasis slot for each priority muscle the day trains (after the first
 *  matching pattern), so the per-day cap keeps the priority work and drops a tail
 *  accessory. Days that don't train the muscle are untouched (no spurious slots). */
function priorityEmphasis(base: Pattern[], priority: readonly Muscle[]): Pattern[] {
  if (priority.length === 0) return base;
  const out = [...base];
  for (const m of priority) {
    const pat = PRIORITY_PATTERN[m];
    if (!pat) continue;
    const idx = out.findIndex((p) => p.muscles.includes(m));
    if (idx >= 0) out.splice(idx + 1, 0, pat);
  }
  return out;
}

/** Suffix repeated day-types: Push, Push -> Push A, Push B. */
function labelDays(types: string[]): string[] {
  const counts = new Map<string, number>();
  for (const t of types) counts.set(t, (counts.get(t) ?? 0) + 1);
  const seen = new Map<string, number>();
  return types.map((t) => {
    if ((counts.get(t) ?? 0) < 2) return t;
    const n = (seen.get(t) ?? 0) + 1;
    seen.set(t, n);
    return `${t} ${String.fromCharCode(64 + n)}`;
  });
}

function exercisesPerDay(exp: Experience): number {
  if (exp === 'Novice') return 4;
  if (exp === 'Advanced') return 6;
  return 5;
}

/**
 * Rank a candidate for a pattern; higher is better, -1 = ineligible. Goal-aware:
 * a strength goal rewards barbell compounds (the trainable main lifts); hypertrophy /
 * recomp / fat-loss reward machine/cable/dumbbell variety on isolation. The curated
 * `prefer` list gets a strong bonus so vetted lifts win over generic name matches.
 */
function score(ex: GenExercise, pat: Pattern, pool: ReadonlySet<string>, strength: boolean): number {
  const equip = ex.equipment ?? 'undefined';
  if (!pool.has(equip)) return -1;
  const n = ex.nameNorm;
  if (pat.excludes?.some((x) => n.includes(x))) return -1;
  const nameHit = pat.includes.some((k) => n.includes(k.replace(/-/g, ' ')) || n.includes(k));
  const muscleHit = ex.primaryMuscles.some((m) => pat.muscles.includes(m));
  if (!nameHit && !muscleHit) return -1;

  let s = 0;
  if (nameHit) s += 4;
  if (muscleHit) s += 2;
  // Curated-pool bonus: exact-ish match to a vetted lift for this pattern.
  if (pat.prefer?.some((k) => n.includes(k))) s += 6;
  if (pat.compound && ex.mechanic === 'compound') s += 2;
  if (!pat.compound && ex.mechanic === 'isolation') s += 1;
  // Goal emphasis (the §2.3 differentiation): strength favors barbell compounds;
  // hypertrophy/fat-loss favor machine/cable/dumbbell isolation variety.
  if (strength) {
    if (pat.compound && equip === 'barbell') s += 3;
  } else {
    if (pat.compound && (equip === 'barbell' || equip === 'dumbbell')) s += 2;
    if (!pat.compound && (equip === 'machine' || equip === 'cable' || equip === 'dumbbell')) s += 2;
  }
  return s;
}

/**
 * Profile-scaled starting weight (lb). A light seed (spec §6.6) — the flat
 * equipment baseline scaled by bodyweight × sex × experience, so a heavier advanced
 * lifter seeds higher than a lighter novice. Week-1 calibration is the real source of
 * truth; this only prefills plausible numbers. (A bodyweight-relative strength-standards
 * TABLE is a later refinement.) Engine rounds to loadable plates at prescription time.
 */
function seedWeight(ex: GenExercise, compound: boolean, profile: GenProfile, exp: Experience): number {
  if (ex.isBodyweight || ex.equipment === 'bodyweight') return 0;
  let base: number;
  if (ex.equipment === 'barbell') base = compound ? 95 : 45;
  else if (ex.equipment === 'dumbbell' || ex.equipment === 'kettlebell') base = compound ? 30 : 15;
  else base = compound ? 50 : 25;

  const bwFactor = profile.bodyweightLb ? clamp(profile.bodyweightLb / 170, 0.6, 1.6) : 1;
  const sexFactor = profile.sex === 'female' ? 0.65 : 1;
  const expFactor = exp === 'Novice' ? 0.85 : exp === 'Advanced' ? 1.2 : 1;
  return Math.round(base * bwFactor * sexFactor * expFactor);
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/* ── R3 · VOLUME ALLOCATOR ─────────────────────────────────────────────────────
   Per-muscle weekly set targets from the `mesocycle.ts` landmark data (previously
   decorative), distributed across the days that train each muscle — replaces the old
   `.slice(0, perDay)` tail-drop + flat `sets:3`. Two passes: compounds first (the
   structural movers + their synergist credit), then a top-up to each muscle's target.

   The MEV floor is HARD — every trained muscle gets ≥ its MEV, so core/abs (and any
   tail accessory) can never be sliced to zero again (the R2 must-fix). The per-session
   quality cap is SOFT — it yields to the MEV floor when a muscle's frequency is too low
   to fit MEV under the cap (e.g. chest on a 3-day PPL, freq 1). Consequence: priority
   bias is frequency-limited (it never crams surplus into one session).

   Counting method switches by goal (research §1/C2): hypertrophy counts fractionally
   (synergist set = 0.5) against a 12–20 priority band; strength counts direct-only
   (indirect = 0) against a much lower per-movement floor.

   NOTE (Option 1 / R3.5): this is the STATIC per-muscle allocation. The within-block
   volume RAMP is paused between R3 and R3.5 — `periodize()` no longer scales set count
   uniformly (see repositories.ts). R3.5 restores it per-muscle via the already-present
   `weeklyVolumeTarget(m, plan, week)`. Phases / RPE / load-progression are unaffected. */

/** Synergist credit for fractional counting. A pattern's primary (`muscles[0]`) always
 *  counts 1.0; its secondary movers (`muscles[1..]`) count 0.5; these are the *indirect*
 *  synergists a set also trains that the flat `muscles` list omits (bench → triceps +
 *  front delt). Strength (direct) counting drops all of it. */
const SYNERGIST: Partial<Record<string, Partial<Record<Muscle, number>>>> = {
  horizPress: { triceps: 0.5, shoulders: 0.5 },
  inclPress: { triceps: 0.5, shoulders: 0.5 },
  vertPress: { triceps: 0.5 },
  vertPull: { biceps: 0.5 },
  horizRow: { biceps: 0.5 },
  squat: { glutes: 0.5 },
  legPress: { glutes: 0.5 },
  hinge: { lowerBack: 0.5 },
};

/** Muscles a single set of `pat` credits, with fractions. Direct (strength) → primary
 *  only. Fractional (hypertrophy) → primary 1.0 + secondary movers 0.5 + synergists. */
function patternCredit(pat: Pattern, direct: boolean): Array<[Muscle, number]> {
  const out: Array<[Muscle, number]> = [[pat.muscles[0]!, 1]];
  if (!direct) {
    for (const m of pat.muscles.slice(1)) out.push([m, 0.5]);
    const syn = SYNERGIST[pat.key];
    if (syn) for (const k of Object.keys(syn) as Muscle[]) out.push([k, syn[k]!]);
  }
  return out;
}

/** Isolation-dominant muscles — the female between-SET volume tolerance applies here
 *  only (research C4: more submax/accessory volume, shorter rest; NOT a blanket weekly
 *  increase, and between-session recovery stays sex-neutral). [Mixed] evidence. */
const ACCESSORY = new Set<Muscle>(['biceps', 'triceps', 'shoulders', 'calves', 'abdominals', 'forearms']);

interface AllocOpts {
  priority: ReadonlySet<Muscle>;
  goal: TrainingGoal;
  /** strength → direct counting + the lower per-movement floor. */
  strength: boolean;
  ageYears?: number;
  female: boolean;
}

/** Per-muscle weekly *effective*-set target. Non-priority sits at MEV (the hard floor —
 *  the must-fix: every trained muscle ≥ MEV, abs ≈ 6 never 0); priority biases up toward
 *  MAV (this is where priority finally protects VOLUME, not just structure). Goal / age /
 *  sex modifiers per the research (Part 1 / 1C). */
function weeklyTarget(m: Muscle, o: AllocOpts): number {
  const { mev, mav, mrv } = landmarksFor(m);
  if (o.strength) {
    // Strength: direct counting, a low per-movement FLOOR (~3–6 hard sets/movement,
    // research C2) — far below hypertrophy's 12–20, heaviness lives in the rule. Heavy
    // compounds will push the big movers above this via overshoot; that's expected.
    return o.priority.has(m) ? 8 : 6;
  }
  let base = o.priority.has(m) ? mav : mev;
  if (o.goal === 'Lose fat') base = mev; // maintenance volume in a deficit (cardio carries the deficit, S7)
  else if (o.goal === 'General fitness') base = Math.round(mev + 0.25 * (mav - mev)); // balanced moderate
  if (o.female && ACCESSORY.has(m)) base = Math.min(base + 2, mrv); // C4 between-set tolerance (accessory only)
  if (o.ageYears !== undefined && o.ageYears >= 50) base = Math.min(base, 12); // C3 older cap (intensity untouched)
  return clamp(base, mev, mrv);
}

interface AllocSlot {
  pat: Pattern;
  sets: number;
}

const BASE_COMPOUND_SETS = 3;
const MAX_SETS_PER_SLOT = 5;

/**
 * Allocate per-muscle weekly volume across the week's days. Returns, per day, an ordered
 * list of (pattern, sets) the exercise-selection loop then fills — and the resulting
 * per-muscle weekly *effective*-set map (for the bands proof). Deterministic.
 */
function allocateVolume(
  dayPatterns: Pattern[][],
  slotBudget: number,
  o: AllocOpts,
): { perDay: AllocSlot[][]; weeklyByMuscle: Map<Muscle, number> } {
  const direct = o.strength;
  const softCap = o.strength ? 6 : 8; // quality sets/muscle/session (research §4)
  const weekly = new Map<Muscle, number>();
  const add = (m: Muscle, n: number) => weekly.set(m, (weekly.get(m) ?? 0) + n);
  const perDay: AllocSlot[][] = dayPatterns.map(() => []);

  // freq(M) = days whose archetype has M as a *primary* (muscles[0]) — its home days.
  const homeDays = new Map<Muscle, number[]>();
  dayPatterns.forEach((pats, di) => {
    const seen = new Set<Muscle>();
    for (const p of pats) {
      const m = p.muscles[0]!;
      if (!seen.has(m)) { seen.add(m); (homeDays.get(m) ?? homeDays.set(m, []).get(m)!).push(di); }
    }
  });

  // ── PASS 1 — compounds: the structural movers, archetype order, capped to a compound
  // budget per day (~60% of the slot budget). Tally direct + synergist credit.
  const compoundBudget = Math.max(2, Math.round(slotBudget * 0.6));
  dayPatterns.forEach((pats, di) => {
    let placed = 0;
    for (const pat of pats) {
      if (placed >= compoundBudget) break;
      if (!pat.compound) continue;
      perDay[di]!.push({ pat, sets: BASE_COMPOUND_SETS });
      for (const [m, c] of patternCredit(pat, direct)) add(m, c * BASE_COMPOUND_SETS);
      placed++;
    }
  });

  // ── PASS 2 — top-up: bring each muscle to its weekly target, distributing the deficit
  // EVENLY across that muscle's home days (round-robin), so volume isn't piled onto one
  // session. Processed priority-first, then big compound muscles before small accessories
  // (so arms/delts benefit from the compounds' synergist credit and need less direct work).
  // The MEV floor overrides the soft cap AND the slot budget (the abs / tail-accessory
  // fix); the soft cap caps surplus once MEV is met (priority is frequency-limited).
  const ORDER: Muscle[] = [
    'chest', 'lats', 'middleBack', 'quadriceps', 'hamstrings', 'glutes', 'shoulders',
    'traps', 'biceps', 'triceps', 'forearms', 'calves', 'abdominals', 'lowerBack',
  ];
  const rank = (m: Muscle) => { const i = ORDER.indexOf(m); return i < 0 ? 99 : i; };
  const muscles = [...homeDays.keys()].sort((a, b) =>
    (o.priority.has(a) ? 0 : 1) - (o.priority.has(b) ? 0 : 1) || rank(a) - rank(b) || a.localeCompare(b),
  );

  for (const m of muscles) {
    const tgt = weeklyTarget(m, o);
    const { mev } = landmarksFor(m);
    const days = homeDays.get(m)!;
    let deficit = tgt - (weekly.get(m) ?? 0);
    // Chunk the deficit into the FEWEST full slots (≤ MAX_SETS_PER_SLOT each) rather than a
    // thin smear across every home day — avoids 1-set fragments and lets frequency derive
    // from volume (a muscle needing > a slot's worth doubles up; a small one trains fewer days).
    const slotsNeeded = Math.max(1, Math.ceil(deficit / MAX_SETS_PER_SLOT));
    const perSession = Math.ceil(deficit / slotsNeeded);
    const sessionSets = (di: number) =>
      perDay[di]!.filter((s) => s.pat.muscles[0] === m).reduce((a, s) => a + s.sets, 0);
    while (deficit > 0.5) {
      const belowMev = (weekly.get(m) ?? 0) < mev;
      // Place on the LEAST-LOADED eligible home day (balances total slots across the week
      // instead of piling onto day 0). MEV-forced placement ignores the cap + budget; once
      // MEV is met the cap/budget gate surplus (priority bias is frequency-limited).
      let day = -1;
      let bestLoad = Infinity;
      for (const d of days) {
        const eligible = belowMev || (perDay[d]!.length < slotBudget && sessionSets(d) < softCap);
        if (eligible && perDay[d]!.length < bestLoad) { bestLoad = perDay[d]!.length; day = d; }
      }
      if (day < 0) break; // no room left → surplus is frequency-limited
      // 2nd+ slot for a muscle in a session → prefer an isolation pattern (doubling with
      // variety); the selection loop picks a distinct exercise. A small trailing remainder
      // folds into an existing slot rather than spawning a 1-set fragment.
      const existing = perDay[day]!.find((s) => s.pat.muscles[0] === m && s.sets < MAX_SETS_PER_SLOT);
      const want = Math.min(perSession, Math.round(deficit), MAX_SETS_PER_SLOT);
      if (existing && want <= 2) {
        const bump = Math.min(want, MAX_SETS_PER_SLOT - existing.sets);
        existing.sets += bump;
        for (const [mm, c] of patternCredit(existing.pat, direct)) add(mm, c * bump);
      } else {
        const pats = dayPatterns[day]!.filter((p) => p.muscles[0] === m);
        const pat = (sessionSets(day) > 0 ? pats.find((p) => !p.compound) : undefined) ?? pats[0]!;
        const sets = Math.max(1, want);
        perDay[day]!.push({ pat, sets });
        for (const [mm, c] of patternCredit(pat, direct)) add(mm, c * sets);
      }
      deficit = tgt - (weekly.get(m) ?? 0);
    }
  }

  // Report only the ALLOCATED (primary-home) muscles — those R3 directly targets + floors
  // ≥ MEV. Synergist-only ride-alongs (a muscle with no primary pattern in this split, e.g.
  // arms on a minimalist novice full-body, or muscles never anyone's primary like glutes /
  // lower-back) accrue fractional credit but aren't allocated here; they ride on the
  // compounds, and giving them a direct home is an R2-archetype / R4-selection concern.
  const out = new Map<Muscle, number>();
  for (const m of homeDays.keys()) out.set(m, weekly.get(m) ?? 0);
  return { perDay, weeklyByMuscle: out };
}

/** The muscles (with fractions) a single set of pattern `patternKey` credits under the
 *  goal's counting mode — `direct` (strength) counts the primary only; fractional
 *  (hypertrophy) adds synergists at 0.5. Exported for the counting-switch proof. */
export function creditFor(patternKey: string, direct: boolean): Array<[Muscle, number]> {
  const p = P[patternKey];
  return p ? patternCredit(p, direct) : [];
}

export function generatePlan(
  catalog: GenExercise[],
  profile: GenProfile,
  preferences: GenPreferences,
): GeneratorResult {
  const { goal } = profile;
  const { days, equipment, experience } = preferences;
  const rest = preferences.rest ?? DEFAULT_REST;
  const pool = EQUIPMENT_POOL[equipment];
  const strength = goal === 'Get stronger';
  const fatLoss = goal === 'Lose fat';
  const perDay = exercisesPerDay(experience);
  // GZCLP is the spec's get-stronger + novice template (§6.6); it's TM-free so it
  // wires now. get-stronger + intermediate/advanced -> 5/3/1, which needs a Training
  // Max surface and is deferred to S10 (the 5/3/1 TM card); those fall back to linear.
  const useGzclp = strength && experience === 'Novice';

  // Rep-range/volume schemes adapt to goal (linear for strength, double for hypertrophy).
  const compoundRule: ProgressionRule = strength
    ? { kind: 'linear', incrementLb: 2.5, failsBeforeDeload: 3, deloadPct: 0.1 }
    : { kind: 'double', repMin: fatLoss ? 8 : 6, repMax: fatLoss ? 12 : 10, incrementLb: 2.5, perSet: false };
  const isoRule: ProgressionRule = {
    kind: 'double',
    repMin: fatLoss ? 12 : 10,
    repMax: fatLoss ? 15 : 14,
    incrementLb: 1.25,
    perSet: false,
  };
  const compoundScheme = strength
    ? { sets: 3, repTarget: 5 }
    : { sets: 3, repRange: [fatLoss ? 8 : 6, fatLoss ? 12 : 10] as [number, number] };
  const isoScheme = { sets: 3, repRange: [fatLoss ? 12 : 10, fatLoss ? 15 : 14] as [number, number] };

  // GZCLP per-slot tier schemes (the engine derives reps from the rule; these drive
  // the preview to match stage 0).
  const gzScheme = (tier: 1 | 2 | 3) =>
    tier === 1 ? { sets: 5, repTarget: 3 } : tier === 2 ? { sets: 3, repTarget: 10 } : { sets: 3, repTarget: 15 };

  // Goal/training-age-aware split designer (R2): composes the week's day structure from
  // the persisted preference inputs, then biases it toward the priority muscles.
  const baseTypes = splitSequence(
    goal, experience, days,
    preferences.splitChoice ?? 'auto',
    preferences.priorityMuscles ?? [],
  );
  const types = labelDays(baseTypes);

  // Each day's candidate patterns (priorityEmphasis, UNSLICED) — the R3 allocator, not a
  // flat `.slice(0, perDay)`, now decides which patterns become slots and with how many
  // sets, so the day's tail (abs / calves / rear-delt) can't be positionally dropped.
  const dayPatterns: Pattern[][] = baseTypes.map((t) =>
    priorityEmphasis(DAY_TEMPLATES[t] ?? DAY_TEMPLATES.Full!, preferences.priorityMuscles ?? []),
  );

  let alloc: AllocSlot[][];
  let weeklyByMuscle: Map<Muscle, number>;
  if (useGzclp) {
    // GZCLP carries its own tier-based set/rep structure (the volume model IS the stage
    // machine), so it keeps the legacy per-day-budget fill; per-muscle MEV-set targeting
    // is a hypertrophy concept and doesn't apply. (GZCLP = get-stronger + novice only.)
    alloc = dayPatterns.map((pats) => pats.slice(0, perDay).map((pat) => ({ pat, sets: 0 })));
    weeklyByMuscle = new Map();
  } else {
    const a = allocateVolume(dayPatterns, perDay, {
      priority: new Set(preferences.priorityMuscles ?? []),
      goal,
      strength,
      ageYears: profile.ageYears,
      female: profile.sex === 'female',
    });
    alloc = a.perDay;
    weeklyByMuscle = a.weeklyByMuscle;
  }

  const used = new Set<string>();
  const trainedMuscles = new Set<Muscle>();
  const planDays: GeneratedDay[] = [];

  for (let di = 0; di < types.length; di++) {
    const slots: GeneratedSlot[] = [];
    let dayCompoundCount = 0; // GZCLP: first compound -> T1, rest -> T2

    for (const { pat, sets: allocSets } of alloc[di]!) {
      let best: GenExercise | null = null;
      let bestScore = 0;
      let bestUsedFallback: GenExercise | null = null;
      let bestUsedScore = 0;
      for (const ex of catalog) {
        const sc = score(ex, pat, pool, strength);
        if (sc < 0) continue;
        if (used.has(ex.id)) {
          if (sc > bestUsedScore) { bestUsedScore = sc; bestUsedFallback = ex; }
          continue;
        }
        if (sc > bestScore) { bestScore = sc; best = ex; }
      }
      const chosen = best ?? bestUsedFallback;
      if (!chosen) continue;
      used.add(chosen.id);
      for (const m of chosen.primaryMuscles) trainedMuscles.add(m);

      let rule: ProgressionRule;
      let scheme: GeneratedSlot['scheme'];
      if (useGzclp) {
        const tier: 1 | 2 | 3 = !pat.compound ? 3 : dayCompoundCount === 0 ? 1 : 2;
        if (pat.compound) dayCompoundCount += 1;
        rule = { kind: 'gzclp', tier };
        scheme = gzScheme(tier);
      } else {
        rule = pat.compound ? compoundRule : isoRule;
        // R3: the per-slot set count is the allocated volume, not flat 3.
        scheme = { ...(pat.compound ? compoundScheme : isoScheme), sets: allocSets };
      }

      const coaching = COACHING[pat.key] ?? DEFAULT_COACHING;
      slots.push({
        exerciseId: chosen.id,
        exerciseName: chosen.name,
        compound: pat.compound,
        rule,
        scheme,
        rest: pat.compound
          ? { warmupSec: 60, workSec: rest.compoundSec }
          : { warmupSec: 45, workSec: rest.isolationSec },
        startWeightLb: seedWeight(chosen, pat.compound, profile, experience),
        tempo: coaching.tempo,
        coachingCue: coaching.cue,
        restTier: coaching.tier,
      });
    }
    planDays.push({ name: types[di]!, slots });
  }

  const goalShort =
    goal === 'Get stronger' ? 'Strength'
    : goal === 'Lose fat' ? 'Cut'
    : goal === 'Recomposition' ? 'Recomp'
    : goal === 'General fitness' ? 'Fitness'
    : 'Hypertrophy';

  // Block mesocycle (§2.2) — sized to the goal timeframe (default 6 wk). GZCLP is
  // self-periodizing (its own stage machine), so those programs carry no mesocycle.
  let mesocycle: GeneratedMesocycle | null = null;
  if (!useGzclp) {
    const plan = buildMesocyclePlan(profile.goalTimeframeWeeks ?? 6);
    const volumeTargets: Partial<Record<Muscle, VolumeLandmarks>> = {};
    for (const m of trainedMuscles) volumeTargets[m] = landmarksFor(m);
    mesocycle = {
      phase: plan.weeks[0]!,
      weekIndex: 0,
      totalWeeks: plan.totalWeeks,
      volumeTargets,
    };
  }

  const weeklyVolumeByMuscle: Partial<Record<Muscle, number>> = {};
  for (const [m, n] of weeklyByMuscle) weeklyVolumeByMuscle[m] = Math.round(n * 10) / 10;

  return {
    program: { name: `${goalShort} · ${days}d`, days: planDays },
    mesocycle,
    weeklyVolumeByMuscle,
    // Scaffolds — shape only this session (filled by later waves).
    cardioProtocol: { weeklyMinutesTarget: 0, dailyStepTarget: 0, sessions: [] },
    goals: [],
    calibrationWeek: {
      isCalibrationWeek: true,
      topSetRepRange: [8, 10],
      note: 'Week 1 is calibration: ramp to a controlled top set of 8–10 reps on each main lift to set your working weights.',
    },
  };
}

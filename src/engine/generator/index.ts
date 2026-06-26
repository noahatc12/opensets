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
  | 'Get stronger';
export type EquipmentProfile = 'Full gym' | 'Home rack' | 'Minimal';
export type Experience = 'Novice' | 'Intermediate' | 'Advanced';
export type Sex = 'male' | 'female';

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
}

export interface GeneratedSlot {
  exerciseId: string;
  exerciseName: string;
  compound: boolean;
  rule: ProgressionRule;
  scheme: { sets: number; repTarget?: number; repRange?: [number, number] };
  rest: { warmupSec: number; workSec: number };
  startWeightLb: number;
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

const DAY_TEMPLATES: Record<string, Pattern[]> = {
  Push: [P.horizPress!, P.vertPress!, P.inclPress!, P.lateralRaise!, P.tricep!, P.rearDelt!],
  Pull: [P.vertPull!, P.horizRow!, P.hinge!, P.biceps!, P.rearDelt!, P.abs!],
  Legs: [P.squat!, P.hinge!, P.legPress!, P.legCurl!, P.calf!, P.legExt!],
  Upper: [P.horizPress!, P.vertPull!, P.vertPress!, P.horizRow!, P.biceps!, P.tricep!],
  Lower: [P.squat!, P.hinge!, P.legPress!, P.legCurl!, P.calf!, P.abs!],
  Full: [P.squat!, P.horizPress!, P.horizRow!, P.vertPress!, P.hinge!, P.abs!],
};

function splitForDays(days: number): string[] {
  switch (days) {
    case 3: return ['Push', 'Pull', 'Legs'];
    case 4: return ['Upper', 'Lower', 'Upper', 'Lower'];
    case 5: return ['Push', 'Pull', 'Legs', 'Upper', 'Lower'];
    case 6: return ['Push', 'Pull', 'Legs', 'Push', 'Pull', 'Legs'];
    default: return ['Full', 'Full', 'Full'];
  }
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

  const types = labelDays(splitForDays(days));
  const baseTypes = splitForDays(days);
  const used = new Set<string>();
  const trainedMuscles = new Set<Muscle>();
  const planDays: GeneratedDay[] = [];

  for (let di = 0; di < types.length; di++) {
    const patterns = (DAY_TEMPLATES[baseTypes[di]!] ?? DAY_TEMPLATES.Full!).slice(0, perDay);
    const slots: GeneratedSlot[] = [];
    let dayCompoundCount = 0; // GZCLP: first compound -> T1, rest -> T2

    for (const pat of patterns) {
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
        scheme = pat.compound ? compoundScheme : isoScheme;
      }

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
      });
    }
    planDays.push({ name: types[di]!, slots });
  }

  const goalShort =
    goal === 'Get stronger' ? 'Strength'
    : goal === 'Lose fat' ? 'Cut'
    : goal === 'Recomposition' ? 'Recomp'
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

  return {
    program: { name: `${goalShort} · ${days}d`, days: planDays },
    mesocycle,
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

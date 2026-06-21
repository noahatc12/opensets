/**
 * Starter-plan generator (spec §6.6). Turns the onboarding answers
 * (goal / days / equipment / experience) into a real multi-day program with
 * exercises chosen from the bundled catalog — so the plan actually changes with
 * the inputs instead of always returning the same five barbell lifts.
 *
 * Pure module: given the catalog array + params it returns a plan spec. No
 * Dexie / React / IO here; OnboardingScreen persists the result.
 */
import type { Exercise, Muscle } from '../../db/types';
import type { ProgressionRule } from '../../engine/types';

export type Goal = 'Build muscle' | 'Lose fat' | 'Recomposition' | 'Get stronger';
export type Equipment = 'Full gym' | 'Home rack' | 'Minimal';
export type Experience = 'Novice' | 'Intermediate' | 'Advanced';

export interface PlanParams {
  goal: Goal;
  days: number;
  equipment: Equipment;
  experience: Experience;
  /** Per-type rest defaults (seconds) from user settings. Compound slots use
   *  `compoundSec`, everything else `isolationSec`. Omitted → built-in defaults
   *  so the generator stays pure for tests. */
  rest?: { compoundSec: number; isolationSec: number };
}

/** Built-in rest fallbacks, used when no settings-derived rest is supplied. */
const DEFAULT_REST = { compoundSec: 180, isolationSec: 90 } as const;

export interface PlanSlotSpec {
  exerciseId: string;
  exerciseName: string;
  compound: boolean;
  rule: ProgressionRule;
  scheme: { sets: number; repTarget?: number; repRange?: [number, number] };
  rest: { warmupSec: number; workSec: number };
  startWeightLb: number;
}

export interface PlanDay {
  name: string;
  slots: PlanSlotSpec[];
}

export interface GeneratedPlan {
  programName: string;
  days: PlanDay[];
}

/** Which equipment is usable per gym profile. */
const EQUIPMENT_POOL: Record<Equipment, ReadonlySet<string>> = {
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
}

/* The movement patterns a day can ask for. The resolver fills each from the
   allowed equipment pool, preferring a real keyword + muscle match. */
const P: Record<string, Pattern> = {
  horizPress: { key: 'horizPress', compound: true, muscles: ['chest'], includes: ['bench press', 'push-up', 'push up', 'chest press', 'dip', 'chest dip'] },
  inclPress: { key: 'inclPress', compound: true, muscles: ['chest'], includes: ['incline'] },
  vertPress: { key: 'vertPress', compound: true, muscles: ['shoulders'], includes: ['overhead press', 'shoulder press', 'military', 'push press', 'arnold'] },
  lateralRaise: { key: 'lateralRaise', compound: false, muscles: ['shoulders'], includes: ['lateral raise', 'side lateral', 'side raise'] },
  rearDelt: { key: 'rearDelt', compound: false, muscles: ['shoulders'], includes: ['rear delt', 'reverse fly', 'face pull', 'rear lateral'] },
  tricep: { key: 'tricep', compound: false, muscles: ['triceps'], includes: ['pushdown', 'triceps extension', 'skullcrusher', 'kickback', 'triceps'] },
  biceps: { key: 'biceps', compound: false, muscles: ['biceps'], includes: ['curl'], excludes: ['leg curl', 'wrist'] },
  squat: { key: 'squat', compound: true, muscles: ['quadriceps'], includes: ['squat'], excludes: ['sissy', 'jump'] },
  legPress: { key: 'legPress', compound: true, muscles: ['quadriceps'], includes: ['leg press', 'lunge', 'split squat', 'hack squat', 'bulgarian'] },
  legExt: { key: 'legExt', compound: false, muscles: ['quadriceps'], includes: ['leg extension'] },
  hinge: { key: 'hinge', compound: true, muscles: ['hamstrings', 'glutes'], includes: ['deadlift', 'romanian', 'good morning', 'hip thrust'] },
  legCurl: { key: 'legCurl', compound: false, muscles: ['hamstrings'], includes: ['leg curl', 'lying leg curl', 'seated leg curl'] },
  calf: { key: 'calf', compound: false, muscles: ['calves'], includes: ['calf raise', 'calf press', 'calf'] },
  vertPull: { key: 'vertPull', compound: true, muscles: ['lats'], includes: ['pulldown', 'pull-up', 'pull up', 'pullup', 'chin up', 'chin-up'] },
  horizRow: { key: 'horizRow', compound: true, muscles: ['middleBack', 'lats'], includes: ['row'], excludes: ['upright'] },
  abs: { key: 'abs', compound: false, muscles: ['abdominals'], includes: ['crunch', 'plank', 'leg raise', 'sit-up', 'situp', 'hanging'] },
};

const DAY_TEMPLATES: Record<string, Pattern[]> = {
  Push: [P.horizPress!, P.vertPress!, P.inclPress!, P.lateralRaise!, P.tricep!, P.rearDelt!],
  Pull: [P.vertPull!, P.horizRow!, P.hinge!, P.biceps!, P.rearDelt!, P.abs!],
  Legs: [P.squat!, P.hinge!, P.legPress!, P.legCurl!, P.calf!, P.legExt!],
  Upper: [P.horizPress!, P.vertPull!, P.vertPress!, P.horizRow!, P.biceps!, P.tricep!],
  Lower: [P.squat!, P.hinge!, P.legPress!, P.legCurl!, P.calf!, P.abs!],
  Full: [P.squat!, P.horizPress!, P.horizRow!, P.vertPress!, P.hinge!, P.abs!],
};

/** Day split per training frequency. Duplicate day-types get A/B suffixes; the
    resolver hands different exercises to the second pass, so A ≠ B. */
function splitForDays(days: number): string[] {
  switch (days) {
    case 3:
      return ['Push', 'Pull', 'Legs'];
    case 4:
      return ['Upper', 'Lower', 'Upper', 'Lower'];
    case 5:
      return ['Push', 'Pull', 'Legs', 'Upper', 'Lower'];
    case 6:
      return ['Push', 'Pull', 'Legs', 'Push', 'Pull', 'Legs'];
    default:
      return ['Full', 'Full', 'Full'];
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
    return `${t} ${String.fromCharCode(64 + n)}`; // A, B, …
  });
}

function exercisesPerDay(exp: Experience): number {
  if (exp === 'Novice') return 4;
  if (exp === 'Advanced') return 6;
  return 5;
}

/** Rank a candidate for a pattern; higher is better. -1 = ineligible. */
function score(ex: Exercise, pat: Pattern, pool: ReadonlySet<string>): number {
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
  if (pat.compound && ex.mechanic === 'compound') s += 2;
  if (!pat.compound && ex.mechanic === 'isolation') s += 1;
  // Prefer canonical free-weight lifts for compounds, machines/cables for isolation.
  if (pat.compound && (equip === 'barbell' || equip === 'dumbbell')) s += 2;
  if (!pat.compound && (equip === 'machine' || equip === 'cable' || equip === 'dumbbell')) s += 1;
  return s;
}

// Conservative starting working weights in lb (canonical). Week-1 calibration is
// the real source of truth; these only prefill plausible numbers.
function startWeight(ex: Exercise, compound: boolean): number {
  if (ex.isBodyweight || ex.equipment === 'bodyweight') return 0;
  if (ex.equipment === 'barbell') return compound ? 95 : 45;
  if (ex.equipment === 'dumbbell' || ex.equipment === 'kettlebell') return compound ? 30 : 15;
  return compound ? 50 : 25;
}

export function generatePlan(catalog: Exercise[], params: PlanParams): GeneratedPlan {
  const { goal, days, equipment, experience } = params;
  const rest = params.rest ?? DEFAULT_REST;
  const pool = EQUIPMENT_POOL[equipment];
  const strength = goal === 'Get stronger' || experience === 'Novice';
  const fatLoss = goal === 'Lose fat';
  const perDay = exercisesPerDay(experience);

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
    : { sets: 3, repRange: [compoundRule.kind === 'double' ? compoundRule.repMin : 6, compoundRule.kind === 'double' ? compoundRule.repMax : 10] as [number, number] };
  const isoScheme = {
    sets: 3,
    repRange: [fatLoss ? 12 : 10, fatLoss ? 15 : 14] as [number, number],
  };

  const types = labelDays(splitForDays(days));
  const baseTypes = splitForDays(days);
  const used = new Set<string>();
  const planDays: PlanDay[] = [];

  for (let di = 0; di < types.length; di++) {
    const patterns = (DAY_TEMPLATES[baseTypes[di]!] ?? DAY_TEMPLATES.Full!).slice(0, perDay);
    const slots: PlanSlotSpec[] = [];
    for (const pat of patterns) {
      // Best unused candidate for this pattern; allow reuse only if nothing else fits.
      let best: Exercise | null = null;
      let bestScore = 0;
      let bestUsedFallback: Exercise | null = null;
      let bestUsedScore = 0;
      for (const ex of catalog) {
        const s = score(ex, pat, pool);
        if (s < 0) continue;
        if (used.has(ex.id)) {
          if (s > bestUsedScore) {
            bestUsedScore = s;
            bestUsedFallback = ex;
          }
          continue;
        }
        if (s > bestScore) {
          bestScore = s;
          best = ex;
        }
      }
      const chosen = best ?? bestUsedFallback;
      if (!chosen) continue;
      used.add(chosen.id);
      slots.push({
        exerciseId: chosen.id,
        exerciseName: chosen.name,
        compound: pat.compound,
        rule: pat.compound ? compoundRule : isoRule,
        scheme: pat.compound ? compoundScheme : isoScheme,
        rest: pat.compound
          ? { warmupSec: 60, workSec: rest.compoundSec }
          : { warmupSec: 45, workSec: rest.isolationSec },
        startWeightLb: startWeight(chosen, pat.compound),
      });
    }
    planDays.push({ name: types[di]!, slots });
  }

  const goalShort = goal === 'Get stronger' ? 'Strength' : goal === 'Lose fat' ? 'Cut' : goal === 'Recomposition' ? 'Recomp' : 'Hypertrophy';
  return { programName: `${goalShort} · ${days}d`, days: planDays };
}

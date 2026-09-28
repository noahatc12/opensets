/**
 * Body-aware suggestions (feature, 2026-09-24). Pure: every input is passed in.
 *
 * STARTING WEIGHTS. A cautious first working weight per movement, from bodyweight,
 * sex, training age and age. Field practice, not a lookup of anyone's standards
 * table: Fitbod seeds conservatively from similar users and adapts from logs; RP
 * has the lifter find the load in a warm-up ramp. Here the seed is a starting
 * point and the first logged session replaces it (the engine progresses from the
 * logged weight). Undershooting costs one easy session; overshooting risks a failed
 * or unsafe set, so every choice below errs light.
 *   - Ratios are the working load (about 10 reps with 2 to 3 in reserve, roughly
 *     60% of an untrained 1RM) as a fraction of bodyweight for an untrained man.
 *     [Canon, not journal-grade: round practitioner numbers, deliberately low.]
 *   - Strength scales with bodyweight to about the 2/3 power, not linearly, so a
 *     330 lb lifter starts about 1.6x, not 2x, a 165 lb lifter.
 *   - Women keep more of the male ratio in the lower body than the upper body.
 *   - Missing sex or bodyweight falls back to the lighter, more cautious reference.
 *   - Height is not used for load. It does not predict what a novice can lift.
 *
 * PROTEIN. 1.6 to 2.2 g per kg a day: Morton et al. 2018 (BJSM meta-analysis) found
 * gains in lean mass plateau around 1.62 g/kg, 95% CI up to 2.2. At BMI 30 or more,
 * g/kg of total weight overshoots, so the basis becomes the weight at BMI 25 for the
 * lifter's height (height's one legitimate use here). Display only: no macros, no
 * meal logging (standing rule).
 */
import type { LoadType } from './types';

export type Sex = 'male' | 'female';
export type TrainingAge = 'Novice' | 'Intermediate' | 'Advanced';

type Region = 'upper' | 'lower';
interface Ratio {
  region: Region;
  barbell?: number;
  dumbbell?: number; // per hand
  stack?: number;
}

/** Working-load ratios by generator movement pattern (see header). */
const RATIOS: Record<string, Ratio> = {
  horizPress: { region: 'upper', barbell: 0.4, dumbbell: 0.12, stack: 0.3 },
  inclPress: { region: 'upper', barbell: 0.33, dumbbell: 0.1, stack: 0.25 },
  vertPress: { region: 'upper', barbell: 0.25, dumbbell: 0.08, stack: 0.2 },
  lateralRaise: { region: 'upper', dumbbell: 0.035, stack: 0.03 },
  rearDelt: { region: 'upper', dumbbell: 0.035, stack: 0.1 },
  tricep: { region: 'upper', barbell: 0.2, dumbbell: 0.06, stack: 0.15 },
  biceps: { region: 'upper', barbell: 0.2, dumbbell: 0.07, stack: 0.15 },
  squat: { region: 'lower', barbell: 0.45, dumbbell: 0.12, stack: 0.6 },
  legPress: { region: 'lower', barbell: 0.35, dumbbell: 0.08, stack: 0.8 },
  legExt: { region: 'lower', stack: 0.2 },
  hinge: { region: 'lower', barbell: 0.55, dumbbell: 0.15, stack: 0.4 },
  legCurl: { region: 'lower', stack: 0.15 },
  calf: { region: 'lower', barbell: 0.4, dumbbell: 0.12, stack: 0.5 },
  vertPull: { region: 'upper', stack: 0.4 },
  horizRow: { region: 'upper', barbell: 0.35, dumbbell: 0.15, stack: 0.35 },
  abs: { region: 'upper', barbell: 0.1, dumbbell: 0.05, stack: 0.15 },
};

/** Fallback when the movement is unknown (a swap or add): by load type and mechanic.
 *  Unknown mechanic reads as isolation, the lighter choice. Upper-body coefficients,
 *  also the lighter choice. */
const FALLBACK: Record<
  Exclude<LoadType, 'bodyweight'>,
  { compound: number; isolation: number }
> = {
  barbell: { compound: 0.35, isolation: 0.2 },
  dumbbell: { compound: 0.1, isolation: 0.05 },
  stack: { compound: 0.35, isolation: 0.15 },
};

const REFERENCE_LB = 165; // allometric anchor
const DEFAULT_BW: Record<Sex, number> = { male: 165, female: 140 };
const BW_MIN = 90;
const BW_MAX = 350;
const SEX_FACTOR: Record<Region, number> = { upper: 0.55, lower: 0.7 }; // female vs male
const TRAINING_AGE: Record<TrainingAge, number> = {
  Novice: 1,
  Intermediate: 1.5,
  Advanced: 1.9,
};

function ageFactor(age?: number): number {
  if (age === undefined) return 1;
  if (age < 18 || age >= 65) return 0.8;
  if (age >= 50) return 0.9;
  return 1;
}

export interface StartInput {
  loadType: LoadType;
  /** Generator movement-pattern key (e.g. 'squat'); omitted for swaps and adds. */
  pattern?: string;
  compound?: boolean;
  bodyweightLb?: number;
  sex?: Sex;
  ageYears?: number;
  experience?: TrainingAge;
}

/** A cautious first working weight in lb (unrounded; the engine rounds it to what the
 *  load type can reach). 0 for bodyweight lifts. */
export function startingWeightLb(i: StartInput): number {
  if (i.loadType === 'bodyweight') return 0;
  const known = i.pattern ? RATIOS[i.pattern] : undefined;
  const ratio =
    known?.[i.loadType] ??
    FALLBACK[i.loadType][i.compound ? 'compound' : 'isolation'];
  const region: Region = known?.region ?? 'upper';

  const female = i.sex !== 'male'; // unknown sex -> the cautious reference
  const bw = Math.min(
    BW_MAX,
    Math.max(BW_MIN, i.bodyweightLb ?? DEFAULT_BW[female ? 'female' : 'male']),
  );
  const effectiveBw = REFERENCE_LB * (bw / REFERENCE_LB) ** (2 / 3);

  return (
    ratio *
    effectiveBw *
    (female ? SEX_FACTOR[region] : 1) *
    TRAINING_AGE[i.experience ?? 'Novice'] *
    ageFactor(i.ageYears)
  );
}

export interface ProteinInput {
  bodyweightLb?: number;
  heightIn?: number;
  ageYears?: number;
}

export interface ProteinTarget {
  lowG: number;
  highG: number;
  /** 'heightAdjusted' when BMI is 30+ and the basis is the weight at BMI 25. */
  basis: 'bodyweight' | 'heightAdjusted';
  underEighteen: boolean;
}

const KG_PER_LB = 0.45359237;
const M_PER_IN = 0.0254;
const PER_KG: [number, number] = [1.6, 2.2];
const round5 = (g: number) => Math.round(g / 5) * 5;

/** Daily protein range in grams, or null without a bodyweight. */
export function proteinTarget(i: ProteinInput): ProteinTarget | null {
  if (!i.bodyweightLb || i.bodyweightLb <= 0) return null;
  const kg = i.bodyweightLb * KG_PER_LB;
  let basisKg = kg;
  let basis: ProteinTarget['basis'] = 'bodyweight';
  if (i.heightIn && i.heightIn > 0) {
    const m2 = (i.heightIn * M_PER_IN) ** 2;
    if (kg / m2 >= 30) {
      basisKg = 25 * m2;
      basis = 'heightAdjusted';
    }
  }
  return {
    lowG: round5(basisKg * PER_KG[0]),
    highG: round5(basisKg * PER_KG[1]),
    basis,
    underEighteen: i.ageYears !== undefined && i.ageYears < 18,
  };
}

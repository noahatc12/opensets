/**
 * OpenSets progression engine — public entry point (spec §6.1).
 *
 * Pure module (see ENGINE PURITY LAW in ./types.ts). All nine progression rules
 * compute: linear / double / manual (P1) plus 5/3/1, GZCLP, RPE-target, APRE,
 * repsOnly, durationLinear (P2). Plus e1RM / EWMA trend and plateau detection.
 */
export * from './types';
export {
  roundToLoadable,
  isLoadable,
  generateWarmupRamp,
  platesForWeight,
  type WarmupSet,
} from './rounding';
export { detectPRs, type PRResult } from './prs';
export {
  e1rm,
  e1rmEpley,
  e1rmBrzycki,
  isE1rmEligible,
  ewma,
  bestSessionE1rm,
  EWMA_ALPHA,
} from './e1rm';
export { detectPlateau, ewmaSeries, type PlateauResult } from './plateau';
export {
  generatePlan,
  type GeneratorResult,
  type GeneratedProgram,
  type GeneratedDay,
  type GeneratedSlot,
  type CardioProtocol,
  type GeneratedGoal,
  type CalibrationWeek,
  type GenExercise,
  type GenProfile,
  type GenPreferences,
  type TrainingGoal,
  type EquipmentProfile,
  type Experience,
  type Sex,
} from './generator';

import type {
  EngineSettings,
  ExerciseState,
  NextPrescriptionResult,
  ProgressionRule,
  SetResult,
  SetScheme,
} from './types';
import { linearNext } from './rules/linear';
import { doubleNext } from './rules/double';
import { percent531Next } from './rules/percent531';
import { gzclpNext } from './rules/gzclp';
import { rpeTargetNext } from './rules/rpeTarget';
import { apreNext } from './rules/apre';
import { repsOnlyNext } from './rules/repsOnly';
import { durationLinearNext } from './rules/durationLinear';
import { buildSets, fmt, workingSets } from './rules/shared';

/**
 * Compute the next session's prescription and advanced state for one exercise.
 *
 * Pure: nothing is read from storage, the DOM, or the clock. `scheme` supplies the
 * slot's set/rep design for the weight-based rules (see {@link SetScheme}).
 */
export function nextPrescription(
  rule: ProgressionRule,
  state: ExerciseState,
  lastSession: SetResult[],
  settings: EngineSettings,
  scheme: SetScheme,
): NextPrescriptionResult {
  switch (rule.kind) {
    case 'linear':
      return linearNext(rule, state, lastSession, settings, scheme);
    case 'double':
      return doubleNext(rule, state, lastSession, settings, scheme);
    case 'manual':
      return manualNext(state, lastSession, scheme);
    case 'percent531':
      return percent531Next(rule, state, lastSession, settings);
    case 'gzclp':
      return gzclpNext(rule, state, lastSession, settings);
    case 'rpeTarget':
      return rpeTargetNext(rule, state, lastSession, settings, scheme);
    case 'apre':
      return apreNext(rule, state, lastSession, settings);
    case 'repsOnly':
      return repsOnlyNext(rule, state, lastSession, settings, scheme);
    case 'durationLinear':
      return durationLinearNext(rule, state, lastSession, settings, scheme);
  }
}

/** Manual: no auto-progression. Re-prescribe the current weight; the lifter decides. */
function manualNext(
  state: ExerciseState,
  lastSession: SetResult[],
  scheme: SetScheme,
): NextPrescriptionResult {
  const targetReps = scheme.repTarget ?? scheme.repRange?.[0] ?? 1;
  const repeated = workingSets(lastSession).length > 0;
  const reason = repeated
    ? `Manual — adjust ${fmt(state.workingWeightLb)} lb as you see fit.`
    : `Manual — set your weight.`;
  return {
    prescription: {
      sets: buildSets(scheme, targetReps, state.workingWeightLb),
      reason,
      flags: [],
    },
    nextState: { ...state },
  };
}

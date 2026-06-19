/**
 * OpenSets progression engine — public entry point (spec §6.1).
 *
 * Pure module (see ENGINE PURITY LAW in ./types.ts). Phase 1 implements `linear`,
 * `double`, and `manual`; the remaining rules (5/3/1, GZCLP, RPE, APRE, repsOnly,
 * durationLinear) land in Phase 2 and throw a clear message until then.
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
    case 'gzclp':
    case 'rpeTarget':
    case 'apre':
    case 'repsOnly':
    case 'durationLinear':
      throw new Error(
        `Progression rule "${rule.kind}" is implemented in Phase 2 — not available yet.`,
      );
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
    ? `Manual — adjust ${fmt(state.workingWeightKg)} kg as you see fit.`
    : `Manual — set your weight.`;
  return {
    prescription: {
      sets: buildSets(scheme, targetReps, state.workingWeightKg),
      reason,
      flags: [],
    },
    nextState: { ...state },
  };
}

/**
 * Double progression (spec §6.2) — default for isolation/hypertrophy.
 * Work a rep range [min,max]: when all working sets reach the top of the range,
 * add weight (and reset toward the bottom); otherwise hold weight and build reps.
 *
 * P1 implements group double progression (one weight for the slot). Per-set DDP
 * (`perSet: true`, independent per-set weights) is a Phase-2 feature; the flag is
 * accepted here but does not yet drive independent per-set state.
 */
import { roundToLoadable } from '../rounding';
import type {
  EngineSettings,
  ExerciseState,
  NextPrescriptionResult,
  PrescriptionFlag,
  ProgressionRule,
  SetResult,
  SetScheme,
} from '../types';
import { buildSets, fmt, workingSets } from './shared';

type DoubleRule = Extract<ProgressionRule, { kind: 'double' }>;

export function doubleNext(
  rule: DoubleRule,
  state: ExerciseState,
  lastSession: SetResult[],
  settings: EngineSettings,
  scheme: SetScheme,
): NextPrescriptionResult {
  const work = workingSets(lastSession);

  let weight = state.workingWeightLb;
  const flags: PrescriptionFlag[] = [];
  let reason: string;

  if (work.length === 0) {
    reason = `Starting weight — build toward ${rule.repMax} reps.`;
  } else {
    const allMax = work.every((s) => s.completed && s.reps >= rule.repMax);
    if (allMax) {
      weight = state.workingWeightLb + rule.incrementLb;
      reason = `+${fmt(rule.incrementLb)} lb — hit ${rule.repMax} on all sets.`;
    } else {
      weight = state.workingWeightLb;
      reason = `Hold ${fmt(weight)} lb — add reps toward ${rule.repMin}–${rule.repMax}.`;
    }
  }

  const rounded = roundToLoadable(
    weight,
    settings.barLb,
    settings.plateInventoryLb,
  );
  // Target the top of the range; the UI shows the full min–max from the scheme.
  return {
    prescription: {
      sets: buildSets(scheme, rule.repMax, rounded),
      reason,
      flags,
    },
    nextState: { ...state, workingWeightLb: rounded, consecutiveFails: 0 },
  };
}

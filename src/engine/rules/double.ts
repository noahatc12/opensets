/**
 * Double progression (spec §6.2) — default for isolation/hypertrophy.
 * Work a rep range [min,max]: when all working sets reach the top of the range,
 * add weight (and reset toward the bottom); otherwise hold weight and build reps.
 *
 * P1 implements group double progression (one weight for the slot). Per-set DDP
 * (`perSet: true`, independent per-set weights) is a Phase-2 feature; the flag is
 * accepted here but does not yet drive independent per-set state.
 *
 * Like linear, progression starts from the weight actually logged and increases
 * round UP to the next reachable load (audit 2026-09-24).
 */
import type {
  EngineSettings,
  ExerciseState,
  NextPrescriptionResult,
  PrescriptionFlag,
  ProgressionRule,
  SetResult,
  SetScheme,
} from '../types';
import {
  allHitAt,
  buildSets,
  fmt,
  performedWeight,
  roundLoad,
  workingSets,
} from './shared';

type DoubleRule = Extract<ProgressionRule, { kind: 'double' }>;

export function doubleNext(
  rule: DoubleRule,
  state: ExerciseState,
  lastSession: SetResult[],
  settings: EngineSettings,
  scheme: SetScheme,
): NextPrescriptionResult {
  const work = workingSets(lastSession);
  const logged = performedWeight(work);
  const base = logged ?? state.workingWeightLb;
  const adopted = logged !== undefined && logged !== state.workingWeightLb;
  const note = adopted ? `Using your logged ${fmt(base)} lb. ` : '';

  const flags: PrescriptionFlag[] = [];
  let weight: number;
  let reason: string;

  if (logged === undefined) {
    weight = roundLoad(base, settings);
    reason = `Starting weight — build toward ${rule.repMax} reps.`;
  } else if (allHitAt(work, rule.repMax, base)) {
    if (settings.loadType === 'bodyweight' && base <= 0) {
      weight = 0;
      reason = `${note}Hit ${rule.repMax} on all sets at bodyweight. Keep the reps clean, or add load when it feels easy.`;
    } else {
      weight = roundLoad(base + rule.incrementLb, settings, 'up');
      reason = `${note}+${fmt(weight - base)} lb — hit ${rule.repMax} on all sets.`;
    }
  } else {
    weight = roundLoad(base, settings);
    reason = `${note}Hold ${fmt(weight)} lb — add reps toward ${rule.repMin}–${rule.repMax}.`;
  }

  // Target the top of the range; the UI shows the full min–max from the scheme.
  return {
    prescription: {
      sets: buildSets(scheme, rule.repMax, weight),
      reason,
      flags,
    },
    nextState: { ...state, workingWeightLb: weight, consecutiveFails: 0 },
  };
}

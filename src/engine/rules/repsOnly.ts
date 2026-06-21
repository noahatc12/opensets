/**
 * repsOnly (spec §6.2) — bodyweight rep progression. Pure.
 *
 * Progress the rep target by `repIncrement` once every set hits it; otherwise hold
 * and build reps. The current rep target lives in `state.stage`. External load
 * (`workingWeightKg`) passes through: 0 = pure bodyweight, negative = assisted —
 * neither is plate-rounded (only a positive barbell load is). When a user attaches
 * external load, the slot converts to `double` (a generator concern, not here).
 */
import { roundLoad, buildSets, workingSets, allHit } from './shared';
import type {
  EngineSettings,
  ExerciseState,
  NextPrescriptionResult,
  ProgressionRule,
  SetResult,
  SetScheme,
} from '../types';

type Rule = Extract<ProgressionRule, { kind: 'repsOnly' }>;

export function repsOnlyNext(
  rule: Rule,
  state: ExerciseState,
  lastSession: SetResult[],
  settings: EngineSettings,
  scheme: SetScheme,
): NextPrescriptionResult {
  const work = workingSets(lastSession);
  const base = scheme.repTarget ?? scheme.repRange?.[0] ?? 5;
  const current = state.stage > 0 ? state.stage : base;
  let target = current;
  let reason: string;

  if (work.length === 0) {
    reason = `Bodyweight — aim for ${target} reps per set.`;
  } else if (allHit(work, current)) {
    target = current + rule.repIncrement;
    reason = `+${rule.repIncrement} rep${rule.repIncrement > 1 ? 's' : ''} — hit ${current} on all sets.`;
  } else {
    reason = `Hold ${current} reps — build up across sets.`;
  }

  // Only a positive barbell load rounds; bodyweight (0) / assisted (negative) pass through.
  const w = state.workingWeightKg;
  const loadKg = w > 0 ? roundLoad(w, settings) : w;

  return {
    prescription: {
      sets: buildSets({ sets: scheme.sets }, target, loadKg),
      reason,
      flags: [],
    },
    nextState: { ...state, stage: target, workingWeightKg: loadKg },
  };
}

/**
 * RPE-target autoregulation (spec §6.2). Pure.
 *
 * Compare the logged RPE on the top set to `targetRpe`: each 1.0 RPE under target
 * (the set was easier than planned) nudges next session's load up by `loadStepPct`,
 * and each 1.0 over nudges it down — clamped to ±10%. Reps are held at `targetReps`.
 * With no logged RPE the engine can't autoregulate, so it holds.
 */
import { roundLoad, buildSets, fmt, workingSets } from './shared';
import type {
  EngineSettings,
  ExerciseState,
  NextPrescriptionResult,
  PrescribedSet,
  ProgressionRule,
  SetResult,
  SetScheme,
} from '../types';

type Rule = Extract<ProgressionRule, { kind: 'rpeTarget' }>;

const pct = (frac: number) => `${Math.abs(Math.round(frac * 100))}%`;

export function rpeTargetNext(
  rule: Rule,
  state: ExerciseState,
  lastSession: SetResult[],
  settings: EngineSettings,
  scheme: SetScheme,
): NextPrescriptionResult {
  const work = workingSets(lastSession);
  let weight = state.workingWeightLb;
  let reason: string;

  if (work.length === 0) {
    reason = `Starting weight — target RPE ${fmt(rule.targetRpe)} @ ${rule.targetReps} reps.`;
  } else {
    const top = work[work.length - 1]!;
    if (top.rpe === undefined) {
      reason = `Hold ${fmt(weight)} lb — log RPE to autoregulate.`;
    } else {
      const deviation = rule.targetRpe - top.rpe; // logged easier (lower RPE) → positive → add load
      const adj = Math.max(-0.1, Math.min(0.1, deviation * rule.loadStepPct));
      weight = state.workingWeightLb * (1 + adj);
      reason =
        adj > 0
          ? `+${pct(adj)} — top set RPE ${fmt(top.rpe)} under target ${fmt(rule.targetRpe)}.`
          : adj < 0
            ? `−${pct(adj)} — top set RPE ${fmt(top.rpe)} over target ${fmt(rule.targetRpe)}.`
            : `Hold — top set RPE ${fmt(top.rpe)} on target.`;
    }
  }

  const rounded = roundLoad(weight, settings);
  const sets: PrescribedSet[] = buildSets(
    { sets: scheme.sets },
    rule.targetReps,
    rounded,
  ).map((s) => ({ ...s, targetRpe: rule.targetRpe }));

  return {
    prescription: { sets, reason, flags: [] },
    nextState: { ...state, workingWeightLb: rounded },
  };
}

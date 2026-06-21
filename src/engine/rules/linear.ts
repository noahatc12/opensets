/**
 * Linear progression (spec §6.2) — novice compounds.
 * All working sets hit target reps → weight += increment. Otherwise count a fail;
 * at `failsBeforeDeload` consecutive fails, deload by `deloadPct` and reset.
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

type LinearRule = Extract<ProgressionRule, { kind: 'linear' }>;

export function linearNext(
  rule: LinearRule,
  state: ExerciseState,
  lastSession: SetResult[],
  settings: EngineSettings,
  scheme: SetScheme,
): NextPrescriptionResult {
  const targetReps = scheme.repTarget ?? scheme.repRange?.[0] ?? 1;
  const work = workingSets(lastSession);

  let weight = state.workingWeightLb;
  let consecutiveFails = state.consecutiveFails;
  const flags: PrescriptionFlag[] = [];
  let reason: string;

  if (work.length === 0) {
    reason = `Starting weight — ${fmt(weight)} lb.`;
  } else {
    const allHit = work.every((s) => s.completed && s.reps >= targetReps);
    if (allHit) {
      weight = state.workingWeightLb + rule.incrementLb;
      consecutiveFails = 0;
      reason = `+${fmt(rule.incrementLb)} lb — hit ${targetReps} on all sets last time.`;
    } else {
      consecutiveFails += 1;
      if (consecutiveFails >= rule.failsBeforeDeload) {
        weight = state.workingWeightLb * (1 - rule.deloadPct);
        consecutiveFails = 0;
        flags.push('deload');
        reason = `Deload −${fmt(Math.round(rule.deloadPct * 100))}% after ${rule.failsBeforeDeload} misses.`;
      } else {
        weight = state.workingWeightLb;
        reason = `Repeat ${fmt(weight)} lb — missed last time (${consecutiveFails}/${rule.failsBeforeDeload}).`;
      }
    }
  }

  const rounded = roundToLoadable(
    weight,
    settings.barLb,
    settings.plateInventoryLb,
  );
  return {
    prescription: {
      sets: buildSets(scheme, targetReps, rounded),
      reason,
      flags,
    },
    nextState: { ...state, workingWeightLb: rounded, consecutiveFails },
  };
}

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

  let weight = state.workingWeightKg;
  let consecutiveFails = state.consecutiveFails;
  const flags: PrescriptionFlag[] = [];
  let reason: string;

  if (work.length === 0) {
    reason = `Starting weight — ${fmt(weight)} kg.`;
  } else {
    const allHit = work.every((s) => s.completed && s.reps >= targetReps);
    if (allHit) {
      weight = state.workingWeightKg + rule.incrementKg;
      consecutiveFails = 0;
      reason = `+${fmt(rule.incrementKg)} kg — hit ${targetReps} on all sets last time.`;
    } else {
      consecutiveFails += 1;
      if (consecutiveFails >= rule.failsBeforeDeload) {
        weight = state.workingWeightKg * (1 - rule.deloadPct);
        consecutiveFails = 0;
        flags.push('deload');
        reason = `Deload −${fmt(Math.round(rule.deloadPct * 100))}% after ${rule.failsBeforeDeload} misses.`;
      } else {
        weight = state.workingWeightKg;
        reason = `Repeat ${fmt(weight)} kg — missed last time (${consecutiveFails}/${rule.failsBeforeDeload}).`;
      }
    }
  }

  const rounded = roundToLoadable(
    weight,
    settings.barKg,
    settings.plateInventoryKg,
  );
  return {
    prescription: {
      sets: buildSets(scheme, targetReps, rounded),
      reason,
      flags,
    },
    nextState: { ...state, workingWeightKg: rounded, consecutiveFails },
  };
}

/**
 * Linear progression (spec §6.2) — novice compounds.
 * All working sets hit target reps → weight += increment. Otherwise count a fail;
 * at `failsBeforeDeload` consecutive fails, deload by `deloadPct` and reset.
 *
 * Progression starts from the weight the lifter actually worked at (the most-used
 * logged weight), not from the stored prescription: a lifter who logs a different
 * weight is progressed from what they lifted, and a new weight starts a new miss
 * count. Increases round UP to the next reachable load so a small increment always
 * moves the weight. (Audit 2026-09-24.)
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
  const logged = performedWeight(work);
  const base = logged ?? state.workingWeightLb;
  const adopted = logged !== undefined && logged !== state.workingWeightLb;
  const note = adopted ? `Using your logged ${fmt(base)} lb. ` : '';

  let consecutiveFails = adopted ? 0 : state.consecutiveFails;
  const flags: PrescriptionFlag[] = [];
  let weight: number;
  let reason: string;

  if (logged === undefined) {
    weight = roundLoad(base, settings);
    reason = `Starting weight — ${fmt(weight)} lb.`;
  } else if (allHitAt(work, targetReps, base)) {
    consecutiveFails = 0;
    if (settings.loadType === 'bodyweight' && base <= 0) {
      weight = 0;
      reason = `${note}Hit ${targetReps} on all sets at bodyweight. Keep the reps clean, or add load when it feels easy.`;
    } else {
      weight = roundLoad(base + rule.incrementLb, settings, 'up');
      reason = `${note}+${fmt(weight - base)} lb — hit ${targetReps} on all sets last time.`;
    }
  } else {
    consecutiveFails += 1;
    if (consecutiveFails >= rule.failsBeforeDeload) {
      weight = roundLoad(base * (1 - rule.deloadPct), settings);
      consecutiveFails = 0;
      flags.push('deload');
      reason = `${note}Deload −${fmt(Math.round(rule.deloadPct * 100))}% after ${rule.failsBeforeDeload} misses.`;
    } else {
      weight = roundLoad(base, settings);
      reason = `${note}Repeat ${fmt(weight)} lb — missed last time (${consecutiveFails}/${rule.failsBeforeDeload}).`;
    }
  }

  return {
    prescription: {
      sets: buildSets(scheme, targetReps, weight),
      reason,
      flags,
    },
    nextState: { ...state, workingWeightLb: weight, consecutiveFails },
  };
}

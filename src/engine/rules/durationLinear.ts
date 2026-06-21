/**
 * durationLinear (spec §6.2) — timed holds & cardio minutes. Pure.
 *
 * The "load" is a duration (seconds), carried in `workingWeightLb`. Every
 * `everyNSessions` completed sessions, the target grows by `incrementSec`;
 * `cyclePos` counts sessions toward the next bump. Prescriptions are `timed` sets
 * carrying `targetDurationSec` (no barbell load).
 */
import { workingSets } from './shared';
import type {
  ExerciseState,
  NextPrescriptionResult,
  PrescribedSet,
  ProgressionRule,
  SetResult,
  SetScheme,
} from '../types';

type Rule = Extract<ProgressionRule, { kind: 'durationLinear' }>;

function fmtDur(sec: number): string {
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return s === 0 ? `${m}m` : `${m}m ${s}s`;
}

export function durationLinearNext(
  rule: Rule,
  state: ExerciseState,
  lastSession: SetResult[],
  _settings: unknown,
  scheme: SetScheme,
): NextPrescriptionResult {
  // A completed session is any completed set (timed/cardio sit outside workingSets).
  const did =
    lastSession.some((s) => s.completed) || workingSets(lastSession).length > 0;
  let duration = state.workingWeightLb;
  let cyclePos = state.cyclePos;
  let reason: string;

  if (!did) {
    reason = `Hold ${fmtDur(duration)} — log a session to progress.`;
  } else {
    cyclePos = state.cyclePos + 1;
    if (cyclePos >= rule.everyNSessions) {
      duration = state.workingWeightLb + rule.incrementSec;
      cyclePos = 0;
      reason = `+${rule.incrementSec}s — up to ${fmtDur(duration)}.`;
    } else {
      reason = `Hold ${fmtDur(duration)} — ${cyclePos}/${rule.everyNSessions} to the next bump.`;
    }
  }

  const n = Math.max(1, scheme.sets);
  const sets: PrescribedSet[] = [];
  for (let i = 0; i < n; i++) {
    sets.push({ type: 'timed', targetReps: 1, targetWeightLb: 0, targetDurationSec: duration });
  }

  return {
    prescription: { sets, reason, flags: [] },
    nextState: { ...state, workingWeightLb: duration, cyclePos },
  };
}

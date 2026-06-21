/** Shared helpers for the progression rules. Pure. */
import { roundToLoadable } from '../rounding';
import type { EngineSettings, PrescribedSet, SetResult, SetScheme } from '../types';

/** Sets that count toward a progression decision (working + AMRAP, not warmups). */
export function workingSets(lastSession: SetResult[]): SetResult[] {
  return lastSession.filter((s) => s.type === 'working' || s.type === 'amrap');
}

/** Round a barbell load to the nearest weight loadable from the lifter's plates. */
export function roundLoad(weightKg: number, settings: EngineSettings): number {
  return roundToLoadable(
    weightKg,
    settings.barKg,
    settings.plateInventoryKg,
    settings.rounding,
  );
}

/** Did every working set hit (or beat) its rep target while completed? */
export function allHit(work: SetResult[], targetReps: number): boolean {
  return work.length > 0 && work.every((s) => s.completed && s.reps >= targetReps);
}

/** Build the prescribed sets for a scheme at a fixed weight + rep target. */
export function buildSets(
  scheme: SetScheme,
  targetReps: number,
  weightKg: number,
): PrescribedSet[] {
  const n = Math.max(1, scheme.sets);
  const out: PrescribedSet[] = [];
  for (let i = 0; i < n; i++) {
    const isLast = i === n - 1;
    const amrap = Boolean(scheme.amrapLast && isLast);
    out.push({
      type: amrap ? 'amrap' : 'working',
      targetReps,
      targetWeightKg: weightKg,
      ...(amrap ? { amrap: true } : {}),
    });
  }
  return out;
}

/** Compact number formatting for reason strings (drops trailing zeros). */
export function fmt(n: number): string {
  return Number.isInteger(n)
    ? String(n)
    : n.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}

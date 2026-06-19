/** Shared helpers for the progression rules. Pure. */
import type { PrescribedSet, SetResult, SetScheme } from '../types';

/** Sets that count toward a progression decision (working + AMRAP, not warmups). */
export function workingSets(lastSession: SetResult[]): SetResult[] {
  return lastSession.filter((s) => s.type === 'working' || s.type === 'amrap');
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

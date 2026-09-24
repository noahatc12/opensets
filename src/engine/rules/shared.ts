/** Shared helpers for the progression rules. Pure. */
import { roundForLoad, DEFAULT_LOAD_STEPS } from '../loading';
import type {
  EngineSettings,
  PrescribedSet,
  RoundingMode,
  SetResult,
  SetScheme,
} from '../types';

/** Sets that count toward a progression decision (working + AMRAP, not warmups). */
export function workingSets(lastSession: SetResult[]): SetResult[] {
  return lastSession.filter((s) => s.type === 'working' || s.type === 'amrap');
}

/** Round a load to the nearest weight reachable for the exercise's load type
 *  (barbell plate math when no load type is given). `mode` overrides the settings'
 *  rounding: increases pass 'up' so a small increment can never round back to the
 *  same weight, deloads pass 'down'. */
export function roundLoad(
  weightLb: number,
  settings: EngineSettings,
  mode: RoundingMode = settings.rounding,
): number {
  return roundForLoad(
    weightLb,
    settings.loadType ?? 'barbell',
    settings.barLb,
    settings.plateInventoryLb,
    settings.steps ?? DEFAULT_LOAD_STEPS,
    mode,
  );
}

/**
 * The weight the lifter actually worked at: the weight used on the most working sets
 * (ties go to the lower weight). Progression starts from this, not from the stored
 * prescription, so a lifter who logs 15 lb against a 45 lb prescription is progressed
 * from 15. Undefined when nothing was logged.
 */
export function performedWeight(work: SetResult[]): number | undefined {
  let best: number | undefined;
  let bestCount = 0;
  const counts = new Map<number, number>();
  for (const s of work) counts.set(s.weightLb, (counts.get(s.weightLb) ?? 0) + 1);
  for (const [w, n] of counts) {
    if (best === undefined || n > bestCount || (n === bestCount && w < best)) {
      best = w;
      bestCount = n;
    }
  }
  return best;
}

/** Did every working set hit (or beat) its rep target while completed? */
export function allHit(work: SetResult[], targetReps: number): boolean {
  return work.length > 0 && work.every((s) => s.completed && s.reps >= targetReps);
}

/** Every working set completed at `weightLb` or heavier with at least `targetReps`.
 *  A set dropped below the main weight is a miss at that weight. */
export function allHitAt(work: SetResult[], targetReps: number, weightLb: number): boolean {
  return work.every((s) => s.completed && s.reps >= targetReps && s.weightLb >= weightLb);
}

/** Build the prescribed sets for a scheme at a fixed weight + rep target. */
export function buildSets(
  scheme: SetScheme,
  targetReps: number,
  weightLb: number,
): PrescribedSet[] {
  const n = Math.max(1, scheme.sets);
  const out: PrescribedSet[] = [];
  for (let i = 0; i < n; i++) {
    const isLast = i === n - 1;
    const amrap = Boolean(scheme.amrapLast && isLast);
    out.push({
      type: amrap ? 'amrap' : 'working',
      targetReps,
      targetWeightLb: weightLb,
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

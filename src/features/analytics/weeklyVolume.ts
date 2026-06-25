/**
 * Weekly hard-set volume per muscle (spec §242 + §142).
 *
 * Counts working + AMRAP sets in a rolling 7-day window, weighted by the
 * exercise→muscle map: each primary muscle = 1.0 set, each secondary = 0.5.
 * The window is anchored to the LATEST logged set (the app's data-relative
 * "now", matching the analytics range filter) rather than wall-clock today, so
 * an idle stretch still surfaces the last active week instead of an empty card.
 *
 * Pure + deterministic: the anchor is derived from the data, no Date.now(), so
 * it is unit-testable and safe to call from a render path. Returned values are
 * multiples of 0.5 (the only weights), already sorted desc and capped to topN.
 */
import type { LoggedSet, Muscle } from '../../db/types';

export interface ExerciseMuscles {
  primary: Muscle[];
  secondary: Muscle[];
}

const DAY_MS = 86_400_000;

export function weeklyVolumeByMuscle(
  sets: LoggedSet[],
  getMuscles: (exerciseId: string) => ExerciseMuscles | undefined,
  topN = 4,
): Array<[Muscle, number]> {
  const hard = sets.filter((s) => s.type === 'working' || s.type === 'amrap');
  if (hard.length === 0) return [];

  // Anchor = latest logged hard-set date; window = the 7 days ending there
  // (inclusive of both ends).
  const anchorMs = hard.reduce((mx, s) => Math.max(mx, new Date(s.date).getTime()), 0);
  const startMs = anchorMs - 6 * DAY_MS;

  const weights = new Map<Muscle, number>();
  for (const s of hard) {
    const t = new Date(s.date).getTime();
    if (t < startMs || t > anchorMs) continue;
    const m = getMuscles(s.exerciseId);
    if (!m) continue;
    for (const p of m.primary) weights.set(p, (weights.get(p) ?? 0) + 1);
    for (const sec of m.secondary) weights.set(sec, (weights.get(sec) ?? 0) + 0.5);
  }

  return [...weights.entries()].sort((a, b) => b[1] - a[1]).slice(0, topN);
}

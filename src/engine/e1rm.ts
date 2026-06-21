/**
 * Estimated 1-rep-max, trend smoothing, and eligibility (spec §6.3). Pure.
 *
 * e1RM is the mean of Epley and Brzycki, computed only for completed working/AMRAP
 * sets at ≤ 10 reps (above that the estimate is low-confidence and is excluded from
 * the trend). The per-exercise trend is an EWMA with α = 0.3.
 */
import type { SetResult } from './types';

export const EWMA_ALPHA = 0.3;

/** Epley: w·(1 + r/30). */
export function e1rmEpley(weightLb: number, reps: number): number {
  return weightLb * (1 + reps / 30);
}

/** Brzycki: w·36/(37 − r). Undefined at r ≥ 37 (never eligible — reps are ≤ 10). */
export function e1rmBrzycki(weightLb: number, reps: number): number {
  return (weightLb * 36) / (37 - reps);
}

/** Mean of Epley and Brzycki (the displayed/stored e1RM). */
export function e1rm(weightLb: number, reps: number): number {
  return (e1rmEpley(weightLb, reps) + e1rmBrzycki(weightLb, reps)) / 2;
}

/** Whether a logged set should contribute an e1RM data point (spec §6.3). */
export function isE1rmEligible(set: SetResult): boolean {
  return (
    (set.type === 'working' || set.type === 'amrap') &&
    set.completed &&
    set.weightLb > 0 &&
    set.reps >= 1 &&
    set.reps <= 10
  );
}

/** EWMA step. `prev === null` seeds the series with `value`. */
export function ewma(
  prev: number | null,
  value: number,
  alpha = EWMA_ALPHA,
): number {
  return prev === null ? value : alpha * value + (1 - alpha) * prev;
}

/** Best (max) e1RM among the eligible sets of a session, or null if none qualify. */
export function bestSessionE1rm(sets: SetResult[]): number | null {
  let best: number | null = null;
  for (const s of sets) {
    if (!isE1rmEligible(s)) continue;
    const v = e1rm(s.weightLb, s.reps);
    if (best === null || v > best) best = v;
  }
  return best;
}

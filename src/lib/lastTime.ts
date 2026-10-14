import type { SetResult } from '../engine/types';
import { fmtWeight, type WeightUnit } from './units';

/**
 * Last time's sets for one exercise as one line: "102.5 lb × 10, 10, 9".
 * A change of weight starts a new run ("105 lb × 10 · 100 lb × 9, 8"); bodyweight
 * sets are reps alone, assisted sets say assist, timed holds are seconds.
 * Quick win from the 2026-10-14 review: Strong and Hevy both lead with this.
 */
export function lastTimeLine(sets: SetResult[], unit: WeightUnit): string {
  if (sets.length === 0) return '';
  if (sets.every((x) => x.durationSec !== undefined && x.durationSec > 0))
    return sets.map((x) => `${Math.round(x.durationSec!)} s`).join(', ');

  const runs: { weightLb: number; reps: number[] }[] = [];
  for (const x of sets) {
    const run = runs[runs.length - 1];
    if (run && Math.abs(run.weightLb - x.weightLb) < 0.01)
      run.reps.push(x.reps);
    else runs.push({ weightLb: x.weightLb, reps: [x.reps] });
  }
  return runs
    .map(({ weightLb, reps }) => {
      const r = reps.join(', ');
      if (Math.abs(weightLb) < 0.01) return `${r} reps`;
      if (weightLb < 0)
        return `${fmtWeight(-weightLb, unit)} ${unit} assist × ${r}`;
      return `${fmtWeight(weightLb, unit)} ${unit} × ${r}`;
    })
    .join(' · ');
}

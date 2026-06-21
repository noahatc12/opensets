/**
 * Plateau detection (spec §6.3) — advisory, never auto-applied. Pure.
 *
 * Wires the EWMA(e1RM) trend: if the smoothed e1RM slope is ≤ 0 over the last 3–4
 * sessions AND there was no weight/rep PR in that window, flag a suspected plateau
 * and recommend a single-exercise deload or a rep-range change. The engine only
 * recommends — applying it is the lifter's call.
 */
import { ewma, EWMA_ALPHA } from './e1rm';

export interface PlateauResult {
  plateauSuspected: boolean;
  reason: string;
}

/** EWMA-smoothed series of an e1RM sequence (oldest → newest). */
export function ewmaSeries(values: number[], alpha = EWMA_ALPHA): number[] {
  const out: number[] = [];
  let prev: number | null = null;
  for (const v of values) {
    prev = ewma(prev, v, alpha);
    out.push(prev);
  }
  return out;
}

export function detectPlateau(
  recentE1rms: number[],
  hadPRInWindow: boolean,
  window = 4,
): PlateauResult {
  if (recentE1rms.length < 3) {
    return {
      plateauSuspected: false,
      reason: `Not enough data (${recentE1rms.length} session${recentE1rms.length === 1 ? '' : 's'}) to judge a plateau.`,
    };
  }
  const w = Math.min(window, recentE1rms.length);
  const slice = ewmaSeries(recentE1rms).slice(-w);
  const slope = slice[slice.length - 1]! - slice[0]!;

  if (slope <= 0 && !hadPRInWindow) {
    return {
      plateauSuspected: true,
      reason: `e1RM flat or down over ${w} sessions with no PR — consider a single-exercise deload (−10% load, ~½ sets) or a rep-range change.`,
    };
  }
  return {
    plateauSuspected: false,
    reason: hadPRInWindow
      ? `Recent PR in the last ${w} sessions — progressing.`
      : `e1RM still trending up over ${w} sessions.`,
  };
}

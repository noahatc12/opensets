/**
 * Plate-loading math (spec §6.1, §6.3). Pure. Works in integer centi-pounds to
 * avoid floating-point drift (0.01 lb resolution covers 1.25 lb microplates).
 *
 * Model: a barbell loaded symmetrically — total = bar + 2 × (sum of plates per
 * side). Plate denominations come from the user's inventory and may be used in any
 * quantity (pairs). `roundToLoadable` snaps a target to the nearest achievable load.
 */
import type { RoundingMode } from './types';

const SCALE = 100;
const cs = (lb: number) => Math.round(lb * SCALE);
const lb = (centi: number) => centi / SCALE;

/** Reachable per-side sums (in centi-lb) up to `boundCs`, from unlimited plate
 *  pairs. Callers pass only positive plate denominations. */
function reachablePerSide(plateCs: number[], boundCs: number): boolean[] {
  const reach = new Array<boolean>(boundCs + 1).fill(false);
  reach[0] = true;
  for (const p of plateCs) {
    for (let s = p; s <= boundCs; s++) {
      if (reach[s - p]) reach[s] = true;
    }
  }
  return reach;
}

/**
 * Snap `targetLb` to the nearest weight loadable from `plates` on a `barLb` bar.
 * Targets at or below the empty bar return the bar. Modes: 'nearest' (tie → lower,
 * the conservative choice), 'down' (≤ target), 'up' (≥ target).
 */
export function roundToLoadable(
  targetLb: number,
  barLb: number,
  plates: number[],
  mode: RoundingMode = 'nearest',
): number {
  const perSideCs = cs((targetLb - barLb) / 2);
  if (perSideCs <= 0) return barLb;

  const plateCs = plates.map(cs).filter((p) => p > 0);
  if (plateCs.length === 0) return barLb;

  const maxPlate = Math.max(...plateCs);
  const bound = perSideCs + maxPlate; // allow rounding up by at most one plate
  const reach = reachablePerSide(plateCs, bound);

  let best = 0; // the bar alone is always reachable
  if (mode === 'down') {
    for (let s = Math.min(perSideCs, bound); s >= 0; s--) {
      if (reach[s]) {
        best = s;
        break;
      }
    }
  } else if (mode === 'up') {
    // A reachable sum always exists in [perSideCs, bound] (gaps ≤ maxPlate).
    for (let s = perSideCs; s <= bound; s++) {
      if (reach[s]) {
        best = s;
        break;
      }
    }
  } else {
    let bestDist = Infinity;
    for (let s = 0; s <= bound; s++) {
      if (!reach[s]) continue;
      const dist = Math.abs(s - perSideCs);
      // strict < keeps the FIRST (lower) candidate on ties → conservative
      if (dist < bestDist) {
        bestDist = dist;
        best = s;
      }
    }
  }

  return barLb + 2 * lb(best);
}

/** True iff `weightLb` is exactly loadable: the bar, or bar + plate pairs. */
export function isLoadable(
  weightLb: number,
  barLb: number,
  plates: number[],
): boolean {
  const perSideCs = cs((weightLb - barLb) / 2);
  if (perSideCs < 0) return false;
  if (perSideCs === 0) return true;
  const plateCs = plates.map(cs).filter((p) => p > 0);
  if (plateCs.length === 0) return false;
  return reachablePerSide(plateCs, perSideCs)[perSideCs] === true;
}

export interface WarmupSet {
  weightLb: number;
  reps: number;
}

/**
 * Warm-up ramp toward `workingLb` (spec §6.1 calculators): empty bar, then ~40/60/80%
 * plate-rounded down, ascending and de-duplicated, all strictly below the work set.
 * Returns [] when the working weight is the bar or lighter.
 */
export function generateWarmupRamp(
  workingLb: number,
  barLb: number,
  plates: number[],
): WarmupSet[] {
  if (workingLb <= barLb) return [];

  const steps: WarmupSet[] = [
    { weightLb: barLb, reps: 8 },
    {
      weightLb: roundToLoadable(workingLb * 0.4, barLb, plates, 'down'),
      reps: 5,
    },
    {
      weightLb: roundToLoadable(workingLb * 0.6, barLb, plates, 'down'),
      reps: 3,
    },
    {
      weightLb: roundToLoadable(workingLb * 0.8, barLb, plates, 'down'),
      reps: 2,
    },
  ];

  const out: WarmupSet[] = [];
  for (const step of steps) {
    if (step.weightLb >= workingLb) continue;
    const prev = out[out.length - 1];
    if (prev && step.weightLb <= prev.weightLb) continue; // keep strictly ascending
    out.push(step);
  }
  return out;
}

/**
 * Per-side plate breakdown for a loadable weight (the plate calculator). Returns
 * plates largest-first in lb, or null if the weight is not exactly loadable from
 * the inventory (round with {@link roundToLoadable} first). Empty array = bar only.
 */
export function platesForWeight(
  weightLb: number,
  barLb: number,
  plates: number[],
): number[] | null {
  const perSideCs = cs((weightLb - barLb) / 2);
  if (perSideCs < 0) return null;
  if (perSideCs === 0) return [];

  const plateCs = plates
    .map(cs)
    .filter((p) => p > 0)
    .sort((a, b) => b - a);
  if (plateCs.length === 0) return null;

  const reach = reachablePerSide(plateCs, perSideCs);
  if (!reach[perSideCs]) return null;

  const out: number[] = [];
  let s = perSideCs;
  while (s > 0) {
    // Largest plate that still leaves a reachable remainder (guaranteed to exist).
    const p = plateCs.find((pc) => pc <= s && reach[s - pc])!;
    out.push(p);
    s -= p;
  }
  return out.map(lb);
}

/**
 * Plate-loading math (spec §6.1, §6.3). Pure. Works in integer centi-kilograms to
 * avoid floating-point drift (0.01 kg resolution covers 0.25 kg microplates).
 *
 * Model: a barbell loaded symmetrically — total = bar + 2 × (sum of plates per
 * side). Plate denominations come from the user's inventory and may be used in any
 * quantity (pairs). `roundToLoadable` snaps a target to the nearest achievable load.
 */
import type { RoundingMode } from './types';

const SCALE = 100;
const cs = (kg: number) => Math.round(kg * SCALE);
const kg = (centi: number) => centi / SCALE;

/** Reachable per-side sums (in centi-kg) up to `boundCs`, from unlimited plate
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
 * Snap `targetKg` to the nearest weight loadable from `plates` on a `barKg` bar.
 * Targets at or below the empty bar return the bar. Modes: 'nearest' (tie → lower,
 * the conservative choice), 'down' (≤ target), 'up' (≥ target).
 */
export function roundToLoadable(
  targetKg: number,
  barKg: number,
  plates: number[],
  mode: RoundingMode = 'nearest',
): number {
  const perSideCs = cs((targetKg - barKg) / 2);
  if (perSideCs <= 0) return barKg;

  const plateCs = plates.map(cs).filter((p) => p > 0);
  if (plateCs.length === 0) return barKg;

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

  return barKg + 2 * kg(best);
}

/** True iff `weightKg` is exactly loadable: the bar, or bar + plate pairs. */
export function isLoadable(
  weightKg: number,
  barKg: number,
  plates: number[],
): boolean {
  const perSideCs = cs((weightKg - barKg) / 2);
  if (perSideCs < 0) return false;
  if (perSideCs === 0) return true;
  const plateCs = plates.map(cs).filter((p) => p > 0);
  if (plateCs.length === 0) return false;
  return reachablePerSide(plateCs, perSideCs)[perSideCs] === true;
}

export interface WarmupSet {
  weightKg: number;
  reps: number;
}

/**
 * Warm-up ramp toward `workingKg` (spec §6.1 calculators): empty bar, then ~40/60/80%
 * plate-rounded down, ascending and de-duplicated, all strictly below the work set.
 * Returns [] when the working weight is the bar or lighter.
 */
export function generateWarmupRamp(
  workingKg: number,
  barKg: number,
  plates: number[],
): WarmupSet[] {
  if (workingKg <= barKg) return [];

  const steps: WarmupSet[] = [
    { weightKg: barKg, reps: 8 },
    {
      weightKg: roundToLoadable(workingKg * 0.4, barKg, plates, 'down'),
      reps: 5,
    },
    {
      weightKg: roundToLoadable(workingKg * 0.6, barKg, plates, 'down'),
      reps: 3,
    },
    {
      weightKg: roundToLoadable(workingKg * 0.8, barKg, plates, 'down'),
      reps: 2,
    },
  ];

  const out: WarmupSet[] = [];
  for (const step of steps) {
    if (step.weightKg >= workingKg) continue;
    const prev = out[out.length - 1];
    if (prev && step.weightKg <= prev.weightKg) continue; // keep strictly ascending
    out.push(step);
  }
  return out;
}

/**
 * Per-side plate breakdown for a loadable weight (the plate calculator). Returns
 * plates largest-first in kg, or null if the weight is not exactly loadable from
 * the inventory (round with {@link roundToLoadable} first). Empty array = bar only.
 */
export function platesForWeight(
  weightKg: number,
  barKg: number,
  plates: number[],
): number[] | null {
  const perSideCs = cs((weightKg - barKg) / 2);
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
  return out.map(kg);
}

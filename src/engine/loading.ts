/**
 * Load types (audit 2026-09-24). Every prescription used to go through barbell plate
 * math, so any target under the bar came back as the bar: a 13 lb dumbbell raise and
 * a pull-up were both prescribed 45 lb. The load type now decides which weights are
 * reachable. Pure. Integer centi-pounds, as in ./rounding, to avoid float drift.
 */
import { roundToLoadable } from './rounding';
import type { LoadSteps, LoadType, RoundingMode } from './types';

/** Common US gym increments: dumbbells 2.5 lb apart below 20 lb, 5 lb from 20 up;
 *  cable and machine stacks in 5 lb steps. */
export const DEFAULT_LOAD_STEPS: LoadSteps = {
  dumbbellStepLb: 5,
  dumbbellSmallStepLb: 2.5,
  dumbbellSmallBelowLb: 20,
  stackStepLb: 5,
};

/** Step for weight added to a bodyweight lift (belt or vest), in lb. */
const BODYWEIGHT_ADDED_STEP_LB = 2.5;

const SCALE = 100;
const cs = (lb: number) => Math.round(lb * SCALE);
const lb = (centi: number) => centi / SCALE;

/** Catalog equipment (free-exercise-db, normalized) to load type. The bodyweight flag
 *  wins. Unknown equipment is treated as a 5 lb stack: a plausible fixed increment
 *  that, unlike the barbell, never forces a 45 lb floor. */
export function loadTypeFor(
  equipment?: string,
  isBodyweight?: boolean,
): LoadType {
  if (isBodyweight) return 'bodyweight';
  switch (equipment) {
    case 'barbell':
      return 'barbell';
    case 'dumbbell':
    case 'kettlebell':
      return 'dumbbell';
    case 'bodyweight':
    case 'bands':
      return 'bodyweight';
    default:
      return 'stack';
  }
}

function pick(t: number, down: number, up: number, mode: RoundingMode): number {
  if (mode === 'down') return down;
  if (mode === 'up') return up;
  return up - t < t - down ? up : down; // tie -> lower, the conservative choice
}

/** Round to a fixed step with a floor. */
function roundToStep(
  t: number,
  step: number,
  min: number,
  mode: RoundingMode,
): number {
  const down = Math.floor(t / step) * step;
  const up = Math.ceil(t / step) * step;
  return Math.max(min, pick(t, down, up, mode));
}

function roundDumbbell(t: number, s: LoadSteps, mode: RoundingMode): number {
  const small = cs(s.dumbbellSmallStepLb);
  const big = cs(s.dumbbellStepLb);
  const pivot = cs(s.dumbbellSmallBelowLb);
  let down: number;
  let up: number;
  if (t < pivot) {
    down = Math.floor(t / small) * small;
    up = Math.min(Math.ceil(t / small) * small, pivot);
  } else {
    down = pivot + Math.floor((t - pivot) / big) * big;
    up = pivot + Math.ceil((t - pivot) / big) * big;
  }
  return Math.max(small, pick(t, down, up, mode));
}

/**
 * Snap a target to the nearest weight reachable for this load type.
 * - barbell: plate math on the lifter's bar and plates (bar floor, as before);
 * - dumbbell: the dumbbell ladder, never below the smallest dumbbell;
 * - stack: the stack step, never below one step;
 * - bodyweight: 0 stays 0 in every mode (bodyweight only is a real prescription,
 *   not something to round up); added or assisted load moves in 2.5 lb steps.
 */
export function roundForLoad(
  targetLb: number,
  loadType: LoadType,
  barLb: number,
  plates: number[],
  steps: LoadSteps = DEFAULT_LOAD_STEPS,
  mode: RoundingMode = 'nearest',
): number {
  const t = cs(targetLb);
  switch (loadType) {
    case 'barbell':
      return roundToLoadable(targetLb, barLb, plates, mode);
    case 'dumbbell':
      return lb(roundDumbbell(t, steps, mode));
    case 'stack': {
      const step = cs(steps.stackStepLb);
      return lb(roundToStep(t, step, step, mode));
    }
    case 'bodyweight': {
      if (t === 0) return 0;
      const step = cs(BODYWEIGHT_ADDED_STEP_LB);
      return lb(roundToStep(t, step, -Infinity, mode));
    }
  }
}

/**
 * Prescription correctness (phase 2 audit, 2026-09-24). These began as runtime proofs
 * against the shipped engine, each of which reproduced a real bug:
 *   P1/P2  every non-barbell lift was snapped up to the 45 lb bar (dumbbell 13 -> 45,
 *          bodyweight 0 -> 45), because every load went through barbell plate math;
 *   P3/P4  progression added the increment to the STORED weight and ignored the weight
 *          the lifter actually logged (15 lb x14 logged -> 47.5 next; 135x5 -> 97.5);
 *   P5     a 1.25 lb increment on a barbell never moved (45 + 1.25 ties back to 45).
 * The load type now travels in EngineSettings and progression starts from what was
 * logged. Barbell behaviour with no load type is unchanged (the rule suites pin it).
 */
import { describe, it, expect } from 'vitest';
import { nextPrescription } from './index';
import type {
  EngineSettings,
  ExerciseState,
  LoadType,
  ProgressionRule,
  SetResult,
  SetScheme,
} from './types';

const base: EngineSettings = {
  barLb: 45,
  plateInventoryLb: [1.25, 2.5, 5, 10, 25, 35, 45],
  rounding: 'nearest',
  units: 'lb',
};
const as = (loadType: LoadType): EngineSettings => ({ ...base, loadType });

const ISO: ProgressionRule = {
  kind: 'double',
  repMin: 10,
  repMax: 14,
  incrementLb: 1.25,
  perSet: false,
};
const ISO_SCHEME: SetScheme = { sets: 3, repRange: [10, 14] };
const LIN: ProgressionRule = {
  kind: 'linear',
  incrementLb: 2.5,
  failsBeforeDeload: 3,
  deloadPct: 0.1,
};
const LIN_SCHEME: SetScheme = { sets: 3, repTarget: 5 };

const st = (w: number, over: Partial<ExerciseState> = {}): ExerciseState => ({
  workingWeightLb: w,
  consecutiveFails: 0,
  stage: 0,
  cyclePos: 0,
  ...over,
});
const sets = (weights: number[], reps: number | number[]): SetResult[] =>
  weights.map((w, i) => ({
    weightLb: w,
    reps: Array.isArray(reps) ? reps[i]! : reps,
    type: 'working' as const,
    completed: true,
  }));
const loads = (r: ReturnType<typeof nextPrescription>) =>
  r.prescription.sets.map((s) => s.targetWeightLb);

describe('P1/P2: the load type decides rounding, not the barbell', () => {
  it('P1: a 13 lb dumbbell seed is prescribed at 12.5 lb, not the 45 lb bar', () => {
    expect(
      loads(nextPrescription(ISO, st(13), [], as('dumbbell'), ISO_SCHEME)),
    ).toEqual([12.5, 12.5, 12.5]);
  });

  it('P2: a bodyweight lift seeded at 0 stays at 0 external load', () => {
    expect(
      loads(nextPrescription(ISO, st(0), [], as('bodyweight'), ISO_SCHEME)),
    ).toEqual([0, 0, 0]);
  });

  it('a cable or machine stack rounds to its 5 lb step, never up to the bar', () => {
    expect(
      loads(nextPrescription(ISO, st(22), [], as('stack'), ISO_SCHEME)),
    ).toEqual([20, 20, 20]);
  });

  it('with no load type the old barbell behaviour holds (bar floor)', () => {
    expect(loads(nextPrescription(ISO, st(13), [], base, ISO_SCHEME))).toEqual([
      45, 45, 45,
    ]);
  });

  it('GZCLP T3 on dumbbells is not floored at the bar either', () => {
    const r = nextPrescription(
      { kind: 'gzclp', tier: 3 },
      st(15),
      [],
      as('dumbbell'),
      { sets: 3 },
    );
    expect(r.prescription.sets.every((s) => s.targetWeightLb === 15)).toBe(
      true,
    );
  });
});

describe('P3/P4: progression starts from the weight actually logged', () => {
  it('P3: logged 15 lb x14 on a 45 lb dumbbell prescription -> next is 17.5, not 47.5', () => {
    const r = nextPrescription(
      ISO,
      st(45),
      sets([15, 15, 15], 14),
      as('dumbbell'),
      ISO_SCHEME,
    );
    expect(r.nextState.workingWeightLb).toBe(17.5);
    expect(r.prescription.reason).toMatch(/15 lb/);
  });

  it('P4: logged 135 x5 on a 95 lb linear prescription -> next is 137.5, not 97.5', () => {
    const r = nextPrescription(
      LIN,
      st(95),
      sets([135, 135, 135], 5),
      base,
      LIN_SCHEME,
    );
    expect(r.nextState.workingWeightLb).toBe(137.5);
  });

  it('a weight change resets the miss counter (a new weight is a new attempt series)', () => {
    const r = nextPrescription(
      LIN,
      st(95, { consecutiveFails: 2 }),
      sets([85, 85, 85], [5, 5, 4]),
      base,
      LIN_SCHEME,
    );
    expect(r.nextState.consecutiveFails).toBe(1);
    expect(r.nextState.workingWeightLb).toBe(85);
  });

  it('dropping the weight on one set counts as a miss at the main weight (hold, do not add)', () => {
    const r = nextPrescription(
      LIN,
      st(100),
      sets([100, 100, 90], 5),
      base,
      LIN_SCHEME,
    );
    expect(r.nextState.workingWeightLb).toBe(100);
    expect(r.nextState.consecutiveFails).toBe(1);
  });

  it('manual carries the logged weight forward', () => {
    const r = nextPrescription(
      { kind: 'manual' },
      st(45),
      sets([25, 25], 10),
      as('dumbbell'),
      ISO_SCHEME,
    );
    expect(r.nextState.workingWeightLb).toBe(25);
  });
});

describe('P5: an increase always lands on the next loadable step', () => {
  it('a barbell isolation lift with a 1.25 lb increment moves 45 -> 47.5 (was stuck at 45)', () => {
    const r = nextPrescription(
      ISO,
      st(45),
      sets([45, 45, 45], 14),
      base,
      ISO_SCHEME,
    );
    expect(r.nextState.workingWeightLb).toBe(47.5);
    expect(r.prescription.reason).toMatch(/\+2\.5 lb/);
  });

  it('dumbbells step 2.5 below 20 lb and 5 from 20 up', () => {
    const at = (w: number) =>
      nextPrescription(
        ISO,
        st(w),
        sets([w, w, w], 14),
        as('dumbbell'),
        ISO_SCHEME,
      ).nextState.workingWeightLb;
    expect(at(12.5)).toBe(15);
    expect(at(17.5)).toBe(20);
    expect(at(20)).toBe(25);
  });

  it('pure bodyweight at 0 does not grow external load; the reason says so', () => {
    const r = nextPrescription(
      ISO,
      st(0),
      sets([0, 0, 0], 14),
      as('bodyweight'),
      ISO_SCHEME,
    );
    expect(r.nextState.workingWeightLb).toBe(0);
    expect(r.prescription.reason).toMatch(/bodyweight/i);
  });

  it('linear on pure bodyweight also holds at 0 rather than adding plates', () => {
    const r = nextPrescription(
      LIN,
      st(0),
      sets([0, 0, 0], 5),
      as('bodyweight'),
      LIN_SCHEME,
    );
    expect(r.nextState.workingWeightLb).toBe(0);
    expect(r.prescription.reason).toMatch(/bodyweight/i);
  });

  it('a deload rounds down, never up past the old weight', () => {
    const r = nextPrescription(
      LIN,
      st(100, { consecutiveFails: 2 }),
      sets([100, 100, 100], [5, 5, 3]),
      base,
      LIN_SCHEME,
    );
    expect(r.nextState.workingWeightLb).toBeLessThanOrEqual(90);
  });
});

import { describe, it, expect } from 'vitest';
import {
  e1rmEpley,
  e1rmBrzycki,
  e1rm,
  isE1rmEligible,
  ewma,
  bestSessionE1rm,
  EWMA_ALPHA,
} from './e1rm';
import type { SetResult } from './types';

const work = (over: Partial<SetResult> = {}): SetResult => ({
  weightLb: 100,
  reps: 5,
  type: 'working',
  completed: true,
  ...over,
});

describe('e1RM formulas', () => {
  it('Epley: w·(1 + r/30)', () => {
    expect(e1rmEpley(100, 5)).toBeCloseTo(116.667, 2);
    expect(e1rmEpley(100, 1)).toBeCloseTo(103.333, 2);
  });
  it('Brzycki: w·36/(37 − r)', () => {
    expect(e1rmBrzycki(100, 5)).toBeCloseTo(112.5, 2);
    expect(e1rmBrzycki(100, 1)).toBeCloseTo(100, 5); // r=1 → identity
  });
  it('e1rm is the mean of Epley and Brzycki', () => {
    expect(e1rm(100, 5)).toBeCloseTo((116.667 + 112.5) / 2, 2);
  });
  it('a single rep returns ~the weight lifted', () => {
    expect(e1rm(140, 1)).toBeCloseTo((140 * (1 + 1 / 30) + 140) / 2, 2);
  });
});

describe('isE1rmEligible', () => {
  it('accepts completed working/AMRAP sets with 1–10 reps and positive load', () => {
    expect(isE1rmEligible(work({ reps: 5 }))).toBe(true);
    expect(isE1rmEligible(work({ type: 'amrap', reps: 3 }))).toBe(true);
    expect(isE1rmEligible(work({ reps: 1 }))).toBe(true);
    expect(isE1rmEligible(work({ reps: 10 }))).toBe(true);
  });
  it('excludes reps > 10 (low confidence)', () => {
    expect(isE1rmEligible(work({ reps: 11 }))).toBe(false);
    expect(isE1rmEligible(work({ reps: 20 }))).toBe(false);
  });
  it('excludes warmups, incomplete sets, and non-positive loads', () => {
    expect(isE1rmEligible(work({ type: 'warmup' }))).toBe(false);
    expect(isE1rmEligible(work({ completed: false }))).toBe(false);
    expect(isE1rmEligible(work({ weightLb: 0 }))).toBe(false); // bodyweight
    expect(isE1rmEligible(work({ weightLb: -10 }))).toBe(false); // assisted
    expect(isE1rmEligible(work({ reps: 0 }))).toBe(false);
  });
});

describe('ewma', () => {
  it('seeds with the first value', () => {
    expect(ewma(null, 100)).toBe(100);
  });
  it('blends with α=0.3', () => {
    expect(EWMA_ALPHA).toBe(0.3);
    expect(ewma(100, 110)).toBeCloseTo(0.3 * 110 + 0.7 * 100, 6);
  });
  it('accepts a custom alpha', () => {
    expect(ewma(100, 110, 0.5)).toBeCloseTo(105, 6);
  });
});

describe('bestSessionE1rm', () => {
  it('returns the max e1RM among eligible sets', () => {
    const best = bestSessionE1rm([
      work({ weightLb: 100, reps: 5 }),
      work({ weightLb: 110, reps: 3 }),
      work({ weightLb: 90, reps: 8 }),
    ]);
    expect(best).toBeCloseTo(e1rm(110, 3), 6);
  });
  it('ignores ineligible sets (warmups, >10 reps, incomplete)', () => {
    const best = bestSessionE1rm([
      work({ type: 'warmup', weightLb: 200, reps: 1 }),
      work({ weightLb: 80, reps: 20 }),
      work({ weightLb: 100, reps: 5 }),
    ]);
    expect(best).toBeCloseTo(e1rm(100, 5), 6);
  });
  it('returns null when no set qualifies', () => {
    expect(bestSessionE1rm([work({ completed: false })])).toBeNull();
    expect(bestSessionE1rm([])).toBeNull();
  });
});

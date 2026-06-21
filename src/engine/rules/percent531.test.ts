import { describe, it, expect } from 'vitest';
import { percent531Next } from './percent531';
import { isLoadable } from '../rounding';
import type { EngineSettings, ExerciseState, SetResult } from '../types';

const settings: EngineSettings = {
  barKg: 20,
  plateInventoryKg: [1.25, 2.5, 5, 10, 15, 20, 25],
  rounding: 'nearest',
  units: 'kg',
};
const rule = (over: Partial<{ variant: 'base' | 'bbb' | 'fsl'; tmIncrementKg: number }> = {}) =>
  ({ kind: 'percent531', variant: 'base', tmIncrementKg: 2.5, ...over }) as const;
const state = (over: Partial<ExerciseState> = {}): ExerciseState => ({
  workingWeightKg: 100,
  trainingMaxKg: 100,
  consecutiveFails: 0,
  stage: 0,
  cyclePos: 0,
  ...over,
});
const top = (reps: number, completed = true): SetResult => ({
  weightKg: 95,
  reps,
  type: 'amrap',
  completed,
});
const work = (topReps: number, completed = true): SetResult[] => [
  { weightKg: 75, reps: 5, type: 'working', completed: true },
  { weightKg: 85, reps: 5, type: 'working', completed: true },
  top(topReps, completed),
];
const allLoadable = (r: ReturnType<typeof percent531Next>) =>
  r.prescription.sets.every((s) =>
    isLoadable(s.targetWeightKg, settings.barKg, settings.plateInventoryKg),
  );

describe('5/3/1', () => {
  it('seeds Week 1 from the TM when there is no history', () => {
    const r = percent531Next(rule(), state(), [], settings);
    expect(r.prescription.reason).toMatch(/Week 1/);
    expect(r.prescription.sets.slice(0, 3).map((s) => s.targetReps)).toEqual([5, 5, 5]);
    expect(r.prescription.sets[2]!.amrap).toBe(true);
    expect(r.nextState.cyclePos).toBe(0);
    expect(allLoadable(r)).toBe(true);
  });

  it('initialises the TM from workingWeightKg when none is set', () => {
    const r = percent531Next(rule(), state({ trainingMaxKg: undefined, workingWeightKg: 90 }), [], settings);
    expect(r.nextState.trainingMaxKg).toBe(90);
  });

  it('advances W1 → W2 (3/3/3) on completion', () => {
    const r = percent531Next(rule(), state({ cyclePos: 0 }), work(7), settings);
    expect(r.nextState.cyclePos).toBe(1);
    expect(r.prescription.sets.slice(0, 3).map((s) => s.targetReps)).toEqual([3, 3, 3]);
    expect(r.prescription.flags).toEqual([]);
  });

  it('advances W2 → W3 (5/3/1)', () => {
    const r = percent531Next(rule(), state({ cyclePos: 1 }), work(5), settings);
    expect(r.nextState.cyclePos).toBe(2);
    expect(r.prescription.sets.slice(0, 3).map((s) => s.targetReps)).toEqual([5, 3, 1]);
  });

  it('W3 completed normally → W4 deload, no flags', () => {
    const r = percent531Next(rule(), state({ cyclePos: 2 }), work(2), settings);
    expect(r.nextState.cyclePos).toBe(3);
    expect(r.prescription.sets).toHaveLength(3); // deload: no AMRAP, no supplemental
    expect(r.prescription.sets.some((s) => s.amrap)).toBe(false);
    expect(r.prescription.flags).toEqual([]);
  });

  it('W3 top set fails (0 reps) → TM resets to ~90% e1RM, deload flag', () => {
    const r = percent531Next(rule(), state({ cyclePos: 2 }), work(0), settings);
    expect(r.prescription.flags).toContain('deload');
    expect(r.nextState.trainingMaxKg).toBeLessThan(100);
    expect(r.prescription.reason).toMatch(/reset/i);
  });

  it('W3 top set not completed also triggers the reset', () => {
    const r = percent531Next(rule(), state({ cyclePos: 2 }), work(1, false), settings);
    expect(r.prescription.flags).toContain('deload');
  });

  it('W3 reset falls back to the prior TM when no set is e1RM-eligible', () => {
    // All sets > 10 reps → none eligible → fallback to 0.9 * tm0.
    const noE1rm: SetResult[] = [
      { weightKg: 75, reps: 12, type: 'working', completed: true },
      { weightKg: 0, reps: 0, type: 'amrap', completed: false },
    ];
    const r = percent531Next(rule(), state({ cyclePos: 2 }), noE1rm, settings);
    expect(r.nextState.trainingMaxKg).toBeCloseTo(90, 0); // 0.9 * 100
  });

  it('W4 deload completed → new cycle, TM increases, tmIncrease flag', () => {
    const deloadWork: SetResult[] = [
      { weightKg: 40, reps: 5, type: 'working', completed: true },
      { weightKg: 50, reps: 5, type: 'working', completed: true },
      { weightKg: 60, reps: 5, type: 'working', completed: true },
    ];
    const r = percent531Next(rule(), state({ cyclePos: 3 }), deloadWork, settings);
    expect(r.nextState.cyclePos).toBe(0);
    expect(r.prescription.flags).toContain('tmIncrease');
    expect(r.nextState.trainingMaxKg).toBe(102.5);
    expect(r.prescription.reason).toMatch(/New cycle/);
  });

  it('BBB variant adds 5×10 supplemental on work weeks', () => {
    const r = percent531Next(rule({ variant: 'bbb' }), state({ cyclePos: 0 }), [], settings);
    const supplemental = r.prescription.sets.filter((s) => s.targetReps === 10);
    expect(supplemental).toHaveLength(5);
    expect(allLoadable(r)).toBe(true);
  });

  it('FSL variant adds 5×5 @ the first-set weight', () => {
    const r = percent531Next(rule({ variant: 'fsl' }), state({ cyclePos: 0 }), [], settings);
    const fsl = r.prescription.sets.filter((s) => s.targetReps === 5);
    // 3 main + 5 FSL = 8 sets of 5 reps on W1 (reps 5/5/5 + 5×5).
    expect(fsl.length).toBeGreaterThanOrEqual(5);
    expect(allLoadable(r)).toBe(true);
  });

  it('no supplemental volume on the deload week even with a variant', () => {
    const r = percent531Next(rule({ variant: 'bbb' }), state({ cyclePos: 2 }), work(2), settings);
    expect(r.nextState.cyclePos).toBe(3); // deload
    expect(r.prescription.sets).toHaveLength(3);
  });

  it('normalises an out-of-range cyclePos', () => {
    const r = percent531Next(rule(), state({ cyclePos: -1 }), [], settings);
    expect(r.prescription.reason).toMatch(/Week 4/); // -1 → week 3 (deload)
  });
});

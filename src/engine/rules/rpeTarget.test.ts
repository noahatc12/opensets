import { describe, it, expect } from 'vitest';
import { rpeTargetNext } from './rpeTarget';
import { isLoadable } from '../rounding';
import type { EngineSettings, ExerciseState, ProgressionRule, SetResult, SetScheme } from '../types';

const settings: EngineSettings = {
  barLb: 45,
  plateInventoryLb: [1.25, 2.5, 5, 10, 25, 35, 45],
  rounding: 'nearest',
  units: 'lb',
};
const rule = { kind: 'rpeTarget', targetRpe: 8, targetReps: 5, loadStepPct: 0.04 } as Extract<
  ProgressionRule,
  { kind: 'rpeTarget' }
>;
const scheme: SetScheme = { sets: 3 };
const state = (w = 100): ExerciseState => ({
  workingWeightLb: w,
  consecutiveFails: 0,
  stage: 0,
  cyclePos: 0,
});
const top = (rpe: number | undefined): SetResult[] => [
  { weightLb: 100, reps: 5, type: 'working', completed: true, ...(rpe !== undefined ? { rpe } : {}) },
];

describe('RPE-target autoregulation', () => {
  it('seeds the starting weight with no history', () => {
    const r = rpeTargetNext(rule, state(), [], settings, scheme);
    expect(r.prescription.sets).toHaveLength(3);
    expect(r.prescription.sets[0]!.targetRpe).toBe(8);
    expect(r.prescription.sets[0]!.targetReps).toBe(5);
    expect(r.prescription.reason).toMatch(/Starting weight/);
  });

  it('top set under target → adds load', () => {
    const r = rpeTargetNext(rule, state(100), top(7), settings, scheme);
    expect(r.nextState.workingWeightLb).toBeGreaterThan(100); // ~104 → rounded
    expect(r.prescription.reason).toMatch(/\+4%/);
  });

  it('top set over target → drops load', () => {
    const r = rpeTargetNext(rule, state(100), top(9), settings, scheme);
    expect(r.nextState.workingWeightLb).toBeLessThan(100); // ~96
    expect(r.prescription.reason).toMatch(/−4%/);
  });

  it('top set on target → holds', () => {
    const r = rpeTargetNext(rule, state(100), top(8), settings, scheme);
    expect(r.prescription.reason).toMatch(/on target/);
  });

  it('clamps the adjustment to ±10%', () => {
    const r = rpeTargetNext(rule, state(100), top(5), settings, scheme); // dev +3 → +12% → clamp +10%
    expect(r.nextState.workingWeightLb).toBeLessThanOrEqual(110);
    expect(r.nextState.workingWeightLb).toBeGreaterThan(105);
  });

  it('holds when no RPE was logged', () => {
    const r = rpeTargetNext(rule, state(100), top(undefined), settings, scheme);
    expect(r.prescription.reason).toMatch(/log RPE/i);
    expect(r.nextState.workingWeightLb).toBe(100);
  });

  it('every prescribed weight is loadable', () => {
    const r = rpeTargetNext(rule, state(100), top(6), settings, scheme);
    expect(
      r.prescription.sets.every((s) => isLoadable(s.targetWeightLb, settings.barLb, settings.plateInventoryLb)),
    ).toBe(true);
  });
});

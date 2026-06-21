import { describe, it, expect } from 'vitest';
import { repsOnlyNext } from './repsOnly';
import { isLoadable } from '../rounding';
import type { EngineSettings, ExerciseState, ProgressionRule, SetResult, SetScheme } from '../types';

const settings: EngineSettings = {
  barLb: 45,
  plateInventoryLb: [1.25, 2.5, 5, 10, 25, 35, 45],
  rounding: 'nearest',
  units: 'lb',
};
const rule = (repIncrement = 1) =>
  ({ kind: 'repsOnly', repIncrement }) as Extract<ProgressionRule, { kind: 'repsOnly' }>;
const scheme: SetScheme = { sets: 3, repTarget: 8 };
const state = (over: Partial<ExerciseState> = {}): ExerciseState => ({
  workingWeightLb: 0,
  consecutiveFails: 0,
  stage: 0,
  cyclePos: 0,
  ...over,
});
const bw = (reps: number, n = 3, completed = true): SetResult[] =>
  Array.from({ length: n }, () => ({ weightLb: 0, reps, type: 'working' as const, completed }));

describe('repsOnly (bodyweight)', () => {
  it('seeds the base rep target from the scheme', () => {
    const r = repsOnlyNext(rule(), state(), [], settings, scheme);
    expect(r.prescription.sets).toHaveLength(3);
    expect(r.prescription.sets[0]!.targetReps).toBe(8);
    expect(r.nextState.stage).toBe(8);
  });

  it('all sets hit the target → +repIncrement', () => {
    const r = repsOnlyNext(rule(1), state({ stage: 8 }), bw(8), settings, scheme);
    expect(r.nextState.stage).toBe(9);
    expect(r.prescription.sets[0]!.targetReps).toBe(9);
    expect(r.prescription.reason).toMatch(/\+1 rep —/);
  });

  it('a short set holds the rep target', () => {
    const r = repsOnlyNext(rule(1), state({ stage: 8 }), bw(6), settings, scheme);
    expect(r.nextState.stage).toBe(8);
    expect(r.prescription.reason).toMatch(/Hold 8 reps/);
  });

  it('pluralises the increment in the reason', () => {
    const r = repsOnlyNext(rule(2), state({ stage: 8 }), bw(8), settings, scheme);
    expect(r.prescription.reason).toMatch(/\+2 reps/);
  });

  it('bodyweight load (0) passes through unrounded', () => {
    const r = repsOnlyNext(rule(), state({ workingWeightLb: 0 }), [], settings, scheme);
    expect(r.prescription.sets[0]!.targetWeightLb).toBe(0);
  });

  it('assisted (negative) load passes through unrounded', () => {
    const r = repsOnlyNext(rule(), state({ workingWeightLb: -15 }), [], settings, scheme);
    expect(r.prescription.sets[0]!.targetWeightLb).toBe(-15);
    expect(r.nextState.workingWeightLb).toBe(-15);
  });

  it('a positive added load IS plate-rounded and loadable', () => {
    const r = repsOnlyNext(rule(), state({ workingWeightLb: 24 }), [], settings, scheme);
    expect(isLoadable(r.prescription.sets[0]!.targetWeightLb, settings.barLb, settings.plateInventoryLb)).toBe(true);
  });

  it('falls back to the rep-range floor when no repTarget is set', () => {
    const r = repsOnlyNext(rule(), state(), [], settings, { sets: 2, repRange: [12, 20] });
    expect(r.prescription.sets[0]!.targetReps).toBe(12);
  });
});

import { describe, it, expect } from 'vitest';
import { doubleNext } from './double';
import type {
  EngineSettings,
  ExerciseState,
  ProgressionRule,
  SetResult,
  SetScheme,
} from '../types';

const settings: EngineSettings = {
  barLb: 45,
  plateInventoryLb: [1.25, 2.5, 5, 10, 25, 35, 45],
  rounding: 'nearest',
  units: 'lb',
};
const rule: Extract<ProgressionRule, { kind: 'double' }> = {
  kind: 'double',
  repMin: 8,
  repMax: 12,
  incrementLb: 2.5,
  perSet: false,
};
const scheme: SetScheme = { sets: 3, repRange: [8, 12] };
const state = (over: Partial<ExerciseState> = {}): ExerciseState => ({
  workingWeightLb: 60,
  consecutiveFails: 0,
  stage: 0,
  cyclePos: 0,
  ...over,
});
const set = (reps: number, over: Partial<SetResult> = {}): SetResult => ({
  weightLb: 60,
  reps,
  type: 'working',
  completed: true,
  ...over,
});

describe('double progression', () => {
  it('first session prescribes the start weight, targeting the top of the range', () => {
    const r = doubleNext(rule, state(), [], settings, scheme);
    expect(r.nextState.workingWeightLb).toBe(60);
    expect(r.prescription.sets).toHaveLength(3);
    expect(r.prescription.sets[0]!.targetReps).toBe(12);
    expect(r.prescription.reason).toMatch(/build toward 12/i);
  });

  it('all sets at repMax → +increment', () => {
    const last = [set(12), set(12), set(12)];
    const r = doubleNext(rule, state(), last, settings, scheme);
    expect(r.nextState.workingWeightLb).toBe(62.5);
    expect(r.prescription.reason).toMatch(/\+2\.5 lb/);
  });

  it('exceeding repMax also counts as cleared', () => {
    const last = [set(14), set(13), set(12)];
    const r = doubleNext(rule, state(), last, settings, scheme);
    expect(r.nextState.workingWeightLb).toBe(62.5);
  });

  it('not all sets at repMax → hold weight, build reps', () => {
    const last = [set(12), set(11), set(10)];
    const r = doubleNext(rule, state(), last, settings, scheme);
    expect(r.nextState.workingWeightLb).toBe(60);
    expect(r.prescription.reason).toMatch(/add reps toward 8–12/i);
  });

  it('an incomplete top-rep set does not trigger progression', () => {
    const last = [set(12), set(12), set(12, { completed: false })];
    const r = doubleNext(rule, state(), last, settings, scheme);
    expect(r.nextState.workingWeightLb).toBe(60);
  });
});

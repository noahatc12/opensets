import { describe, it, expect } from 'vitest';
import { linearNext } from './linear';
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
const rule: Extract<ProgressionRule, { kind: 'linear' }> = {
  kind: 'linear',
  incrementLb: 5,
  failsBeforeDeload: 3,
  deloadPct: 0.1,
};
const scheme: SetScheme = { sets: 3, repTarget: 5 };
const state = (over: Partial<ExerciseState> = {}): ExerciseState => ({
  workingWeightLb: 60,
  consecutiveFails: 0,
  stage: 0,
  cyclePos: 0,
  ...over,
});
const set = (over: Partial<SetResult> = {}): SetResult => ({
  weightLb: 60,
  reps: 5,
  type: 'working',
  completed: true,
  ...over,
});

describe('linear progression', () => {
  it('first session (no history) prescribes the starting weight, no change', () => {
    const r = linearNext(rule, state(), [], settings, scheme);
    expect(r.nextState.workingWeightLb).toBe(60);
    expect(r.prescription.sets).toHaveLength(3);
    expect(r.prescription.sets[0]!.targetReps).toBe(5);
    expect(r.prescription.sets[0]!.targetWeightLb).toBe(60);
    expect(r.prescription.reason).toMatch(/starting weight/i);
    expect(r.prescription.flags).toEqual([]);
  });

  it('all sets hit target → +increment, fails reset', () => {
    const last = [set(), set(), set()];
    const r = linearNext(
      rule,
      state({ consecutiveFails: 1 }),
      last,
      settings,
      scheme,
    );
    expect(r.nextState.workingWeightLb).toBe(65);
    expect(r.nextState.consecutiveFails).toBe(0);
    expect(r.prescription.reason).toMatch(/\+5 lb/);
  });

  it('a missed set → consecutiveFails++, weight held', () => {
    const last = [set(), set(), set({ reps: 3 })]; // last set short
    const r = linearNext(
      rule,
      state({ consecutiveFails: 0 }),
      last,
      settings,
      scheme,
    );
    expect(r.nextState.workingWeightLb).toBe(60);
    expect(r.nextState.consecutiveFails).toBe(1);
    expect(r.prescription.reason).toMatch(/repeat/i);
    expect(r.prescription.flags).toEqual([]);
  });

  it('an incomplete set also counts as a miss', () => {
    const last = [set(), set({ completed: false }), set()];
    const r = linearNext(rule, state(), last, settings, scheme);
    expect(r.nextState.consecutiveFails).toBe(1);
    expect(r.nextState.workingWeightLb).toBe(60);
  });

  it('reaching failsBeforeDeload triggers a deload and resets fails', () => {
    const last = [set({ reps: 2 })];
    const r = linearNext(
      rule,
      state({ consecutiveFails: 2 }),
      last,
      settings,
      scheme,
    );
    // 60 × 0.9 = 54 → loadable (20 bar + 2×17 not loadable; 55 is, 52.5 is) → nearest
    expect(r.nextState.workingWeightLb).toBeCloseTo(55, 1); // 54 rounds to nearest loadable 55
    expect(r.nextState.consecutiveFails).toBe(0);
    expect(r.prescription.flags).toContain('deload');
    expect(r.prescription.reason).toMatch(/deload −10%/i);
  });

  it('prescribed weights are always loadable', () => {
    const r = linearNext(
      rule,
      state({ workingWeightLb: 62.5 }),
      [set({ reps: 5 })],
      settings,
      scheme,
    );
    // 62.5 + 5 = 67.5 → loadable (20 + 2×23.75 = 20+2×(20+2.5+1.25)) yes
    expect(r.prescription.sets[0]!.targetWeightLb).toBe(67.5);
  });

  it('respects an AMRAP last set in the scheme', () => {
    const r = linearNext(rule, state(), [], settings, {
      sets: 3,
      repTarget: 5,
      amrapLast: true,
    });
    expect(r.prescription.sets[2]!.type).toBe('amrap');
    expect(r.prescription.sets[2]!.amrap).toBe(true);
    expect(r.prescription.sets[0]!.type).toBe('working');
  });

  it('falls back to the rep-range floor when no repTarget is given', () => {
    const r = linearNext(rule, state(), [], settings, {
      sets: 1,
      repRange: [4, 6],
    });
    expect(r.prescription.sets[0]!.targetReps).toBe(4);
  });

  it('defaults the rep target to 1 when the scheme has neither field', () => {
    const r = linearNext(rule, state(), [], settings, { sets: 2 });
    expect(r.prescription.sets).toHaveLength(2);
    expect(r.prescription.sets[0]!.targetReps).toBe(1);
  });

  it('counts a logged AMRAP set among the working sets', () => {
    const last = [set(), set(), set({ type: 'amrap', reps: 8 })];
    const r = linearNext(rule, state(), last, settings, {
      sets: 3,
      repTarget: 5,
      amrapLast: true,
    });
    expect(r.nextState.workingWeightLb).toBe(65); // amrap 8 ≥ target 5 → all hit
  });
});

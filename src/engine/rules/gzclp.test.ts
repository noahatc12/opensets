import { describe, it, expect } from 'vitest';
import { gzclpNext } from './gzclp';
import { isLoadable } from '../rounding';
import type { EngineSettings, ExerciseState, ProgressionRule, SetResult } from '../types';

const settings: EngineSettings = {
  barLb: 45,
  plateInventoryLb: [1.25, 2.5, 5, 10, 25, 35, 45],
  rounding: 'nearest',
  units: 'lb',
};
const rule = (tier: 1 | 2 | 3) => ({ kind: 'gzclp', tier }) as Extract<ProgressionRule, { kind: 'gzclp' }>;
const state = (over: Partial<ExerciseState> = {}): ExerciseState => ({
  workingWeightLb: 60,
  consecutiveFails: 0,
  stage: 0,
  cyclePos: 0,
  ...over,
});
const sets = (n: number, reps: number, completed = true): SetResult[] =>
  Array.from({ length: n }, (_, i) => ({
    weightLb: 60,
    reps,
    type: i === n - 1 ? 'amrap' : 'working',
    completed,
  }));
const loadable = (r: ReturnType<typeof gzclpNext>) =>
  r.prescription.sets.every((s) => isLoadable(s.targetWeightLb, settings.barLb, settings.plateInventoryLb));

describe('GZCLP T1 (5×3 → 6×2 → 10×1)', () => {
  it('seeds stage 1 (5×3+) with no history', () => {
    const r = gzclpNext(rule(1), state(), [], settings);
    expect(r.prescription.sets).toHaveLength(5);
    expect(r.prescription.sets[0]!.targetReps).toBe(3);
    expect(r.prescription.sets[4]!.amrap).toBe(true);
    expect(loadable(r)).toBe(true);
  });

  it('all reps hit → +5 lb, same stage', () => {
    const r = gzclpNext(rule(1), state(), sets(5, 3), settings);
    expect(r.nextState.workingWeightLb).toBe(65);
    expect(r.nextState.stage).toBe(0);
    expect(r.prescription.reason).toMatch(/\+5 lb/);
  });

  it('miss → drop to stage 2 (6×2), same weight', () => {
    const r = gzclpNext(rule(1), state(), sets(5, 2), settings); // 2 < target 3
    expect(r.nextState.stage).toBe(1);
    expect(r.nextState.workingWeightLb).toBe(60);
    expect(r.prescription.sets).toHaveLength(6);
    expect(r.prescription.flags).toContain('stageChange');
  });

  it('miss at stage 2 → stage 3 (10×1)', () => {
    const r = gzclpNext(rule(1), state({ stage: 1 }), sets(6, 1), settings); // 1 < target 2
    expect(r.nextState.stage).toBe(2);
    expect(r.prescription.sets).toHaveLength(10);
  });

  it('miss at stage 3 → recalibrate to ~85% e1RM, restart stage 1', () => {
    const r = gzclpNext(rule(1), state({ stage: 2 }), sets(10, 0), settings); // failed 10×1+
    expect(r.nextState.stage).toBe(0);
    expect(r.nextState.workingWeightLb).toBeLessThan(60);
    expect(r.prescription.flags).toContain('stageChange');
  });

  it('stage-3 reset falls back to the working weight when no set is e1RM-eligible', () => {
    const noE1rm: SetResult[] = [{ weightLb: 0, reps: 0, type: 'amrap', completed: false }];
    const r = gzclpNext(rule(1), state({ stage: 2 }), noE1rm, settings);
    // 0.85 * 60 = 51 → nearest loadable
    expect(r.nextState.workingWeightLb).toBeLessThan(60);
    expect(loadable(r)).toBe(true);
  });
});

describe('GZCLP T2 (3×10 → 3×8 → 3×6)', () => {
  it('seeds stage 1 (3×10), no AMRAP, anchors the weight', () => {
    const r = gzclpNext(rule(2), state(), [], settings);
    expect(r.prescription.sets).toHaveLength(3);
    expect(r.prescription.sets[0]!.targetReps).toBe(10);
    expect(r.prescription.sets.some((s) => s.amrap)).toBe(false);
    expect(r.nextState.anchorLb).toBe(60);
  });

  it('hit 3×10 → +5 lb, anchor follows', () => {
    const r = gzclpNext(rule(2), state(), sets(3, 10), settings);
    expect(r.nextState.workingWeightLb).toBe(65);
    expect(r.nextState.stage).toBe(0);
    expect(r.nextState.anchorLb).toBe(65);
  });

  it('miss 3×10 → drop to 3×8, weight + anchor held', () => {
    const r = gzclpNext(rule(2), state({ anchorLb: 60 }), sets(3, 7), settings);
    expect(r.nextState.stage).toBe(1);
    expect(r.nextState.workingWeightLb).toBe(60);
    expect(r.prescription.sets[0]!.targetReps).toBe(8);
  });

  it('miss 3×6 → restart 3×10 at the last 3×10 weight + increment', () => {
    const r = gzclpNext(rule(2), state({ stage: 2, workingWeightLb: 80, anchorLb: 70 }), sets(3, 5), settings);
    expect(r.nextState.stage).toBe(0);
    expect(r.nextState.workingWeightLb).toBe(75); // anchor 70 + 5
    expect(r.prescription.sets[0]!.targetReps).toBe(10);
    expect(r.prescription.flags).toContain('stageChange');
  });
});

describe('GZCLP T3 (3×15+)', () => {
  it('seeds 3×15 with an AMRAP final set', () => {
    const r = gzclpNext(rule(3), state(), [], settings);
    expect(r.prescription.sets).toHaveLength(3);
    expect(r.prescription.sets[2]!.amrap).toBe(true);
    expect(r.prescription.sets[0]!.targetReps).toBe(15);
  });

  it('AMRAP ≥ 25 reps → +5 lb', () => {
    const r = gzclpNext(rule(3), state(), sets(3, 25), settings);
    expect(r.nextState.workingWeightLb).toBe(65);
    expect(r.prescription.reason).toMatch(/≥ 25/);
  });

  it('AMRAP < 25 reps → hold', () => {
    const r = gzclpNext(rule(3), state(), sets(3, 18), settings);
    expect(r.nextState.workingWeightLb).toBe(60);
    expect(r.prescription.reason).toMatch(/Hold/);
  });

  it('an uncompleted AMRAP set holds the weight', () => {
    const r = gzclpNext(rule(3), state(), sets(3, 30, false), settings);
    expect(r.nextState.workingWeightLb).toBe(60);
  });
});

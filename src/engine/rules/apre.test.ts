import { describe, it, expect } from 'vitest';
import { apreNext } from './apre';
import { isLoadable } from '../rounding';
import type { EngineSettings, ExerciseState, ProgressionRule, SetResult } from '../types';

const settings: EngineSettings = {
  barLb: 45,
  plateInventoryLb: [1.25, 2.5, 5, 10, 25, 35, 45],
  rounding: 'nearest',
  units: 'lb',
};
const rule = (rm: 3 | 6 | 10) => ({ kind: 'apre', rm }) as Extract<ProgressionRule, { kind: 'apre' }>;
const state = (w = 100): ExerciseState => ({
  workingWeightLb: w,
  consecutiveFails: 0,
  stage: 0,
  cyclePos: 0,
});
const amrap = (reps: number, completed = true): SetResult[] => [
  { weightLb: 50, reps: 10, type: 'working', completed: true },
  { weightLb: 75, reps: 6, type: 'working', completed: true },
  { weightLb: 100, reps, type: 'amrap', completed },
];
const loadable = (r: ReturnType<typeof apreNext>) =>
  r.prescription.sets.every((s) => isLoadable(s.targetWeightLb, settings.barLb, settings.plateInventoryLb));

describe('APRE', () => {
  it('seeds a 4-set protocol with no history', () => {
    const r = apreNext(rule(10), state(), [], settings);
    expect(r.prescription.sets).toHaveLength(4);
    expect(r.prescription.sets[2]!.amrap).toBe(true);
    expect(r.prescription.sets[0]!.targetReps).toBe(10); // APRE-10 warm-up reps
    expect(r.prescription.reason).toMatch(/calibrate/i);
    expect(loadable(r)).toBe(true);
  });

  it('APRE-10: many AMRAP reps raise the RM', () => {
    const r = apreNext(rule(10), state(100), amrap(14), settings); // 12–16 → +5
    expect(r.nextState.workingWeightLb).toBe(105);
    expect(r.prescription.reason).toMatch(/\+5 lb/);
  });

  it('APRE-10: target-band reps hold the RM', () => {
    const r = apreNext(rule(10), state(100), amrap(10), settings); // 9–11 → 0
    expect(r.nextState.workingWeightLb).toBe(100);
    expect(r.prescription.reason).toMatch(/Hold/);
  });

  it('APRE-10: low AMRAP reps drop the RM', () => {
    const r = apreNext(rule(10), state(100), amrap(5), settings); // 4–6 → −10
    expect(r.nextState.workingWeightLb).toBe(90);
    expect(r.prescription.reason).toMatch(/−10 lb/);
  });

  it('APRE-6 and APRE-3 use their own warm-up reps and tables', () => {
    const r6 = apreNext(rule(6), state(100), amrap(10), settings); // 8–12 → +5
    expect(r6.prescription.sets[0]!.targetReps).toBe(6);
    expect(r6.nextState.workingWeightLb).toBe(105);
    const r3 = apreNext(rule(3), state(100), amrap(5), settings); // 5–6 → +5
    expect(r3.prescription.sets[0]!.targetReps).toBe(3);
    expect(r3.nextState.workingWeightLb).toBe(105);
  });

  it('an uncompleted AMRAP set counts as 0 reps (RM drops)', () => {
    const r = apreNext(rule(6), state(100), amrap(9, false), settings); // 0 → −10
    expect(r.nextState.workingWeightLb).toBe(90);
  });

  it('falls back to the last working set when no AMRAP set is logged', () => {
    const noAmrap: SetResult[] = [
      { weightLb: 100, reps: 4, type: 'working', completed: true },
    ];
    const r = apreNext(rule(6), state(100), noAmrap, settings); // 4 → −5
    expect(r.nextState.workingWeightLb).toBe(95);
  });

  it('very high AMRAP reps give the largest bump', () => {
    const r = apreNext(rule(3), state(100), amrap(9), settings); // 7+ → +10
    expect(r.nextState.workingWeightLb).toBe(110);
  });
});

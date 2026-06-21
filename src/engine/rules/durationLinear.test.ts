import { describe, it, expect } from 'vitest';
import { durationLinearNext } from './durationLinear';
import type { EngineSettings, ExerciseState, ProgressionRule, SetResult, SetScheme } from '../types';

const settings: EngineSettings = {
  barKg: 20,
  plateInventoryKg: [1.25, 2.5, 5, 10, 15, 20, 25],
  rounding: 'nearest',
  units: 'kg',
};
const rule = (incrementSec = 5, everyNSessions = 2) =>
  ({ kind: 'durationLinear', incrementSec, everyNSessions }) as Extract<
    ProgressionRule,
    { kind: 'durationLinear' }
  >;
const scheme: SetScheme = { sets: 3 };
const state = (over: Partial<ExerciseState> = {}): ExerciseState => ({
  workingWeightKg: 30, // seconds
  consecutiveFails: 0,
  stage: 0,
  cyclePos: 0,
  ...over,
});
const did: SetResult[] = [{ weightKg: 0, reps: 1, durationSec: 30, type: 'timed', completed: true }];

describe('durationLinear (timed holds / cardio)', () => {
  it('seeds the current duration with no history', () => {
    const r = durationLinearNext(rule(), state(), [], settings, scheme);
    expect(r.prescription.sets).toHaveLength(3);
    expect(r.prescription.sets[0]!.type).toBe('timed');
    expect(r.prescription.sets[0]!.targetDurationSec).toBe(30);
    expect(r.prescription.reason).toMatch(/30s/);
  });

  it('holds the duration before the bump interval is reached', () => {
    const r = durationLinearNext(rule(5, 2), state({ cyclePos: 0 }), did, settings, scheme);
    expect(r.nextState.cyclePos).toBe(1);
    expect(r.nextState.workingWeightKg).toBe(30);
    expect(r.prescription.reason).toMatch(/1\/2/);
  });

  it('bumps the duration once the interval is reached and resets the counter', () => {
    const r = durationLinearNext(rule(5, 2), state({ cyclePos: 1 }), did, settings, scheme);
    expect(r.nextState.workingWeightKg).toBe(35);
    expect(r.nextState.cyclePos).toBe(0);
    expect(r.prescription.reason).toMatch(/\+5s/);
  });

  it('formats minutes for longer holds', () => {
    const r = durationLinearNext(rule(30, 1), state({ workingWeightKg: 90, cyclePos: 0 }), did, settings, scheme);
    expect(r.nextState.workingWeightKg).toBe(120);
    expect(r.prescription.reason).toMatch(/2m/); // 120s → "2m"
  });

  it('formats minutes-and-seconds', () => {
    const r = durationLinearNext(rule(0, 1), state({ workingWeightKg: 90 }), did, settings, scheme);
    expect(r.prescription.sets[0]!.targetDurationSec).toBe(90);
    expect(r.prescription.reason).toMatch(/1m 30s/);
  });

  it('defaults to at least one set', () => {
    const r = durationLinearNext(rule(), state(), [], settings, { sets: 0 });
    expect(r.prescription.sets).toHaveLength(1);
  });
});

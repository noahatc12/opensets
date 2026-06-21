import { describe, it, expect } from 'vitest';
import { nextPrescription } from './index';
import type {
  EngineSettings,
  ExerciseState,
  ProgressionRule,
  SetResult,
  SetScheme,
} from './types';

const settings: EngineSettings = {
  barKg: 20,
  plateInventoryKg: [1.25, 2.5, 5, 10, 15, 20, 25],
  rounding: 'nearest',
  units: 'kg',
};
const state: ExerciseState = {
  workingWeightKg: 60,
  consecutiveFails: 0,
  stage: 0,
  cyclePos: 0,
};
const scheme: SetScheme = { sets: 3, repTarget: 5 };
const noHistory: SetResult[] = [];

describe('nextPrescription (dispatcher)', () => {
  it('dispatches linear', () => {
    const r = nextPrescription(
      { kind: 'linear', incrementKg: 5, failsBeforeDeload: 3, deloadPct: 0.1 },
      state,
      [
        { weightKg: 60, reps: 5, type: 'working', completed: true },
        { weightKg: 60, reps: 5, type: 'working', completed: true },
        { weightKg: 60, reps: 5, type: 'working', completed: true },
      ],
      settings,
      scheme,
    );
    expect(r.nextState.workingWeightKg).toBe(65);
  });

  it('dispatches double', () => {
    const r = nextPrescription(
      {
        kind: 'double',
        repMin: 8,
        repMax: 12,
        incrementKg: 2.5,
        perSet: false,
      },
      { ...state, workingWeightKg: 30 },
      [],
      settings,
      { sets: 3, repRange: [8, 12] },
    );
    expect(r.prescription.sets[0]!.targetReps).toBe(12);
  });

  it('manual re-prescribes the current weight without changing state', () => {
    const r = nextPrescription(
      { kind: 'manual' },
      state,
      noHistory,
      settings,
      scheme,
    );
    expect(r.nextState.workingWeightKg).toBe(60);
    expect(r.prescription.reason).toMatch(/manual/i);
  });

  it('manual notes when there is prior history', () => {
    const r = nextPrescription(
      { kind: 'manual' },
      state,
      [{ weightKg: 60, reps: 5, type: 'working', completed: true }],
      settings,
      scheme,
    );
    expect(r.prescription.reason).toMatch(/adjust 60 kg/i);
  });

  it('manual defaults the rep target when the scheme is bare', () => {
    const r = nextPrescription({ kind: 'manual' }, state, noHistory, settings, {
      sets: 1,
    });
    expect(r.prescription.sets[0]!.targetReps).toBe(1);
  });

  it.each([
    { kind: 'percent531', variant: 'base', tmIncrementKg: 2.5 },
    { kind: 'gzclp', tier: 1 },
    { kind: 'rpeTarget', targetRpe: 8, targetReps: 5, loadStepPct: 0.04 },
    { kind: 'apre', rm: 6 },
    { kind: 'repsOnly', repIncrement: 1 },
    { kind: 'durationLinear', incrementSec: 5, everyNSessions: 2 },
  ] as ProgressionRule[])('dispatches the Phase-2 rule "%s" (no throw)', (rule) => {
    const r = nextPrescription(rule, state, noHistory, settings, scheme);
    expect(r.prescription.sets.length).toBeGreaterThan(0);
    expect(typeof r.prescription.reason).toBe('string');
    expect(r.nextState).toBeDefined();
  });
});

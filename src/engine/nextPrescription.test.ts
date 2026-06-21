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
  barLb: 45,
  plateInventoryLb: [1.25, 2.5, 5, 10, 25, 35, 45],
  rounding: 'nearest',
  units: 'lb',
};
const state: ExerciseState = {
  workingWeightLb: 60,
  consecutiveFails: 0,
  stage: 0,
  cyclePos: 0,
};
const scheme: SetScheme = { sets: 3, repTarget: 5 };
const noHistory: SetResult[] = [];

describe('nextPrescription (dispatcher)', () => {
  it('dispatches linear', () => {
    const r = nextPrescription(
      { kind: 'linear', incrementLb: 5, failsBeforeDeload: 3, deloadPct: 0.1 },
      state,
      [
        { weightLb: 60, reps: 5, type: 'working', completed: true },
        { weightLb: 60, reps: 5, type: 'working', completed: true },
        { weightLb: 60, reps: 5, type: 'working', completed: true },
      ],
      settings,
      scheme,
    );
    expect(r.nextState.workingWeightLb).toBe(65);
  });

  it('dispatches double', () => {
    const r = nextPrescription(
      {
        kind: 'double',
        repMin: 8,
        repMax: 12,
        incrementLb: 2.5,
        perSet: false,
      },
      { ...state, workingWeightLb: 30 },
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
    expect(r.nextState.workingWeightLb).toBe(60);
    expect(r.prescription.reason).toMatch(/manual/i);
  });

  it('manual notes when there is prior history', () => {
    const r = nextPrescription(
      { kind: 'manual' },
      state,
      [{ weightLb: 60, reps: 5, type: 'working', completed: true }],
      settings,
      scheme,
    );
    expect(r.prescription.reason).toMatch(/adjust 60 lb/i);
  });

  it('manual defaults the rep target when the scheme is bare', () => {
    const r = nextPrescription({ kind: 'manual' }, state, noHistory, settings, {
      sets: 1,
    });
    expect(r.prescription.sets[0]!.targetReps).toBe(1);
  });

  it.each([
    { kind: 'percent531', variant: 'base', tmIncrementLb: 2.5 },
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

import { describe, it, expect } from 'vitest';
import { nextPrescription } from './index';
import type {
  EngineSettings,
  ExerciseState,
  ProgressionRule,
  SetResult,
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

describe('nextPrescription (engine entry point)', () => {
  it('is wired and currently a stub — logic lands in P1 (TDD red→green)', () => {
    const rule: ProgressionRule = { kind: 'manual' };
    const lastSession: SetResult[] = [];
    expect(() =>
      nextPrescription(rule, state, lastSession, settings),
    ).toThrow(/not implemented/i);
  });
});

/*
 * TDD scaffold (spec §6.5) — the table-driven branch cases the engine must cover
 * to clear the ≥95% branch gate. Left as `todo` so the harness is wired and the
 * cases are enumerated, without failing CI before the logic exists. Each becomes
 * a real, red-first test as its rule is implemented in P1/P2.
 */
describe('progression rules — branch coverage targets', () => {
  it.todo('linear: all working sets hit target → weight += increment, fails reset');
  it.todo('linear: a missed set → consecutiveFails++, weight unchanged');
  it.todo('linear: fails reach failsBeforeDeload → weight ×= (1 − deloadPct), reset');
  it.todo('double: all sets at repMax → weight += increment, reps reset to repMin');
  it.todo('double: below repMax → add reps where possible, weight unchanged');
  it.todo('double(perSet/DDP): each set slot progresses independently');
  it.todo('percent531: wave % by cyclePos; TM increment after cycle; TM reset on missed top set');
  it.todo('gzclp T1/T2/T3: stage transitions on failure, weight bump on success');
  it.todo('rpeTarget: load step from RPE deviation, clamped to ±10%');
  it.todo('apre 3/6/10: set-3 AMRAP reps → next load + RM via lookup');
  it.todo('repsOnly (bodyweight): rep progression; converts to double when load attached');
  it.todo('durationLinear: +incrementSec every everyNSessions');
  it.todo('roundToLoadable: prescribed weight always loadable from plate pairs');
  it.todo('roundToLoadable: microplate absence → nearest achievable load');
  it.todo('e1RM: excluded when reps > 10 (low confidence), included otherwise');
  it.todo('negative/assisted load (weightKg < 0) handled without NaN');
});

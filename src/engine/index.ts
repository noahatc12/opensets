/**
 * OpenSets progression engine — public entry point (spec §6.1).
 *
 * Pure module (see ENGINE PURITY LAW in ./types.ts). Phase 0 ships the types and
 * a stubbed entry point so the TDD harness is wired before any logic lands. The
 * linear + double rules are implemented in Phase 1, the rest in Phase 2 — each
 * test-first against the table-driven cases enumerated in engine.test.ts.
 */
export * from './types';

import type {
  EngineSettings,
  ExerciseState,
  NextPrescriptionResult,
  ProgressionRule,
  SetResult,
} from './types';

/**
 * Compute the next session's prescription and advanced exercise state from the
 * progression rule, current state, and last session's logged sets.
 *
 * Pure: all inputs are passed in; nothing is read from storage, the DOM, or the
 * clock. Not yet implemented — progression logic is built test-first in P1/P2.
 */
export function nextPrescription(
  rule: ProgressionRule,
  state: ExerciseState,
  lastSession: SetResult[],
  settings: EngineSettings,
): NextPrescriptionResult {
  // Mark inputs as referenced while the body is a stub (no-unused-params).
  void rule;
  void state;
  void lastSession;
  void settings;
  throw new Error(
    'nextPrescription is not implemented yet — progression logic lands in Phase 1 (test-first).',
  );
}

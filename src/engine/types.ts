/**
 * OpenSets progression engine — core types (spec §6.1).
 *
 * ENGINE PURITY LAW (spec §6, inviolable): everything in /src/engine is pure
 * TypeScript — no React, no Dexie, no DOM, no Date.now(), no randomness, no I/O.
 * Every function is (inputs) -> outputs. Time and storage are passed in. This is
 * what makes the engine 100% unit-testable and is the centerpiece of the project.
 *
 * Storage rule (spec §8): kg is canonical. All loads here are kilograms. lb is a
 * display-layer conversion only and never reaches this module.
 */

export type SetType =
  | 'warmup'
  | 'working'
  | 'amrap'
  | 'drop'
  | 'restPause'
  | 'timed'
  | 'cardio';

/** A single performed set, as logged. */
export interface SetResult {
  /** External load. 0 = pure bodyweight; negative = assisted. */
  weightKg: number;
  reps: number;
  /** Timed holds & cardio. */
  durationSec?: number;
  /** Optional, cardio. */
  distanceM?: number;
  /** 6.0–10.0 in 0.5 steps. */
  rpe?: number;
  type: SetType;
  completed: boolean;
}

/**
 * A progression rule attached to an exercise slot. The discriminated union is the
 * heart of the engine — each `kind` is a distinct, individually-tested algorithm
 * (spec §6.2). Phase 0 ships the type only; logic lands per-phase (linear/double
 * in P1, the rest in P2).
 */
export type ProgressionRule =
  | { kind: 'linear'; incrementKg: number; failsBeforeDeload: number; deloadPct: number }
  // perSet=true -> DDP (per-set double progression)
  | { kind: 'double'; repMin: number; repMax: number; incrementKg: number; perSet: boolean }
  // week derived from cycle position
  | { kind: 'percent531'; variant: 'base' | 'bbb' | 'fsl'; tmIncrementKg: number }
  | { kind: 'gzclp'; tier: 1 | 2 | 3 }
  | { kind: 'rpeTarget'; targetRpe: number; targetReps: number; loadStepPct: number }
  | { kind: 'apre'; rm: 3 | 6 | 10 }
  // bodyweight progression
  | { kind: 'repsOnly'; repIncrement: number }
  // timed holds, cardio minutes
  | { kind: 'durationLinear'; incrementSec: number; everyNSessions: number }
  | { kind: 'manual' };

/** Discriminant helper for the rule union. */
export type ProgressionKind = ProgressionRule['kind'];

/** Mutable per-exercise progression state (spec §6.1). Persisted as ExerciseStateRow (§8). */
export interface ExerciseState {
  workingWeightKg: number;
  /** 5/3/1 training max. */
  trainingMaxKg?: number;
  consecutiveFails: number;
  /** GZCLP stage index, wave position, etc. */
  stage: number;
  /** Week-in-cycle for percentage schemes. */
  cyclePos: number;
}

/** Flags surfaced on a prescription, driving UI badges (spec §6.1). */
export type PrescriptionFlag =
  | 'deload'
  | 'stageChange'
  | 'tmIncrease'
  | 'plateauSuspected';

/** A single prescribed set within a prescription. */
export interface PrescribedSet {
  type: SetType;
  targetReps: number;
  targetWeightKg: number;
  amrap?: boolean;
  targetRpe?: number;
}

/** The engine's output for the next session of one exercise (spec §6.1). */
export interface Prescription {
  sets: PrescribedSet[];
  /** Human-readable, surfaced + tappable in the UI: "+2.5 kg — hit 12/12/12 @ 50 kg". */
  reason: string;
  flags: PrescriptionFlag[];
}

/** Rounding behaviour for {@link roundToLoadable}. */
export type RoundingMode = 'nearest' | 'down' | 'up';

/**
 * Settings the engine needs but does not own. Passed in to keep the module pure
 * (no reading global config / DB). `plateInventoryKg` is the set of plate
 * denominations the lifter owns; loads must be loadable from PAIRS of these.
 */
export interface EngineSettings {
  barKg: number;
  /** Available plate denominations in kg (each usable as a pair). */
  plateInventoryKg: number[];
  rounding: RoundingMode;
  /** Display units. Storage/computation is always kg; this is informational only. */
  units: 'kg' | 'lb';
}

/** Return shape of {@link nextPrescription}: the prescription plus advanced state. */
export interface NextPrescriptionResult {
  prescription: Prescription;
  nextState: ExerciseState;
}

/**
 * OpenSets persistence types (spec §8).
 *
 * Storage rules: lb is canonical for all loads (kg is display-only); imperial
 * throughout — height & body measurements in inches; ISO-8601
 * strings for dates; ULIDs for ids; soft-delete via `deletedAt` where undo
 * applies. The engine's ProgressionRule/ExerciseState are reused here so the
 * stored program references the exact rule shape the pure engine consumes.
 */
import type {
  ProgressionRule,
  ExerciseState,
  SetType,
  Prescription,
  PRKind,
  Muscle,
} from '../engine/types';

// The Muscle taxonomy now lives in the pure engine (the plan generator needs it and
// /src/engine may not import from /src/db). Re-exported here so existing consumers
// keep importing it from `db/types` unchanged.
export type { PRKind, Muscle };

export type Equipment =
  | 'barbell'
  | 'dumbbell'
  | 'kettlebell'
  | 'cable'
  | 'machine'
  | 'bands'
  | 'bodyweight'
  | 'medicineBall'
  | 'exerciseBall'
  | 'foamRoll'
  | 'ezBar'
  | 'other';

export type DataLicense = 'unlicense' | 'cc-by-sa';

export interface Exercise {
  id: string;
  name: string;
  /** Lowercased, punctuation-stripped name for search/matching. */
  nameNorm: string;
  primaryMuscles: Muscle[];
  secondaryMuscles: Muscle[];
  equipment?: Equipment;
  mechanic?: 'compound' | 'isolation';
  level?: string;
  instructions: string[];
  /** jsDelivr image URLs (spec §7). */
  images: string[];
  isCustom: boolean;
  isBodyweight: boolean;
  trackingMode: 'load' | 'reps' | 'duration';
  license: DataLicense;
  attribution?: string;
  youtubeId?: string;
  youtubeT?: number;
  userNotes?: string;
  category?: string;
}

export interface Mesocycle {
  phase: 'accumulation' | 'intensification' | 'deload';
  weekIndex: number;
  totalWeeks: number;
  /** Per-muscle weekly working-set landmarks (MEV/MAV/MRV) — the generator writes
   *  these from the engine's volume table; analytics (S12) charts logged volume vs them. */
  volumeTargets?: Partial<Record<Muscle, { mev: number; mav: number; mrv: number }>>;
}

export interface Program {
  id: string;
  name: string;
  isActive: boolean;
  createdAt: string;
  mesocycle?: Mesocycle;
  /** Per-muscle weekly-set state the evolution engine advances over the block. R1
   *  seeds it from landmarks (current = MEV) at creation; R3/R5 read + advance it.
   *  Absent on self-periodizing (GZCLP) programs that carry no block mesocycle. */
  volumeState?: Partial<Record<Muscle, MuscleVolumeState>>;
}

export interface ExerciseSlot {
  slotId: string;
  exerciseId: string;
  order: number;
  scheme: {
    sets: number;
    repTarget?: number;
    repRange?: [number, number];
    percentOfTM?: number[];
    amrapLast?: boolean;
  };
  progressionRule: ProgressionRule;
  restWarmupSec: number;
  restWorkSec: number;
  warmupPolicy: 'auto' | 'none' | 'custom';
  /** 4-digit tempo string, e.g. "3-1-1-0" (ecc-pause-con-pause). §3.4. */
  tempo?: string;
  /** One-line coaching cue surfaced in the logger, e.g. "Squeeze at the top". §3.3. */
  coachingCue?: string;
  /** Rest-tier classification driving the prescribed rest shown pre-set. §3.7. */
  restTier?: RestTier;
  supersetGroup?: string;
  substitutionPolicy: 'carryState' | 'resetState';
}

/** Rest-tier buckets (§3.7) — coarse classification that maps to a rest duration.
 *  Heavy compounds rest longest; pump/iso work shortest. */
export type RestTier = 'heavy' | 'compound' | 'accessory' | 'isolation' | 'pump';

export interface WorkoutTemplate {
  id: string;
  programId: string;
  dayIndex: number;
  name: string;
  slots: ExerciseSlot[];
}

export interface Readiness {
  sleep: 1 | 2 | 3;
  soreness: 1 | 2 | 3;
  motivation: 1 | 2 | 3;
  jointPain: boolean;
}

export interface WorkoutSession {
  id: string;
  programId?: string;
  templateId?: string;
  /** A session belongs to its START date (sessions crossing midnight stay on the
   *  start day) — date & week semantics decided per the design refinements. */
  date: string;
  startedAt: string;
  endedAt?: string;
  readiness?: Readiness;
  status: 'active' | 'completed' | 'partial';
  notes?: string;
  /** Program-edit snapshot: a frozen copy of the slots executed, so editing a
   *  template never silently rewrites past history/compliance/progression (P1
   *  refinement). Populated when a session is created from a template. */
  executedSlots?: ExerciseSlot[];
}

export interface LoggedSet {
  id: string;
  sessionId: string;
  exerciseId: string;
  date: string;
  order: number;
  type: SetType;
  weightLb: number;
  reps: number;
  durationSec?: number;
  distanceM?: number;
  rpe?: number;
  completed: boolean;
  supersetGroup?: string;
  isPR?: PRKind[];
  deletedAt?: string;
}

export interface ExerciseStateRow extends ExerciseState {
  programId: string;
  exerciseId: string;
  updatedAt: string;
  /** The engine's prescription for the NEXT session, computed at the last
   *  completion (or seed). Cached so the Today view reads it without re-running
   *  progression (which would double-advance). db-layer field, not in §6.1. */
  pending?: Prescription;
}

export type GoalType =
  | 'bodyweight'
  | 'measurement'
  | 'liftTarget'
  | 'weeklyCardioMin'
  | 'weeklySetsMuscle'
  | 'streak';

export interface Goal {
  id: string;
  type: GoalType;
  target: number;
  direction: 'increase' | 'decrease';
  exerciseId?: string;
  repTarget?: number;
  muscle?: Muscle;
  deadline?: string;
  status: 'active' | 'achieved' | 'abandoned';
  createdAt: string;
}

export interface Measurement {
  id: string;
  date: string;
  type: string;
  /** Body-length measurements (waist, arm, …) in inches — imperial canonical, no toggle. */
  valueIn?: number;
  valueLb?: number;
  note?: string;
}

export interface ProgressPhoto {
  id: string;
  date: string;
  /** IndexedDB blob (P3). Excluded from JSON export until base64 handling lands. */
  blob?: Blob;
  pose?: string;
}

export interface UserSettings {
  units: 'kg' | 'lb';
  barLb: number;
  plateInventoryLb: number[];
  defaultRestWarmupSec: number;
  defaultRestWorkSec: number;
  /** Per-exercise-type rest defaults (seconds), keyed by mechanic class.
   *  Older rows may lack these — consumers read with `?? <default>`. */
  restCompoundSec: number;
  restIsolationSec: number;
  restAccessorySec: number;
  /** When true, the rest timer auto-starts after each logged set. */
  restAutoStart: boolean;
  theme: 'dark' | 'light' | 'system';
  soundOn: boolean;
  backupNudgeEvery: number;
  lastExportAt?: string;
  /** PAT is held in memory/sessionStorage only, NEVER persisted in exports. */
  gistSync?: { gistId: string };
}

/** Settings are stored as keyed singleton rows (spec §8: `settings: 'key'`). */
export interface UserSettingsRow extends UserSettings {
  key: 'user';
}

export type BiologicalSex = 'male' | 'female';

/** Training-age / experience class — drives the goal×training-age progression router. */
export type Experience = 'Novice' | 'Intermediate' | 'Advanced';
/** Equipment environment available to the lifter. */
export type EquipmentProfile = 'Full gym' | 'Home rack' | 'Minimal';
/** User split preference. 'auto' (or unset) lets the split designer choose by
 *  goal / days / training-age (R2). The others pin a specific split family. */
export type SplitChoice =
  | 'auto'
  | 'fullBody'
  | 'upperLower'
  | 'pushPullLegs'
  | 'pplArms'
  | 'bodyPart';

/** Per-muscle weekly working-set state the evolution engine advances across a block:
 *  `current` is this week's target set count (seeded at MEV); mev/mav/mrv are the
 *  landmarks it ramps within. Seeded at program creation from the engine volume table
 *  (R1); read + advanced by the volume allocator / evolution engine (R3/R5). */
export interface MuscleVolumeState {
  current: number;
  mev: number;
  mav: number;
  mrv: number;
}

/**
 * User profile — the generator/nutrition input (spec §6.6 + §5). Captured in the
 * onboarding wizard, edited in Settings → Profile. Every field is optional: the
 * wizard is skippable, and downstream consumers (the generator in a later branch,
 * nutrition after) handle a partial profile. Canonical units match the data model
 * (lb/inches): height is stored in INCHES (displayed ft/in); bodyweight is NOT
 * here — it stays a time-series `measurement` (valueLb). DOB is stored so age stays
 * correct over time; age is derived where needed with a passed-in `now` (never a
 * clock call in the pure engine).
 */
export interface Profile {
  /** Biological sex — required by the Mifflin-St Jeor BMR formula (§5/§6.6). */
  sex?: BiologicalSex;
  /** ISO date (yyyy-mm-dd). Age = derived from this + a passed-in now. */
  birthDate?: string;
  /** Canonical height in inches (UI shows/enters ft + in). */
  heightIn?: number;
  /** Current body-fat %, optional. */
  bodyFatPct?: number;
  /** Training goal — mirrors the onboarding goal strings; the generator maps it later. */
  goal?: string;
  /** Physique-target extension: target body-fat % for body-comp goals. */
  targetBodyFatPct?: number;
  /** Goal timeframe in weeks (e.g. "visible abs in 8 weeks"). */
  goalTimeframeWeeks?: number;
  /** Training-age class. Was transient onboarding state pre-R1; now persisted so the
   *  generator + evolution engine read it after onboarding (not just at first build). */
  experience?: Experience;
  /** Training days/week the user can commit — the real frequency constraint.
   *  (Per-muscle frequency is DERIVED from the volume target, not a separate input;
   *  see docs/generator-research.md §4.) Was transient onboarding state pre-R1. */
  days?: number;
  /** Equipment environment. Was transient onboarding state pre-R1; now persisted. */
  equipment?: EquipmentProfile;
  /** Split preference; 'auto'/unset lets the split designer (R2) choose. */
  splitChoice?: SplitChoice;
  /** Lagging/priority muscles to bias weekly volume toward (weak-point priority). */
  priorityMuscles?: Muscle[];
  /** Exercise ids to exclude from generation (injury/preference avoid-list; read by R4). */
  avoidExerciseIds?: string[];
  /** ISO timestamp of the last edit. */
  updatedAt: string;
}

/** Profile is a keyed singleton row, same pattern as settings (spec §8: `profile: 'key'`). */
export interface ProfileRow extends Profile {
  key: 'user';
}

/** Crash-recovery singleton (spec §8: `activeSession: 'key'`). Filled in P1. */
export interface ActiveSessionRow {
  key: 'current';
  sessionId: string;
  updatedAt: string;
  payload: unknown;
}

/** Pre-migration full-DB snapshot (spec §8: `backups: 'id, createdAt'`, keep 2). */
export interface BackupRow {
  id: string;
  createdAt: string;
  schemaVersion: number;
  envelope: ExportEnvelope;
}

/** Versioned export/import envelope (spec §8, §12). Old envelopes migrate forward. */
export interface ExportEnvelope {
  app: 'opensets';
  schemaVersion: number;
  exportedAt: string;
  data: {
    exercises: Exercise[];
    programs: Program[];
    templates: WorkoutTemplate[];
    sessions: WorkoutSession[];
    sets: LoggedSet[];
    exerciseState: ExerciseStateRow[];
    measurements: Measurement[];
    goals: Goal[];
    settings: UserSettingsRow[];
    /** Added in schema v2; optional so v1 envelopes/snapshots remain valid. */
    profile?: ProfileRow[];
  };
}

/**
 * OpenSets IndexedDB (Dexie) — schema v1 (spec §8).
 *
 * Dexie is the single source of truth (spec §9); the UI reads via useLiveQuery.
 * Migration policy (inviolable): never delete an old `version(n)` declaration;
 * every upgrade wraps in `.upgrade(tx)`; before applying a migration, a full-DB
 * JSON snapshot is written to `backups` (keep 2) so a botched migration is always
 * reversible. See ./backup.ts for the snapshot helper and the v2 wiring pattern.
 */
import Dexie, { type Table } from 'dexie';
import { lbToKg } from '../lib/units';
import type {
  Exercise,
  Program,
  WorkoutTemplate,
  WorkoutSession,
  LoggedSet,
  ExerciseStateRow,
  Measurement,
  ProgressPhoto,
  Goal,
  UserSettingsRow,
  ActiveSessionRow,
  BackupRow,
  UserSettings,
} from './types';

/** Current code schema version. Bump alongside a new `version(n)` block below. */
export const SCHEMA_VERSION = 1;

export const DEFAULT_SETTINGS: UserSettings = {
  units: 'lb',
  // 45 lb Olympic bar (canonical kg). Plates default to the standard US lb set,
  // stored as kg-equivalents; a kg user re-picks their set on the Plates screen.
  barKg: Math.round(lbToKg(45) * 1000) / 1000,
  plateInventoryKg: [45, 35, 25, 10, 5, 2.5]
    .map((lb) => Math.round(lbToKg(lb) * 1000) / 1000)
    .sort((a, b) => a - b),
  defaultRestWarmupSec: 60,
  defaultRestWorkSec: 120,
  theme: 'dark',
  soundOn: true,
  backupNudgeEvery: 10,
};

export class OpenSetsDB extends Dexie {
  exercises!: Table<Exercise, string>;
  programs!: Table<Program, string>;
  templates!: Table<WorkoutTemplate, string>;
  sessions!: Table<WorkoutSession, string>;
  sets!: Table<LoggedSet, string>;
  exerciseState!: Table<ExerciseStateRow, string>;
  measurements!: Table<Measurement, string>;
  photos!: Table<ProgressPhoto, string>;
  goals!: Table<Goal, string>;
  settings!: Table<UserSettingsRow, string>;
  activeSession!: Table<ActiveSessionRow, string>;
  backups!: Table<BackupRow, string>;

  constructor(name = 'opensets') {
    super(name);

    // --- v1 (spec §8). Keep this block forever; add version(2) below it. ---
    this.version(1).stores({
      exercises: 'id, nameNorm, *primaryMuscles, equipment, category, isCustom',
      programs: 'id, name, isActive',
      templates: 'id, programId, dayIndex',
      sessions: 'id, date, programId, templateId, status',
      sets: 'id, sessionId, exerciseId, [exerciseId+date]',
      exerciseState: '[programId+exerciseId]',
      measurements: 'id, date, type',
      photos: 'id, date',
      goals: 'id, type, status',
      settings: 'key',
      activeSession: 'key',
      backups: 'id, createdAt',
    });

    // Seed default settings on a brand-new database only.
    this.on('populate', () => {
      this.settings.add({ key: 'user', ...DEFAULT_SETTINGS });
    });
  }
}

/** App-wide singleton database handle. */
export const db = new OpenSetsDB();

/** Read the user settings row, falling back to defaults if not yet seeded. */
export async function getSettings(): Promise<UserSettings> {
  const row = await db.settings.get('user');
  return row ?? { ...DEFAULT_SETTINGS };
}

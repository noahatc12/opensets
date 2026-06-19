/**
 * Full-DB export / import (spec §8, §12).
 *
 * Export produces a versioned envelope; import validates, migrates any older
 * envelope forward through the same upgrade path, then restores. This is the
 * data-ownership guarantee and the P0 exit gate: export → wipe → import restores
 * everything byte-equal. Time is passed in (`now`) so the core is deterministic
 * and unit-testable; only `downloadEnvelope`/`pickAndReadFile` touch the DOM.
 */
import { db, SCHEMA_VERSION } from './db';
import type { ExportEnvelope } from './types';

/** The tables that participate in export/import, in stable order.
 *  Excludes `backups` (would nest), `photos` (Blobs — base64 handling lands with
 *  P3 photos), and `activeSession` (ephemeral crash-recovery state). */
const EXPORT_TABLES = [
  'exercises',
  'programs',
  'templates',
  'sessions',
  'sets',
  'exerciseState',
  'measurements',
  'goals',
  'settings',
] as const;

/** Read the entire database into a versioned envelope. `now` is an ISO string. */
export async function buildEnvelope(now: string): Promise<ExportEnvelope> {
  const [
    exercises,
    programs,
    templates,
    sessions,
    sets,
    exerciseState,
    measurements,
    goals,
    settings,
  ] = await Promise.all([
    db.exercises.toArray(),
    db.programs.toArray(),
    db.templates.toArray(),
    db.sessions.toArray(),
    db.sets.toArray(),
    db.exerciseState.toArray(),
    db.measurements.toArray(),
    db.goals.toArray(),
    db.settings.toArray(),
  ]);
  return {
    app: 'opensets',
    schemaVersion: SCHEMA_VERSION,
    exportedAt: now,
    data: {
      exercises,
      programs,
      templates,
      sessions,
      sets,
      exerciseState,
      measurements,
      goals,
      settings,
    },
  };
}

/** Pretty, stable JSON for an envelope. */
export function serializeEnvelope(env: ExportEnvelope): string {
  return JSON.stringify(env, null, 2);
}

export class ImportError extends Error {}

/** Structural validation — guards against importing a foreign or corrupt file. */
export function assertValidEnvelope(
  value: unknown,
): asserts value is ExportEnvelope {
  if (typeof value !== 'object' || value === null) {
    throw new ImportError('Not a valid OpenSets backup (expected an object).');
  }
  const env = value as Record<string, unknown>;
  if (env.app !== 'opensets') {
    throw new ImportError('This file is not an OpenSets backup.');
  }
  if (typeof env.schemaVersion !== 'number') {
    throw new ImportError('Backup is missing a schema version.');
  }
  if (env.schemaVersion > SCHEMA_VERSION) {
    throw new ImportError(
      `Backup is from a newer version of OpenSets (schema ${env.schemaVersion}). Update the app first.`,
    );
  }
  if (typeof env.data !== 'object' || env.data === null) {
    throw new ImportError('Backup has no data section.');
  }
  for (const t of EXPORT_TABLES) {
    const arr = (env.data as Record<string, unknown>)[t];
    if (arr !== undefined && !Array.isArray(arr)) {
      throw new ImportError(`Backup table "${t}" is malformed.`);
    }
  }
}

/**
 * Forward-migrate an older envelope to the current schema. Each future bump adds
 * one step here, mirroring the Dexie `version(n).upgrade` chain so a file exported
 * from any past version imports cleanly. v1 is the baseline → identity.
 */
export function migrateEnvelope(env: ExportEnvelope): ExportEnvelope {
  let migrated = env;
  // Example for the next bump:
  // if (migrated.schemaVersion < 2) migrated = migrate_1_to_2(migrated);
  return migrated;
}

export interface ImportOptions {
  /** 'replace' wipes the DB first (P0). 'merge' is a P1 feature. */
  mode?: 'replace';
}

/** Validate → migrate → restore the whole database from an envelope. */
export async function importEnvelope(
  value: unknown,
  _opts: ImportOptions = {},
): Promise<void> {
  assertValidEnvelope(value);
  const env = migrateEnvelope(value);
  const d = env.data;

  await db.transaction(
    'rw',
    [
      db.exercises,
      db.programs,
      db.templates,
      db.sessions,
      db.sets,
      db.exerciseState,
      db.measurements,
      db.goals,
      db.settings,
    ],
    async () => {
      // Replace mode: clear every export table, then load. (Merge lands in P1.)
      await Promise.all([
        db.exercises.clear(),
        db.programs.clear(),
        db.templates.clear(),
        db.sessions.clear(),
        db.sets.clear(),
        db.exerciseState.clear(),
        db.measurements.clear(),
        db.goals.clear(),
        db.settings.clear(),
      ]);
      await Promise.all([
        db.exercises.bulkAdd(d.exercises ?? []),
        db.programs.bulkAdd(d.programs ?? []),
        db.templates.bulkAdd(d.templates ?? []),
        db.sessions.bulkAdd(d.sessions ?? []),
        db.sets.bulkAdd(d.sets ?? []),
        d.exerciseState?.length
          ? db.exerciseState.bulkAdd(d.exerciseState)
          : Promise.resolve(),
        db.measurements.bulkAdd(d.measurements ?? []),
        db.goals.bulkAdd(d.goals ?? []),
        db.settings.bulkAdd(d.settings ?? []),
      ]);
    },
  );
}

/** Parse a JSON string into an envelope and import it. */
export async function importFromJson(
  json: string,
  opts: ImportOptions = {},
): Promise<void> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new ImportError('File is not valid JSON.');
  }
  await importEnvelope(parsed, opts);
}

// --- DOM-facing helpers (browser only) ---

function backupFilename(now: string): string {
  return `opensets-backup-${now.slice(0, 10)}.json`;
}

/** One-tap export. Uses the File System Access API where available, else <a download>. */
export async function downloadEnvelope(now: string): Promise<void> {
  const env = await buildEnvelope(now);
  const json = serializeEnvelope(env);
  const filename = backupFilename(now);

  const picker = (
    window as unknown as {
      showSaveFilePicker?: (opts: unknown) => Promise<{
        createWritable: () => Promise<{
          write: (data: string) => Promise<void>;
          close: () => Promise<void>;
        }>;
      }>;
    }
  ).showSaveFilePicker;

  if (typeof picker === 'function') {
    try {
      const handle = await picker({
        suggestedName: filename,
        types: [
          {
            description: 'OpenSets backup',
            accept: { 'application/json': ['.json'] },
          },
        ],
      });
      const writable = await handle.createWritable();
      await writable.write(json);
      await writable.close();
      return;
    } catch (err) {
      // User cancelled the picker → not an error worth surfacing.
      if (err instanceof DOMException && err.name === 'AbortError') return;
      // Otherwise fall through to the anchor-download fallback.
    }
  }

  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

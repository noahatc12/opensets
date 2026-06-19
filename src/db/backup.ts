/**
 * Pre-migration / safety snapshots (spec §8 backups, keep 2).
 *
 * The migration contract: before a schema upgrade transforms data, capture a full
 * envelope into the `backups` table so a botched migration is reversible. With v1
 * there is no prior version yet, so this ships as the snapshot primitive plus the
 * documented wiring for the first real migration.
 */
import type { Transaction } from 'dexie';
import { db, SCHEMA_VERSION } from './db';
import { buildEnvelope } from './exportImport';
import type { BackupRow, ExportEnvelope } from './types';

const KEEP = 2;

/**
 * Write a full-DB snapshot to `backups` and prune to the most recent KEEP.
 * `id` (ULID) and `now` (ISO) are passed in by the caller to keep this testable
 * and free of clock/randomness at this layer.
 */
export async function createBackup(
  id: string,
  now: string,
): Promise<BackupRow> {
  const envelope = await buildEnvelope(now);
  const row: BackupRow = {
    id,
    createdAt: now,
    schemaVersion: SCHEMA_VERSION,
    envelope,
  };
  await db.backups.add(row);

  const all = await db.backups.orderBy('createdAt').toArray();
  if (all.length > KEEP) {
    const stale = all.slice(0, all.length - KEEP).map((b) => b.id);
    await db.backups.bulkDelete(stale);
  }
  return row;
}

/**
 * Wiring pattern for the first schema upgrade (kept here as the canonical example
 * so future migrations follow it). At the TOP of a `version(n).upgrade`, before
 * any table is transformed, snapshot the still-current data:
 *
 *   this.version(2)
 *     .stores({ ...v2 schema... })
 *     .upgrade(async (tx) => {
 *       // 1) snapshot pre-migration state into `backups`
 *       await preMigrationSnapshot(tx, ulid(), new Date().toISOString());
 *       // 2) then transform rows to the v2 shape
 *       await tx.table('sets').toCollection().modify((s) => { ... });
 *     });
 *
 * Implemented against the upgrade transaction so the snapshot reflects the data
 * exactly as it was before migration.
 */
export async function preMigrationSnapshot(
  tx: Transaction,
  id: string,
  now: string,
): Promise<void> {
  const tableNames = [
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

  const entries = await Promise.all(
    tableNames.map(
      async (name) => [name, await tx.table(name).toArray()] as const,
    ),
  );
  const data = Object.fromEntries(entries) as ExportEnvelope['data'];

  // Snapshot reflects the OLD version (one below the code version mid-upgrade).
  const oldVersion = SCHEMA_VERSION - 1;
  const row: BackupRow = {
    id,
    createdAt: now,
    schemaVersion: oldVersion,
    envelope: {
      app: 'opensets',
      schemaVersion: oldVersion,
      exportedAt: now,
      data,
    },
  };
  await tx.table('backups').add(row);
}

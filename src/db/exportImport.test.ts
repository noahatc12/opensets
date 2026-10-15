import { describe, it, expect, beforeEach } from 'vitest';
import { db } from './db';
import {
  buildEnvelope,
  importEnvelope,
  importFromJson,
  serializeEnvelope,
  assertValidEnvelope,
  ImportError,
} from './exportImport';
import { createBackup } from './backup';
import type {
  Exercise,
  Program,
  WorkoutTemplate,
  WorkoutSession,
  LoggedSet,
  ExerciseStateRow,
  Goal,
  Measurement,
  UserSettingsRow,
  ExportEnvelope,
} from './types';

const EXPORT_TABLES = [
  db.exercises,
  db.programs,
  db.templates,
  db.sessions,
  db.sets,
  db.exerciseState,
  db.measurements,
  db.goals,
  db.settings,
  db.backups,
  db.photos,
];

async function wipe() {
  await Promise.all(EXPORT_TABLES.map((t) => t.clear()));
}

async function seed() {
  const exercise: Exercise = {
    id: 'ex_squat',
    name: 'Barbell Back Squat',
    nameNorm: 'barbell back squat',
    primaryMuscles: ['quadriceps'],
    secondaryMuscles: ['glutes', 'hamstrings'],
    equipment: 'barbell',
    mechanic: 'compound',
    level: 'beginner',
    instructions: ['Unrack.', 'Squat to depth.', 'Stand.'],
    images: [
      'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@sha/exercises/Squat/0.jpg',
    ],
    isCustom: false,
    isBodyweight: false,
    trackingMode: 'load',
    license: 'unlicense',
    category: 'strength',
  };
  const program: Program = {
    id: 'prog_1',
    name: 'Starting Strength',
    isActive: true,
    createdAt: '2026-06-01T08:00:00.000Z',
  };
  const template: WorkoutTemplate = {
    id: 'tpl_a',
    programId: 'prog_1',
    dayIndex: 0,
    name: 'Workout A',
    slots: [
      {
        slotId: 'slot_1',
        exerciseId: 'ex_squat',
        order: 0,
        scheme: { sets: 3, repTarget: 5 },
        progressionRule: {
          kind: 'linear',
          incrementLb: 5,
          failsBeforeDeload: 3,
          deloadPct: 0.1,
        },
        restWarmupSec: 60,
        restWorkSec: 180,
        warmupPolicy: 'auto',
        substitutionPolicy: 'carryState',
      },
    ],
  };
  const session: WorkoutSession = {
    id: 'sess_1',
    programId: 'prog_1',
    templateId: 'tpl_a',
    date: '2026-06-02',
    startedAt: '2026-06-02T17:00:00.000Z',
    endedAt: '2026-06-02T18:00:00.000Z',
    status: 'completed',
  };
  const set: LoggedSet = {
    id: 'set_1',
    sessionId: 'sess_1',
    exerciseId: 'ex_squat',
    date: '2026-06-02',
    order: 0,
    type: 'working',
    weightLb: 60,
    reps: 5,
    completed: true,
    isPR: ['weight'],
  };
  const stateRow: ExerciseStateRow = {
    programId: 'prog_1',
    exerciseId: 'ex_squat',
    workingWeightLb: 60,
    consecutiveFails: 0,
    stage: 0,
    cyclePos: 0,
    updatedAt: '2026-06-02T18:00:00.000Z',
  };
  const measurement: Measurement = {
    id: 'm_1',
    date: '2026-06-01',
    type: 'bodyweight',
    valueLb: 80,
  };
  const goal: Goal = {
    id: 'goal_1',
    type: 'liftTarget',
    target: 100,
    direction: 'increase',
    exerciseId: 'ex_squat',
    repTarget: 5,
    status: 'active',
    createdAt: '2026-06-01T08:00:00.000Z',
  };
  const settings: UserSettingsRow = {
    key: 'user',
    units: 'kg',
    barLb: 20,
    plateInventoryLb: [1.25, 2.5, 5, 10, 15, 20, 25],
    defaultRestWarmupSec: 60,
    defaultRestWorkSec: 150,
    restCompoundSec: 180,
    restIsolationSec: 120,
    restAccessorySec: 90,
    restAutoStart: true,
    theme: 'dark',
    soundOn: true,
    backupNudgeEvery: 10,
  };

  await db.exercises.add(exercise);
  await db.programs.add(program);
  await db.templates.add(template);
  await db.sessions.add(session);
  await db.sets.add(set);
  await db.exerciseState.add(stateRow);
  await db.measurements.add(measurement);
  await db.goals.add(goal);
  await db.settings.add(settings);
}

beforeEach(async () => {
  await wipe();
});

describe('full-DB export → wipe → import (P0 exit gate)', () => {
  it('restores every table byte-equal in the data section', async () => {
    await seed();
    const before = await buildEnvelope('2026-06-19T00:00:00.000Z');

    // Simulate device loss.
    await wipe();
    const empty = await buildEnvelope('2026-06-19T00:00:00.500Z');
    expect(empty.data.sets).toHaveLength(0);

    // Restore from the exported envelope (different export time).
    await importEnvelope(before);
    const after = await buildEnvelope('2026-06-19T00:00:01.000Z');

    // The data section is identical down to the bytes; only exportedAt differs.
    expect(after.data).toEqual(before.data);
    expect(JSON.stringify(after.data)).toBe(JSON.stringify(before.data));
  });

  it('round-trips through the serialized JSON string', async () => {
    await seed();
    const env = await buildEnvelope('2026-06-19T00:00:00.000Z');
    const json = serializeEnvelope(env);

    await wipe();
    await importFromJson(json);

    const restored = await buildEnvelope('2026-06-19T00:00:02.000Z');
    expect(restored.data).toEqual(env.data);
  });

  it('preserves the exact stored values (lb canonical, PR flags, nested slots)', async () => {
    await seed();
    const env = await buildEnvelope('2026-06-19T00:00:00.000Z');
    await wipe();
    await importEnvelope(env);

    const set = await db.sets.get('set_1');
    expect(set?.weightLb).toBe(60);
    expect(set?.isPR).toEqual(['weight']);
    const tpl = await db.templates.get('tpl_a');
    expect(tpl?.slots[0]?.progressionRule).toEqual({
      kind: 'linear',
      incrementLb: 5,
      failsBeforeDeload: 3,
      deloadPct: 0.1,
    });
  });
});

/** A fake JPEG body: 2 KB of bytes that differ per `seedByte`, so a mix-up shows. */
function photoBlob(seedByte: number): Blob {
  const bytes = new Uint8Array(2048);
  for (let i = 0; i < bytes.length; i++) bytes[i] = (i * 31 + seedByte) % 256;
  return new Blob([bytes], { type: 'image/jpeg' });
}

async function bytesOf(blob: Blob | undefined): Promise<number[]> {
  expect(blob).toBeDefined();
  return Array.from(new Uint8Array(await (blob as Blob).arrayBuffer()));
}

describe('progress photos in the backup', () => {
  it('survive export → erase → import with identical bytes', async () => {
    await seed();
    const original = photoBlob(7);
    await db.photos.add({
      id: 'ph_1',
      date: '2026-10-16T14:00:00.000Z',
      blob: original,
      pose: 'front',
    });
    const json = serializeEnvelope(
      await buildEnvelope('2026-10-16T15:00:00.000Z'),
    );

    await wipe();
    expect(await db.photos.count()).toBe(0);
    await importFromJson(json);

    const back = await db.photos.get('ph_1');
    expect(back?.date).toBe('2026-10-16T14:00:00.000Z');
    expect(back?.pose).toBe('front');
    expect(back?.blob?.type).toBe('image/jpeg');
    expect(await bytesOf(back?.blob)).toEqual(await bytesOf(original));
  });

  it('an older backup without photos leaves the photos on the device alone', async () => {
    const env = await buildEnvelope('2026-10-16T15:00:00.000Z');
    delete env.data.photos; // as written by an app version before photo backup
    await db.photos.add({
      id: 'ph_keep',
      date: '2026-10-16T14:00:00.000Z',
      blob: photoBlob(1),
    });
    await importEnvelope(env);
    expect(await db.photos.get('ph_keep')).toBeDefined();
  });

  it('import adds and updates photos but never deletes one', async () => {
    await db.photos.add({
      id: 'ph_a',
      date: '2026-10-16T14:00:00.000Z',
      blob: photoBlob(2),
    });
    const env = await buildEnvelope('2026-10-16T15:00:00.000Z');
    await db.photos.add({
      id: 'ph_b',
      date: '2026-10-23T14:00:00.000Z',
      blob: photoBlob(3),
    });
    await importEnvelope(env);
    const ids = (await db.photos.toArray()).map((p) => p.id).sort();
    expect(ids).toEqual(['ph_a', 'ph_b']);
  });

  it('safety snapshots leave photos out so they do not double the storage', async () => {
    await db.photos.add({
      id: 'ph_s',
      date: '2026-10-16T14:00:00.000Z',
      blob: photoBlob(4),
    });
    const row = await createBackup('bk_photo', '2026-10-16T15:00:00.000Z');
    expect(row.envelope.data.photos).toBeUndefined();
  });

  it('rejects a damaged photo entry before touching any data', async () => {
    await seed();
    const env = await buildEnvelope('2026-10-16T15:00:00.000Z');
    const bad = {
      ...env,
      data: { ...env.data, photos: [{ id: 'ph_x', date: 'x' }] },
    } as unknown as ExportEnvelope;
    await expect(importEnvelope(bad)).rejects.toBeInstanceOf(ImportError);
    expect(await db.sets.count()).toBe(1);
    expect(() =>
      assertValidEnvelope({ ...env, data: { ...env.data, photos: 'nope' } }),
    ).toThrow(/malformed/i);
  });
});

describe('import validation', () => {
  it('rejects a non-OpenSets file', () => {
    expect(() =>
      assertValidEnvelope({ app: 'someOtherApp', data: {} }),
    ).toThrow(ImportError);
  });

  it('rejects an envelope from a newer schema version', () => {
    expect(() =>
      assertValidEnvelope({ app: 'opensets', schemaVersion: 999, data: {} }),
    ).toThrow(/newer version/i);
  });

  it('rejects malformed JSON', async () => {
    await expect(importFromJson('{ not json')).rejects.toBeInstanceOf(
      ImportError,
    );
  });

  it('rejects a malformed table', () => {
    expect(() =>
      assertValidEnvelope({
        app: 'opensets',
        schemaVersion: 1,
        data: { sets: 'nope' },
      }),
    ).toThrow(/malformed/i);
  });
});

describe('createBackup (pre-migration snapshots, keep 2)', () => {
  it('retains only the two most recent snapshots', async () => {
    await seed();
    await createBackup('bk_1', '2026-06-01T00:00:00.000Z');
    await createBackup('bk_2', '2026-06-02T00:00:00.000Z');
    await createBackup('bk_3', '2026-06-03T00:00:00.000Z');

    const ids = (await db.backups.orderBy('createdAt').toArray()).map(
      (b) => b.id,
    );
    expect(ids).toEqual(['bk_2', 'bk_3']);
  });

  it('snapshots the current DB into the envelope', async () => {
    await seed();
    const row = await createBackup('bk_x', '2026-06-04T00:00:00.000Z');
    expect(row.envelope.data.exercises).toHaveLength(1);
    expect(row.envelope.data.sets[0]?.weightLb).toBe(60);
  });
});

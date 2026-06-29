import { describe, it, expect, beforeEach } from 'vitest';
import Dexie from 'dexie';
import { OpenSetsDB, DEFAULT_SETTINGS, db } from './db';
import { updateProfile } from './hooks';

/**
 * The first real schema migration (v1 → v2 adds the `profile` store). This proves
 * the inviolable — "migrations never lose data" — by seeding a v1 database, opening
 * it with the v1+v2 code, and asserting every v1 row survives the version bump AND
 * a pre-migration snapshot was captured into `backups`.
 */

// Exact v1 schema — pinned here on purpose (mirrors db.ts version(1)) so the test
// drives a genuine v1→v2 upgrade rather than opening straight at v2.
const V1_STORES = {
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
};

async function seedV1(name: string): Promise<void> {
  const v1 = new Dexie(name);
  v1.version(1).stores(V1_STORES);
  await v1.open();
  await v1.table('programs').add({
    id: 'p1',
    name: 'My Program',
    isActive: true,
    createdAt: '2026-06-01T00:00:00.000Z',
  });
  await v1.table('settings').add({ key: 'user', ...DEFAULT_SETTINGS });
  await v1.table('sets').add({
    id: 's1',
    sessionId: 'sess1',
    exerciseId: 'ex1',
    date: '2026-06-01',
    order: 0,
    type: 'working',
    weightLb: 135,
    reps: 5,
    completed: true,
  });
  await v1.table('measurements').add({
    id: 'm1',
    date: '2026-06-01',
    type: 'bodyweight',
    valueLb: 150,
  });
  v1.close();
}

describe('schema v1 → v4 migration (profile store + prescription fields + preference inputs)', () => {
  const NAME = 'opensets-migr-test';

  it('preserves all v1 data across ALL upgrades and snapshots each step with its own source version', async () => {
    await Dexie.delete(NAME);
    await seedV1(NAME);

    const migrated = new OpenSetsDB(NAME);
    await migrated.open(); // runs version(2), version(3) AND version(4) upgrades in sequence

    // The inviolable: every v1 row survives the version bumps.
    expect(await migrated.programs.get('p1')).toMatchObject({ name: 'My Program', isActive: true });
    expect(await migrated.settings.get('user')).toMatchObject({ units: 'lb' });
    expect(await migrated.sets.count()).toBe(1);
    expect(await migrated.measurements.get('m1')).toMatchObject({ valueLb: 150 });
    expect(await migrated.profile.count()).toBe(0); // v2 store exists, empty

    // THREE pre-migration snapshots, each labelled with ITS source version (1, 2, 3) —
    // proves the fromVersion fix: not every step stamped SCHEMA_VERSION-1.
    const versions = (await migrated.backups.toArray()).map((b) => b.schemaVersion).sort();
    expect(versions).toEqual([1, 2, 3]);

    migrated.close();
    await Dexie.delete(NAME);
  });

  it('v2 → v4: existing template + slots survive the prescription-fields bump (snapshots labelled 2, 3)', async () => {
    const N2 = 'opensets-migr-v2v3';
    await Dexie.delete(N2);
    // Seed a v2 DB (v1 stores + the profile store) with a template carrying a slot.
    const v2 = new Dexie(N2);
    v2.version(2).stores({ ...V1_STORES, profile: 'key' });
    await v2.open();
    await v2.table('templates').add({
      id: 't1', programId: 'p1', dayIndex: 0, name: 'Day 1',
      slots: [{ slotId: 's1', exerciseId: 'bench', order: 0, scheme: { sets: 3 }, progressionRule: { kind: 'manual' }, restWarmupSec: 60, restWorkSec: 120, warmupPolicy: 'auto', substitutionPolicy: 'carryState' }],
    });
    v2.close();

    const migrated = new OpenSetsDB(N2);
    await migrated.open(); // runs version(3) AND version(4)

    const tpl = await migrated.templates.get('t1');
    expect(tpl?.slots).toHaveLength(1);
    expect(tpl?.slots[0]).toMatchObject({ slotId: 's1', exerciseId: 'bench' }); // old slot intact
    // The new optional fields are simply absent on the old slot (valid) — and writable.
    expect(tpl!.slots[0]!.tempo).toBeUndefined();
    tpl!.slots[0]!.tempo = '3-1-1-0';
    await migrated.templates.put(tpl!);
    expect((await migrated.templates.get('t1'))!.slots[0]!.tempo).toBe('3-1-1-0');

    // Two snapshots from this open — the v3 and v4 upgrade steps, each labelled with
    // its own source version (proves the fromVersion fix across the new bump too).
    const versions = (await migrated.backups.toArray()).map((b) => b.schemaVersion).sort();
    expect(versions).toEqual([2, 3]);

    migrated.close();
    await Dexie.delete(N2);
  });

  it('v3 → v4: existing program survives the preference-inputs bump (snapshot labelled 3)', async () => {
    const N3 = 'opensets-migr-v3v4';
    await Dexie.delete(N3);
    // Seed a v3 DB (v1 stores + profile) with a program + a profile row.
    const v3 = new Dexie(N3);
    v3.version(3).stores({ ...V1_STORES, profile: 'key' });
    await v3.open();
    await v3.table('programs').add({
      id: 'p1', name: 'Recomp · 5d', isActive: true, createdAt: '2026-06-01T00:00:00.000Z',
    });
    await v3.table('profile').add({ key: 'user', goal: 'Recomposition', updatedAt: '2026-06-01T00:00:00.000Z' });
    v3.close();

    const migrated = new OpenSetsDB(N3);
    await migrated.open(); // runs only version(4)

    // Old program + profile intact; new optional fields simply absent and writable.
    const prog = await migrated.programs.get('p1');
    expect(prog).toMatchObject({ name: 'Recomp · 5d', isActive: true });
    expect(prog!.volumeState).toBeUndefined();
    const prof = await migrated.profile.get('user');
    expect(prof).toMatchObject({ goal: 'Recomposition' });
    expect(prof!.experience).toBeUndefined();
    expect(prof!.priorityMuscles).toBeUndefined();

    // One snapshot, labelled with the v3 source version.
    const backups = await migrated.backups.toArray();
    expect(backups).toHaveLength(1);
    expect(backups[0]!.schemaVersion).toBe(3);

    migrated.close();
    await Dexie.delete(N3);
  });
});

describe('R1 preference inputs + volume-state persistence', () => {
  beforeEach(async () => {
    await db.profile.clear();
    await db.programs.clear();
  });

  it('persists the new goal-aware Profile fields and merge-patches them', async () => {
    await updateProfile({
      experience: 'Intermediate',
      days: 5,
      equipment: 'Full gym',
      splitChoice: 'pplArms',
      priorityMuscles: ['chest', 'biceps'],
      avoidExerciseIds: ['Barbell_Squat'],
    });
    let p = await db.profile.get('user');
    expect(p).toMatchObject({
      experience: 'Intermediate',
      days: 5,
      equipment: 'Full gym',
      splitChoice: 'pplArms',
      priorityMuscles: ['chest', 'biceps'],
      avoidExerciseIds: ['Barbell_Squat'],
    });

    // A later patch to one field leaves the others intact (merge semantics).
    await updateProfile({ priorityMuscles: ['hamstrings'] });
    p = await db.profile.get('user');
    expect(p).toMatchObject({ splitChoice: 'pplArms', priorityMuscles: ['hamstrings'], days: 5 });
  });

  it('persists per-muscle volumeState on a Program and reads it back', async () => {
    await db.programs.add({
      id: 'pv', name: 'Hypertrophy · 5d', isActive: true, createdAt: '2026-06-28T00:00:00.000Z',
      volumeState: {
        chest: { current: 10, mev: 10, mav: 16, mrv: 22 },
        biceps: { current: 8, mev: 8, mav: 14, mrv: 20 },
      },
    });
    const prog = await db.programs.get('pv');
    // current seeds at MEV (block starts at minimum effective volume).
    expect(prog!.volumeState!.chest).toEqual({ current: 10, mev: 10, mav: 16, mrv: 22 });
    expect(prog!.volumeState!.chest!.current).toBe(prog!.volumeState!.chest!.mev);
    expect(prog!.volumeState!.biceps!.mrv).toBe(20);
  });
});

describe('profile persistence (updateProfile)', () => {
  beforeEach(() => db.profile.clear());

  it('creates then merge-patches the singleton, stamping updatedAt', async () => {
    await updateProfile({ sex: 'male', heightIn: 70 });
    let p = await db.profile.get('user');
    expect(p).toMatchObject({ key: 'user', sex: 'male', heightIn: 70 });
    expect(typeof p?.updatedAt).toBe('string');

    // A later patch merges — prior fields are retained.
    await updateProfile({ goal: 'Lose fat', goalTimeframeWeeks: 8 });
    p = await db.profile.get('user');
    expect(p).toMatchObject({
      sex: 'male',
      heightIn: 70,
      goal: 'Lose fat',
      goalTimeframeWeeks: 8,
    });
  });
});

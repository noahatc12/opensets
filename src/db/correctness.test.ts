/**
 * Phase 2 correctness (audit 2026-09-24), proven through the real Dexie pipeline:
 * load types reach the engine, progression follows the log, a block rolls over
 * instead of parking in deload, finishing twice advances once, an import snapshots
 * the data it is about to replace, and pre-migration snapshots carry the profile.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import Dexie from 'dexie';
import { db, DEFAULT_SETTINGS, OpenSetsDB } from './db';
import {
  createProgram,
  setActiveProgram,
  createTemplate,
  saveTemplate,
  makeSlot,
  seedExerciseState,
  getExerciseState,
  prescriptionForSlot,
  startSessionFromTemplate,
  logSet,
  completeSessionAndAdvance,
  nextTemplateForProgram,
} from './repositories';
import { buildEnvelope, importEnvelope } from './exportImport';
import type { ExerciseSlot, WorkoutTemplate } from './types';
import type { ProgressionRule } from '../engine/types';

const NOW = '2026-09-24T17:00:00.000Z';
const ISO: ProgressionRule = {
  kind: 'double',
  repMin: 10,
  repMax: 14,
  incrementLb: 1.25,
  perSet: false,
};
const LIN: ProgressionRule = {
  kind: 'linear',
  incrementLb: 2.5,
  failsBeforeDeload: 3,
  deloadPct: 0.1,
};

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
  await db.settings.put({ key: 'user', ...DEFAULT_SETTINGS });
});

function slot(
  exerciseId: string,
  rule: ProgressionRule,
  loadType?: ExerciseSlot['loadType'],
): ExerciseSlot {
  const s = makeSlot(
    exerciseId,
    0,
    rule,
    rule.kind === 'linear'
      ? { sets: 3, repTarget: 5 }
      : { sets: 3, repRange: [10, 14] },
    { warmupSec: 60, workSec: 90 },
  );
  return loadType ? { ...s, loadType } : s;
}

async function program(
  slots: ExerciseSlot[],
  mesocycle?: { totalWeeks: number },
) {
  const p = await createProgram('Test', NOW);
  await setActiveProgram(p.id);
  if (mesocycle) {
    await db.programs.update(p.id, {
      mesocycle: {
        phase: 'accumulation',
        weekIndex: 0,
        totalWeeks: mesocycle.totalWeeks,
      },
    });
  }
  const tpl = await createTemplate(p.id, 'Day 1', 0);
  tpl.slots = slots;
  await saveTemplate(tpl);
  return { programId: p.id, tpl };
}

async function logWorking(
  sessionId: string,
  exerciseId: string,
  weightLb: number,
  reps: number,
  n = 3,
) {
  for (let i = 0; i < n; i++) {
    await logSet({
      sessionId,
      exerciseId,
      date: NOW.slice(0, 10),
      order: i,
      type: 'working',
      weightLb,
      reps,
      completed: true,
    });
  }
}

describe('load type reaches the engine through the repositories', () => {
  it('seeding a 13 lb dumbbell slot prescribes 12.5 lb, not the 45 lb bar', async () => {
    const s = slot('db_raise', ISO, 'dumbbell');
    const { programId } = await program([s]);
    const row = await seedExerciseState(programId, s, 13, NOW);
    expect(row.pending!.sets[0]!.targetWeightLb).toBe(12.5);
  });

  it('an unseeded dumbbell slot (swap / add) does not fall back to the bar', async () => {
    const s = slot('db_curl', ISO, 'dumbbell');
    const { programId } = await program([s]);
    const pres = await prescriptionForSlot(programId, s, NOW);
    expect(pres.sets[0]!.targetWeightLb).toBeLessThan(45);
  });

  it('an unseeded bodyweight slot starts at 0 external load', async () => {
    const s = slot(
      'pushup',
      { kind: 'repsOnly', repIncrement: 1 },
      'bodyweight',
    );
    const { programId } = await program([s]);
    const pres = await prescriptionForSlot(programId, s, NOW);
    expect(pres.sets[0]!.targetWeightLb).toBe(0);
  });

  it('completion follows the logged weight: 45 prescribed, 15 x14 logged -> 17.5 next', async () => {
    const s = slot('db_raise', ISO, 'dumbbell');
    const { programId, tpl } = await program([s]);
    await seedExerciseState(programId, s, 45, NOW);
    const session = await startSessionFromTemplate(tpl, NOW);
    await logWorking(session.id, 'db_raise', 15, 14);
    await completeSessionAndAdvance(session.id, NOW);
    expect(
      (await getExerciseState(programId, 'db_raise'))!.pending!.sets[0]!
        .targetWeightLb,
    ).toBe(17.5);
  });
});

describe('block rollover (was: parked in deload forever)', () => {
  async function completeN(n: number, programId: string, tplId: string) {
    for (let i = 0; i < n; i++) {
      const tpl = (await db.templates.get(tplId))!;
      const session = await startSessionFromTemplate(tpl, NOW);
      await logWorking(session.id, 'bench', 100, 5);
      await completeSessionAndAdvance(session.id, NOW);
    }
    return (await db.programs.get(programId))!.mesocycle!;
  }

  it('after a full 4-week block the program starts block 2 at week 0', async () => {
    const s = slot('bench', LIN, 'barbell');
    const { programId, tpl } = await program([s], { totalWeeks: 4 });
    await seedExerciseState(programId, s, 100, NOW);
    const m3 = await completeN(3, programId, tpl.id);
    expect(m3.weekIndex).toBe(3);
    expect(m3.phase).toBe('deload');
    const m4 = await completeN(1, programId, tpl.id);
    expect(m4.weekIndex).toBe(0);
    expect(m4.blockIndex).toBe(1);
    expect(m4.phase).toBe('accumulation');
  });

  it('a program already parked in deload (pre-fix data) restarts at week 0, not mid-block', async () => {
    const s = slot('bench', LIN, 'barbell');
    const { programId, tpl } = await program([s]);
    await db.programs.update(programId, {
      mesocycle: { phase: 'deload', weekIndex: 5, totalWeeks: 6 },
    });
    await seedExerciseState(programId, s, 100, NOW);
    for (let i = 0; i < 17; i++) {
      await db.sessions.add({
        id: `old${i}`,
        programId,
        date: '2026-07-01',
        startedAt: NOW,
        status: 'completed',
      });
    }
    const m = await completeN(1, programId, tpl.id);
    expect(m.blockIndex).toBe(1);
    expect(m.weekIndex).toBe(0);
    expect(m.phase).toBe('accumulation');
  });
});

describe('day rotation (was: Today always started Day 1)', () => {
  it('the next workout is the day after the last completed one, wrapping at the end', async () => {
    const p = await createProgram('3-day', NOW);
    await setActiveProgram(p.id);
    const days: WorkoutTemplate[] = [];
    for (let d = 0; d < 3; d++) {
      const t = await createTemplate(p.id, `Day ${d + 1}`, d);
      t.slots = [slot(`ex${d}`, LIN, 'barbell')];
      await saveTemplate(t);
      days.push(t);
    }
    expect((await nextTemplateForProgram(p.id))!.id).toBe(days[0]!.id);

    const finish = async (tplIdx: number, at: string) => {
      const s = await startSessionFromTemplate(days[tplIdx]!, at);
      await completeSessionAndAdvance(s.id, at);
    };
    await finish(0, '2026-09-20T10:00:00.000Z');
    expect((await nextTemplateForProgram(p.id))!.id).toBe(days[1]!.id);
    await finish(1, '2026-09-21T10:00:00.000Z');
    await finish(2, '2026-09-22T10:00:00.000Z');
    expect((await nextTemplateForProgram(p.id))!.id).toBe(days[0]!.id);
  });
});

describe('finishing twice advances once', () => {
  it('a repeated completeSessionAndAdvance is a no-op', async () => {
    const s = slot('bench', LIN, 'barbell');
    const { programId, tpl } = await program([s], { totalWeeks: 6 });
    await seedExerciseState(programId, s, 100, NOW);
    const session = await startSessionFromTemplate(tpl, NOW);
    await logWorking(session.id, 'bench', 100, 5);
    await completeSessionAndAdvance(session.id, NOW);
    await completeSessionAndAdvance(session.id, NOW);
    expect((await getExerciseState(programId, 'bench'))!.workingWeightLb).toBe(
      102.5,
    );
    expect((await db.programs.get(programId))!.mesocycle!.weekIndex).toBe(1);
  });

  it('two concurrent finishes advance once', async () => {
    const s = slot('bench', LIN, 'barbell');
    const { programId, tpl } = await program([s], { totalWeeks: 6 });
    await seedExerciseState(programId, s, 100, NOW);
    const session = await startSessionFromTemplate(tpl, NOW);
    await logWorking(session.id, 'bench', 100, 5);
    await Promise.all([
      completeSessionAndAdvance(session.id, NOW),
      completeSessionAndAdvance(session.id, NOW),
    ]);
    expect((await getExerciseState(programId, 'bench'))!.workingWeightLb).toBe(
      102.5,
    );
    expect((await db.programs.get(programId))!.mesocycle!.weekIndex).toBe(1);
  });
});

describe('import snapshots the data it replaces', () => {
  it('importing a backup first saves the current data into backups', async () => {
    await program([slot('bench', LIN, 'barbell')]);
    const incoming = await buildEnvelope(NOW);
    incoming.data.programs = [];
    incoming.data.templates = [];
    await importEnvelope(incoming);
    expect(await db.programs.count()).toBe(0);
    const backups = await db.backups.toArray();
    expect(backups).toHaveLength(1);
    expect(backups[0]!.envelope.data.programs).toHaveLength(1);
  });
});

describe('pre-migration snapshots', () => {
  const V3_STORES = {
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
    profile: 'key',
  };

  it('carry the profile row and keep only the newest two', async () => {
    const NAME = 'opensets-p2-snap';
    await Dexie.delete(NAME);
    const v3 = new Dexie(NAME);
    v3.version(3).stores(V3_STORES);
    await v3.open();
    await v3
      .table('profile')
      .add({ key: 'user', goal: 'Build muscle', heightIn: 70, updatedAt: NOW });
    for (const id of ['old1', 'old2']) {
      await v3.table('backups').add({
        id,
        createdAt: '2026-01-01T00:00:00.000Z',
        schemaVersion: 2,
        envelope: {
          app: 'opensets',
          schemaVersion: 2,
          exportedAt: NOW,
          data: {},
        },
      });
    }
    v3.close();

    const migrated = new OpenSetsDB(NAME);
    await migrated.open();
    const backups = await migrated.backups.toArray();
    expect(backups).toHaveLength(2);
    const fresh = backups.find((b) => b.schemaVersion === 3)!;
    expect(fresh.envelope.data.profile).toEqual([
      expect.objectContaining({ heightIn: 70 }),
    ]);
    migrated.close();
    await Dexie.delete(NAME);
  });
});

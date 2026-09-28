/**
 * Body-aware starts through the real pipeline: an exercise with no history (a swap or
 * an add) seeds from the on-device profile and latest bodyweight, and the seeded
 * prescription is flagged as a suggestion until the lifter logs it.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { db, DEFAULT_SETTINGS } from './db';
import {
  createProgram,
  setActiveProgram,
  createTemplate,
  saveTemplate,
  makeSlot,
  prescriptionForSlot,
  getExerciseState,
  startSessionFromTemplate,
  logSet,
  completeSessionAndAdvance,
} from './repositories';
import type { ProgressionRule } from '../engine/types';

const NOW = '2026-09-24T17:00:00.000Z';
const ISO: ProgressionRule = {
  kind: 'double',
  repMin: 10,
  repMax: 14,
  incrementLb: 1.25,
  perSet: false,
};

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
  await db.settings.put({ key: 'user', ...DEFAULT_SETTINGS });
});

async function oneSlotProgram() {
  const p = await createProgram('P', NOW);
  await setActiveProgram(p.id);
  const tpl = await createTemplate(p.id, 'Day 1', 0);
  const slot = makeSlot(
    'db_raise',
    0,
    ISO,
    { sets: 3, repRange: [10, 14] },
    { warmupSec: 45, workSec: 90 },
    { loadType: 'dumbbell' },
  );
  tpl.slots = [slot];
  await saveTemplate(tpl);
  return { programId: p.id, tpl, slot };
}

describe('body-aware start for exercises with no history', () => {
  it('a novice 140 lb woman adding a dumbbell isolation lift starts at 5 lb or less, not the generic 10', async () => {
    await db.profile.put({
      key: 'user',
      sex: 'female',
      experience: 'Novice',
      birthDate: '1998-03-01',
      updatedAt: NOW,
    });
    await db.measurements.add({
      id: 'bw1',
      type: 'bodyweight',
      date: NOW,
      valueLb: 140,
    });
    const { programId, slot } = await oneSlotProgram();
    const pres = await prescriptionForSlot(programId, slot, NOW);
    expect(pres.sets[0]!.targetWeightLb).toBeGreaterThan(0);
    expect(pres.sets[0]!.targetWeightLb).toBeLessThanOrEqual(5);
  });

  it('uses the most recent bodyweight entry', async () => {
    await db.profile.put({
      key: 'user',
      sex: 'male',
      experience: 'Intermediate',
      updatedAt: NOW,
    });
    await db.measurements.bulkAdd([
      {
        id: 'old',
        type: 'bodyweight',
        date: '2026-01-01T00:00:00.000Z',
        valueLb: 120,
      },
      {
        id: 'new',
        type: 'bodyweight',
        date: '2026-09-01T00:00:00.000Z',
        valueLb: 240,
      },
    ]);
    const { programId, slot } = await oneSlotProgram();
    const heavy = (await prescriptionForSlot(programId, slot, NOW)).sets[0]!
      .targetWeightLb;
    await db.measurements.delete('new');
    await db.exerciseState.clear();
    const light = (await prescriptionForSlot(programId, slot, NOW)).sets[0]!
      .targetWeightLb;
    expect(heavy).toBeGreaterThan(light);
  });

  it('flags a seeded prescription as a suggestion, and the flag clears once it is logged', async () => {
    const { programId, tpl } = await oneSlotProgram();
    const seeded = await prescriptionForSlot(programId, tpl.slots[0]!, NOW);
    expect(seeded.flags).toContain('suggested');

    const session = await startSessionFromTemplate(tpl, NOW);
    for (let i = 0; i < 3; i++) {
      await logSet({
        sessionId: session.id,
        exerciseId: 'db_raise',
        date: NOW.slice(0, 10),
        order: i,
        type: 'working',
        weightLb: 10,
        reps: 12,
        completed: true,
      });
    }
    await completeSessionAndAdvance(session.id, NOW);
    expect(
      (await getExerciseState(programId, 'db_raise'))!.pending!.flags,
    ).not.toContain('suggested');
  });
});

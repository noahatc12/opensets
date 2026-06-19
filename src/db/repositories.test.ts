import { describe, it, expect, beforeEach } from 'vitest';
import { db } from './db';
import {
  createProgram,
  setActiveProgram,
  getActiveProgram,
  createTemplate,
  saveTemplate,
  makeSlot,
  seedExerciseState,
  getExerciseState,
  prescriptionForSlot,
  startSessionFromTemplate,
  completeSessionAndAdvance,
  logSet,
  getSessionSets,
  softDeleteSet,
  restoreSet,
  lastWorkingSetsForExercise,
  detectAndMarkPRs,
  getExercisePRs,
} from './repositories';
import type { ExerciseSlot, LoggedSet } from './types';

const NOW = '2026-06-19T17:00:00.000Z';
const LATER = '2026-06-20T17:00:00.000Z';

async function wipe() {
  await Promise.all([
    db.programs.clear(),
    db.templates.clear(),
    db.sessions.clear(),
    db.sets.clear(),
    db.exerciseState.clear(),
  ]);
}
beforeEach(wipe);

function linearSlot(): ExerciseSlot {
  return makeSlot(
    'ex_squat',
    0,
    { kind: 'linear', incrementKg: 5, failsBeforeDeload: 3, deloadPct: 0.1 },
    { sets: 3, repTarget: 5 },
    { warmupSec: 60, workSec: 180 },
  );
}

async function setupProgram() {
  const program = await createProgram('Starting Strength', NOW);
  await setActiveProgram(program.id);
  const tpl = await createTemplate(program.id, 'Workout A', 0);
  const slot = linearSlot();
  tpl.slots = [slot];
  await saveTemplate(tpl);
  return { program, tpl, slot };
}

function loggedSet(
  sessionId: string,
  order: number,
  over: Partial<LoggedSet> = {},
): Omit<LoggedSet, 'id'> {
  return {
    sessionId,
    exerciseId: 'ex_squat',
    date: '2026-06-19',
    order,
    type: 'working',
    weightKg: 60,
    reps: 5,
    completed: true,
    ...over,
  };
}

describe('programs', () => {
  it('marks exactly one program active', async () => {
    const a = await createProgram('A', NOW);
    const b = await createProgram('B', NOW);
    await setActiveProgram(a.id);
    await setActiveProgram(b.id);
    const active = await getActiveProgram();
    expect(active?.id).toBe(b.id);
    expect((await db.programs.get(a.id))?.isActive).toBe(false);
  });
});

describe('exercise state seeding', () => {
  it('seeds the starting weight and a starting prescription', async () => {
    const { program, slot } = await setupProgram();
    const row = await seedExerciseState(program.id, slot, 60, NOW);
    expect(row.workingWeightKg).toBe(60);
    expect(row.pending?.sets).toHaveLength(3);
    expect(row.pending?.sets[0]?.targetWeightKg).toBe(60);
    expect(row.pending?.reason).toMatch(/starting weight/i);
  });

  it('prescriptionForSlot seeds on first call (bar weight) then reuses the cache', async () => {
    const { program, slot } = await setupProgram();
    const p = await prescriptionForSlot(program.id, slot, NOW);
    expect(p.sets[0]?.targetWeightKg).toBe(20); // empty bar default
    const state = await getExerciseState(program.id, 'ex_squat');
    expect(state?.pending).toBeDefined();
  });
});

describe('full workout cycle advances progression', () => {
  it('all sets hit → next prescription is +increment with an explained reason', async () => {
    const { program, tpl, slot } = await setupProgram();
    await seedExerciseState(program.id, slot, 60, NOW);

    const session = await startSessionFromTemplate(tpl, NOW);
    await logSet(loggedSet(session.id, 0));
    await logSet(loggedSet(session.id, 1));
    await logSet(loggedSet(session.id, 2));
    await completeSessionAndAdvance(session.id, NOW);

    const state = await getExerciseState(program.id, 'ex_squat');
    expect(state?.workingWeightKg).toBe(65); // 60 + 5
    expect(state?.pending?.reason).toMatch(/\+5 kg/);
    expect((await db.sessions.get(session.id))?.status).toBe('completed');
  });

  it('a missed set holds the weight', async () => {
    const { program, tpl, slot } = await setupProgram();
    await seedExerciseState(program.id, slot, 60, NOW);
    const session = await startSessionFromTemplate(tpl, NOW);
    await logSet(loggedSet(session.id, 0));
    await logSet(loggedSet(session.id, 1));
    await logSet(loggedSet(session.id, 2, { reps: 3 })); // short
    await completeSessionAndAdvance(session.id, NOW);
    const state = await getExerciseState(program.id, 'ex_squat');
    expect(state?.workingWeightKg).toBe(60);
    expect(state?.pending?.reason).toMatch(/repeat/i);
  });
});

describe('program-edit snapshot (frozen executed slots)', () => {
  it('editing the template after a session starts does not change that session', async () => {
    const { tpl } = await setupProgram();
    const session = await startSessionFromTemplate(tpl, NOW);

    // Mutate and persist the template after the session started.
    tpl.slots[0]!.scheme.sets = 5;
    tpl.slots.push(linearSlot());
    await saveTemplate(tpl);

    const frozen = (await db.sessions.get(session.id))!;
    expect(frozen.executedSlots).toHaveLength(1);
    expect(frozen.executedSlots![0]!.scheme.sets).toBe(3);
  });
});

describe('set logging, undo, and last-session lookup', () => {
  it('soft-delete hides a set; restore brings it back', async () => {
    const session = await startSessionFromTemplate(
      (await setupProgram()).tpl,
      NOW,
    );
    const s = await logSet(loggedSet(session.id, 0));
    expect(await getSessionSets(session.id)).toHaveLength(1);
    await softDeleteSet(s.id, NOW);
    expect(await getSessionSets(session.id)).toHaveLength(0);
    await restoreSet(s.id);
    expect(await getSessionSets(session.id)).toHaveLength(1);
  });

  it('returns the most recent completed session as last-session input', async () => {
    const { tpl } = await setupProgram();
    const s1 = await startSessionFromTemplate(tpl, NOW);
    await logSet(loggedSet(s1.id, 0, { date: '2026-06-19', weightKg: 60 }));
    const s2 = await startSessionFromTemplate(tpl, LATER);
    await logSet(loggedSet(s2.id, 0, { date: '2026-06-20', weightKg: 65 }));

    const last = await lastWorkingSetsForExercise('ex_squat');
    expect(last).toHaveLength(1);
    expect(last[0]!.weightKg).toBe(65); // the newer session
  });

  it('can exclude the in-progress session from the last-session lookup', async () => {
    const { tpl } = await setupProgram();
    const s1 = await startSessionFromTemplate(tpl, NOW);
    await logSet(loggedSet(s1.id, 0, { date: '2026-06-19', weightKg: 60 }));
    const s2 = await startSessionFromTemplate(tpl, LATER);
    await logSet(loggedSet(s2.id, 0, { date: '2026-06-20', weightKg: 65 }));

    const last = await lastWorkingSetsForExercise('ex_squat', s2.id);
    expect(last[0]!.weightKg).toBe(60); // falls back to the earlier session
  });
});

describe('PR detection + history', () => {
  it('marks a heavier set as a PR, persists the flag, and lists it', async () => {
    const { tpl } = await setupProgram();
    const s1 = await startSessionFromTemplate(tpl, NOW);
    await logSet(loggedSet(s1.id, 0, { date: '2026-06-19', weightKg: 60 }));
    const s2 = await startSessionFromTemplate(tpl, LATER);
    const heavy = await logSet(
      loggedSet(s2.id, 0, { date: '2026-06-20', weightKg: 70 }),
    );

    const result = await detectAndMarkPRs(heavy);
    expect(result.kinds).toContain('weight');
    expect((await db.sets.get(heavy.id))?.isPR).toContain('weight');
    expect((await getExercisePRs('ex_squat')).map((p) => p.id)).toContain(
      heavy.id,
    );
  });

  it('does not mark the first-ever set', async () => {
    const { tpl } = await setupProgram();
    const s1 = await startSessionFromTemplate(tpl, NOW);
    const first = await logSet(loggedSet(s1.id, 0));
    expect((await detectAndMarkPRs(first)).kinds).toEqual([]);
    expect((await db.sets.get(first.id))?.isPR).toBeUndefined();
  });
});

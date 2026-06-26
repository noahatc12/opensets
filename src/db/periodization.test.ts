import { describe, it, expect, beforeEach } from 'vitest';
import { db } from './db';
import {
  createProgram,
  createTemplate,
  saveTemplate,
  makeSlot,
  seedExerciseState,
  getExerciseState,
  startSessionFromTemplate,
  logSet,
  completeSessionAndAdvance,
} from './repositories';
import type { ProgressionRule } from '../engine/types';

/* Runtime proof that periodization is REAL, not rendered: a program with a mesocycle
   advances its week as sessions complete, and the cached prescription changes with it
   (RPE moves, intensifier appears) — while the weight stays rule-owned. */

const DOUBLE: ProgressionRule = { kind: 'double', repMin: 6, repMax: 10, incrementLb: 2.5, perSet: false };

beforeEach(async () => {
  await Promise.all([
    db.programs.clear(),
    db.templates.clear(),
    db.sessions.clear(),
    db.sets.clear(),
    db.exerciseState.clear(),
  ]);
});

const workingRpe = (row: Awaited<ReturnType<typeof getExerciseState>>) =>
  row!.pending!.sets.find((s) => s.type === 'working' || s.type === 'amrap')!.targetRpe;

async function setup(now: string) {
  const program = await createProgram('Hypertrophy · 1d', now);
  // 1-day program → each completed session advances one mesocycle week.
  await db.programs.update(program.id, {
    mesocycle: { phase: 'accumulation', weekIndex: 0, totalWeeks: 6, volumeTargets: { chest: { mev: 10, mav: 16, mrv: 22 } } },
  });
  const tpl = await createTemplate(program.id, 'Day 1', 0);
  const slot = makeSlot('bench', 0, DOUBLE, { sets: 3, repRange: [6, 10] }, { warmupSec: 60, workSec: 120 });
  tpl.slots = [slot];
  await saveTemplate(tpl);
  await seedExerciseState(program.id, slot, 135, now);
  return { program, tpl };
}

async function completeOneSession(tplSlots: { exerciseId: string }, tplId: string, programId: string, now: string) {
  const tpl = (await db.templates.get(tplId))!;
  void tplSlots;
  const session = await startSessionFromTemplate(tpl, now);
  await logSet({ sessionId: session.id, exerciseId: 'bench', date: now.slice(0, 10), order: 0, type: 'working', weightLb: 135, reps: 8, completed: true });
  await completeSessionAndAdvance(session.id, now);
  void programId;
}

describe('runtime periodization (§2.2 wired into the pipeline)', () => {
  it('seeds the week-0 prescription with the accumulation RPE', async () => {
    const now = '2026-06-26T18:00:00.000Z';
    await setup(now);
    expect(workingRpe(await getExerciseState((await db.programs.toArray())[0]!.id, 'bench'))).toBe(7);
  });

  it('advances the week as sessions complete, and the prescription changes with it', async () => {
    const now = '2026-06-26T18:00:00.000Z';
    const { program, tpl } = await setup(now);
    const rpe0 = workingRpe(await getExerciseState(program.id, 'bench'));

    await completeOneSession(tpl.slots[0]!, tpl.id, program.id, now);
    const after1 = (await db.programs.get(program.id))!;
    expect(after1.mesocycle!.weekIndex).toBe(1); // floor(1 completed / 1 day) = week 2
    const rpe1 = workingRpe(await getExerciseState(program.id, 'bench'));
    expect(rpe1).not.toBe(rpe0); // the cached prescription actually moved

    // Drive into the intensification phase → the prescription gains a rest-pause set.
    for (let i = 0; i < 3; i++) await completeOneSession(tpl.slots[0]!, tpl.id, program.id, now);
    const prog = (await db.programs.get(program.id))!;
    expect(prog.mesocycle!.phase).toBe('intensification');
    const state = await getExerciseState(program.id, 'bench');
    expect(state!.pending!.sets.some((s) => s.type === 'restPause')).toBe(true);
    // Weight stayed rule-owned (held at 135 — only 1 sub-max set logged).
    expect(state!.pending!.sets.find((s) => s.type === 'working')!.targetWeightLb).toBe(135);
  });

  it('caps the week at the deload and never runs off the end', async () => {
    const now = '2026-06-26T18:00:00.000Z';
    const { program, tpl } = await setup(now);
    for (let i = 0; i < 10; i++) await completeOneSession(tpl.slots[0]!, tpl.id, program.id, now);
    const prog = (await db.programs.get(program.id))!;
    expect(prog.mesocycle!.weekIndex).toBe(5); // totalWeeks 6 → max index 5
    expect(prog.mesocycle!.phase).toBe('deload');
  });
});

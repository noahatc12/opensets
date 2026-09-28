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
import { buildMesocyclePlan, phaseForWeek } from '../engine';

/* Runtime proof that periodization is REAL, not rendered: a program with a mesocycle
   advances its week as sessions complete, and the cached prescription changes with it
   (RPE moves, intensifier appears) — while the weight stays rule-owned. */

const DOUBLE: ProgressionRule = {
  kind: 'double',
  repMin: 6,
  repMax: 10,
  incrementLb: 2.5,
  perSet: false,
};

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
  row!.pending!.sets.find((s) => s.type === 'working' || s.type === 'amrap')!
    .targetRpe;

async function setup(now: string) {
  const program = await createProgram('Hypertrophy · 1d', now);
  // 1-day program → each completed session advances one mesocycle week.
  await db.programs.update(program.id, {
    mesocycle: {
      phase: 'accumulation',
      weekIndex: 0,
      totalWeeks: 6,
      volumeTargets: { chest: { mev: 10, mav: 16, mrv: 22 } },
    },
  });
  const tpl = await createTemplate(program.id, 'Day 1', 0);
  const slot = makeSlot(
    'bench',
    0,
    DOUBLE,
    { sets: 3, repRange: [6, 10] },
    { warmupSec: 60, workSec: 120 },
  );
  tpl.slots = [slot];
  await saveTemplate(tpl);
  await seedExerciseState(program.id, slot, 135, now);
  return { program, tpl };
}

async function completeOneSession(
  tplSlots: { exerciseId: string },
  tplId: string,
  programId: string,
  now: string,
) {
  const tpl = (await db.templates.get(tplId))!;
  void tplSlots;
  const session = await startSessionFromTemplate(tpl, now);
  await logSet({
    sessionId: session.id,
    exerciseId: 'bench',
    date: now.slice(0, 10),
    order: 0,
    type: 'working',
    weightLb: 135,
    reps: 8,
    completed: true,
  });
  await completeSessionAndAdvance(session.id, now);
  void programId;
}

describe('runtime periodization (§2.2 wired into the pipeline)', () => {
  it('seeds the week-0 prescription with the accumulation RPE', async () => {
    const now = '2026-06-26T18:00:00.000Z';
    await setup(now);
    expect(
      workingRpe(
        await getExerciseState((await db.programs.toArray())[0]!.id, 'bench'),
      ),
    ).toBe(7);
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
    for (let i = 0; i < 3; i++)
      await completeOneSession(tpl.slots[0]!, tpl.id, program.id, now);
    const prog = (await db.programs.get(program.id))!;
    expect(prog.mesocycle!.phase).toBe('intensification');
    const state = await getExerciseState(program.id, 'bench');
    expect(state!.pending!.sets.some((s) => s.type === 'restPause')).toBe(true);
    // Weight stayed rule-owned (held at 135 — only 1 sub-max set logged).
    expect(
      state!.pending!.sets.find((s) => s.type === 'working')!.targetWeightLb,
    ).toBe(135);
  });

  // Was "caps the week at the deload and never runs off the end": that pinned the bug
  // where a program parked in deload forever after one block (audit 2026-09-24).
  it('rolls into the next block after the deload instead of parking there', async () => {
    const now = '2026-06-26T18:00:00.000Z';
    const { program, tpl } = await setup(now);
    for (let i = 0; i < 10; i++)
      await completeOneSession(tpl.slots[0]!, tpl.id, program.id, now);
    const prog = (await db.programs.get(program.id))!;
    // 10 weeks on a 6-week block = block 2 (index 1), week 5 (index 4).
    expect(prog.mesocycle!.blockIndex).toBe(1);
    expect(prog.mesocycle!.weekIndex).toBe(4);
    expect(prog.mesocycle!.phase).toBe('intensification');
  });
});

/* R3.5 — the per-muscle temporal set-count ramp is wired into periodize: a hypertrophy
   (rampsVolume) program grows a muscle's working sets from its R3 base toward MRV across
   the block and resets at deload; a non-volume program (rampsVolume false) does not. */

const workingCount = (row: Awaited<ReturnType<typeof getExerciseState>>) =>
  row!.pending!.sets.filter((s) => s.type === 'working' || s.type === 'amrap')
    .length;

const PLAN6 = buildMesocyclePlan(6);
const PEAK = PLAN6.weeks.lastIndexOf('intensification'); // 4
const DELOAD = PLAN6.weeks.indexOf('deload'); // 5

/** Two chest slots (5 + 5 = base 10 = chest MEV, headroom to MRV 22), seeded at `weekIndex`. */
async function rampSetup(now: string, rampsVolume: boolean, weekIndex: number) {
  const program = await createProgram('Chest · 1d', now);
  await db.programs.update(program.id, {
    mesocycle: {
      phase: phaseForWeek(PLAN6, weekIndex),
      weekIndex,
      totalWeeks: 6,
      volumeTargets: { chest: { mev: 10, mav: 16, mrv: 22 } },
      rampsVolume,
    },
  });
  const tpl = await createTemplate(program.id, 'Chest', 0);
  tpl.slots = [
    makeSlot(
      'bench',
      0,
      DOUBLE,
      { sets: 5, repRange: [6, 10] },
      { warmupSec: 60, workSec: 120 },
      { primaryMuscle: 'chest' },
    ),
    makeSlot(
      'incline',
      1,
      DOUBLE,
      { sets: 5, repRange: [6, 10] },
      { warmupSec: 60, workSec: 120 },
      { primaryMuscle: 'chest' },
    ),
  ];
  await saveTemplate(tpl);
  for (const s of tpl.slots) await seedExerciseState(program.id, s, 135, now);
  return { program, tpl };
}

const chestWeeklySets = async (programId: string) =>
  workingCount(await getExerciseState(programId, 'bench')) +
  workingCount(await getExerciseState(programId, 'incline'));

describe('R3.5 per-muscle ramp wired into periodize', () => {
  const now = '2026-07-05T18:00:00.000Z';

  it('week-1 prescribes the R3 static base (factor 1, no change vs paused state)', async () => {
    const { program } = await rampSetup(now, true, 0);
    expect(await chestWeeklySets(program.id)).toBe(10); // 5 + 5 = MEV base
  });

  it('the intensification peak ramps chest up toward MRV', async () => {
    const { program } = await rampSetup(now, true, PEAK);
    // base 10 · (22/10) = 22 → each 5-set slot → round(5·2.2)=11, sum 22
    expect(await chestWeeklySets(program.id)).toBe(22);
  });

  it('deload resets chest volume back to its base', async () => {
    const { program } = await rampSetup(now, true, DELOAD);
    expect(await chestWeeklySets(program.id)).toBe(10);
  });

  it('a non-volume goal (rampsVolume false) does NOT ramp — set count stays flat at the peak', async () => {
    const { program } = await rampSetup(now, false, PEAK);
    expect(await chestWeeklySets(program.id)).toBe(10); // strength/fat-loss hold the R3 base
  });

  it('never prescribes below the base (MEV) on any week', async () => {
    for (let w = 0; w < 6; w++) {
      const { program } = await rampSetup(now, true, w);
      expect(await chestWeeklySets(program.id)).toBeGreaterThanOrEqual(10);
    }
  });
});

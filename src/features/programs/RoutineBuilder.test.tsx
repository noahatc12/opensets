// @vitest-environment jsdom
/**
 * Editing a saved day (Noah, 09-28: "I couldn't go back and change how many sets").
 * Asserts against Dexie: the day keeps its id, the change lands on the slot, and the
 * exercise is re-prescribed from its current state without losing progress.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { db, DEFAULT_SETTINGS } from '../../db/db';
import {
  createProgram,
  setActiveProgram,
  createTemplate,
  saveTemplate,
  makeSlot,
  seedExerciseState,
  getExerciseState,
} from '../../db/repositories';
import { RoutineBuilder } from './RoutineBuilder';
import type { ProgressionRule } from '../../engine/types';

const now = '2026-09-28T10:00:00.000Z';
const LINEAR: ProgressionRule = {
  kind: 'linear',
  incrementLb: 5,
  failsBeforeDeload: 3,
  deloadPct: 0.1,
};

async function seedDay(rule: ProgressionRule = LINEAR) {
  await db.settings.put({ key: 'user', ...DEFAULT_SETTINGS });
  const program = await createProgram('Upper', now);
  await setActiveProgram(program.id);
  const tpl = await createTemplate(program.id, 'Day 1', 0);
  tpl.slots = [
    makeSlot(
      'Barbell_Bench_Press_-_Medium_Grip',
      0,
      rule,
      { sets: 3, repTarget: 5 },
      { warmupSec: 60, workSec: 180 },
    ),
  ];
  await saveTemplate(tpl);
  await seedExerciseState(program.id, tpl.slots[0]!, 135, now);
  // A lifter one miss into this weight: an edit must not wipe that.
  const st = (await getExerciseState(program.id, tpl.slots[0]!.exerciseId))!;
  await db.exerciseState.put({ ...st, consecutiveFails: 1 });
  return { programId: program.id, tpl };
}

function renderEdit(id: string) {
  return render(
    <MemoryRouter initialEntries={[`/routine/${id}`]}>
      <Routes>
        <Route path="/routine/:templateId" element={<RoutineBuilder />} />
        <Route path="/plan" element={<div>plan</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

// The catalog loads from /data/exercises.json; tests serve one exercise.
const BENCH = {
  id: 'Barbell_Bench_Press_-_Medium_Grip',
  name: 'Barbell Bench Press - Medium Grip',
  nameNorm: 'barbell bench press medium grip',
  primaryMuscles: ['chest'],
  secondaryMuscles: ['triceps'],
  equipment: 'barbell',
  mechanic: 'compound',
  instructions: [],
  images: [],
  isCustom: false,
  isBodyweight: false,
  trackingMode: 'load',
  license: 'unlicense',
};

beforeEach(async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify([BENCH]), { status: 200 })),
  );
  await Promise.all(db.tables.map((t) => t.clear()));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('editing a saved day', () => {
  it('opens with the saved exercise, sets and weight, and saves a new set count in place', async () => {
    const { programId, tpl } = await seedDay();
    const user = userEvent.setup();
    renderEdit(tpl.id);
    await screen.findByText(/Bench Press/i, undefined, { timeout: 3000 });
    expect(
      (screen.getByRole('textbox', { name: 'Day name' }) as HTMLInputElement)
        .value,
    ).toBe('Day 1');
    await user.click(screen.getByRole('button', { name: 'Increase sets' }));
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(async () => {
      const saved = await db.templates.get(tpl.id);
      expect(saved!.slots[0]!.scheme.sets).toBe(4);
    });
    const st = (await getExerciseState(programId, tpl.slots[0]!.exerciseId))!;
    expect(st.workingWeightLb).toBe(135);
    expect(st.consecutiveFails).toBe(1);
    const work = st.pending!.sets.filter((s) => s.type !== 'warmup');
    expect(work).toHaveLength(4);
    expect(work.every((s) => s.targetWeightLb === 135)).toBe(true);
    expect(await db.templates.count()).toBe(1);
  });

  it('a changed weight starts clean at that weight', async () => {
    const { programId, tpl } = await seedDay();
    const user = userEvent.setup();
    renderEdit(tpl.id);
    await screen.findByText(/Bench Press/i, undefined, { timeout: 3000 });
    await user.click(
      screen.getByRole('button', { name: 'Increase starting weight' }),
    );
    await user.click(
      screen.getByRole('button', { name: 'Increase starting weight' }),
    );
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(async () => {
      const st = (await getExerciseState(programId, tpl.slots[0]!.exerciseId))!;
      expect(st.workingWeightLb).toBe(140);
      expect(st.consecutiveFails).toBe(0);
    });
  });

  it('a program-set rule (5/3/1) keeps its rule; only rest edits', async () => {
    const { tpl } = await seedDay({
      kind: 'percent531',
      variant: 'base',
      tmIncrementLb: 5,
    });
    const user = userEvent.setup();
    renderEdit(tpl.id);
    await screen.findByText(/set by your program/i, undefined, {
      timeout: 3000,
    });
    expect(screen.queryByRole('button', { name: 'Increase sets' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Increase rest' }));
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(async () => {
      const saved = await db.templates.get(tpl.id);
      expect(saved!.slots[0]!.restWorkSec).toBe(195);
      expect(saved!.slots[0]!.progressionRule.kind).toBe('percent531');
    });
  });
});

// @vitest-environment jsdom
/**
 * Editing a saved day (Noah, 09-28: "I couldn't go back and change how many sets").
 * Asserts against Dexie: the day keeps its id, the change lands on the slot, and the
 * exercise is re-prescribed from its current state without losing progress.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  render,
  screen,
  waitFor,
  cleanup,
  within,
} from '@testing-library/react';
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
    // The day is saved first, then the exercise is re-prescribed: wait for both.
    await waitFor(async () => {
      const st = (await getExerciseState(programId, tpl.slots[0]!.exerciseId))!;
      const work = st.pending!.sets.filter((s) => s.type !== 'warmup');
      expect(work).toHaveLength(4);
      expect(st.workingWeightLb).toBe(135);
      expect(st.consecutiveFails).toBe(1);
      expect(work.every((s) => s.targetWeightLb === 135)).toBe(true);
    });
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

  // Review card f11: tap a number to type it; rest reads as m:ss and comes from presets.
  it('types a set count on the keypad and picks a rest preset', async () => {
    const { tpl } = await seedDay();
    const user = userEvent.setup();
    renderEdit(tpl.id);
    await screen.findByText(/Bench Press/i, undefined, { timeout: 3000 });
    expect(screen.getByRole('button', { name: 'Type rest' }).textContent).toBe(
      '3:00',
    );
    await user.click(screen.getByRole('button', { name: 'Type sets' }));
    const pad = await screen.findByRole('dialog', { name: 'Sets' });
    await user.click(within(pad).getByRole('button', { name: '5' }));
    await user.click(within(pad).getByRole('button', { name: 'Set' }));
    expect(screen.getByRole('button', { name: 'Type sets' }).textContent).toBe(
      '5',
    );
    await user.click(screen.getByRole('button', { name: 'Type rest' }));
    const rest = await screen.findByRole('dialog', {
      name: 'Rest between sets',
    });
    await user.click(within(rest).getByRole('button', { name: '2:00' }));
    expect(screen.getByRole('button', { name: 'Type rest' }).textContent).toBe(
      '2:00',
    );
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(async () => {
      const saved = await db.templates.get(tpl.id);
      expect(saved!.slots[0]!.scheme.sets).toBe(5);
      expect(saved!.slots[0]!.restWorkSec).toBe(120);
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

/** /routine/new with one exercise handed over, as Exercise detail's "Add to a day" does. */
function renderNew(exerciseId = BENCH.id) {
  return render(
    <MemoryRouter
      initialEntries={[
        { pathname: '/routine/new', state: { addExerciseId: exerciseId } },
      ]}
    >
      <Routes>
        <Route path="/routine/new" element={<RoutineBuilder />} />
        <Route path="/plan" element={<div>plan</div>} />
        <Route path="/today" element={<div>today</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

// Persona check, 09-28: "+ New day" started a separate program and hid the first, so a
// Push and Pull split could not be built by hand, and the typed name went on the program.
describe('a new day', () => {
  it('joins the active program under the name typed, and keeps the lift progress', async () => {
    const { programId, tpl } = await seedDay();
    const user = userEvent.setup();
    renderNew();
    await screen.findByText(/Bench Press/i, undefined, { timeout: 3000 });
    // The lift is already trained on Day 1: its working weight is prefilled.
    await screen.findByText('Upper · Day 2', { exact: false });
    await user.type(screen.getByRole('textbox', { name: 'Day name' }), 'Pull');
    await user.click(screen.getByRole('button', { name: 'Save day' }));
    await screen.findByText('plan');
    const days = await db.templates
      .where('programId')
      .equals(programId)
      .toArray();
    expect(days.map((d) => d.name).sort()).toEqual(['Day 1', 'Pull']);
    expect(days.find((d) => d.name === 'Pull')!.dayIndex).toBe(1);
    expect(await db.programs.count()).toBe(1);
    const st = (await getExerciseState(programId, tpl.slots[0]!.exerciseId))!;
    expect(st.workingWeightLb).toBe(135);
    expect(st.consecutiveFails).toBe(1);
  });

  // Review card f11: Double is the default progression for a loaded lift.
  it('a new loaded lift defaults to double progression, 3 × 8 to 12', async () => {
    await db.settings.put({ key: 'user', ...DEFAULT_SETTINGS });
    const user = userEvent.setup();
    renderNew();
    await screen.findByText(/Bench Press/i, undefined, { timeout: 3000 });
    expect(
      screen
        .getByRole('radio', { name: 'Double' })
        .getAttribute('aria-checked'),
    ).toBe('true');
    await user.type(screen.getByRole('textbox', { name: 'Day name' }), 'Push');
    await user.click(screen.getByRole('button', { name: 'Save day' }));
    await screen.findByText('today');
    const day = (await db.templates.toArray())[0]!;
    expect(day.slots[0]!.progressionRule.kind).toBe('double');
    expect(day.slots[0]!.scheme).toEqual({ sets: 3, repRange: [8, 12] });
  });

  it('starts My plan when there is no program, with the day under the name typed', async () => {
    await db.settings.put({ key: 'user', ...DEFAULT_SETTINGS });
    const user = userEvent.setup();
    renderNew();
    await screen.findByText(/Bench Press/i, undefined, { timeout: 3000 });
    await user.type(screen.getByRole('textbox', { name: 'Day name' }), 'Push');
    await user.click(screen.getByRole('button', { name: 'Save day' }));
    await screen.findByText('today');
    const programs = await db.programs.toArray();
    expect(programs.map((p) => p.name)).toEqual(['My plan']);
    const days = await db.templates.toArray();
    expect(days.map((d) => d.name)).toEqual(['Push']);
    expect(await getExerciseState(programs[0]!.id, BENCH.id)).toBeDefined();
  });

  // Review card f13: "Suggested start" belongs to weights the app picked, never to one
  // the lifter typed.
  it('a weight the app picked is a suggested start; one the lifter set is not', async () => {
    await db.settings.put({ key: 'user', ...DEFAULT_SETTINGS });
    const user = userEvent.setup();
    renderNew();
    await screen.findByText(/Bench Press/i, undefined, { timeout: 3000 });
    await user.type(screen.getByRole('textbox', { name: 'Day name' }), 'Push');
    await user.click(screen.getByRole('button', { name: 'Save day' }));
    await screen.findByText('today');
    const program = (await db.programs.toArray())[0]!;
    const picked = (await getExerciseState(program.id, BENCH.id))!;
    expect(picked.pending!.flags).toContain('suggested');

    await Promise.all(db.tables.map((t) => t.clear()));
    await db.settings.put({ key: 'user', ...DEFAULT_SETTINGS });
    cleanup();
    renderNew();
    await screen.findByText(/Bench Press/i, undefined, { timeout: 3000 });
    await user.click(
      screen.getByRole('button', { name: 'Increase starting weight' }),
    );
    await user.type(screen.getByRole('textbox', { name: 'Day name' }), 'Push');
    await user.click(screen.getByRole('button', { name: 'Save day' }));
    await screen.findByText('today');
    const own = (await getExerciseState(
      (await db.programs.toArray())[0]!.id,
      BENCH.id,
    ))!;
    expect(own.pending!.flags).not.toContain('suggested');
  });
});

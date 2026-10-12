// @vitest-environment jsdom
/**
 * Review card f12 (Noah, 2026-10-01): your other programs are listed under the plan,
 * each with Make active, so a regenerated plan no longer hides the one before it.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { db, DEFAULT_SETTINGS } from '../../db/db';
import {
  createProgram,
  setActiveProgram,
  createTemplate,
  saveTemplate,
  makeSlot,
  getActiveProgram,
} from '../../db/repositories';
import { PlanScreen } from './PlanScreen';
import type { ProgressionRule } from '../../engine/types';

const now = '2026-10-12T10:00:00.000Z';
const LINEAR: ProgressionRule = {
  kind: 'linear',
  incrementLb: 5,
  failsBeforeDeload: 3,
  deloadPct: 0.1,
};

async function seedProgram(name: string, days: number) {
  const program = await createProgram(name, now);
  for (let i = 0; i < days; i++) {
    const tpl = await createTemplate(program.id, `${name} day ${i + 1}`, i);
    tpl.slots = [
      makeSlot(
        'bench',
        0,
        LINEAR,
        { sets: 3, repTarget: 5 },
        { warmupSec: 60, workSec: 180 },
      ),
    ];
    await saveTemplate(tpl);
  }
  return program;
}

beforeEach(async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify([]), { status: 200 })),
  );
  await Promise.all(db.tables.map((t) => t.clear()));
  await db.settings.put({ key: 'user', ...DEFAULT_SETTINGS });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('Plan: your other programs', () => {
  it('lists the programs that are not active, with their day counts, and Make active switches', async () => {
    const first = await seedProgram('Spring plan', 2);
    const second = await seedProgram('Summer plan', 3);
    await setActiveProgram(second.id);
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/plan']}>
        <PlanScreen />
      </MemoryRouter>,
    );
    expect(await screen.findByText('Your other programs')).toBeTruthy();
    expect(screen.getByText('Spring plan')).toBeTruthy();
    expect(screen.getByText('2 days')).toBeTruthy();
    // The active one is the plan itself (its name is the eyebrow), not in the list.
    expect(
      screen.queryByRole('button', { name: 'Make Summer plan active' }),
    ).toBeNull();
    await user.click(
      screen.getByRole('button', { name: 'Make Spring plan active' }),
    );
    await waitFor(async () => {
      expect((await getActiveProgram())!.id).toBe(first.id);
    });
    expect(
      await screen.findByRole('button', { name: 'Make Summer plan active' }),
    ).toBeTruthy();
    expect(screen.getByText('3 days')).toBeTruthy();
  });

  it('shows no other-programs section with a single program', async () => {
    const only = await seedProgram('Only plan', 1);
    await setActiveProgram(only.id);
    render(
      <MemoryRouter initialEntries={['/plan']}>
        <PlanScreen />
      </MemoryRouter>,
    );
    await screen.findByText('Only plan day 1');
    expect(screen.queryByText('Your other programs')).toBeNull();
  });
});

// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { db, DEFAULT_SETTINGS } from '../../db/db';
import { WorkoutCalendar } from './WorkoutCalendar';
import type { LoggedSet, WorkoutSession } from '../../db/types';

// The workout calendar (Noah, 2026-10-14): "a calendar that shows the days a workout
// was logged and what happened during the workout". Local-time dates keep these
// tests true in any time zone.

const at = (m0: number, d: number, h = 12, min = 0) =>
  new Date(2026, m0, d, h, min).toISOString();

async function seed() {
  await db.templates.bulkPut([
    { id: 'tA', programId: 'p', name: 'Upper A', order: 0, slots: [] },
    { id: 'tB', programId: 'p', name: 'Lower A', order: 1, slots: [] },
  ] as never);
  const sessions: WorkoutSession[] = [
    {
      id: 'mon',
      templateId: 'tA',
      date: '',
      startedAt: at(5, 8),
      endedAt: at(5, 8, 12, 55),
      status: 'completed',
    },
    {
      id: 'tue',
      templateId: 'tB',
      date: '',
      startedAt: at(5, 9),
      endedAt: at(5, 9, 12, 58),
      status: 'completed',
    },
    {
      id: 'now',
      templateId: 'tA',
      date: '',
      startedAt: at(5, 11),
      status: 'active',
    },
  ];
  await db.sessions.bulkPut(sessions);
  let order = 0;
  const s = (
    sessionId: string,
    exerciseId: string,
    weightLb: number,
    reps: number,
    isPR?: LoggedSet['isPR'],
  ): LoggedSet => ({
    id: `${sessionId}-${order}`,
    sessionId,
    exerciseId,
    date: at(5, 9),
    order: order++,
    type: 'working',
    weightLb,
    reps,
    completed: true,
    ...(isPR ? { isPR } : {}),
  });
  await db.sets.bulkPut([
    s('mon', 'Barbell_Bench_Press_-_Medium_Grip', 135, 8),
    s('mon', 'Barbell_Bench_Press_-_Medium_Grip', 135, 7),
    s('tue', 'Barbell_Squat', 185, 5),
    s('tue', 'Barbell_Hip_Thrust', 160, 12, ['reps']),
    s('now', 'Barbell_Bench_Press_-_Medium_Grip', 140, 5),
  ]);
}

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
  await db.settings.put({ key: 'user', ...DEFAULT_SETTINGS });
  await seed();
});
afterEach(() => cleanup());

const renderCal = () =>
  render(
    <MemoryRouter>
      <WorkoutCalendar />
    </MemoryRouter>,
  );

describe('WorkoutCalendar', () => {
  it('opens on the month of the latest workout and marks each trained day', async () => {
    renderCal();
    expect(await screen.findByRole('heading', { name: /^June/ })).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Monday, June 8: a workout' }),
    ).toBeTruthy();
    expect(
      screen.getByRole('button', {
        name: 'Tuesday, June 9: a workout, new record',
      }),
    ).toBeTruthy();
    expect(screen.getByText('2 workouts')).toBeTruthy();
  });

  it('does not mark a workout still in progress', async () => {
    renderCal();
    await screen.findByRole('heading', { name: /^June/ });
    expect(screen.queryByRole('button', { name: /June 11/ })).toBeNull();
  });

  it('shows the latest workout first: its name, time, sets and records', async () => {
    renderCal();
    const card = await screen.findByRole('article', {
      name: /^Lower A, Tuesday, June 9/,
    });
    expect(within(card).getByText('58')).toBeTruthy();
    expect(within(card).getByText('185 × 5')).toBeTruthy();
    expect(within(card).getByText('160 × 12')).toBeTruthy();
    expect(within(card).getByText('Record')).toBeTruthy();
  });

  it('opens another day on a tap', async () => {
    const user = userEvent.setup();
    renderCal();
    await user.click(
      await screen.findByRole('button', { name: 'Monday, June 8: a workout' }),
    );
    const card = await screen.findByRole('article', {
      name: /^Upper A, Monday, June 8/,
    });
    expect(within(card).getAllByText('135 × 8')).toHaveLength(1);
    expect(within(card).getByText('135 × 7')).toBeTruthy();
    expect(screen.queryByRole('article', { name: /^Lower A/ })).toBeNull();
  });

  it('steps back a month and says when nothing was logged', async () => {
    const user = userEvent.setup();
    renderCal();
    await user.click(
      await screen.findByRole('button', { name: 'Previous month' }),
    );
    expect(await screen.findByRole('heading', { name: /^May/ })).toBeTruthy();
    expect(screen.getByText('No workouts logged in May.')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Next month' }));
    expect(
      await screen.findByRole('article', { name: /^Lower A/ }),
    ).toBeTruthy();
  });
});

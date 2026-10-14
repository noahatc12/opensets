import { describe, expect, it } from 'vitest';
import {
  exercisesOf,
  localDayKey,
  monthCells,
  setChip,
  workoutDays,
} from './calendar';
import type { LoggedSet, WorkoutSession } from '../../db/types';

// The workout calendar (Noah, 2026-10-14): every trained day marked, a tap opens
// the workout. Times are built in local time so these hold in any time zone.

const at = (m0: number, d: number, h = 12) =>
  new Date(2026, m0, d, h).toISOString();

const session = (
  id: string,
  startedAt: string,
  status: WorkoutSession['status'] = 'completed',
): WorkoutSession => ({
  id,
  date: startedAt.slice(0, 10),
  startedAt,
  status,
});

let n = 0;
const set = (
  sessionId: string,
  exerciseId: string,
  weightLb: number,
  reps: number,
  extra: Partial<LoggedSet> = {},
): LoggedSet => ({
  id: `s${++n}`,
  sessionId,
  exerciseId,
  date: at(9, 13),
  order: n,
  type: 'working',
  weightLb,
  reps,
  completed: true,
  ...extra,
});

describe('localDayKey', () => {
  it('is the local calendar day of the start time', () => {
    expect(localDayKey(at(9, 13, 21))).toBe('2026-10-13');
    expect(localDayKey(at(9, 1, 0))).toBe('2026-10-01');
  });
});

describe('monthCells', () => {
  it('starts on Sunday with blanks before the 1st', () => {
    // October 2026 starts on a Thursday.
    const cells = monthCells(2026, 9);
    expect(cells.slice(0, 5)).toEqual([null, null, null, null, 1]);
    expect(cells.filter((c) => c !== null)).toHaveLength(31);
    expect(cells.length % 7).toBe(0);
  });

  it('handles February in a leap year', () => {
    expect(monthCells(2028, 1).filter((c) => c !== null)).toHaveLength(29);
  });
});

describe('workoutDays', () => {
  it('marks days with logged sets and flags record days', () => {
    const sessions = [
      session('a', at(9, 12)),
      session('b', at(9, 13)),
      session('live', at(9, 14), 'active'),
      session('empty', at(9, 9)),
    ];
    const sets = [
      set('a', 'bench', 135, 8),
      set('b', 'squat', 185, 5, { isPR: ['weight'] }),
      set('live', 'bench', 135, 8),
    ];
    const days = workoutDays(sessions, sets);
    expect([...days.keys()].sort()).toEqual(['2026-10-12', '2026-10-13']);
    expect(days.get('2026-10-12')).toEqual({
      sessionIds: ['a'],
      record: false,
    });
    expect(days.get('2026-10-13')).toEqual({ sessionIds: ['b'], record: true });
  });

  it('ignores deleted and unfinished sets', () => {
    const days = workoutDays(
      [session('a', at(9, 12))],
      [
        set('a', 'bench', 135, 8, { deletedAt: at(9, 12) }),
        set('a', 'bench', 135, 8, { completed: false }),
      ],
    );
    expect(days.size).toBe(0);
  });

  it('keeps two workouts on one day together', () => {
    const days = workoutDays(
      [session('am', at(9, 13, 7)), session('pm', at(9, 13, 18))],
      [set('am', 'bench', 135, 8), set('pm', 'row', 95, 10)],
    );
    expect(days.get('2026-10-13')!.sessionIds).toEqual(['am', 'pm']);
  });
});

describe('exercisesOf', () => {
  it('groups sets by exercise in the order they were done and flags records', () => {
    const sets = [
      set('a', 'squat', 135, 10, { order: 0 }),
      set('a', 'squat', 135, 9, { order: 1 }),
      set('a', 'thrust', 160, 12, { order: 2, isPR: ['reps'] }),
    ];
    const ex = exercisesOf(sets);
    expect(ex.map((e) => e.exerciseId)).toEqual(['squat', 'thrust']);
    expect(ex[0]!.sets.map((s) => s.reps)).toEqual([10, 9]);
    expect(ex[1]!.record).toBe(true);
  });
});

describe('setChip', () => {
  it('reads like the logger', () => {
    expect(setChip(set('a', 'x', 135, 8), 'lb')).toBe('135 × 8');
    expect(setChip(set('a', 'x', 0, 12), 'lb')).toBe('BW × 12');
    expect(setChip(set('a', 'x', -30, 6), 'lb')).toBe('30 assist × 6');
    expect(setChip(set('a', 'x', 0, 1, { durationSec: 60 }), 'lb')).toBe(
      '60 s',
    );
    expect(setChip(set('a', 'x', 100, 5), 'kg')).toBe('45.5 × 5');
  });
});

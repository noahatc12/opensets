import type { LoggedSet, WorkoutSession } from '../../db/types';
import { fmtWeight, type WeightUnit } from '../../lib/units';
import { localDay } from '../../lib/dates';

/*
 * The workout calendar's logic (Noah, 2026-10-14: "a calendar that shows the days a
 * workout was logged and what happened during the workout"). Pure functions so the
 * screen stays a thin shell.
 *
 * A workout sits on the LOCAL day it started. Before schema v5 `WorkoutSession.date`
 * was the UTC day, so the calendar reads `startedAt`, which is right either way.
 */

const pad = (n: number) => String(n).padStart(2, '0');

/** The local calendar day of a timestamp: one implementation, in lib/dates. */
export const localDayKey = localDay;

/** "2026-10-13" for a year, zero-based month and day. */
export function dayKey(year: number, month0: number, day: number): string {
  return `${year}-${pad(month0 + 1)}-${pad(day)}`;
}

/** The month as week rows from Sunday: blanks before the 1st and after the last day,
 *  so the length is a multiple of seven. */
export function monthCells(year: number, month0: number): (number | null)[] {
  const lead = new Date(year, month0, 1).getDay();
  const days = new Date(year, month0 + 1, 0).getDate();
  const cells: (number | null)[] = Array.from({ length: lead }, () => null);
  for (let d = 1; d <= days; d++) cells.push(d);
  while (cells.length % 7) cells.push(null);
  return cells;
}

export interface WorkoutDay {
  /** Finished sessions that day, in the order they started. */
  sessionIds: string[];
  /** Any set that day set a record. */
  record: boolean;
}

const liveSet = (s: LoggedSet) => !s.deletedAt && s.completed;

/** Every local day with at least one logged set in a finished workout. A workout in
 *  progress, or one with nothing logged, does not mark a day. */
export function workoutDays(
  sessions: WorkoutSession[],
  sets: LoggedSet[],
): Map<string, WorkoutDay> {
  const bySession = new Map<string, LoggedSet[]>();
  for (const s of sets) {
    if (!liveSet(s)) continue;
    const list = bySession.get(s.sessionId);
    if (list) list.push(s);
    else bySession.set(s.sessionId, [s]);
  }
  const done = sessions
    .filter((s) => s.status !== 'active' && bySession.has(s.id))
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  const days = new Map<string, WorkoutDay>();
  for (const s of done) {
    const key = localDayKey(s.startedAt);
    const record = bySession.get(s.id)!.some((x) => (x.isPR?.length ?? 0) > 0);
    const day = days.get(key);
    if (day) {
      day.sessionIds.push(s.id);
      day.record ||= record;
    } else days.set(key, { sessionIds: [s.id], record });
  }
  return days;
}

export interface ExerciseLog {
  exerciseId: string;
  sets: LoggedSet[];
  record: boolean;
}

/** One workout's sets grouped by exercise, in the order they were done. */
export function exercisesOf(sets: LoggedSet[]): ExerciseLog[] {
  const out: ExerciseLog[] = [];
  const index = new Map<string, ExerciseLog>();
  for (const s of [...sets].filter(liveSet).sort((a, b) => a.order - b.order)) {
    let ex = index.get(s.exerciseId);
    if (!ex) {
      ex = { exerciseId: s.exerciseId, sets: [], record: false };
      index.set(s.exerciseId, ex);
      out.push(ex);
    }
    ex.sets.push(s);
    if ((s.isPR?.length ?? 0) > 0) ex.record = true;
  }
  return out;
}

/** One set as the logger writes it: "135 × 8", "BW × 12", "30 assist × 6", "60 s". */
export function setChip(s: LoggedSet, unit: WeightUnit): string {
  if (s.durationSec !== undefined && s.durationSec > 0)
    return `${Math.round(s.durationSec)} s`;
  if (Math.abs(s.weightLb) < 0.01) return `BW × ${s.reps}`;
  if (s.weightLb < 0)
    return `${fmtWeight(-s.weightLb, unit)} assist × ${s.reps}`;
  return `${fmtWeight(s.weightLb, unit)} × ${s.reps}`;
}

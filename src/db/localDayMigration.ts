import type { Transaction } from 'dexie';
import { localDay } from '../lib/dates';
import type { LoggedSet, WorkoutSession } from './types';

/**
 * Schema v5 (2026-10-14): every session, and every set that carried its day, moves
 * to the LOCAL day the session started. Until then the stored day was the UTC day (an
 * ISO timestamp cut at 10 characters), which filed a Pacific evening workout under
 * the next day. Runs inside the upgrade transaction, after the pre-migration snapshot,
 * in the lifter's own time zone. Idempotent: a session already on its local day is
 * left alone. A set is moved only when it carries the session's old day, so a set
 * with any other date (a full timestamp, an import) is never touched.
 * Returns how many sessions moved.
 */
export async function moveSessionsToLocalDay(tx: Transaction): Promise<number> {
  const sessions = tx.table<WorkoutSession, string>('sessions');
  const sets = tx.table<LoggedSet, string>('sets');
  let moved = 0;
  for (const s of await sessions.toArray()) {
    if (!s.startedAt || Number.isNaN(Date.parse(s.startedAt))) continue;
    const day = localDay(s.startedAt);
    if (day === s.date) continue;
    const old = s.date;
    await sessions.update(s.id, { date: day });
    await sets
      .where('sessionId')
      .equals(s.id)
      .modify((row) => {
        if (row.date === old) row.date = day;
      });
    moved++;
  }
  return moved;
}

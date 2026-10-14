/**
 * Calendar days, read and written in the lifter's own time zone.
 *
 * A workout belongs to the LOCAL day it started (db/types.ts, WorkoutSession.date).
 * Until 2026-10-14 the stored day was the UTC day (an ISO timestamp cut at 10
 * characters) and a bare day was read back as UTC midnight. In the Pacific time zone
 * that showed a morning workout as the day before and stored an evening one as the
 * day after. These two helpers are the fix; schema v5 moves the old rows.
 */

const BARE_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;
const pad = (n: number) => String(n).padStart(2, '0');

/** "2026-10-14": the local calendar day of an ISO timestamp. */
export function localDay(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** A bare day ("2026-10-14") as local midnight; a full timestamp as that instant. */
export function parseDay(value: string): Date {
  const m = BARE_DAY.exec(value);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return new Date(value);
}

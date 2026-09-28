/**
 * Display formatting shared by the premium screens. Numbers only; every weight still
 * goes through lib/units so the lb/kg setting stays consistent.
 */

/** 86_700 -> "86.7k", 716_000 -> "716k", 1_240_000 -> "1.24M", 950 -> "950". */
export function compact(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return trim((n / 1_000_000).toFixed(2)) + 'M';
  if (abs >= 100_000) return Math.round(n / 1000) + 'k';
  if (abs >= 10_000) return trim((n / 1000).toFixed(1)) + 'k';
  if (abs >= 1000) return trim((n / 1000).toFixed(1)) + 'k';
  return String(Math.round(n));
}

function trim(s: string): string {
  return s.replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1');
}

/** 150 -> "2:30". */
export function clock(totalSec: number): string {
  const s = Math.max(0, Math.round(totalSec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** The engine writes its reasons with a spaced em dash; the UI shows them without one. */
export function humanReason(reason: string): string {
  return reason.replace(/\s+—\s+/g, ': ').replace(/—/g, ',');
}

/** "Fri" for an ISO date or timestamp. */
export function weekdayShort(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { weekday: 'short' });
}

/** "Sunday". */
export function weekdayLong(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { weekday: 'long' });
}

/** "Sun, Sep 27". */
export function dateShort(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

/** "Sep 27". */
export function monthDay(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

/** Whole days between an ISO date and now, floored at 0. */
export function daysAgo(iso: string, now = Date.now()): number {
  return Math.max(0, Math.floor((now - Date.parse(iso)) / 86_400_000));
}

/** "today", "yesterday", "5 days ago". */
export function daysAgoLabel(iso: string, now = Date.now()): string {
  const d = daysAgo(iso, now);
  if (d === 0) return 'today';
  if (d === 1) return 'yesterday';
  return `${d} days ago`;
}

/** Shorten an exercise name for a chip: drop a trailing qualifier and cap the length. */
export function shortName(name: string, max = 20): string {
  // Drop a parenthetical or a spaced-hyphen qualifier ("Bench Press - Medium Grip"), never a
  // hyphen inside a word ("Close-Grip").
  const base =
    name
      .replace(/\s*\(.*$/, '')
      .replace(/\s+-\s.*$/, '')
      .trim() || name;
  return base.length > max ? base.slice(0, max - 1).trimEnd() + '…' : base;
}

/** "lowerBack" -> "Lower back", "barbell" -> "Barbell". */
export function titleCase(s?: string): string {
  if (!s) return '';
  const spaced = s.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** Monday 00:00 local of the week containing `d`. */
export function startOfWeek(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}

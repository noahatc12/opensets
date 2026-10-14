import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { localDay, parseDay } from './dates';
import { dateShort, daysAgo, monthDay, weekdayShort } from './format';

// A workout belongs to the LOCAL day it started. Until 2026-10-14 the day was the
// UTC day (an ISO string cut at 10), and a bare day was read back as UTC midnight,
// so in the Pacific time zone a morning workout showed as the day before and an
// evening one was stored as the day after. Pinned to Los Angeles so these fail on a
// UTC machine too.

// Node reads TZ on change; the app's tsconfig has no Node types, hence globalThis.
const env = (
  globalThis as unknown as {
    process: { env: Record<string, string | undefined> };
  }
).process.env;
let tz: string | undefined;
beforeAll(() => {
  tz = env.TZ;
  env.TZ = 'America/Los_Angeles';
});
afterAll(() => {
  if (tz === undefined) delete env.TZ;
  else env.TZ = tz;
});

describe('localDay', () => {
  it('is the local day of a timestamp, not the UTC day', () => {
    // 9 PM Wednesday Oct 14 in Los Angeles is 04:00 Thursday UTC.
    expect(localDay('2026-10-15T04:00:00.000Z')).toBe('2026-10-14');
    // 9 AM Wednesday in Los Angeles is 16:00 the same day UTC.
    expect(localDay('2026-10-14T16:00:00.000Z')).toBe('2026-10-14');
  });
});

describe('parseDay', () => {
  it('reads a bare day as local midnight', () => {
    const d = parseDay('2026-10-14');
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()]).toEqual([
      2026, 9, 14, 0,
    ]);
  });
  it('reads a timestamp as that instant', () => {
    expect(parseDay('2026-10-15T04:00:00.000Z').toISOString()).toBe(
      '2026-10-15T04:00:00.000Z',
    );
  });
});

describe('date formatters read a bare day as local', () => {
  it('show Wednesday Oct 14 for "2026-10-14"', () => {
    expect(weekdayShort('2026-10-14')).toBe('Wed');
    expect(monthDay('2026-10-14')).toBe('Oct 14');
    expect(dateShort('2026-10-14')).toBe('Wed, Oct 14');
  });
  it('count days from local midnight, so a workout this morning is today all evening', () => {
    // 6 PM Wednesday in Los Angeles is already Thursday in UTC.
    const eveningWed = new Date(2026, 9, 14, 18).getTime();
    expect(daysAgo('2026-10-14', eveningWed)).toBe(0);
    expect(daysAgo('2026-10-13', eveningWed)).toBe(1);
  });
});

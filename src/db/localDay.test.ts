import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { db, DEFAULT_SETTINGS } from './db';
import {
  createProgram,
  createTemplate,
  startSessionFromTemplate,
} from './repositories';

// A new workout is stored under the LOCAL day it started (2026-10-14). Pinned to Los
// Angeles, where 9 PM Wednesday is already Thursday in UTC.
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
beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
  await db.settings.put({ key: 'user', ...DEFAULT_SETTINGS });
});

describe('a new session', () => {
  it('started at 9 PM Wednesday in Los Angeles is stored under Wednesday', async () => {
    const p = await createProgram('P', '2026-10-14T16:00:00.000Z');
    const tpl = await createTemplate(p.id, 'Day 1', 0);
    const s = await startSessionFromTemplate(tpl, '2026-10-15T04:00:00.000Z');
    expect(s.date).toBe('2026-10-14');
  });
});

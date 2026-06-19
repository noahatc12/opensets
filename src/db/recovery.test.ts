import { describe, it, expect, beforeEach } from 'vitest';
import { db } from './db';
import {
  resumability,
  saveActiveSnapshot,
  getActiveSnapshot,
  clearActiveSnapshot,
  checkForRecoverableSession,
} from './recovery';

beforeEach(() => db.activeSession.clear());

describe('resumability (pure)', () => {
  const now = '2026-06-19T18:00:00.000Z';
  it('offers resume within the 12 h window', () => {
    expect(resumability(now, '2026-06-19T17:00:00.000Z')).toBe('resume');
    expect(resumability(now, '2026-06-19T06:00:00.001Z')).toBe('resume');
  });
  it('marks stale beyond the window', () => {
    expect(resumability(now, '2026-06-19T05:59:00.000Z')).toBe('stale');
    expect(resumability(now, '2026-06-18T00:00:00.000Z')).toBe('stale');
  });
});

describe('active-session snapshot', () => {
  it('saves, reads, and clears the singleton', async () => {
    await saveActiveSnapshot(
      'sess_1',
      { setIndex: 2 },
      '2026-06-19T18:00:00.000Z',
    );
    const snap = await getActiveSnapshot();
    expect(snap?.sessionId).toBe('sess_1');
    expect((snap?.payload as { setIndex: number }).setIndex).toBe(2);
    await clearActiveSnapshot();
    expect(await getActiveSnapshot()).toBeUndefined();
  });

  it('reports a recoverable session with its resume state', async () => {
    expect(
      await checkForRecoverableSession('2026-06-19T18:00:00.000Z'),
    ).toBeNull();
    await saveActiveSnapshot('sess_2', null, '2026-06-19T17:30:00.000Z');
    const rec = await checkForRecoverableSession('2026-06-19T18:00:00.000Z');
    expect(rec?.sessionId).toBe('sess_2');
    expect(rec?.state).toBe('resume');
  });
});

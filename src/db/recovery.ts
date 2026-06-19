/**
 * Crash recovery (spec §9): the in-flight session is debounced into the
 * `activeSession` singleton; on boot we offer to resume if it's recent (< 12 h),
 * else offer save-as-partial/discard. The debounce (≤ 250 ms) lives in the UI
 * store; this module owns the snapshot persistence and the pure resume policy.
 */
import { db } from './db';
import type { ActiveSessionRow } from './types';

export type Resumability = 'resume' | 'stale';
const RESUME_WINDOW_HOURS = 12;

/** Pure: is an active session recent enough to offer a resume? */
export function resumability(
  nowIso: string,
  updatedAtIso: string,
  maxHours = RESUME_WINDOW_HOURS,
): Resumability {
  const ageMs = Date.parse(nowIso) - Date.parse(updatedAtIso);
  return ageMs <= maxHours * 3_600_000 ? 'resume' : 'stale';
}

export async function saveActiveSnapshot(
  sessionId: string,
  payload: unknown,
  now: string,
): Promise<void> {
  await db.activeSession.put({
    key: 'current',
    sessionId,
    updatedAt: now,
    payload,
  });
}

export function getActiveSnapshot(): Promise<ActiveSessionRow | undefined> {
  return db.activeSession.get('current');
}

export async function clearActiveSnapshot(): Promise<void> {
  await db.activeSession.delete('current');
}

export interface RecoverableSession {
  sessionId: string;
  updatedAt: string;
  state: Resumability;
}

/** On boot, report any recoverable in-flight session and whether to offer resume. */
export async function checkForRecoverableSession(
  now: string,
): Promise<RecoverableSession | null> {
  const snap = await getActiveSnapshot();
  if (!snap) return null;
  return {
    sessionId: snap.sessionId,
    updatedAt: snap.updatedAt,
    state: resumability(now, snap.updatedAt),
  };
}

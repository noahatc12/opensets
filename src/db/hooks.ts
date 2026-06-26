import { useLiveQuery } from 'dexie-react-hooks';
import { db, DEFAULT_SETTINGS } from './db';
import type { UserSettings, Profile, ProfileRow } from './types';

/** Live user settings. Falls back to defaults while the row loads / before seed. */
export function useSettings(): UserSettings {
  const row = useLiveQuery(() => db.settings.get('user'));
  return row ?? DEFAULT_SETTINGS;
}

/** Merge-patch the singleton settings row. */
export async function updateSettings(
  patch: Partial<UserSettings>,
): Promise<void> {
  const current = await db.settings.get('user');
  const base = current ?? { key: 'user' as const, ...DEFAULT_SETTINGS };
  await db.settings.put({ ...base, ...patch, key: 'user' });
}

/** Live user profile. `undefined` until the user captures one (no defaults — an
 *  empty profile must read as absent, not as fabricated stats). */
export function useProfile(): ProfileRow | undefined {
  return useLiveQuery(() => db.profile.get('user'));
}

/** Merge-patch the singleton profile row, stamping updatedAt. Clock lives in the
 *  db layer (never the engine). */
export async function updateProfile(patch: Partial<Profile>): Promise<void> {
  const now = new Date().toISOString();
  const current = await db.profile.get('user');
  const base: ProfileRow = current ?? { key: 'user', updatedAt: now };
  await db.profile.put({ ...base, ...patch, key: 'user', updatedAt: now });
}

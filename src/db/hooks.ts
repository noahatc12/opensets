import { useLiveQuery } from 'dexie-react-hooks';
import { db, DEFAULT_SETTINGS } from './db';
import type { UserSettings } from './types';

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

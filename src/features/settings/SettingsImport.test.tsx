// @vitest-environment jsdom
/** Import replaces every table, so it must wait for an explicit confirm and snapshot
 *  the current data first (audit 2026-09-24: picking a file replaced everything at once). */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  render,
  screen,
  waitFor,
  cleanup,
  fireEvent,
} from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { db, DEFAULT_SETTINGS } from '../../db/db';
import { buildEnvelope } from '../../db/exportImport';
import { createProgram } from '../../db/repositories';
import { SettingsScreen } from './SettingsScreen';

const NOW = '2026-09-24T17:00:00.000Z';

/** jsdom 25's File has no .text() (every current browser does), so hand the input a
 *  file-shaped object that implements it. */
const fileOf = (json: string, name: string) =>
  ({
    name,
    type: 'application/json',
    text: async () => json,
  }) as unknown as File;

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
  await db.settings.put({ key: 'user', ...DEFAULT_SETTINGS });
});
afterEach(cleanup);

describe('Settings import', () => {
  it('asks before replacing, and only replaces on confirm', async () => {
    await createProgram('Keep me', NOW);
    const incoming = await buildEnvelope(NOW);
    incoming.data.programs = [];
    const file = fileOf(JSON.stringify(incoming), 'other-backup.json');

    const { container } = render(
      <MemoryRouter>
        <SettingsScreen />
      </MemoryRouter>,
    );
    const input = container.querySelector('input[type="file"]')!;
    fireEvent.change(input, { target: { files: [file] } });

    await screen.findByRole('alertdialog');
    await new Promise((r) => setTimeout(r, 50));
    expect(await db.programs.count()).toBe(1); // nothing replaced yet

    fireEvent.click(screen.getByRole('button', { name: 'Replace data' }));
    await waitFor(async () => expect(await db.programs.count()).toBe(0));
    expect(await db.backups.count()).toBe(1);
  });

  it('cancel leaves the data alone', async () => {
    await createProgram('Keep me', NOW);
    const file = fileOf(JSON.stringify(await buildEnvelope(NOW)), 'b.json');
    const { container } = render(
      <MemoryRouter>
        <SettingsScreen />
      </MemoryRouter>,
    );
    fireEvent.change(container.querySelector('input[type="file"]')!, {
      target: { files: [file] },
    });
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(await db.programs.count()).toBe(1);
    expect(await db.backups.count()).toBe(0);
  });
});

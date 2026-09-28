// @vitest-environment jsdom
/** Dumbbell and machine increments are editable on the Plates screen (Noah, 2026-09-24:
 *  defaults dumbbells 5 lb, 2.5 lb under 20 lb, stacks 5 lb). */
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
import { PlatesScreen } from './PlatesScreen';

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
  await db.settings.put({ key: 'user', ...DEFAULT_SETTINGS });
});
afterEach(cleanup);

describe('Plates screen increments', () => {
  it('shows the defaults and saves a new stack step', async () => {
    render(
      <MemoryRouter>
        <PlatesScreen />
      </MemoryRouter>,
    );
    const dumbbell5 = await screen.findByRole('button', {
      name: 'Dumbbell jumps: 5',
    });
    expect(dumbbell5.getAttribute('aria-pressed')).toBe('true');
    expect(
      screen
        .getByRole('button', { name: 'Under 20 lb: 2.5' })
        .getAttribute('aria-pressed'),
    ).toBe('true');

    fireEvent.click(
      screen.getByRole('button', { name: 'Cable and machine stack: 10' }),
    );
    await waitFor(async () =>
      expect((await db.settings.get('user'))!.stackStepLb).toBe(10),
    );
  });

  it('in kg, the option nearest the stored (lb) step is highlighted, never none', async () => {
    await db.settings.put({ key: 'user', ...DEFAULT_SETTINGS, units: 'kg' });
    render(
      <MemoryRouter>
        <PlatesScreen />
      </MemoryRouter>,
    );
    const pressed = (name: string) =>
      screen.getByRole('button', { name }).getAttribute('aria-pressed');
    // Wait for the kg-only label: the lb options also contain a 2.5.
    await screen.findByRole('button', { name: 'Under 9 kg: 1' });
    expect(pressed('Dumbbell jumps: 2.5')).toBe('true'); // 5 lb = 2.27 kg
    expect(pressed('Under 9 kg: 1')).toBe('true'); // 2.5 lb = 1.13 kg
    expect(pressed('Cable and machine stack: 2.5')).toBe('true');
  });
});

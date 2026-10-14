// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { db, DEFAULT_SETTINGS } from '../../db/db';
import { ProteinCard } from './ProteinCard';
import { TodayScreen } from './TodayScreen';

// Review 2026-10-14: the protein card leads with one number to act on, and the
// hero buttons draw their arrow instead of typing one.

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
  await db.settings.put({ key: 'user', ...DEFAULT_SETTINGS });
});
afterEach(() => cleanup());

describe('Protein card', () => {
  it('leads with the low end and keeps the range', async () => {
    await db.measurements.put({
      id: 'bw',
      date: '2026-10-14T10:00:00.000Z',
      type: 'bodyweight',
      valueLb: 175,
    });
    render(
      <MemoryRouter>
        <ProteinCard />
      </MemoryRouter>,
    );
    expect(await screen.findByText('At least 125 g a day')).toBeTruthy();
    expect(screen.getByText(/Up to 175 g is fine\./)).toBeTruthy();
  });
});

describe('Today, no plan yet', () => {
  it('draws the Build my plan arrow as an icon, not a typed character', async () => {
    render(
      <MemoryRouter>
        <TodayScreen />
      </MemoryRouter>,
    );
    const btn = await screen.findByRole('button', { name: 'Build my plan' });
    expect(btn.textContent).not.toContain('\u2192');
    expect(btn.querySelector('svg')).not.toBeNull();
  });
});

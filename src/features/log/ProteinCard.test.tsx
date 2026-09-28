// @vitest-environment jsdom
/** The protein target is display-only (standing rule: no macros, no meal logging) and
 *  framed as an estimate, not medical advice. */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { db, DEFAULT_SETTINGS } from '../../db/db';
import { ProteinCard } from './ProteinCard';

const NOW = '2026-09-24T17:00:00.000Z';

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
  await db.settings.put({ key: 'user', ...DEFAULT_SETTINGS });
});
afterEach(cleanup);

const renderCard = () =>
  render(
    <MemoryRouter>
      <ProteinCard />
    </MemoryRouter>,
  );

describe('ProteinCard', () => {
  it('shows a daily range from the latest bodyweight, framed as an estimate', async () => {
    await db.measurements.add({
      id: 'bw',
      type: 'bodyweight',
      date: NOW,
      valueLb: 180,
    });
    renderCard();
    expect(await screen.findByText(/130 to 180 g/)).toBeTruthy();
    expect(screen.getByText(/estimate/i)).toBeTruthy();
    expect(screen.getByText(/not medical advice/i)).toBeTruthy();
  });

  it('says so when it used a height-based weight', async () => {
    await db.measurements.add({
      id: 'bw',
      type: 'bodyweight',
      date: NOW,
      valueLb: 300,
    });
    await db.profile.put({ key: 'user', heightIn: 70, updatedAt: NOW });
    renderCard();
    expect(await screen.findByText(/125 to 175 g/)).toBeTruthy();
    expect(screen.getByText(/height/i)).toBeTruthy();
  });

  it('adds the check-with-a-professional line under 18', async () => {
    await db.measurements.add({
      id: 'bw',
      type: 'bodyweight',
      date: NOW,
      valueLb: 150,
    });
    await db.profile.put({
      key: 'user',
      birthDate: '2011-01-01',
      updatedAt: NOW,
    });
    renderCard();
    expect(
      await screen.findByText(/doctor or registered dietitian/i),
    ).toBeTruthy();
  });

  it('invites a bodyweight entry when there is none', async () => {
    renderCard();
    expect(await screen.findByText(/add your bodyweight/i)).toBeTruthy();
  });
});

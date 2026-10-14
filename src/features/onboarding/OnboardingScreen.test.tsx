// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { db, DEFAULT_SETTINGS } from '../../db/db';
import { OnboardingScreen } from './OnboardingScreen';

// Review 2026-10-14: step 4 read "0 ft, 0 in, 0 lb" as if filled in, and a screen
// reader heard the first sex choice as "Sex Sex" (the field's <label> lent it its text).

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
  await db.settings.put({ key: 'user', ...DEFAULT_SETTINGS });
});
afterEach(() => cleanup());

async function toStepFour() {
  render(
    <MemoryRouter>
      <OnboardingScreen />
    </MemoryRouter>,
  );
  const user = userEvent.setup();
  for (let i = 0; i < 3; i++)
    await user.click(await screen.findByRole('button', { name: 'Continue' }));
  await waitFor(() => screen.getByRole('heading', { name: 'A few numbers' }));
  return user;
}

describe('Onboarding step 4, A few numbers', () => {
  it('names the sex choices by their own words only', async () => {
    await toStepFour();
    expect(screen.getByRole('radio', { name: 'male' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'female' })).toBeTruthy();
  });

  it('leaves empty number fields blank, not 0', async () => {
    await toStepFour();
    for (const name of ['Height feet', 'Height inches', 'Bodyweight']) {
      const input = screen.getByRole('spinbutton', {
        name,
      }) as HTMLInputElement;
      expect(input.value).toBe('');
      expect(input.placeholder).toBe('');
    }
  });
});

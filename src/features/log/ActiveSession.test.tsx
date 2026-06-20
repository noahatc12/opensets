// @vitest-environment jsdom
/**
 * Interaction tests pinning the core Readout logger flow BEFORE the useLogger()
 * extraction, so "behavior-preserving" is verified, not asserted. They drive the
 * real UI but assert against Dexie (not display formatting), so they survive the
 * refactor. Engine coverage gate doesn't reach here (features/**), but these are
 * the safety net for the logger UI the gate never covered.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { db, DEFAULT_SETTINGS } from '../../db/db';
import {
  createProgram,
  setActiveProgram,
  createTemplate,
  saveTemplate,
  makeSlot,
  seedExerciseState,
  startSessionFromTemplate,
  getExerciseState,
  getSessionSets,
} from '../../db/repositories';
import { useSessionStore } from '../../state/session';
import { ActiveSession } from './ActiveSession';
import { TodayScreen } from './TodayScreen';
import type { WorkoutSession } from '../../db/types';
import type { ProgressionRule } from '../../engine/types';

const now = '2026-06-20T10:00:00.000Z';
const LINEAR: ProgressionRule = {
  kind: 'linear',
  incrementKg: 2.5,
  failsBeforeDeload: 3,
  deloadPct: 0.1,
};

async function seedActiveSession(): Promise<{ session: WorkoutSession; programId: string }> {
  await db.settings.put({ key: 'user', ...DEFAULT_SETTINGS });
  const program = await createProgram('Test Program', now);
  await setActiveProgram(program.id);
  const tpl = await createTemplate(program.id, 'Day 1', 0);
  const slot = makeSlot('bench', 0, LINEAR, { sets: 3, repTarget: 5 }, {
    warmupSec: 60,
    workSec: 120,
  });
  tpl.slots = [slot];
  await saveTemplate(tpl);
  await seedExerciseState(program.id, slot, 60, now);
  const session = await startSessionFromTemplate(tpl, now);
  useSessionStore.getState().beginSession(session.id);
  return { session, programId: program.id };
}

function renderLogger() {
  return render(
    <MemoryRouter>
      <ActiveSession />
    </MemoryRouter>,
  );
}

/** Wait for the prescription to load and the active set's Log CTA to render. */
async function logButton() {
  return waitFor(() => screen.getByRole('button', { name: /Log Set/ }));
}

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
  useSessionStore.setState({ activeSessionId: null, currentExercise: 0, rest: null });
});
afterEach(() => {
  cleanup();
  useSessionStore.getState().endSession();
});

describe('Readout logger — core flow (pinned pre-extraction)', () => {
  it('logs a prescribed set to the session', async () => {
    const { session } = await seedActiveSession();
    const user = userEvent.setup();
    renderLogger();
    await user.click(await logButton());
    await waitFor(async () => {
      const sets = await getSessionSets(session.id);
      expect(sets).toHaveLength(1);
      expect(sets[0]!.exerciseId).toBe('bench');
      expect(sets[0]!.completed).toBe(true);
    });
  });

  it('persists edited weight and reps when logging', async () => {
    const { session, programId } = await seedActiveSession();
    const target = (await getExerciseState(programId, 'bench'))!.pending!.sets[0]!;
    const user = userEvent.setup();
    renderLogger();
    await logButton();
    await user.click(screen.getByRole('button', { name: 'increase weight' }));
    await user.click(screen.getByRole('button', { name: 'increase weight' }));
    await user.click(screen.getByRole('button', { name: 'increase reps' }));
    await user.click(await logButton());
    await waitFor(async () => {
      const sets = await getSessionSets(session.id);
      expect(sets).toHaveLength(1);
      expect(sets[0]!.weightKg).toBeGreaterThan(target.targetWeightKg);
      expect(sets[0]!.reps).toBe(target.targetReps + 1);
    });
  });

  it('records a selected RPE', async () => {
    const { session } = await seedActiveSession();
    const user = userEvent.setup();
    renderLogger();
    await logButton();
    await user.click(screen.getByRole('button', { name: '8' }));
    await user.click(await logButton());
    await waitFor(async () => {
      const sets = await getSessionSets(session.id);
      expect(sets[0]!.rpe).toBe(8);
    });
  });

  it('undo removes the just-logged set', async () => {
    const { session } = await seedActiveSession();
    const user = userEvent.setup();
    renderLogger();
    await user.click(await logButton());
    const undo = await screen.findByRole('button', { name: 'Undo' });
    await user.click(undo);
    await waitFor(async () => {
      expect(await getSessionSets(session.id)).toHaveLength(0);
    });
  });

  it('rest timer auto-starts on log', async () => {
    await seedActiveSession();
    const user = userEvent.setup();
    renderLogger();
    await user.click(await logButton());
    expect(await screen.findByText('Rest')).toBeTruthy();
  });

  it('finish completes the session', async () => {
    const { session } = await seedActiveSession();
    const user = userEvent.setup();
    renderLogger();
    await logButton();
    await user.click(screen.getByRole('button', { name: 'Finish' }));
    await waitFor(async () => {
      const s = await db.sessions.get(session.id);
      expect(s!.status).toBe('completed');
    });
  });
});

describe('Session resume on reload', () => {
  it('TodayScreen resumes an in-flight session', async () => {
    const { session } = await seedActiveSession();
    // Simulate a fresh load: the ephemeral store is empty, the session is in Dexie.
    useSessionStore.setState({ activeSessionId: null, currentExercise: 0, rest: null });
    render(
      <MemoryRouter>
        <TodayScreen />
      </MemoryRouter>,
    );
    // The logger (not the Today hub) renders once the active session is picked up.
    await waitFor(() => {
      expect(useSessionStore.getState().activeSessionId).toBe(session.id);
    });
  });
});

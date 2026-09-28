// @vitest-environment jsdom
/**
 * Interaction tests pinning the core Readout logger flow BEFORE the useLogger()
 * extraction, so "behavior-preserving" is verified, not asserted. They drive the
 * real UI but assert against Dexie (not display formatting), so they survive the
 * refactor. Engine coverage gate doesn't reach here (features/**), but these are
 * the safety net for the logger UI the gate never covered.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  render,
  screen,
  waitFor,
  cleanup,
  fireEvent,
} from '@testing-library/react';
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
  incrementLb: 2.5,
  failsBeforeDeload: 3,
  deloadPct: 0.1,
};

async function seedActiveSession(
  exerciseIds: string[] = ['bench'],
): Promise<{ session: WorkoutSession; programId: string }> {
  await db.settings.put({ key: 'user', ...DEFAULT_SETTINGS });
  const program = await createProgram('Test Program', now);
  await setActiveProgram(program.id);
  const tpl = await createTemplate(program.id, 'Day 1', 0);
  tpl.slots = exerciseIds.map((id, i) =>
    makeSlot(
      id,
      i,
      LINEAR,
      { sets: 3, repTarget: 5 },
      { warmupSec: 60, workSec: 120 },
    ),
  );
  await saveTemplate(tpl);
  for (const slot of tpl.slots)
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
  return waitFor(() => screen.getByRole('button', { name: /Log set/i }));
}

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
  useSessionStore.setState({
    activeSessionId: null,
    leftSessionId: null,
    currentExercise: 0,
    rest: null,
  });
});
afterEach(() => {
  cleanup();
  useSessionStore.getState().endSession();
});

describe('Logger core flow (pinned pre-extraction)', () => {
  it("logs the program's rest-pause set as restPause, not as a missed working set", async () => {
    // 09-28: in an intensification week periodize() appends a rest-pause set; the logger
    // saved it as 'working', and double progression read it as a miss every such week.
    await db.settings.put({ key: 'user', ...DEFAULT_SETTINGS });
    const program = await createProgram('Block', now);
    await db.programs.update(program.id, {
      mesocycle: { phase: 'intensification', weekIndex: 2, totalWeeks: 4 },
    });
    await setActiveProgram(program.id);
    const tpl = await createTemplate(program.id, 'Day 1', 0);
    tpl.slots = [
      makeSlot(
        'bench',
        0,
        LINEAR,
        { sets: 2, repTarget: 5 },
        { warmupSec: 60, workSec: 120 },
      ),
    ];
    await saveTemplate(tpl);
    await seedExerciseState(program.id, tpl.slots[0]!, 60, now);
    const pending = (await getExerciseState(program.id, 'bench'))!.pending!;
    expect(pending.sets.map((s) => s.type)).toEqual([
      'working',
      'working',
      'restPause',
    ]);
    const session = await startSessionFromTemplate(tpl, now);
    useSessionStore.getState().beginSession(session.id);
    const user = userEvent.setup();
    renderLogger();
    for (let i = 0; i < 3; i++) {
      await user.click(await logButton());
      await waitFor(async () =>
        expect(await getSessionSets(session.id)).toHaveLength(i + 1),
      );
      const keep = screen.queryByRole('button', { name: 'Keep going' });
      if (keep) await user.click(keep);
      const skip = screen.queryByRole('button', { name: /Skip rest/i });
      if (skip) await user.click(skip);
    }
    const types = (await getSessionSets(session.id))
      .sort((a, b) => a.order - b.order)
      .map((s) => s.type);
    expect(types).toEqual(['working', 'working', 'restPause']);
  });

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
    const target = (await getExerciseState(programId, 'bench'))!.pending!
      .sets[0]!;
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
      expect(sets[0]!.weightLb).toBeGreaterThan(target.targetWeightLb);
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

  it('a seeded weight is labelled as a suggested start with the calibration instruction', async () => {
    await seedActiveSession();
    renderLogger();
    await logButton();
    expect(await screen.findByText(/Suggested start/)).toBeTruthy();
    expect(screen.getByText(/2 to 3 more/)).toBeTruthy();
  });

  it('the weight stepper follows the dumbbell rack: 15 -> 17.5 -> 20 -> 25, shown exactly', async () => {
    await db.settings.put({ key: 'user', ...DEFAULT_SETTINGS });
    const program = await createProgram('DB', now);
    await setActiveProgram(program.id);
    const tpl = await createTemplate(program.id, 'Day 1', 0);
    tpl.slots = [
      makeSlot(
        'db_curl',
        0,
        {
          kind: 'double',
          repMin: 10,
          repMax: 14,
          incrementLb: 1.25,
          perSet: false,
        },
        { sets: 3, repRange: [10, 14] },
        { warmupSec: 45, workSec: 90 },
        { loadType: 'dumbbell' },
      ),
    ];
    await saveTemplate(tpl);
    await seedExerciseState(program.id, tpl.slots[0]!, 15, now);
    const session = await startSessionFromTemplate(tpl, now);
    useSessionStore.getState().beginSession(session.id);
    const user = userEvent.setup();
    renderLogger();
    await logButton();
    const up = screen.getByRole('button', { name: 'increase weight' });
    await user.click(up);
    expect(await screen.findByText('17.5')).toBeTruthy();
    await user.click(up);
    await user.click(up);
    expect(await screen.findByText('25')).toBeTruthy();
    expect(screen.getByText('Per hand')).toBeTruthy();
  });

  it('a pure bodyweight lift reads BW everywhere, not 0, and dumbbells say per hand', async () => {
    await db.settings.put({ key: 'user', ...DEFAULT_SETTINGS });
    const program = await createProgram('BW', now);
    await setActiveProgram(program.id);
    const tpl = await createTemplate(program.id, 'Day 1', 0);
    tpl.slots = [
      makeSlot(
        'pushup',
        0,
        { kind: 'repsOnly', repIncrement: 1 },
        { sets: 3, repTarget: 10 },
        { warmupSec: 45, workSec: 90 },
        { loadType: 'bodyweight' },
      ),
      makeSlot(
        'db_curl',
        1,
        {
          kind: 'double',
          repMin: 10,
          repMax: 14,
          incrementLb: 1.25,
          perSet: false,
        },
        { sets: 3, repRange: [10, 14] },
        { warmupSec: 45, workSec: 90 },
        { loadType: 'dumbbell' },
      ),
    ];
    await saveTemplate(tpl);
    await seedExerciseState(program.id, tpl.slots[0]!, 0, now);
    await seedExerciseState(program.id, tpl.slots[1]!, 15, now);
    const session = await startSessionFromTemplate(tpl, now);
    useSessionStore.getState().beginSession(session.id);
    const user = userEvent.setup();
    renderLogger();
    expect(
      await screen.findByRole('button', { name: /Log set 1 · BW × 10/i }),
    ).toBeTruthy();
    expect(screen.queryByText(/^0$/)).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Next exercise' }));
    expect(await screen.findByText('Per hand')).toBeTruthy();
  });

  it('a double tap on Log Set logs one set, not two', async () => {
    const { session } = await seedActiveSession();
    renderLogger();
    const btn = await logButton();
    fireEvent.click(btn);
    fireEvent.click(btn);
    await waitFor(async () => {
      expect((await getSessionSets(session.id)).length).toBeGreaterThan(0);
    });
    await new Promise((r) => setTimeout(r, 150));
    expect(await getSessionSets(session.id)).toHaveLength(1);
  });

  it('finish opens the summary, and Save workout completes the session', async () => {
    const { session } = await seedActiveSession();
    const user = userEvent.setup();
    renderLogger();
    await logButton();
    await user.click(screen.getByRole('button', { name: 'Finish' }));
    await user.click(
      await screen.findByRole('button', { name: 'Save workout' }),
    );
    await waitFor(async () => {
      const s = await db.sessions.get(session.id);
      expect(s!.status).toBe('completed');
    });
  });
});

describe('Summary: Discard', () => {
  it('removes the logged sets and closes the session without advancing progression', async () => {
    const { session, programId } = await seedActiveSession();
    const before = await getExerciseState(programId, 'bench');
    const user = userEvent.setup();
    renderLogger();
    await user.click(await logButton());
    await user.click(screen.getByRole('button', { name: 'Finish' }));
    await user.click(await screen.findByRole('button', { name: 'Discard' }));
    await user.click(
      await screen.findByRole('button', { name: 'Discard workout' }),
    );
    await waitFor(async () => {
      expect((await db.sessions.get(session.id))!.status).toBe('partial');
    });
    expect(await getSessionSets(session.id)).toHaveLength(0); // soft-deleted
    expect((await getExerciseState(programId, 'bench'))!.updatedAt).toBe(
      before!.updatedAt,
    ); // NOT advanced
    expect(await db.activeSession.get('current')).toBeFalsy();
  });
});

describe('Session resume on reload', () => {
  it('TodayScreen resumes an in-flight session', async () => {
    const { session } = await seedActiveSession();
    // Simulate a fresh load: the ephemeral store is empty, the session is in Dexie.
    useSessionStore.setState({
      activeSessionId: null,
      currentExercise: 0,
      rest: null,
    });
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

describe('Mid-workout Skip', () => {
  it('removes the current exercise from the session (template untouched)', async () => {
    const { session } = await seedActiveSession(['bench', 'squat']);
    const user = userEvent.setup();
    renderLogger();
    await logButton();
    await user.click(screen.getByRole('button', { name: 'Skip' }));
    await waitFor(async () => {
      const s = await db.sessions.get(session.id);
      expect(s!.executedSlots).toHaveLength(1);
      expect(s!.executedSlots![0]!.exerciseId).toBe('squat');
    });
    // The template (program day) is NOT mutated — still 2 slots.
    const tpl = (await db.templates.toArray())[0]!;
    expect(tpl.slots).toHaveLength(2);
  });
});

describe('Crash recovery snapshot', () => {
  it('saves and restores the current exercise + rest timer across a reload', async () => {
    const { session } = await seedActiveSession(['bench', 'squat']);
    const user = userEvent.setup();
    const view = renderLogger();
    await logButton();
    // Log → rest auto-starts; advance to the 2nd exercise → snapshot should capture both.
    await user.click(await logButton());
    await user.click(screen.getByRole('button', { name: 'Next exercise' }));
    await waitFor(async () => {
      const snap = await db.activeSession.get('current');
      expect(snap?.sessionId).toBe(session.id);
      const p = snap!.payload as { currentExercise: number; rest: unknown };
      expect(p.currentExercise).toBe(1);
      expect(p.rest).not.toBeNull();
    });
    // Simulate a reload: unmount, clear ephemeral store, resume the session fresh.
    view.unmount();
    useSessionStore.setState({
      activeSessionId: null,
      currentExercise: 0,
      rest: null,
    });
    useSessionStore.getState().beginSession(session.id);
    renderLogger();
    await waitFor(() => {
      expect(useSessionStore.getState().currentExercise).toBe(1);
      expect(useSessionStore.getState().rest).not.toBeNull();
    });
  });
});

describe('Back is a non-destructive leave (#2)', () => {
  const renderToday = () =>
    render(
      <MemoryRouter>
        <TodayScreen />
      </MemoryRouter>,
    );

  it('Back keeps the session active + resumable: no completion, no progression advance, snapshot kept', async () => {
    const { session, programId } = await seedActiveSession();
    const user = userEvent.setup();
    renderToday(); // activeSessionId set → renders the active session
    await user.click(await logButton()); // log one set
    // Wait for the debounced recovery snapshot so "snapshot kept" is a real assertion.
    await waitFor(async () =>
      expect(await db.activeSession.get('current')).toBeTruthy(),
    );
    const before = await getExerciseState(programId, 'bench');

    await user.click(
      await screen.findByRole('button', { name: /Leave workout/ }),
    );

    await waitFor(async () => {
      expect((await db.sessions.get(session.id))!.status).toBe('active'); // NOT completed
    });
    expect(await db.activeSession.get('current')).toBeTruthy(); // snapshot NOT cleared
    expect((await getExerciseState(programId, 'bench'))!.updatedAt).toBe(
      before!.updatedAt,
    ); // NOT advanced
    expect(await getSessionSets(session.id)).toHaveLength(1); // logged work intact
    expect(
      await screen.findByRole('button', { name: /Resume workout/ }),
    ).toBeTruthy();
  });

  it('Resume from the hub returns to the live in-progress session with the logged set', async () => {
    const { session } = await seedActiveSession();
    const user = userEvent.setup();
    renderToday();
    await user.click(await logButton());
    await user.click(
      await screen.findByRole('button', { name: /Leave workout/ }),
    );
    await user.click(
      await screen.findByRole('button', { name: /Resume workout/ }),
    );
    await waitFor(() =>
      expect(useSessionStore.getState().activeSessionId).toBe(session.id),
    );
    expect(await getSessionSets(session.id)).toHaveLength(1);
    await waitFor(() => screen.getByRole('button', { name: /Log set/i }));
  });

  it('Finish (not Back) still finalizes: completes, advances progression, clears the snapshot', async () => {
    const { session, programId } = await seedActiveSession();
    const before = await getExerciseState(programId, 'bench');
    const user = userEvent.setup();
    renderLogger();
    await user.click(await logButton());
    await waitFor(async () =>
      expect(await db.activeSession.get('current')).toBeTruthy(),
    );
    await user.click(screen.getByRole('button', { name: 'Finish' }));
    await user.click(
      await screen.findByRole('button', { name: 'Save workout' }),
    );
    await waitFor(async () => {
      expect((await db.sessions.get(session.id))!.status).toBe('completed');
    });
    expect(await db.activeSession.get('current')).toBeFalsy(); // snapshot cleared
    expect((await getExerciseState(programId, 'bench'))!.updatedAt).not.toBe(
      before!.updatedAt,
    ); // advanced
  });
});

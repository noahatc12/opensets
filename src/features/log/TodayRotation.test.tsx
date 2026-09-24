// @vitest-environment jsdom
/** Today must offer the next day in the rotation (audit 2026-09-24: it always started
 *  the first template, so Day 2+ of a multi-day program could never be trained). */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { db, DEFAULT_SETTINGS } from '../../db/db';
import {
  createProgram,
  setActiveProgram,
  createTemplate,
  saveTemplate,
  makeSlot,
  startSessionFromTemplate,
  completeSessionAndAdvance,
} from '../../db/repositories';
import { useSessionStore } from '../../state/session';
import { TodayScreen } from './TodayScreen';

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
  await db.settings.put({ key: 'user', ...DEFAULT_SETTINGS });
  useSessionStore.setState({
    activeSessionId: null,
    leftSessionId: null,
    currentExercise: 0,
    rest: null,
  });
});
afterEach(cleanup);

describe('Today rotation', () => {
  it('after Day 1 is done, Today schedules Day 2', async () => {
    const p = await createProgram('Upper Lower', '2026-09-20T10:00:00.000Z');
    await setActiveProgram(p.id);
    const tpls = [];
    for (const [i, name] of ['Upper', 'Lower'].entries()) {
      const t = await createTemplate(p.id, name, i);
      t.slots = [
        makeSlot(
          `ex${i}`,
          0,
          { kind: 'manual' },
          { sets: 3, repTarget: 8 },
          { warmupSec: 60, workSec: 90 },
        ),
      ];
      await saveTemplate(t);
      tpls.push(t);
    }
    const s = await startSessionFromTemplate(
      tpls[0]!,
      '2026-09-20T10:00:00.000Z',
    );
    await completeSessionAndAdvance(s.id, '2026-09-20T11:00:00.000Z');

    render(
      <MemoryRouter>
        <TodayScreen />
      </MemoryRouter>,
    );
    expect(await screen.findByText(/Scheduled · Lower/)).toBeTruthy();
  });
});

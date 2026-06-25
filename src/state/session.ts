/**
 * Ephemeral active-session UI state (spec §9: Zustand for running timer / active
 * set index — NOT app data, which lives in Dexie). The rest timer stores an
 * absolute `endsAt` epoch so it survives background/lock and is recomputed from
 * the wall clock on each tick (never trust a background JS timer on iOS).
 */
import { create } from 'zustand';

export interface RestTimer {
  endsAt: number; // epoch ms
  durationSec: number;
}

interface SessionUIState {
  activeSessionId: string | null;
  /** A session the user deliberately LEFT (via Back) this app-session. It stays
   *  active + resumable in Dexie; this flag only suppresses TodayScreen's
   *  auto-resume for it, so leaving lands on the hub instead of bouncing back in.
   *  Null on a cold reopen (in-memory), so cold-reopen auto-resume is unaffected. */
  leftSessionId: string | null;
  currentExercise: number;
  rest: RestTimer | null;
  beginSession: (sessionId: string) => void;
  /** Leave the active session WITHOUT finalizing it (no completion, no progression
   *  advance, snapshot kept). Back uses this; Finish uses completeSessionAndAdvance. */
  leaveSession: () => void;
  endSession: () => void;
  setCurrentExercise: (i: number) => void;
  startRest: (seconds: number) => void;
  adjustRest: (deltaSec: number) => void;
  stopRest: () => void;
  /** Set the rest timer directly (used to restore a crash-recovery snapshot). */
  setRest: (rest: RestTimer | null) => void;
  /** Restore ephemeral UI (current exercise + rest) from a recovery snapshot. */
  restoreUI: (currentExercise: number, rest: RestTimer | null) => void;
}

export const useSessionStore = create<SessionUIState>((set) => ({
  activeSessionId: null,
  leftSessionId: null,
  currentExercise: 0,
  rest: null,
  beginSession: (sessionId) =>
    set({ activeSessionId: sessionId, leftSessionId: null, currentExercise: 0, rest: null }),
  leaveSession: () =>
    set((s) => ({
      leftSessionId: s.activeSessionId,
      activeSessionId: null,
      currentExercise: 0,
      rest: null,
    })),
  endSession: () =>
    set({ activeSessionId: null, leftSessionId: null, currentExercise: 0, rest: null }),
  setCurrentExercise: (i) => set({ currentExercise: i }),
  startRest: (seconds) =>
    set({
      rest: { endsAt: Date.now() + seconds * 1000, durationSec: seconds },
    }),
  adjustRest: (deltaSec) =>
    set((s) =>
      s.rest
        ? {
            rest: {
              ...s.rest,
              endsAt: Math.max(Date.now(), s.rest.endsAt + deltaSec * 1000),
            },
          }
        : {},
    ),
  stopRest: () => set({ rest: null }),
  setRest: (rest) => set({ rest }),
  restoreUI: (currentExercise, rest) => set({ currentExercise, rest }),
}));

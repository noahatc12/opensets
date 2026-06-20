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
  currentExercise: number;
  rest: RestTimer | null;
  beginSession: (sessionId: string) => void;
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
  currentExercise: 0,
  rest: null,
  beginSession: (sessionId) =>
    set({ activeSessionId: sessionId, currentExercise: 0, rest: null }),
  endSession: () =>
    set({ activeSessionId: null, currentExercise: 0, rest: null }),
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

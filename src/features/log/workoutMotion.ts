import { useSessionStore } from '../../state/session';
import { withTransition } from '../../ui/nav';

/* The workout cover's three moves (docs/redesign/NAV.md, rule 5). It rises over the
   screen that started it and lowers to reveal that same screen, so none of these
   navigate: the screen underneath never left. */

/** Raise the cover for a session (start or resume). */
export function openWorkout(sessionId: string): void {
  withTransition('up', () =>
    useSessionStore.getState().beginSession(sessionId),
  );
}

/** Lower the cover and keep the session resumable (the down arrow). */
export function tuckWorkout(): void {
  withTransition('down', () => useSessionStore.getState().leaveSession());
}

/** Lower the cover after the session was saved or discarded. */
export function closeWorkout(): void {
  withTransition('down', () => useSessionStore.getState().endSession());
}

import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useSessionStore } from '../../state/session';
import {
  getSession,
  prescriptionForSlot,
  lastWorkingSetsForExercise,
  getSessionSets,
} from '../../db/repositories';
import type { LoggedSet, WorkoutSession } from '../../db/types';
import type { Prescription, SetResult } from '../../engine/types';

const nowIso = () => new Date().toISOString();

export interface ActiveWorkout {
  session: WorkoutSession | null;
  prescriptions: Record<string, Prescription>;
  lastByExercise: Record<string, SetResult[]>;
  logged: LoggedSet[];
}

/** Loads everything the active-session UI needs: the session + its frozen slots,
 *  each slot's pending prescription, the previous-session sets, and (live) the
 *  sets logged so far this session. */
export function useActiveWorkout(): ActiveWorkout {
  const activeSessionId = useSessionStore((s) => s.activeSessionId);
  const [session, setSession] = useState<WorkoutSession | null>(null);
  const [prescriptions, setPrescriptions] = useState<
    Record<string, Prescription>
  >({});
  const [lastByExercise, setLastByExercise] = useState<
    Record<string, SetResult[]>
  >({});

  // Loading session data from storage is a valid effect (synchronizing React with
  // an external system). The synchronous reset on a null id is intentional.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    let live = true;
    if (!activeSessionId) {
      setSession(null);
      setPrescriptions({});
      setLastByExercise({});
      return;
    }
    void (async () => {
      const s = await getSession(activeSessionId);
      if (!live) return;
      setSession(s ?? null);
      if (!s) return;
      const pres: Record<string, Prescription> = {};
      const last: Record<string, SetResult[]> = {};
      for (const slot of s.executedSlots ?? []) {
        pres[slot.exerciseId] = await prescriptionForSlot(
          s.programId!,
          slot,
          nowIso(),
        );
        last[slot.exerciseId] = await lastWorkingSetsForExercise(
          slot.exerciseId,
          s.id,
        );
      }
      if (!live) return;
      setPrescriptions(pres);
      setLastByExercise(last);
    })();
    return () => {
      live = false;
    };
  }, [activeSessionId]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const logged =
    useLiveQuery(
      () =>
        activeSessionId
          ? getSessionSets(activeSessionId)
          : Promise.resolve([] as LoggedSet[]),
      [activeSessionId],
    ) ?? [];

  return { session, prescriptions, lastByExercise, logged };
}

import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { e1rm, isE1rmEligible } from '../../engine';

export interface LiftStats {
  /** Best estimated one-rep max per exercise, from every eligible logged set. */
  best: Map<string, number>;
  /** Number of sessions each exercise appears in. */
  sessions: Map<string, number>;
  /** The heaviest set of the most recent session for each exercise. */
  lastTop: Map<string, { weightLb: number; reps: number; date: string }>;
}

/** Per-exercise lift stats from the whole log. Live. */
export function useBestE1rm(): LiftStats {
  const sets = useLiveQuery(() => db.sets.toArray());
  return useMemo(() => {
    const best = new Map<string, number>();
    const sessionSets = new Map<string, Set<string>>();
    const lastTop = new Map<
      string,
      { weightLb: number; reps: number; date: string }
    >();
    for (const s of sets ?? []) {
      if (s.deletedAt || !s.completed) continue;
      const ids = sessionSets.get(s.exerciseId) ?? new Set<string>();
      ids.add(s.sessionId);
      sessionSets.set(s.exerciseId, ids);
      if (isE1rmEligible(s)) {
        const v = e1rm(s.weightLb, s.reps);
        if (v > (best.get(s.exerciseId) ?? 0)) best.set(s.exerciseId, v);
      }
      const lt = lastTop.get(s.exerciseId);
      if (
        !lt ||
        s.date > lt.date ||
        (s.date === lt.date && s.weightLb * s.reps > lt.weightLb * lt.reps)
      ) {
        lastTop.set(s.exerciseId, {
          weightLb: s.weightLb,
          reps: s.reps,
          date: s.date,
        });
      }
    }
    const sessions = new Map<string, number>();
    for (const [id, ids] of sessionSets) sessions.set(id, ids.size);
    return { best, sessions, lastTop };
  }, [sets]);
}

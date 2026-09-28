import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { useSessionStore } from '../../state/session';
import { openWorkout } from './workoutMotion';
import type { WorkoutSession } from '../../db/types';
import { ActiveSession } from './ActiveSession';

/* The workout is a cover over the screen that started it (docs/redesign/NAV.md, rule 5).
   Starting or resuming raises it over whatever is showing; the down arrow, Save and
   Discard lower it again, and that screen is exactly as it was because it never left.
   A workout tucked away shows as a bar on every tab and as the card on Today. */

export function WorkoutCover({
  resumable,
}: {
  resumable: WorkoutSession | undefined;
}) {
  const activeSessionId = useSessionStore((s) => s.activeSessionId);
  const leftSessionId = useSessionStore((s) => s.leftSessionId);
  const beginSession = useSessionStore((s) => s.beginSession);

  // A workout in progress on a cold reopen comes straight back (rule 11); one the lifter
  // just tucked away does not bounce back in.
  useEffect(() => {
    if (activeSessionId) return;
    if (resumable && resumable.id !== leftSessionId) beginSession(resumable.id);
  }, [activeSessionId, resumable, leftSessionId, beginSession]);

  if (!activeSessionId) return null;
  return (
    <div className="os-cover">
      <ActiveSession />
    </div>
  );
}

/** "Workout in progress" above the tab island, on every tab but Today. */
export function WorkoutBar({ session }: { session: WorkoutSession }) {
  const name = useLiveQuery(
    async () =>
      session.templateId
        ? (await db.templates.get(session.templateId))?.name
        : undefined,
    [session.templateId],
  );
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const mins = Math.max(
    0,
    Math.floor((now - Date.parse(session.startedAt)) / 60000),
  );
  return (
    <button
      type="button"
      onClick={() => openWorkout(session.id)}
      className="os-workout-bar os-press"
      aria-label={`Resume ${name ?? 'workout'}, in progress`}
    >
      <span
        className="os-pulse size-2.5 flex-none rounded-full"
        style={{ background: 'var(--pos)' }}
        aria-hidden
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14px] font-extrabold">
          {name ?? 'Workout'} in progress
        </span>
        <span className="os-t block text-[12px]">{mins} min</span>
      </span>
      <span
        className="os-chip os-chip--on"
        style={{ height: 36, borderRadius: 12 }}
      >
        Resume
      </span>
    </button>
  );
}

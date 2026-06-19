import { useEffect, useState } from 'react';
import { useSessionStore } from '../../state/session';

/**
 * Rest timer (spec §5 P1). Recomputed from the wall clock every tick so it stays
 * correct across screen-lock/background (a backgrounded JS interval can't be
 * trusted on iOS). ±15 s controls + skip. Audio/vibration cue is deferred polish.
 */
export function RestTimer() {
  const rest = useSessionStore((s) => s.rest);
  const adjustRest = useSessionStore((s) => s.adjustRest);
  const stopRest = useSessionStore((s) => s.stopRest);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!rest) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [rest]);

  if (!rest) return null;
  const remainMs = Math.max(0, rest.endsAt - now);
  const remain = Math.ceil(remainMs / 1000);
  const mm = Math.floor(remain / 60);
  const ss = remain % 60;
  const done = remainMs <= 0;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[max(4.5rem,calc(env(safe-area-inset-bottom)+4.5rem))] z-40 mx-auto flex max-w-md justify-center px-4">
      <div className="pointer-events-auto flex items-center gap-2 rounded-xl border border-border-strong bg-elevated px-2 py-1.5 shadow-lg">
        <button
          type="button"
          onClick={() => adjustRest(-15)}
          className="min-h-9 rounded-lg px-2.5 text-[13px] text-muted hover:text-text"
        >
          −15s
        </button>
        <span
          className={`tnum w-16 text-center text-lg font-bold ${done ? 'text-accent' : 'text-text'}`}
        >
          {done ? 'Rest!' : `${mm}:${String(ss).padStart(2, '0')}`}
        </span>
        <button
          type="button"
          onClick={() => adjustRest(15)}
          className="min-h-9 rounded-lg px-2.5 text-[13px] text-muted hover:text-text"
        >
          +15s
        </button>
        <button
          type="button"
          onClick={stopRest}
          className="min-h-9 rounded-lg bg-surface-2 px-3 text-[13px] font-medium text-text"
        >
          Skip
        </button>
      </div>
    </div>
  );
}

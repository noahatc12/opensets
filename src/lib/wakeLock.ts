import { useEffect } from 'react';

/**
 * Keep the screen awake while `active` (the workout is open). Quick win from the
 * 2026-10-14 review: between sets the phone used to dim and lock.
 *
 * The browser drops a screen lock whenever the page is hidden, so it is taken again
 * each time the page comes back into view. Where the API is missing (older iOS, the
 * test DOM) or refuses, the screen simply sleeps as before. On iPhone, an installed
 * Home Screen app is reported to support this from iOS 18.4; Noah is device QA.
 */
export function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active || typeof navigator === 'undefined') return;
    const api = 'wakeLock' in navigator ? navigator.wakeLock : undefined;
    if (!api) return;

    let lock: WakeLockSentinel | null = null;
    let done = false;

    const acquire = async () => {
      if (done || document.visibilityState !== 'visible') return;
      try {
        const next = await api.request('screen');
        if (done) {
          void next.release().catch(() => {});
          return;
        }
        lock = next;
      } catch {
        // Refused (low battery, no user gesture yet, unsupported): sleep as before.
      }
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') void acquire();
    };

    void acquire();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      done = true;
      document.removeEventListener('visibilitychange', onVisible);
      if (lock) void lock.release().catch(() => {});
    };
  }, [active]);
}

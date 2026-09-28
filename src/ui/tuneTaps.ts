import { useEffect, type RefObject } from 'react';
import { setTuning } from '../lib/feel';

const TAPS = 5;
const WINDOW_MS = 2000;

/** Five taps inside two seconds on `ref` turns the feel tuning panel on. The Home Screen
 *  app has no address bar, so `?tune` cannot reach it; this is the way in there. A native
 *  listener rather than an onClick, because the element is text, not a control. */
export function useTuneTaps(ref: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let taps: number[] = [];
    const onTap = () => {
      const now = performance.now();
      taps = [...taps.filter((t) => now - t < WINDOW_MS), now];
      if (taps.length >= TAPS) {
        taps = [];
        setTuning(true);
      }
    };
    el.addEventListener('click', onTap);
    return () => el.removeEventListener('click', onTap);
  }, [ref]);
}

/** `?tune` in the URL (before or after the hash) turns tune mode on. */
export function tuneWantedFromUrl(): boolean {
  return /[?&]tune\b/.test(location.search) || /[?&]tune\b/.test(location.hash);
}

import { useCallback, useLayoutEffect, useState } from 'react';

/* Screens keep their place inside their tab, the way iOS does: open an exercise from the
   Library, come back by swipe or button, and the list is where you left it, including
   the copy of the screen that shows under the finger during a swipe back. Switching to
   another tab starts every screen fresh at the top (Noah, 09-28), so the tab bar calls
   forgetScreens(). Positions and kept state live in memory for this launch only.

   No flash on the way back (Noah, 09-28: the list showed its top for a frame, then
   jumped). The position is set the moment the scroller attaches, before a virtualized
   list inside it has mounted: a temporary bottom padding makes the saved offset
   reachable, so the list mounts already scrolled and renders the right rows in its
   first frame; the padding comes off once the content is tall enough to hold it. */

const positions = new Map<string, number>();
const kept = new Map<string, unknown>();

/** Every saved position and kept screen state, gone: the next visit starts at the top. */
export function forgetScreens(): void {
  positions.clear();
  kept.clear();
}

/** State that outlives the screen within its tab (search text, filters), reset by
 *  forgetScreens. */
export function useKeptState<T>(
  key: string,
  initial: () => T,
): [T, (v: T | ((prev: T) => T)) => void] {
  const [value, setValue] = useState<T>(() =>
    kept.has(key) ? (kept.get(key) as T) : initial(),
  );
  const set = useCallback(
    (v: T | ((prev: T) => T)) =>
      setValue((prev) => {
        const next = typeof v === 'function' ? (v as (p: T) => T)(prev) : v;
        kept.set(key, next);
        return next;
      }),
    [key],
  );
  return [value, set];
}

/** The saved position for a screen (0 if none), so a long list can render the rows
 *  around it in its first frame. */
export function savedScrollTop(key: string): number {
  return positions.get(key) ?? 0;
}

/** Returns the scroller element and a ref callback to put on it. */
export function useScrollMemory(
  key: string,
): [HTMLElement | null, (el: HTMLElement | null) => void] {
  const [el, setEl] = useState<HTMLElement | null>(null);

  const attach = useCallback(
    (node: HTMLElement | null) => {
      if (node && !node.dataset.osPrimed) {
        node.dataset.osPrimed = '1';
        prime(node, positions.get(key) ?? 0);
      }
      setEl(node);
    },
    [key],
  );

  // After the children that depend on the element (a virtualized list) have mounted:
  // drop the temporary padding once the content can hold the position, and start
  // recording.
  useLayoutEffect(() => {
    if (!el) return;
    const saved = positions.get(key) ?? 0;
    const stop = settle(el, saved);
    const onScroll = () => positions.set(key, el.scrollTop);
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      stop();
      el.removeEventListener('scroll', onScroll);
    };
  }, [key, el]);

  return [el, attach];
}

const PAD = 'osPad';

/** Make `top` reachable now and scroll to it. */
function prime(node: HTMLElement, top: number): void {
  if (top <= 0) return;
  const short = top + node.clientHeight - node.scrollHeight;
  if (short > 0) {
    node.dataset[PAD] = node.style.paddingBottom;
    const pb = parseFloat(getComputedStyle(node).paddingBottom) || 0;
    node.style.paddingBottom = `${pb + short}px`;
  }
  node.scrollTop = top;
}

/** Remove the priming padding as soon as the real content is tall enough (checked now
 *  and for a few frames while a list measures), keeping the position throughout. Stops
 *  early if the person starts scrolling. */
function settle(el: HTMLElement, top: number): () => void {
  let raf = 0;
  let frames = 0;
  const done = () => {
    cancelAnimationFrame(raf);
    frames = Infinity;
  };
  const step = () => {
    if (el.dataset[PAD] !== undefined) {
      const extra =
        parseFloat(el.style.paddingBottom) -
        (parseFloat(el.dataset[PAD] || '0') || 0);
      const contentOk = el.scrollHeight - extra >= top + el.clientHeight;
      if (contentOk || frames >= 30) {
        el.style.paddingBottom = el.dataset[PAD] ?? '';
        delete el.dataset[PAD];
      }
    }
    if (top > 0 && Math.abs(el.scrollTop - top) > 1) el.scrollTop = top;
    if (el.dataset[PAD] === undefined && Math.abs(el.scrollTop - top) <= 1)
      return;
    if (frames++ < 30) raf = requestAnimationFrame(step);
  };
  step();
  const interrupt = () => {
    if (el.dataset[PAD] !== undefined) {
      el.style.paddingBottom = el.dataset[PAD] ?? '';
      delete el.dataset[PAD];
    }
    done();
  };
  el.addEventListener('touchstart', interrupt, { once: true, passive: true });
  el.addEventListener('wheel', interrupt, { once: true, passive: true });
  return () => {
    done();
    el.removeEventListener('touchstart', interrupt);
    el.removeEventListener('wheel', interrupt);
  };
}

/** Test seam: forget every saved position. */
export const clearScrollMemory = forgetScreens;

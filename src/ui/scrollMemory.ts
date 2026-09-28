import { useLayoutEffect, useState } from 'react';

/* Screens keep their place the way iOS does: open an exercise from the Library, come back
   by swipe or button, and the list is where you left it. That includes the copy of the
   screen that shows under the finger during a swipe back, so the hand-off matches.
   Positions live in memory for this launch, keyed by screen; a relaunch starts at the top.

   Returns the scroller element and a ref callback to put on it. */

const positions = new Map<string, number>();

export function useScrollMemory(
  key: string,
): [HTMLElement | null, (el: HTMLElement | null) => void] {
  const [el, setEl] = useState<HTMLElement | null>(null);

  // Layout effect: the position is set before the frame is painted, and before a view
  // transition captures the incoming screen.
  useLayoutEffect(() => {
    if (!el) return;
    const saved = positions.get(key) ?? 0;
    const cancel = saved > 0 ? restore(el, saved) : undefined;
    const onScroll = () => positions.set(key, el.scrollTop);
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      cancel?.();
      el.removeEventListener('scroll', onScroll);
    };
  }, [key, el]);

  return [el, setEl];
}

/** A virtualized list can be too short for a frame or two while it measures its rows, which
 *  clamps the position. Keep setting it until it holds, for at most ten frames, and stop the
 *  moment the person touches or scrolls the list themselves. */
function restore(el: HTMLElement, top: number): () => void {
  el.scrollTop = top;
  let frames = 0;
  let raf = 0;
  const stop = () => {
    frames = Infinity;
    cancelAnimationFrame(raf);
  };
  const again = () => {
    if (frames++ >= 10) return;
    if (Math.abs(el.scrollTop - top) > 1) el.scrollTop = top;
    raf = requestAnimationFrame(again);
  };
  raf = requestAnimationFrame(again);
  el.addEventListener('touchstart', stop, { once: true, passive: true });
  el.addEventListener('wheel', stop, { once: true, passive: true });
  return () => {
    stop();
    el.removeEventListener('touchstart', stop);
    el.removeEventListener('wheel', stop);
  };
}

/** Test seam: forget every saved position. */
export function clearScrollMemory(): void {
  positions.clear();
}

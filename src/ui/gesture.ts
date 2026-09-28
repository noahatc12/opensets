/**
 * One drag recogniser for touch and mouse. Touch events are used on touch devices because
 * they are the only ones iOS lets a page claim mid-gesture (preventDefault on a
 * non-passive touchmove); pointer events with capture cover the mouse for desktop QA.
 *
 * The recogniser reports raw deltas and a velocity estimate from the last ~80 ms of
 * samples. The caller decides when to claim the gesture (axis lock, edge start, scroll
 * position) by returning true from `onStart`; until then nothing is prevented and the
 * browser keeps scrolling.
 */
export interface DragSample {
  x: number;
  y: number;
  t: number;
}

export interface DragState {
  startX: number;
  startY: number;
  x: number;
  y: number;
  dx: number;
  dy: number;
  /** px per ms over the last samples. */
  vx: number;
  vy: number;
  target: EventTarget | null;
}

export interface DragHandlers {
  /** Called on the first move once the finger has travelled `slop` px. Return true to
   *  claim the gesture (the page stops scrolling); false to let the browser have it. */
  onStart: (s: DragState) => boolean;
  onMove: (s: DragState) => void;
  onEnd: (s: DragState, cancelled: boolean) => void;
}

const SLOP = 6;
const WINDOW_MS = 80;

export function attachDrag(el: HTMLElement, h: DragHandlers): () => void {
  let samples: DragSample[] = [];
  let state: DragState | null = null;
  let claimed = false;
  let active = false;
  let touchId: number | null = null;

  const velocity = (): { vx: number; vy: number } => {
    const now = samples[samples.length - 1];
    if (!now) return { vx: 0, vy: 0 };
    let first = samples[0]!;
    for (const s of samples)
      if (now.t - s.t <= WINDOW_MS) {
        first = s;
        break;
      }
    const dt = Math.max(1, now.t - first.t);
    return { vx: (now.x - first.x) / dt, vy: (now.y - first.y) / dt };
  };

  const begin = (x: number, y: number, target: EventTarget | null) => {
    samples = [{ x, y, t: performance.now() }];
    state = { startX: x, startY: y, x, y, dx: 0, dy: 0, vx: 0, vy: 0, target };
    claimed = false;
    active = true;
  };

  const move = (x: number, y: number, ev: Event) => {
    if (!active || !state) return;
    samples.push({ x, y, t: performance.now() });
    if (samples.length > 12) samples.shift();
    const { vx, vy } = velocity();
    state = {
      ...state,
      x,
      y,
      dx: x - state.startX,
      dy: y - state.startY,
      vx,
      vy,
    };
    if (!claimed) {
      if (Math.hypot(state.dx, state.dy) < SLOP) return;
      if (!h.onStart(state)) {
        active = false;
        return;
      }
      claimed = true;
    }
    if (ev.cancelable) ev.preventDefault();
    h.onMove(state);
  };

  const end = (cancelled: boolean) => {
    if (!active || !state) return;
    active = false;
    if (claimed) h.onEnd(state, cancelled);
    claimed = false;
    touchId = null;
  };

  const onTouchStart = (e: TouchEvent) => {
    if (touchId !== null || e.touches.length !== 1) return;
    const t = e.touches[0]!;
    touchId = t.identifier;
    begin(t.clientX, t.clientY, e.target);
  };
  const onTouchMove = (e: TouchEvent) => {
    const t = Array.from(e.touches).find((x) => x.identifier === touchId);
    if (!t) return;
    move(t.clientX, t.clientY, e);
  };
  const onTouchEnd = () => end(false);
  const onTouchCancel = () => end(true);

  const onMouseDown = (e: MouseEvent) => {
    if (e.button !== 0) return;
    begin(e.clientX, e.clientY, e.target);
    const onMouseMove = (m: MouseEvent) => move(m.clientX, m.clientY, m);
    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      end(false);
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  el.addEventListener('touchstart', onTouchStart, { passive: true });
  el.addEventListener('touchmove', onTouchMove, { passive: false });
  el.addEventListener('touchend', onTouchEnd);
  el.addEventListener('touchcancel', onTouchCancel);
  el.addEventListener('mousedown', onMouseDown);
  return () => {
    el.removeEventListener('touchstart', onTouchStart);
    el.removeEventListener('touchmove', onTouchMove);
    el.removeEventListener('touchend', onTouchEnd);
    el.removeEventListener('touchcancel', onTouchCancel);
    el.removeEventListener('mousedown', onMouseDown);
  };
}

/** True when any scroll container between `from` and `stop` is scrolled away from the top. */
export function scrolledAwayFromTop(
  from: EventTarget | null,
  stop: HTMLElement,
): boolean {
  let el = from instanceof HTMLElement ? from : null;
  while (el && el !== stop) {
    const oy = getComputedStyle(el).overflowY;
    if ((oy === 'auto' || oy === 'scroll') && el.scrollTop > 0) return true;
    el = el.parentElement;
  }
  return false;
}

/** True when a horizontal scroller between `from` and `stop` can still scroll left. */
export function canScrollLeft(
  from: EventTarget | null,
  stop: HTMLElement,
): boolean {
  let el = from instanceof HTMLElement ? from : null;
  while (el && el !== stop) {
    const ox = getComputedStyle(el).overflowX;
    if (
      (ox === 'auto' || ox === 'scroll') &&
      el.scrollWidth > el.clientWidth &&
      el.scrollLeft > 0
    )
      return true;
    el = el.parentElement;
  }
  return false;
}

/** True when a vertical scroller between `from` and `stop` has more content than height. */
export function hasVerticalScroller(
  from: EventTarget | null,
  stop: HTMLElement,
): boolean {
  let el = from instanceof HTMLElement ? from : null;
  while (el && el !== stop) {
    const oy = getComputedStyle(el).overflowY;
    if (
      (oy === 'auto' || oy === 'scroll') &&
      el.scrollHeight > el.clientHeight + 1
    )
      return true;
    el = el.parentElement;
  }
  return false;
}

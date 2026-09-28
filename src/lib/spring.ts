/**
 * A damped spring driven by requestAnimationFrame. The finger's velocity carries into the
 * release, a running spring can be retargeted or cancelled mid-flight, and a settle with
 * no flick is critically damped so nothing wobbles for the sake of it.
 *
 * Units: px and ms. stiffness/damping are in the usual Motion/Framer sense.
 */
export interface SpringOptions {
  from: number;
  to: number;
  /** px per ms, positive toward larger values. */
  velocity?: number;
  stiffness?: number;
  damping?: number;
  mass?: number;
  onUpdate: (value: number) => void;
  onDone?: () => void;
}

export interface SpringHandle {
  cancel: () => void;
  /** The value at the moment of the last frame. */
  current: () => number;
  velocity: () => number;
}

const raf =
  typeof requestAnimationFrame === 'function'
    ? requestAnimationFrame
    : (cb: (t: number) => void) =>
        setTimeout(() => cb(Date.now()), 16) as unknown as number;
const caf =
  typeof cancelAnimationFrame === 'function'
    ? cancelAnimationFrame
    : clearTimeout;

export function spring({
  from,
  to,
  velocity = 0,
  stiffness = 420,
  damping = 38,
  mass = 1,
  onUpdate,
  onDone,
}: SpringOptions): SpringHandle {
  let x = from;
  let v = velocity * 1000; // px per second inside the integrator
  let last = performance.now();
  let frame = 0;
  let done = false;

  const step = (now: number) => {
    // Sub-step at 4 ms so a slow frame (a busy main thread on a phone) cannot make the
    // spring overshoot or explode.
    let dt = Math.min(64, now - last) / 1000;
    last = now;
    while (dt > 0) {
      const h = Math.min(dt, 0.004);
      const a = (-stiffness * (x - to) - damping * v) / mass;
      v += a * h;
      x += v * h;
      dt -= h;
    }
    const settled = Math.abs(v) < 8 && Math.abs(x - to) < 0.3;
    if (settled) {
      x = to;
      v = 0;
      done = true;
      onUpdate(x);
      onDone?.();
      return;
    }
    onUpdate(x);
    frame = raf(step);
  };
  frame = raf(step);

  return {
    cancel: () => {
      if (!done) caf(frame);
      done = true;
    },
    current: () => x,
    velocity: () => v / 1000,
  };
}

/**
 * The iOS rubber band: past a limit the finger's pull is resisted more the further it
 * goes, and the band tracks the finger back the way it came.
 * `limit` is how far the surface can be pulled at most, `r` the initial resistance.
 */
export function rubberBand(x: number, limit = 40, r = 0.55): number {
  const s = Math.sign(x);
  const d = Math.abs(x);
  return s * ((limit * d * r) / (d * r + limit));
}

/** Reduced motion: springs and transitions collapse to their end state. */
export function reducedMotion(): boolean {
  return (
    typeof matchMedia === 'function' &&
    matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

import { useEffect, useRef, type ReactNode } from 'react';
import { attachDrag, canScrollLeft } from './gesture';
import { spring, reducedMotion } from '../lib/spring';
import { useNav } from './nav';

/* A pushed screen: swipe from the left edge to go back, the screen following the finger.
   Release past a third of the width, or a flick, carries it off with the finger's own
   velocity and the parent slides back in; anything less springs it home. The edge is
   24 px so chip rows and the image carousel keep their own horizontal scroll. */

const EDGE = 24;
const CLOSE_FRACTION = 0.33;
const FLICK = 0.45; // px per ms

export function Pushed({
  children,
  to = -1,
  className = '',
}: {
  children: ReactNode;
  to?: string | -1;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const nav = useNav();
  const navRef = useRef(nav);
  const toRef = useRef(to);
  useEffect(() => {
    navRef.current = nav;
    toRef.current = to;
  });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let x = 0;
    let anim: ReturnType<typeof spring> | null = null;
    const width = () => el.clientWidth || 390;

    const paint = (v: number) => {
      x = v;
      el.style.transform = v <= 0 ? '' : `translate3d(${v}px, 0, 0)`;
      el.style.setProperty('--os-back-dim', String(Math.min(1, v / width())));
    };

    const detach = attachDrag(el, {
      onStart: (s) => {
        if (s.startX > EDGE) return false;
        if (Math.abs(s.dx) < Math.abs(s.dy) || s.dx <= 0) return false;
        if (canScrollLeft(s.target, el)) return false;
        anim?.cancel();
        el.classList.add('os-pushed--dragging');
        return true;
      },
      onMove: (s) => paint(Math.max(0, s.dx)),
      onEnd: (s, cancelled) => {
        const w = width();
        const shouldPop =
          !cancelled &&
          (x > w * CLOSE_FRACTION || s.vx > FLICK) &&
          s.vx > -FLICK;
        if (shouldPop) {
          if (reducedMotion()) {
            navRef.current.swipe(toRef.current);
            return;
          }
          anim = spring({
            from: x,
            to: w,
            velocity: Math.max(s.vx, 0.6),
            stiffness: 260,
            damping: 30,
            onUpdate: paint,
            onDone: () => {
              navRef.current.swipe(toRef.current);
            },
          });
        } else {
          anim = spring({
            from: x,
            to: 0,
            velocity: s.vx,
            onUpdate: paint,
            onDone: () => el.classList.remove('os-pushed--dragging'),
          });
        }
      },
    });
    return () => {
      detach();
      anim?.cancel();
    };
  }, []);

  return (
    <div ref={ref} className={`os-pushed ${className}`}>
      {children}
    </div>
  );
}

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { attachDrag, canScrollLeft } from './gesture';
import { spring, reducedMotion } from '../lib/spring';
import { backFeel } from '../lib/feel';
import { useNav } from './nav';

/* A pushed screen: swipe from the left edge to go back, the screen following the finger
   with the parent screen visible underneath, the way iOS does it. The parent is mounted
   the moment the drag begins (a second copy of that screen, live data, pointer-inert),
   sits 24 percent to the left and dimmed, and slides to rest as the finger travels.
   Release past a third of the width, or a flick, carries the screen off with the finger's
   own velocity and the route switches to the real parent, which looks the same, so the
   hand-off is invisible; anything less springs it home and the copy unmounts. The edge is
   24 px so chip rows and the image carousel keep their own horizontal scroll. */

const EDGE = 24;
const PARALLAX = 0.24;

export function Pushed({
  children,
  to = -1,
  parent,
  className = '',
}: {
  children: ReactNode;
  /** Where the swipe lands; the screen the `parent` preview stands in for. */
  to?: string | -1;
  /** The screen under this one, rendered beneath the finger during the swipe. */
  parent?: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const under = useRef<HTMLDivElement>(null);
  const nav = useNav();
  const navRef = useRef(nav);
  const toRef = useRef(to);
  const [dragging, setDragging] = useState(false);
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
      const p = Math.min(1, Math.max(0, v / width()));
      el.style.transform = v <= 0 ? '' : `translate3d(${v}px, 0, 0)`;
      const u = under.current;
      if (u) {
        u.style.transform = `translate3d(${(-PARALLAX * (1 - p) * 100).toFixed(2)}%, 0, 0)`;
        u.style.filter = `brightness(${(0.72 + 0.28 * p).toFixed(3)})`;
      }
    };

    const detach = attachDrag(el, {
      onStart: (s) => {
        if (s.startX > EDGE) return false;
        if (Math.abs(s.dx) < Math.abs(s.dy) || s.dx <= 0) return false;
        if (canScrollLeft(s.target, el)) return false;
        anim?.cancel();
        el.classList.add('os-pushed--dragging');
        setDragging(true);
        return true;
      },
      onMove: (s) => paint(Math.max(0, s.dx)),
      onEnd: (s, cancelled) => {
        const w = width();
        // Read at release so a change on the tuning panel applies to the next swipe.
        const feel = backFeel();
        const shouldPop =
          !cancelled &&
          (x > w * feel.closeFraction || s.vx > feel.flick) &&
          s.vx > -feel.flick;
        if (shouldPop) {
          if (reducedMotion()) {
            navRef.current.swipe(toRef.current);
            return;
          }
          anim = spring({
            from: x,
            to: w,
            velocity: Math.max(s.vx, 0.6),
            ...feel.release,
            onUpdate: paint,
            onDone: () => navRef.current.swipe(toRef.current),
          });
        } else {
          anim = spring({
            from: x,
            to: 0,
            velocity: s.vx,
            ...feel.home,
            onUpdate: paint,
            onDone: () => {
              el.classList.remove('os-pushed--dragging');
              setDragging(false);
            },
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
    <>
      {dragging && parent !== undefined && (
        <div ref={under} className="os-pushed-parent" aria-hidden inert>
          {parent}
        </div>
      )}
      <div ref={ref} className={`os-pushed ${className}`}>
        {children}
      </div>
    </>
  );
}

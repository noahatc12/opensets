import { useCallback, useEffect, useRef, type ReactNode } from 'react';
import {
  attachDrag,
  hasVerticalScroller,
  scrolledAwayFromTop,
} from './gesture';
import { spring, rubberBand, reducedMotion } from '../lib/spring';
import { sheetFeel } from '../lib/feel';

/* Bottom sheet. Rises on the iOS curve; drags with the finger once its content is at the
   top; release past the commit point, or a fast enough flick (src/lib/feel.ts), carries
   it off with that velocity and the scrim fades with it; anything less springs back.
   Dragging upward past open is rubber-banded. Tapping the scrim or pressing Escape runs
   the same close animation. Positioned inside the app shell (position: relative) so it
   respects the phone's safe areas the same way the tab bar does. */

export function Sheet({
  open,
  onClose,
  children,
  label,
  height,
  role = 'dialog',
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  label: string;
  height?: string;
  role?: 'dialog' | 'alertdialog';
}) {
  const panel = useRef<HTMLDivElement>(null);
  const scrim = useRef<HTMLDivElement>(null);
  const anim = useRef<ReturnType<typeof spring> | null>(null);
  const closing = useRef(false);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  const paint = useCallback((y: number) => {
    const p = panel.current;
    const s = scrim.current;
    if (!p) return;
    const h = p.offsetHeight || 1;
    p.style.transform = `translate3d(0, ${y}px, 0)`;
    if (s) s.style.opacity = String(Math.max(0, Math.min(1, 1 - y / h)));
  }, []);

  /** Close with motion, carrying `velocity` (px/ms) from the finger when there is one. */
  const animateClose = useCallback(
    (velocity = 0) => {
      const p = panel.current;
      if (closing.current) return;
      closing.current = true;
      if (!p || reducedMotion()) {
        onCloseRef.current();
        return;
      }
      anim.current?.cancel();
      const from = currentY(p);
      anim.current = spring({
        from,
        to: p.offsetHeight + 8,
        velocity: Math.max(velocity, 0.9),
        ...sheetFeel().close,
        onUpdate: paint,
        onDone: () => onCloseRef.current(),
      });
    },
    [paint],
  );

  useEffect(() => {
    if (!open) return;
    closing.current = false;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') animateClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, animateClose]);

  useEffect(() => {
    const p = panel.current;
    if (!open || !p) return;
    let y = 0;
    const detach = attachDrag(p, {
      onStart: (s) => {
        if (Math.abs(s.dy) < Math.abs(s.dx)) return false;
        // Downward on content that is scrolled away from its top is a scroll. Upward is
        // always a scroll when there is anything to scroll under the finger; only a
        // header or a short sheet rubber-bands.
        if (s.dy > 0 && scrolledAwayFromTop(s.target, p)) return false;
        if (s.dy < 0 && hasVerticalScroller(s.target, p)) return false;
        anim.current?.cancel();
        p.classList.add('os-sheet--dragging');
        return true;
      },
      onMove: (s) => {
        y = s.dy >= 0 ? s.dy : rubberBand(s.dy);
        paint(y);
      },
      onEnd: (s, cancelled) => {
        p.classList.remove('os-sheet--dragging');
        const h = p.offsetHeight || 1;
        // Read at release so a change on the tuning panel applies to the next drag.
        const feel = sheetFeel();
        const flick = s.vy > feel.flick;
        const shouldClose =
          !cancelled &&
          y > 0 &&
          (y > h * feel.closeFraction || flick) &&
          s.vy > -feel.flick;
        if (shouldClose) {
          animateClose(s.vy);
          return;
        }
        anim.current = spring({
          from: y,
          to: 0,
          velocity: s.vy,
          ...(flick ? feel.flickHome : feel.home),
          onUpdate: paint,
        });
      },
    });
    return () => {
      detach();
      anim.current?.cancel();
    };
  }, [open, paint, animateClose]);

  if (!open) return null;
  return (
    <div className="absolute inset-0 z-40">
      <div
        ref={scrim}
        className="os-scrim"
        onClick={() => animateClose()}
        aria-hidden
      />
      <div
        ref={panel}
        role={role}
        aria-modal="true"
        aria-label={label}
        className="os-sheet"
        style={height ? { height } : undefined}
      >
        <div className="os-grab" />
        {children}
      </div>
    </div>
  );
}

function currentY(el: HTMLElement): number {
  const m = /translate3d\(0px, ([-\d.]+)px/.exec(el.style.transform);
  return m ? parseFloat(m[1]!) : 0;
}

/** Sheet header: bold title left, a text action right. */
export function SheetHeader({
  title,
  action,
  onAction,
}: {
  title: string;
  action: string;
  onAction: () => void;
}) {
  return (
    <div className="flex flex-none items-center justify-between">
      <span
        className="text-[22px] font-extrabold"
        style={{ letterSpacing: '-.03em' }}
      >
        {title}
      </span>
      <button
        type="button"
        onClick={onAction}
        className="h-10 px-2 text-[14px] font-bold"
        style={{ color: 'var(--acc-tx)' }}
      >
        {action}
      </button>
    </div>
  );
}

/** Destructive confirm sheet. */
export function ConfirmSheet({
  open,
  title,
  body,
  cta,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  body: string;
  cta: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Sheet open={open} onClose={onClose} label={title} role="alertdialog">
      <div
        className="text-[24px] font-extrabold leading-tight"
        style={{ letterSpacing: '-.03em' }}
      >
        {title}
      </div>
      <p
        className="mb-[18px] mt-2 text-[15px] leading-[1.45]"
        style={{ color: 'var(--mute)' }}
      >
        {body}
      </p>
      <button
        type="button"
        onClick={onConfirm}
        className="os-btn os-press"
        style={{
          background: 'var(--danger)',
          color: '#fff',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,.25)',
        }}
      >
        {cta}
      </button>
      <button
        type="button"
        onClick={onClose}
        className="os-btn os-btn--sm os-press mt-2"
      >
        Cancel
      </button>
    </Sheet>
  );
}

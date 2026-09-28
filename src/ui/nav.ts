import { useCallback, useMemo } from 'react';
import { flushSync } from 'react-dom';
import { useNavigate, type NavigateOptions, type To } from 'react-router-dom';
import { reducedMotion } from '../lib/spring';

/**
 * Navigation with intent. Every route change says whether it is a push (deeper), a pop
 * (back up), a tab switch, or a swipe-back that already moved the screen with the finger.
 * The intent lands on <html data-nav> for the duration of a view transition, and the CSS
 * in editorial.css picks the slide for it. Browsers without view transitions just switch.
 */
export type NavKind = 'push' | 'pop' | 'tab' | 'swipe' | 'none';

const DONE_DELAY = 500;

function withTransition(kind: NavKind, update: () => void): void {
  const doc = typeof document !== 'undefined' ? document : null;
  const start =
    doc && 'startViewTransition' in doc
      ? (
          doc as Document & {
            startViewTransition: (cb: () => void) => {
              finished: Promise<void>;
            };
          }
        ).startViewTransition.bind(doc)
      : null;
  if (!doc || !start || kind === 'none' || reducedMotion()) {
    update();
    return;
  }
  doc.documentElement.dataset.nav = kind;
  const t = start(() => {
    flushSync(update);
  });
  const clear = () => {
    if (doc.documentElement.dataset.nav === kind)
      delete doc.documentElement.dataset.nav;
  };
  t.finished.then(clear, clear);
  setTimeout(clear, DONE_DELAY + 300);
}

export interface Nav {
  /** Deeper into the hierarchy: the new screen slides in from the right. */
  push: (to: To, opts?: NavigateOptions) => void;
  /** Back up: the screen slides out to the right, the parent returns from the left. */
  pop: (to?: To | -1) => void;
  /** Sideways between tabs: a short crossfade, the pill glides. */
  tab: (to: To) => void;
  /** After a swipe that already carried the screen off: only the parent moves. */
  swipe: (to?: To | -1) => void;
}

export function useNav(): Nav {
  const navigate = useNavigate();
  const go = useCallback(
    (kind: NavKind, to: To | -1, opts?: NavigateOptions) => {
      withTransition(kind, () => {
        if (to === -1) navigate(-1);
        else navigate(to, opts);
      });
    },
    [navigate],
  );
  return useMemo(
    () => ({
      push: (to, opts) => go('push', to, opts),
      pop: (to = -1) => go('pop', to),
      tab: (to) => go('tab', to),
      swipe: (to = -1) => go('swipe', to),
    }),
    [go],
  );
}

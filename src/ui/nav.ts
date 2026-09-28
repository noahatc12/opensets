import { useCallback, useMemo } from 'react';
import { flushSync } from 'react-dom';
import {
  useLocation,
  useNavigate,
  type Location,
  type NavigateOptions,
  type To,
} from 'react-router-dom';
import { reducedMotion } from '../lib/spring';

/**
 * Navigation with intent. Every route change says whether it is a push (deeper), a pop
 * (back up), a tab switch, or a swipe-back that already moved the screen with the finger.
 * The intent lands on <html data-nav> for the duration of a view transition, and the CSS
 * in editorial.css picks the slide for it. Browsers without view transitions just switch.
 *
 * Back returns to where you came from (docs/redesign/NAV.md, rule 1): a push records the
 * screen it left in `location.state.from`, with that screen's own state, so going back
 * restores it and its own way back. A screen opened cold has no origin and goes back to
 * the fallback its caller names.
 */
export type NavKind =
  | 'push'
  | 'pop'
  | 'tab'
  | 'swipe'
  /** The workout cover rising over the screen that started it, and tucking away. */
  | 'up'
  | 'down'
  | 'none';

/** Where a pushed screen came from: the path and that screen's own router state. */
export interface Origin {
  path: string;
  state: unknown;
}

const DONE_DELAY = 500;

/** Run a UI change inside a view transition of the given kind. */
export function withTransition(kind: NavKind, update: () => void): void {
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

/** The origin a location was pushed from, if it was pushed. */
export function originOf(location: Pick<Location, 'state'>): Origin | null {
  const from = (location.state as { from?: Origin } | null)?.from;
  return from && typeof from.path === 'string' ? from : null;
}

export interface Nav {
  /** Deeper into the hierarchy: the new screen slides in from the right and remembers
   *  the screen it came from. */
  push: (to: To, opts?: NavigateOptions) => void;
  /** Back up to where this screen came from, else to `fallback`. */
  back: (fallback: string) => void;
  /** Up to a named screen. */
  pop: (to?: To | -1) => void;
  /** Sideways between tabs: a short crossfade, the pill glides. */
  tab: (to: To) => void;
  /** After a swipe that already carried the screen off: only the parent moves. A path
   *  is the fallback; the origin wins when there is one. */
  swipe: (to?: To | -1) => void;
  /** Where Back would go: the origin, else `fallback`. */
  backTarget: (fallback: string) => Origin;
}

export function useNav(): Nav {
  const navigate = useNavigate();
  const location = useLocation();
  const go = useCallback(
    (kind: NavKind, to: To | -1, opts?: NavigateOptions) => {
      withTransition(kind, () => {
        if (to === -1) navigate(-1);
        else navigate(to, opts);
      });
    },
    [navigate],
  );
  return useMemo(() => {
    const here: Origin = { path: location.pathname, state: location.state };
    const backTarget = (fallback: string): Origin =>
      originOf(location) ?? { path: fallback, state: null };
    const toOrigin = (kind: NavKind, o: Origin) =>
      go(kind, o.path, { state: o.state, replace: true });
    return {
      push: (to, opts) =>
        go('push', to, {
          ...opts,
          state: { ...(opts?.state as object | undefined), from: here },
        }),
      back: (fallback) => toOrigin('pop', backTarget(fallback)),
      pop: (to = -1) => go('pop', to),
      tab: (to) => go('tab', to),
      swipe: (to = -1) =>
        typeof to === 'string'
          ? toOrigin('swipe', backTarget(to))
          : go('swipe', to),
      backTarget,
    };
  }, [go, location]);
}

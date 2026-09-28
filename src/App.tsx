import { useCallback, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { installViewportFix } from './ui/viewport';
import { FeelPanel } from './ui/FeelPanel';
import { tuneWantedFromUrl } from './ui/tuneTaps';
import { setTuning } from './lib/feel';
import {
  HashRouter,
  Routes,
  Route,
  Navigate,
  Outlet,
  useLocation,
  UNSAFE_RouteContext as RouteContext,
} from 'react-router-dom';
import { TabBar } from './components/TabBar';
import { ReloadPrompt } from './components/ReloadPrompt';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useSessionStore } from './state/session';
import { TodayScreen } from './features/log/TodayScreen';
import { RoutineBuilder } from './features/programs/RoutineBuilder';
import { PlanScreen } from './features/programs/PlanScreen';
import { LibraryScreen } from './features/library/LibraryScreen';
import { ExerciseDetailScreen } from './features/library/ExerciseDetailScreen';
import { HistoryScreen } from './features/analytics/HistoryScreen';
import { SettingsScreen } from './features/settings/SettingsScreen';
import { PlatesScreen } from './features/settings/PlatesScreen';
import { RestDefaultsScreen } from './features/settings/RestDefaultsScreen';
import { GoalsScreen } from './features/settings/GoalsScreen';
import { MeasurementsScreen } from './features/settings/MeasurementsScreen';
import { ProfileScreen } from './features/settings/ProfileScreen';
import { OnboardingScreen } from './features/onboarding/OnboardingScreen';
import { WorkoutBar, WorkoutCover } from './features/log/WorkoutCover';
import { getActiveWorkoutSession } from './db/repositories';
import { ScreenAtContext } from './ui/screenAt';
import type { Origin } from './ui/nav';

const TAB_ROUTES = ['/today', '/plan', '/library', '/history', '/settings'];

/** Every screen, once: the app's routes, and the copy shown under a swipe back. */
function screenRoutes() {
  return [
    <Route key="today" path="/today" element={<TodayScreen />} />,
    <Route key="plan" path="/plan" element={<PlanScreen />} />,
    <Route key="rnew" path="/routine/new" element={<RoutineBuilder />} />,
    <Route
      key="redit"
      path="/routine/:templateId"
      element={<RoutineBuilder />}
    />,
    <Route key="lib" path="/library" element={<LibraryScreen />} />,
    <Route key="ex" path="/library/:id" element={<ExerciseDetailScreen />} />,
    <Route key="hist" path="/history" element={<HistoryScreen />} />,
    <Route key="you" path="/settings" element={<SettingsScreen />} />,
    <Route
      key="app"
      path="/appearance"
      element={<Navigate to="/settings" replace />}
    />,
    <Route key="plates" path="/plates" element={<PlatesScreen />} />,
    <Route key="rest" path="/rest-defaults" element={<RestDefaultsScreen />} />,
    <Route key="goals" path="/goals" element={<GoalsScreen />} />,
    <Route key="meas" path="/measurements" element={<MeasurementsScreen />} />,
    <Route key="prof" path="/profile" element={<ProfileScreen />} />,
    <Route key="onb" path="/onboarding" element={<OnboardingScreen />} />,
  ];
}

function AppShell() {
  const inSession = useSessionStore((s) => s.activeSessionId !== null);
  const { pathname } = useLocation();
  // The floating tab bar shows on the five tabs; pushed screens and the active
  // session are full-screen.
  const showTabs = TAB_ROUTES.includes(pathname) && !inSession;
  // A workout tucked away: a bar on every tab but Today, whose card already shows it.
  const resumable = useLiveQuery(() => getActiveWorkoutSession());
  const barOn = showTabs && pathname !== '/today' && Boolean(resumable);
  // The screen a pushed screen came from, drawn under the finger during a swipe back.
  const screenAt = useCallback(
    (o: Origin) => (
      <>
        {/* Matched from the top, not inside the pushed screen's own route: a location
            override must sit under its parent route, and the origin never does. */}
        <RouteContext.Provider
          value={{ outlet: null, matches: [], isDataRoute: false }}
        >
          <Routes location={{ pathname: o.path, state: o.state }}>
            {screenRoutes()}
          </Routes>
        </RouteContext.Provider>
        {TAB_ROUTES.includes(o.path) && <TabBar activePath={o.path} />}
      </>
    ),
    [],
  );

  // Storage durability ladder (spec §9): request persistence post-load.
  useEffect(() => {
    if (typeof navigator !== 'undefined' && navigator.storage?.persist) {
      void navigator.storage.persist();
    }
  }, []);
  // The Home Screen container can report a viewport shorter than the screen; the shell
  // extends by the measured gap (see ui/viewport.ts).
  useEffect(() => installViewportFix(), []);
  // Keyboard focus rings only for keyboard use: Tab turns them on, any touch or click
  // turns them off (editorial.css, the search well).
  useEffect(() => {
    const root = document.documentElement;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Tab') root.dataset.kbd = '1';
    };
    const onPointer = () => {
      delete root.dataset.kbd;
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onPointer);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onPointer);
    };
  }, []);
  // Device QA: `?tune` opens the feel tuning panel (see ui/FeelPanel.tsx).
  useEffect(() => {
    if (tuneWantedFromUrl()) setTuning(true);
  }, []);

  return (
    <div
      className="os-shell fixed inset-0 mx-auto flex max-w-md flex-col overflow-hidden bg-bg"
      data-tabs={showTabs ? 'on' : 'off'}
      data-workout={barOn ? 'on' : 'off'}
    >
      <ScreenAtContext.Provider value={screenAt}>
        {/* Under the workout cover the screen is kept, not usable: out of reach of touch,
            focus and VoiceOver until the cover lowers. */}
        <main
          className="flex-1 overflow-y-auto overscroll-contain"
          inert={inSession || undefined}
          aria-hidden={inSession || undefined}
        >
          <ErrorBoundary key={pathname}>
            <Outlet />
          </ErrorBoundary>
        </main>
      </ScreenAtContext.Provider>
      {barOn && resumable && <WorkoutBar session={resumable} />}
      {showTabs && <TabBar />}
      <WorkoutCover resumable={resumable} />
      <ReloadPrompt />
      <FeelPanel />
    </div>
  );
}

export default function App() {
  return (
    // Navigations commit at once, not as a low-priority transition: the slide between
    // screens is a view transition that snapshots the page inside its callback, and a
    // deferred commit left it sliding the old screen over a copy of itself before the
    // new one snapped in (measured 09-28, live since the feel layer shipped).
    <HashRouter useTransitions={false}>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<Navigate to="/today" replace />} />
          {screenRoutes()}
          <Route path="*" element={<Navigate to="/today" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}

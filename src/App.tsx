import { useEffect } from 'react';
import {
  HashRouter,
  Routes,
  Route,
  Navigate,
  Outlet,
  useLocation,
} from 'react-router-dom';
import { TabBar } from './components/TabBar';
import { ReloadPrompt } from './components/ReloadPrompt';
import { useSessionStore } from './state/session';
import { TodayScreen } from './features/log/TodayScreen';
import { RoutineBuilder } from './features/programs/RoutineBuilder';
import { PlanScreen } from './features/programs/PlanScreen';
import { LibraryScreen } from './features/library/LibraryScreen';
import { ExerciseDetailScreen } from './features/library/ExerciseDetailScreen';
import { HistoryScreen } from './features/analytics/HistoryScreen';
import { SettingsScreen } from './features/settings/SettingsScreen';
import { AppearanceScreen } from './features/settings/AppearanceScreen';
import { OnboardingScreen } from './features/onboarding/OnboardingScreen';

const TAB_ROUTES = ['/today', '/plan', '/library', '/history'];

function AppShell() {
  const inSession = useSessionStore((s) => s.activeSessionId !== null);
  const { pathname } = useLocation();
  // The tab bar shows only on the 4 main tabs; pushed sub-screens (builder,
  // settings, detail, onboarding) and the active session are full-screen.
  const showTabs = TAB_ROUTES.includes(pathname) && !inSession;

  // Storage durability ladder (spec §9): request persistence post-load. Browsers
  // grant silently for installed / engaged PWAs; Settings exposes the status.
  useEffect(() => {
    if (typeof navigator !== 'undefined' && navigator.storage?.persist) {
      void navigator.storage.persist();
    }
  }, []);

  return (
    <div className="mx-auto flex h-dvh max-w-md flex-col overflow-hidden bg-bg">
      <main className="flex-1 overflow-y-auto overscroll-contain">
        <Outlet />
      </main>
      {showTabs && <TabBar />}
      <ReloadPrompt />
    </div>
  );
}

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<Navigate to="/today" replace />} />
          <Route path="/today" element={<TodayScreen />} />
          <Route path="/plan" element={<PlanScreen />} />
          <Route path="/routine/new" element={<RoutineBuilder />} />
          <Route path="/library" element={<LibraryScreen />} />
          <Route path="/library/:id" element={<ExerciseDetailScreen />} />
          <Route path="/history" element={<HistoryScreen />} />
          <Route path="/settings" element={<SettingsScreen />} />
          <Route path="/appearance" element={<AppearanceScreen />} />
          <Route path="/onboarding" element={<OnboardingScreen />} />
          <Route path="*" element={<Navigate to="/today" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}

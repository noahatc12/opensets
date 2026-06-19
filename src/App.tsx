import { useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { TabBar } from './components/TabBar';
import { ReloadPrompt } from './components/ReloadPrompt';
import { TodayScreen } from './features/log/TodayScreen';
import { RoutineBuilder } from './features/programs/RoutineBuilder';
import { LibraryScreen } from './features/library/LibraryScreen';
import { HistoryScreen } from './features/analytics/HistoryScreen';
import { SettingsScreen } from './features/settings/SettingsScreen';

function AppShell() {
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
      <TabBar />
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
          <Route path="/routine/new" element={<RoutineBuilder />} />
          <Route path="/library" element={<LibraryScreen />} />
          <Route path="/history" element={<HistoryScreen />} />
          <Route path="/settings" element={<SettingsScreen />} />
          <Route path="*" element={<Navigate to="/today" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}

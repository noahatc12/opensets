import { NavLink } from 'react-router-dom';
import { cn } from './cn';
import { DumbbellIcon, LibraryIcon, HistoryIcon, SettingsIcon } from './icons';
import { t } from '../i18n/strings';

const TABS = [
  { to: '/today', label: t.nav.today, Icon: DumbbellIcon },
  { to: '/library', label: t.nav.library, Icon: LibraryIcon },
  { to: '/history', label: t.nav.history, Icon: HistoryIcon },
  { to: '/settings', label: t.nav.settings, Icon: SettingsIcon },
] as const;

/** Bottom tab navigation — primary actions in the thumb zone, safe-area aware. */
export function TabBar() {
  return (
    <nav className="shrink-0 border-t border-border bg-surface/95 pb-[max(0.375rem,env(safe-area-inset-bottom))] backdrop-blur">
      <ul className="mx-auto flex max-w-md">
        {TABS.map(({ to, label, Icon }) => (
          <li key={to} className="flex-1">
            <NavLink
              to={to}
              className={({ isActive }) =>
                cn(
                  'flex min-h-14 flex-col items-center justify-center gap-1 pt-1.5 text-[11px] font-medium transition-colors',
                  isActive ? 'text-accent' : 'text-faint hover:text-muted',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon
                    className={cn(
                      'size-[22px]',
                      isActive && 'drop-shadow-[0_0_6px_rgba(168,242,58,0.35)]',
                    )}
                  />
                  <span>{label}</span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

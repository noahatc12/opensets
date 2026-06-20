import { NavLink } from 'react-router-dom';
import { cn } from './cn';

/* Ported from the Tempo prototype: 4 tabs (Today / Plan / Library / Trends),
   icons inline from the reference. Settings lives on the Today header gear. */

const TABS = [
  {
    to: '/today',
    label: 'Today',
    icon: (
      <path
        d="M4 11l8-7 8 7v8a1 1 0 01-1 1h-4v-6h-6v6H5a1 1 0 01-1-1z"
        stroke="currentColor"
        strokeWidth="1.6"
      />
    ),
  },
  {
    to: '/plan',
    label: 'Plan',
    icon: (
      <>
        <rect x="4" y="5" width="16" height="15" rx="2" stroke="currentColor" strokeWidth="1.6" />
        <path d="M4 9h16M8 3v4M16 3v4" stroke="currentColor" strokeWidth="1.6" />
      </>
    ),
  },
  {
    to: '/library',
    label: 'Library',
    icon: (
      <>
        <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.6" />
        <path d="M20 20l-4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </>
    ),
  },
  {
    to: '/history',
    label: 'Trends',
    icon: (
      <path
        d="M4 19V9M9.5 19V4M15 19v-7M20.5 19v-11"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    ),
  },
] as const;

export function TabBar() {
  return (
    <nav
      className="flex shrink-0 justify-between px-[22px] pb-[max(1rem,env(safe-area-inset-bottom))] pt-2.5"
      style={{ background: 'linear-gradient(180deg,transparent,var(--bg) 32%)' }}
    >
      {TABS.map((t) => (
        <NavLink
          key={t.to}
          to={t.to}
          className={({ isActive }) =>
            cn(
              'flex flex-col items-center gap-1 bg-transparent',
              isActive ? 'text-accent' : 'text-faint',
            )
          }
        >
          <svg width="23" height="23" viewBox="0 0 24 24" fill="none">
            {t.icon}
          </svg>
          <span className="text-[9.5px] font-semibold">{t.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}

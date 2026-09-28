import { NavLink, useLocation } from 'react-router-dom';
import { useNav } from '../ui/nav';

/* Floating glass tab bar. Five tabs. The active highlight is a pill inset 6px inside the
   66px island, so its radius (27px) is concentric with the island's (33px) at the ends. */

const TABS = [
  {
    to: '/today',
    label: 'Today',
    icon: <path d="M4 11l8-7 8 7v8a1 1 0 01-1 1h-4v-6h-6v6H5a1 1 0 01-1-1z" />,
  },
  {
    to: '/plan',
    label: 'Plan',
    icon: (
      <>
        <rect x="4" y="5" width="16" height="15" rx="4" />
        <path d="M4 10h16M8 3v4M16 3v4" />
      </>
    ),
  },
  {
    to: '/library',
    label: 'Library',
    icon: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="M20 20l-4-4" />
      </>
    ),
  },
  {
    to: '/history',
    label: 'Trends',
    icon: <path d="M4 19V9M9.5 19V4M15 19v-7M20.5 19v-11" />,
  },
  {
    to: '/settings',
    label: 'You',
    icon: (
      <>
        <circle cx="12" cy="8.5" r="3.8" />
        <path d="M4.5 20c1.2-3.6 4-5.5 7.5-5.5s6.3 1.9 7.5 5.5" />
      </>
    ),
  },
] as const;

export function TabBar() {
  const nav = useNav();
  const { pathname } = useLocation();
  return (
    <nav aria-label="Main" className="os-tabs">
      {TABS.map((t) => (
        <NavLink
          key={t.to}
          to={t.to}
          className="os-tab os-press"
          onClick={(e) => {
            if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
            e.preventDefault();
            if (pathname !== t.to) nav.tab(t.to);
          }}
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            {t.icon}
          </svg>
          <span>{t.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}

/**
 * Minimal hand-rolled icon set (no icon-library dependency in P0).
 * 24×24, inherit `currentColor`, 1.75 stroke. Decorative by default (aria-hidden).
 */
import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

function base(props: IconProps) {
  return {
    width: 24,
    height: 24,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.75,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
    ...props,
  };
}

export function DumbbellIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 9v6" />
      <path d="M7.5 7v10" />
      <path d="M16.5 7v10" />
      <path d="M20 9v6" />
      <path d="M7.5 12h9" />
    </svg>
  );
}

export function LibraryIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 5.5A1.5 1.5 0 015.5 4H18a2 2 0 012 2v12.5" />
      <path d="M6 4v14.5" />
      <path d="M4 18.5A1.5 1.5 0 015.5 17H20" />
      <path d="M4 5.5v13" />
      <path d="M20 18.5A1.5 1.5 0 0118.5 20H5.5A1.5 1.5 0 014 18.5" />
    </svg>
  );
}

export function HistoryIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M3.5 7V4M3.5 7h3" />
      <path d="M4 11a8 8 0 113 7.2" />
      <path d="M12 8v4l2.5 1.5" />
    </svg>
  );
}

export function SettingsIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2.5l1.4 2.3 2.6-.5.5 2.6 2.3 1.4-1 2.4 1 2.4-2.3 1.4-.5 2.6-2.6-.5L12 21.5l-1.4-2.3-2.6.5-.5-2.6L5.2 15.7l1-2.4-1-2.4 2.3-1.4.5-2.6 2.6.5L12 2.5z" />
    </svg>
  );
}

export function DownloadIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 3v12" />
      <path d="M7 11l5 5 5-5" />
      <path d="M4 20h16" />
    </svg>
  );
}

export function UploadIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 21V9" />
      <path d="M7 13l5-5 5 5" />
      <path d="M4 4h16" />
    </svg>
  );
}

export function ShieldIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 3l7 3v5c0 4.5-3 7.7-7 9-4-1.3-7-4.5-7-9V6l7-3z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}

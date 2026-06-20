/* ============================================================================
   OpenSets — Icons (React + TypeScript)
   ----------------------------------------------------------------------------
   Inline, currentColor-driven SVGs lifted verbatim from the prototype. They
   inherit `color` (so set it via text-accent / text-muted / var(--token)) and
   take an optional size. 1.6 stroke at 23–24px is the app's nav weight.
   ========================================================================== */

import React from 'react';

export interface IconProps {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

const wrap = (size = 24, children: React.ReactNode, p?: IconProps) => (
  <svg width={p?.size ?? size} height={p?.size ?? size} viewBox="0 0 24 24" fill="none" className={p?.className} style={p?.style}>
    {children}
  </svg>
);

/* ----- bottom-tab icons (nav) -------------------------------------------- */

export const HomeIcon = (p?: IconProps) =>
  wrap(23, <path d="M4 11l8-7 8 7v8a1 1 0 01-1 1h-4v-6h-6v6H5a1 1 0 01-1-1z" stroke="currentColor" strokeWidth="1.6" />, p);

export const PlanIcon = (p?: IconProps) =>
  wrap(23, <>
    <rect x="4" y="5" width="16" height="15" rx="2" stroke="currentColor" strokeWidth="1.6" />
    <path d="M4 9h16M8 3v4M16 3v4" stroke="currentColor" strokeWidth="1.6" />
  </>, p);

export const LibraryIcon = (p?: IconProps) =>
  wrap(23, <>
    <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.6" />
    <path d="M20 20l-4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </>, p);

export const TrendsIcon = (p?: IconProps) =>
  wrap(23, <path d="M4 19V9M9.5 19V4M15 19v-7M20.5 19v-11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />, p);

/* ----- glyphs ------------------------------------------------------------ */

export const CheckIcon = (p?: IconProps) =>
  wrap(20, <path d="M4 10.5L8 14.5L16 5.5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />, p);

export const InfoIcon = (p?: IconProps) =>
  wrap(16, <>
    <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.3" />
    <path d="M8 7.2v4M8 4.8h.01" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
  </>, p);

export const ShieldIcon = (p?: IconProps) =>
  wrap(24, <path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />, p);

/* ----- logo -------------------------------------------------------------- */

/** OpenSets wordmark glyph — interlocking "O" + bar. Uses currentColor. */
export const LogoMark = (p?: IconProps) =>
  wrap(28, <>
    <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="2.2" />
    <path d="M5 12h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    <circle cx="5" cy="12" r="2.2" fill="currentColor" />
    <circle cx="19" cy="12" r="2.2" fill="currentColor" />
  </>, p);

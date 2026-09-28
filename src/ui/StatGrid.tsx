import type { ReactNode } from 'react';

export interface Stat {
  label: string;
  value: ReactNode;
  unit?: string;
  sub?: ReactNode;
  color?: string;
  /** A tinted tile (the gold Records tile on the summary). */
  tint?: 'pr';
  onClick?: () => void;
}

/* Stat tiles: label, big numeral with a small unit, optional subline. */
export function StatTiles({
  stats,
  cols = 2,
  size = 28,
}: {
  stats: Stat[];
  cols?: number;
  size?: number;
}) {
  return (
    <div
      className="grid gap-2.5"
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
    >
      {stats.map((s, i) => {
        const inner = (
          <>
            <div
              className="os-t"
              style={{
                ...(cols >= 3 ? { fontSize: 11 } : {}),
                ...(s.tint === 'pr' ? { color: 'var(--pr)' } : {}),
              }}
            >
              {s.label}
            </div>
            <div
              className="os-num mt-2"
              style={{ fontSize: size, color: s.color ?? 'var(--ink)' }}
            >
              {s.value}
              {s.unit && (
                <span
                  className="ml-1 text-[12px] font-semibold"
                  style={{ color: 'var(--mute)', letterSpacing: 0 }}
                >
                  {s.unit}
                </span>
              )}
            </div>
            {s.sub !== undefined && (
              <div
                className="mt-1 truncate text-[11.5px] font-semibold"
                style={{ color: 'var(--mute)' }}
              >
                {s.sub}
              </div>
            )}
          </>
        );
        const style = {
          ...(cols >= 3 ? { padding: 12 } : {}),
          ...(s.tint === 'pr'
            ? {
                background:
                  'linear-gradient(160deg, color-mix(in oklab, var(--pr) 22%, var(--s1)), color-mix(in oklab, var(--pr) 6%, var(--s1)))',
                boxShadow:
                  'inset 0 1px 0 color-mix(in oklab, var(--pr) 30%, transparent)',
              }
            : {}),
        };
        return s.onClick ? (
          <button
            key={i}
            type="button"
            onClick={s.onClick}
            className="os-tile os-press text-left"
            style={style}
          >
            {inner}
          </button>
        ) : (
          <div key={i} className="os-tile" style={style}>
            {inner}
          </div>
        );
      })}
    </div>
  );
}

/** Screen title block: small line above, the 32px title, optional right slot. */
export function ScreenTitle({
  eyebrow,
  title,
  right,
}: {
  eyebrow: ReactNode;
  title: string;
  right?: ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-3 pt-[max(0.5rem,env(safe-area-inset-top))]">
      <div className="min-w-0">
        <div className="os-t">{eyebrow}</div>
        <h1 className="os-h1 mt-0.5 truncate">{title}</h1>
      </div>
      {right}
    </div>
  );
}

/** Round back button used at the top of pushed screens. */
export function BackButton({
  onClick,
  label = 'Back',
}: {
  onClick: () => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="os-icon-btn os-press"
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M15 6l-6 6 6 6" />
      </svg>
    </button>
  );
}

/** Section heading with an optional right-hand link. */
export function SectionHead({
  children,
  right,
  onRight,
}: {
  children: ReactNode;
  right?: ReactNode;
  onRight?: () => void;
}) {
  return (
    <div className="os-h2">
      <span>{children}</span>
      {right !== undefined &&
        (onRight ? (
          <button
            type="button"
            onClick={onRight}
            className="text-[12.5px] font-semibold"
            style={{ color: 'var(--acc-tx)' }}
          >
            {right}
          </button>
        ) : (
          <span
            className="text-[12.5px] font-semibold"
            style={{ color: 'var(--acc-tx)' }}
          >
            {right}
          </span>
        ))}
    </div>
  );
}

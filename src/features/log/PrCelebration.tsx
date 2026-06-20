/* Ported from the OpenSets prototype PR celebration overlay
   (reference/OpenSets.dc.html, "PR CELEBRATION" block ~L1124).
   Full-screen centered overlay, tappable to dismiss, --pr accent + glow.
   Pure presentational — reads only the kg/lb units setting for display. */

import { useSettings } from '../../db/hooks';
import { roundDisplay, toUnit } from '../../lib/units';

type PrKind = 'weight' | 'reps' | 'e1rm';

const KIND_LABEL: Record<PrKind, string> = {
  weight: 'weight',
  reps: 'reps',
  e1rm: 'e1RM',
};

const numFont = {
  fontFamily: 'var(--font-num)',
  fontWeight: 'var(--num-weight)' as unknown as number,
  fontVariantNumeric: 'tabular-nums' as const,
};

function badgeLabel(kinds: PrKind[]): string {
  if (kinds.length === 0) return 'NEW PR';
  if (kinds.length === 1) return `NEW ${KIND_LABEL[kinds[0]!]} PR`;
  return 'NEW PR';
}

export function PrCelebration({
  kinds,
  e1rm,
  onDismiss,
}: {
  kinds: PrKind[];
  e1rm?: number | null;
  onDismiss: () => void;
}) {
  const { units } = useSettings();
  const e1rmDisplay =
    e1rm != null ? roundDisplay(toUnit(e1rm, units), units) : null;

  return (
    <div
      onClick={onDismiss}
      role="dialog"
      aria-modal="true"
      aria-label="Personal record"
      className="absolute inset-0 z-[5] flex cursor-pointer items-center justify-center"
      style={{
        background: 'color-mix(in oklab, var(--bg) 78%, transparent)',
        backdropFilter: 'blur(3px)',
      }}
    >
      <div
        className="max-w-[280px] text-center"
        style={{
          padding: '34px 30px',
          background: 'var(--elevated)',
          borderRadius: 'var(--r-2xl)',
          animation:
            'os-cel-in var(--dur-slow) var(--ease-spring), os-cel-glow 2s var(--ease-in-out) infinite',
        }}
      >
        <div
          className="inline-flex items-center gap-[7px] rounded-[var(--r-pill)] px-[14px] py-[7px] text-[12px] font-bold"
          style={{
            background: 'var(--pr)',
            color: 'var(--accent-ink)',
            letterSpacing: '0.06em',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M13 2L4 14h7l-1 8 9-12h-7z" fill="currentColor" />
          </svg>
          {badgeLabel(kinds)}
        </div>

        {e1rmDisplay != null && (
          <div className="mt-[18px] flex items-baseline justify-center gap-2">
            <span
              className="font-bold"
              style={{
                fontSize: 'var(--num-lg)',
                letterSpacing: 'var(--tracking-tight)',
                ...numFont,
              }}
            >
              {e1rmDisplay}
            </span>
            <span className="text-[18px] font-semibold text-muted">{units}</span>
          </div>
        )}

        <div className="mt-[6px] text-[13px] text-muted">
          {e1rmDisplay != null
            ? 'A new estimated one-rep max.'
            : 'You beat your previous best.'}
        </div>

        <button
          onClick={onDismiss}
          className="mt-[22px] h-12 w-full rounded-[var(--r-md)] text-[14px] font-bold"
          style={{ background: 'var(--accent)', color: 'var(--accent-ink)' }}
        >
          Keep going
        </button>
      </div>
    </div>
  );
}

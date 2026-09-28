/* The record screen: full-bleed gold, the number that was just set, one way out.
   Presentational; reads only the kg/lb setting for display. */

import { useSettings } from '../../db/hooks';
import { fmtWeight, roundDisplay, toUnit } from '../../lib/units';

type PrKind = 'weight' | 'reps' | 'e1rm';

export function PrCelebration({
  kinds,
  e1rm,
  exerciseName,
  weightLb,
  reps,
  previousBestE1rm,
  onDismiss,
}: {
  kinds: PrKind[];
  e1rm?: number | null;
  exerciseName?: string;
  weightLb?: number;
  reps?: number;
  previousBestE1rm?: number | null;
  onDismiss: () => void;
}) {
  const { units } = useSettings();
  const e1rmDisplay =
    e1rm != null ? roundDisplay(toUnit(e1rm, units), units) : null;
  const prevDisplay =
    previousBestE1rm != null
      ? roundDisplay(toUnit(previousBestE1rm, units), units)
      : null;
  // A rep record on a lift with no eligible e1RM (very high reps, bodyweight) shows the
  // reps as the number instead.
  const weightRecord =
    e1rmDisplay == null &&
    kinds.includes('weight') &&
    weightLb !== undefined &&
    weightLb > 0;
  const numeral =
    e1rmDisplay ?? (weightRecord ? fmtWeight(weightLb, units) : (reps ?? ''));
  const what =
    e1rmDisplay != null
      ? `e1RM ${units}`
      : weightRecord
        ? `heaviest, ${units}`
        : kinds.includes('reps')
          ? 'rep record'
          : 'record';
  const setLine =
    weightLb !== undefined && reps !== undefined
      ? `${weightLb > 0 ? fmtWeight(weightLb, units) : 'BW'} × ${reps}`
      : null;
  // The previous best is an e1RM, so it only makes sense next to an e1RM numeral.
  const detail = [
    setLine,
    e1rmDisplay != null && prevDisplay != null
      ? `previous best ${prevDisplay}`
      : null,
    e1rmDisplay == null &&
    !weightRecord &&
    kinds.includes('reps') &&
    weightLb !== undefined
      ? `most reps at ${weightLb > 0 ? fmtWeight(weightLb, units) : 'bodyweight'}`
      : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="New record"
      className="os-gold absolute inset-0 z-50 flex flex-col items-center justify-center px-6 text-center"
    >
      <div
        className="text-[13px] font-extrabold uppercase"
        style={{ letterSpacing: '.08em', opacity: 0.75 }}
      >
        New record
      </div>
      <div
        className="os-num os-pr-pulse mt-1.5"
        style={{
          fontSize: String(numeral).length > 3 ? 120 : 150,
          letterSpacing: '-.06em',
          textShadow: '0 12px 30px rgba(120,80,0,.25)',
        }}
      >
        {numeral}
      </div>
      <div
        className="mt-0.5 text-[22px] font-extrabold"
        style={{ letterSpacing: '-.03em' }}
      >
        {exerciseName ? `${exerciseName} · ${what}` : what}
      </div>
      {detail && (
        <div
          className="mt-3 text-[14px] font-semibold"
          style={{ opacity: 0.75, fontVariantNumeric: 'tabular-nums' }}
        >
          {detail}
        </div>
      )}
      <button
        type="button"
        onClick={onDismiss}
        className="os-press mt-10 flex h-[54px] items-center rounded-[18px] px-[26px] text-[15px] font-extrabold"
        style={{
          background: 'rgba(26,18,4,.92)',
          color: '#ffe7a8',
          boxShadow: '0 12px 30px -10px rgba(60,40,0,.6)',
        }}
      >
        Keep going
      </button>
    </div>
  );
}

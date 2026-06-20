/* ============================================================================
   OpenSets — SetRow (React + TypeScript)
   ----------------------------------------------------------------------------
   The single most important component in the app: one row of a working set.
   It renders five states. Two visual templates (data-ds) restyle it for free
   via tokens — this component never branches on ds.

     prescribed : not yet attempted. Muted weight × reps, target reps shown.
     active     : the set being performed now. Accent-bordered "hero" card with
                  the editable weight/reps steppers + RPE + Log button.
     done       : completed at/above target. Solid text, check, ✓.
     failed     : completed below target reps. Danger hairline + value muted.
     amrap      : As-Many-Reps-As-Possible — same as active but reps is open;
                  on completion it shows a PR badge when a record is hit.

   All colors are tokens, so the row re-themes live and matches whichever
   data-ds / data-theme / data-mode is set on an ancestor.
   ========================================================================== */

import React from 'react';
import { Button, NumberStepper } from './primitives';

export type SetState = 'prescribed' | 'active' | 'done' | 'failed' | 'amrap';

export interface SetData {
  index: number;          // 1-based set number
  weight: number;         // kg (or lb — unit is display-only here)
  reps: number;           // performed (done/failed) or current (active/amrap)
  targetReps: number;     // prescription
  rpe?: number;           // logged effort (done) or selected (active)
  isPR?: boolean;         // only meaningful when done/amrap
}

export interface SetRowProps {
  state: SetState;
  data: SetData;
  unit?: string;          // 'kg' | 'lb'
  // active / amrap handlers
  onWeight?: (v: number) => void;
  onReps?: (v: number) => void;
  onRpe?: (v: number) => void;
  onLog?: () => void;
}

const num: React.CSSProperties = {
  fontFamily: 'var(--font-num)', fontWeight: 'var(--num-weight)' as any, fontVariantNumeric: 'tabular-nums',
};
const capsLabel: React.CSSProperties = {
  fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: 'var(--font-label)',
};

/* ------------------------------------------------------- static row body --- */

function StaticRow({
  data, unit, tone, borderColor, badge,
}: {
  data: SetData; unit: string;
  tone: string;                 // value color
  borderColor: string;
  badge?: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: 14, padding: '11px 16px',
        background: 'var(--surface)', border: `1px solid ${borderColor}`, borderRadius: 'var(--r-md)',
      }}
    >
      <span style={{ fontSize: 13, color: 'var(--faint)', width: 14, fontFamily: 'var(--font-num)' }}>{data.index}</span>
      <span style={{ fontSize: 17, color: tone, ...num }}>
        {data.weight}
        <span style={{ fontSize: 12, color: 'var(--faint)', margin: '0 4px' }}>{unit} ×</span>
        {data.reps}
      </span>
      {badge}
    </div>
  );
}

/* ----------------------------------------------------------------- view --- */

export function SetRow({ state, data, unit = 'kg', onWeight, onReps, onRpe, onLog }: SetRowProps) {
  switch (state) {
    case 'prescribed':
      return (
        <StaticRow
          data={data}
          unit={unit}
          tone="var(--muted)"
          borderColor="var(--border-card, transparent)"
          badge={
            <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--faint)' }}>
              target {data.targetReps}
            </span>
          }
        />
      );

    case 'done':
      return (
        <StaticRow
          data={data}
          unit={unit}
          tone="var(--text)"
          borderColor="var(--border-card, transparent)"
          badge={
            <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
              {data.isPR && (
                <span style={{ ...capsLabel, fontSize: 10, color: 'var(--pr)', border: '1px solid color-mix(in oklab, var(--pr) 40%, transparent)', borderRadius: 'var(--r-sm)', padding: '3px 7px' }}>
                  PR
                </span>
              )}
              <CheckIcon />
            </span>
          }
        />
      );

    case 'failed':
      return (
        <StaticRow
          data={data}
          unit={unit}
          tone="var(--muted)"
          borderColor="color-mix(in oklab, var(--danger) 28%, var(--border-card))"
          badge={
            <span style={{ marginLeft: 'auto', ...capsLabel, fontSize: 10, color: 'var(--danger)' }}>
              {data.reps}/{data.targetReps}
            </span>
          }
        />
      );

    case 'active':
    case 'amrap':
      return <ActiveSet state={state} data={data} unit={unit} onWeight={onWeight} onReps={onReps} onRpe={onRpe} onLog={onLog} />;
  }
}

/* ---------------------------------------------- active / amrap hero card --- */

function ActiveSet({ state, data, unit, onWeight, onReps, onRpe, onLog }: SetRowProps) {
  const amrap = state === 'amrap';
  return (
    <div
      style={{
        border: '1.5px solid var(--accent)', borderRadius: 'var(--r-lg)', background: 'var(--surface)',
        padding: '16px 16px 18px', boxShadow: '0 0 0 4px color-mix(in oklab, var(--accent) 7%, transparent)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ ...capsLabel, color: 'var(--accent)' }}>Set {data.index} · Now</span>
        <span style={{ ...capsLabel, fontSize: 10, color: 'var(--muted)', background: 'color-mix(in oklab, var(--accent) 10%, transparent)', padding: '4px 8px', borderRadius: 'var(--r-sm)' }}>
          {amrap ? 'AMRAP' : `target ${data.targetReps}`}
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'stretch', gap: 10 }}>
        <div style={{ flex: 1 }}>
          <div style={{ ...capsLabel, fontSize: 10, color: 'var(--muted)', marginBottom: 6 }}>Weight</div>
          <NumberStepper value={data.weight} onChange={(v) => onWeight?.(v)} step={2.5} unit={unit} decimals={1} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ ...capsLabel, fontSize: 10, color: 'var(--muted)', marginBottom: 6 }}>Reps{amrap ? ' (max)' : ''}</div>
          <NumberStepper value={data.reps} onChange={(v) => onReps?.(v)} step={1} />
        </div>
      </div>

      {/* RPE */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14 }}>
        <span style={{ ...capsLabel, fontSize: 10, color: 'var(--muted)' }}>RPE</span>
        {[7, 8, 9].map((n) => {
          const sel = data.rpe === n;
          return (
            <span
              key={n}
              onClick={() => onRpe?.(n)}
              style={{
                fontSize: 12, padding: '6px 11px', borderRadius: 'var(--r-sm)', cursor: 'pointer', fontFamily: 'var(--font-num)',
                background: sel ? 'var(--accent)' : 'var(--bg)', color: sel ? 'var(--accent-ink)' : 'var(--muted)', fontWeight: sel ? 700 : 400,
              }}
            >
              {n}
            </span>
          );
        })}
        <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--faint)' }}>optional</span>
      </div>

      <Button full size="lg" onClick={onLog} style={{ marginTop: 16 }} leftIcon={<CheckIcon ink />}>
        Log Set {data.index} · <span style={{ ...num }}>{data.weight} × {data.reps}</span>
      </Button>
    </div>
  );
}

/* ------------------------------------------------------------------ icon --- */

function CheckIcon({ ink }: { ink?: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
      <path d="M4 10.5L8 14.5L16 5.5" stroke={ink ? 'var(--accent-ink)' : 'var(--accent)'} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

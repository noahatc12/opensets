import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { newId } from '../../db/ids';
import type { Measurement } from '../../db/types';
import { ChevronLeftIcon } from '../../components/icons';

/* Ported from the Tempo prototype Measurements screen (showMeasurements): a back
   header + stat cards (Bodyweight / Waist) + a recent-measurements list and a
   "Log measurement" affordance. The prototype's stat numbers and the progress-
   photos block are mock; we render the layout faithfully but only show honest
   data — stat cards read the latest stored value for their type (or "—" when
   none logged), and we drop the mock photo-compare block (progress photos are a
   separate, unimplemented store) rather than fabricating filled-in placeholders. */

const numFont = {
  fontFamily: 'var(--font-num)',
  fontWeight: 'var(--num-weight)' as unknown as number,
  fontVariantNumeric: 'tabular-nums' as const,
};

const capsLabel = {
  fontFamily: 'var(--font-label)',
  letterSpacing: 'var(--tracking-caps)',
};

const nowIso = () => new Date().toISOString();
const today = () => nowIso().slice(0, 10);

/** Bodyweight stores a weight (kg); every other type stores a length (cm). */
const isWeight = (type: string) => type === 'bodyweight';
const unitFor = (type: string) => (isWeight(type) ? 'kg' : 'cm');
const valueOf = (m: Measurement) => (isWeight(m.type) ? m.valueKg : m.valueCm);

const MEASUREMENT_TYPES: { value: string; label: string }[] = [
  { value: 'bodyweight', label: 'Bodyweight' },
  { value: 'waist', label: 'Waist' },
  { value: 'chest', label: 'Chest' },
  { value: 'hips', label: 'Hips' },
  { value: 'thigh', label: 'Thigh' },
  { value: 'arm', label: 'Arm' },
  { value: 'neck', label: 'Neck' },
  { value: 'calf', label: 'Calf' },
];

const typeLabel = (type: string) =>
  MEASUREMENT_TYPES.find((t) => t.value === type)?.label ?? type;

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function StatCard({ label, value, unit }: { label: string; value?: number; unit: string }) {
  return (
    <div
      className="flex-1 rounded-[var(--r-md)] border p-4"
      style={{ background: 'var(--surface)', borderColor: 'var(--border-card)' }}
    >
      <div className="text-[11px] text-muted">{label}</div>
      <div className="mt-1 text-[22px] font-semibold text-text" style={numFont}>
        {value !== undefined ? value : '—'}
        {value !== undefined && <span className="text-[12px] text-muted">{unit}</span>}
      </div>
      <div className="mt-1 text-[11px] text-faint">
        {value !== undefined ? 'latest' : 'not logged'}
      </div>
    </div>
  );
}

function MeasurementRow({ m }: { m: Measurement }) {
  const v = valueOf(m);
  return (
    <div
      className="flex items-center justify-between rounded-[var(--r-md)] border px-4 py-3"
      style={{ background: 'var(--surface)', borderColor: 'var(--border-card)' }}
    >
      <div className="flex flex-col">
        <span className="text-[14px] font-semibold text-text">{typeLabel(m.type)}</span>
        <span className="text-[11px] text-faint" style={{ fontFamily: 'var(--font-num)' }}>
          {fmtDate(m.date)}
        </span>
      </div>
      <span className="text-[15px] text-text" style={numFont}>
        {v !== undefined ? v : '—'}
        <span className="text-[12px] text-muted">{unitFor(m.type)}</span>
      </span>
    </div>
  );
}

function LogMeasurementSheet({ onClose }: { onClose: () => void }) {
  const [type, setType] = useState<string>('bodyweight');
  const [value, setValue] = useState('');
  const [date, setDate] = useState(today());

  const unit = unitFor(type);
  const valueNum = Number(value);
  const valid = value.trim() !== '' && Number.isFinite(valueNum) && valueNum > 0 && date !== '';

  async function save() {
    if (!valid) return;
    const m: Measurement = {
      id: newId(),
      type,
      date: nowIso(),
      ...(isWeight(type) ? { valueKg: valueNum } : { valueCm: valueNum }),
    };
    await db.measurements.add(m);
    onClose();
  }

  return (
    <div
      className="absolute inset-0 z-10 flex flex-col justify-end"
      style={{ background: 'color-mix(in oklab, var(--bg) 55%, transparent)' }}
      onClick={onClose}
    >
      <div
        className="rounded-t-[var(--r-xl)] border-t px-[22px] pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4"
        style={{ background: 'var(--surface)', borderColor: 'var(--border-card)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-3.5 h-1 w-9 rounded-full" style={{ background: 'var(--border-strong)' }} />
        <div className="mb-3.5 text-[17px] font-bold text-text" style={{ letterSpacing: 'var(--tracking-snug)' }}>
          Log measurement
        </div>

        <label className="mb-1.5 block text-[11px] font-bold uppercase text-faint" style={capsLabel}>
          Type
        </label>
        <div className="mb-4 flex flex-wrap gap-1.5">
          {MEASUREMENT_TYPES.map((t) => {
            const active = type === t.value;
            return (
              <button
                key={t.value}
                onClick={() => setType(t.value)}
                className="rounded-[var(--r-pill)] px-3 py-1.5 text-[12px] font-semibold"
                style={{
                  background: active ? 'var(--accent)' : 'var(--bg)',
                  color: active ? 'var(--accent-ink)' : 'var(--muted)',
                }}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        <label className="mb-1.5 block text-[11px] font-bold uppercase text-faint" style={capsLabel}>
          Value ({unit})
        </label>
        <input
          type="number"
          inputMode="decimal"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="0"
          className="mb-4 w-full rounded-[var(--r-md)] border px-3.5 py-3 text-[15px] text-text outline-none"
          style={{ ...numFont, background: 'var(--bg)', borderColor: 'var(--border-card)' }}
        />

        <label className="mb-1.5 block text-[11px] font-bold uppercase text-faint" style={capsLabel}>
          Date
        </label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="mb-5 w-full rounded-[var(--r-md)] border px-3.5 py-3 text-[15px] text-text outline-none"
          style={{ ...numFont, background: 'var(--bg)', borderColor: 'var(--border-card)' }}
        />

        <button
          onClick={() => void save()}
          disabled={!valid}
          className="h-12 w-full rounded-[var(--r-md)] text-[14px] font-bold"
          style={{
            background: valid ? 'var(--accent)' : 'var(--surface-2)',
            color: valid ? 'var(--accent-ink)' : 'var(--faint)',
          }}
        >
          Save measurement
        </button>
      </div>
    </div>
  );
}

export function MeasurementsScreen() {
  const navigate = useNavigate();
  const measurements = useLiveQuery(() => db.measurements.toArray());
  const [logging, setLogging] = useState(false);

  const recent = [...(measurements ?? [])].sort((a, b) => b.date.localeCompare(a.date));
  const latestOf = (type: string) => recent.find((m) => m.type === type);
  const bodyweight = latestOf('bodyweight');
  const waist = latestOf('waist');

  return (
    <div className="relative flex h-full flex-col">
      <div className="flex items-center gap-2.5 px-[18px] pb-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
        <button
          onClick={() => navigate('/settings')}
          className="grid size-10 place-items-center bg-transparent text-muted"
          aria-label="Back"
        >
          <ChevronLeftIcon className="size-[22px]" />
        </button>
        <div
          className="text-[20px] font-bold text-text"
          style={{ letterSpacing: 'var(--tracking-snug)' }}
        >
          Measurements
        </div>
      </div>

      <div className="os-scroll flex-1 overflow-auto px-[22px] pb-7 pt-1.5">
        <div className="flex gap-2.5">
          <StatCard label="Bodyweight" value={bodyweight?.valueKg} unit="kg" />
          <StatCard label="Waist" value={waist?.valueCm} unit="cm" />
        </div>

        <div
          className="mx-1 mb-2.5 mt-[22px] text-[11px] font-bold uppercase text-faint"
          style={capsLabel}
        >
          Recent
        </div>
        {recent.length > 0 ? (
          <div className="flex flex-col gap-2">
            {recent.map((m) => (
              <MeasurementRow key={m.id} m={m} />
            ))}
          </div>
        ) : (
          <p className="mt-6 text-center text-[12.5px] leading-snug text-faint">
            No measurements yet. Log your bodyweight or a tape measurement to track change over time.
          </p>
        )}

        <button
          onClick={() => setLogging(true)}
          className="mt-4 h-12 w-full rounded-[var(--r-md)] text-[14px] font-bold"
          style={{ background: 'var(--accent)', color: 'var(--accent-ink)' }}
        >
          Log measurement
        </button>
      </div>

      {logging && <LogMeasurementSheet onClose={() => setLogging(false)} />}
    </div>
  );
}

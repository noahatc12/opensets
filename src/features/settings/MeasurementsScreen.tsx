import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { newId } from '../../db/ids';
import type { Measurement, ProgressPhoto } from '../../db/types';
import { ChevronLeftIcon } from '../../components/icons';
import { useSettings } from '../../db/hooks';
import { fmtWeight, kgToLb, toUnit } from '../../lib/units';
import type { WeightUnit } from '../../lib/units';

/* Ported from the Tempo prototype Measurements screen (showMeasurements): a back
   header + stat cards (Bodyweight / Waist) + a PROGRESS PHOTOS row + a recent-
   measurements list and a "Log measurement" affordance. Stat cards read the
   latest stored value for their type and a delta vs ~4 weeks earlier; progress
   photos are stored as real Blobs in db.photos. */

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

/** Bodyweight stores a weight (lb); every other type stores a length (inches). */
const isWeight = (type: string) => type === 'bodyweight';
/** Unit label for a type: weight follows the kg/lb setting; lengths are always inches. */
const unitFor = (type: string, units: WeightUnit) => (isWeight(type) ? units : 'in');
/** Raw stored value (canonical lb for weight, inches otherwise). */
const valueOf = (m: Measurement) => (isWeight(m.type) ? m.valueLb : m.valueIn);
/** Display string for a measurement value: weight converts to the user's unit, lengths render as-is. */
const displayValue = (m: Measurement, units: WeightUnit): string | undefined => {
  const v = valueOf(m);
  if (v === undefined) return undefined;
  return isWeight(m.type) ? fmtWeight(v, units) : String(v);
};

/** ~4 weeks in milliseconds — the comparison window the prototype labels "/ 4wk". */
const FOUR_WEEKS_MS = 28 * 24 * 60 * 60 * 1000;

/** A stat card's value + an optional change vs the entry nearest ~4 weeks earlier.
 *  Values are returned in display units (weight converted; lengths as-is). */
interface Stat {
  value: number;
  /** Signed change vs ~4wk ago, in display units; undefined when no prior entry. */
  delta?: number;
}

/** Build the stat for a measurement type from its full (date-sorted) history.
 *  `rows` must be newest-first. Returns undefined when nothing is logged. */
function statFor(
  rows: Measurement[],
  type: string,
  units: WeightUnit,
): Stat | undefined {
  const series = rows.filter((m) => m.type === type);
  const latest = series[0];
  if (!latest) return undefined;
  const raw = valueOf(latest);
  if (raw === undefined) return undefined;
  const conv = (v: number) => (isWeight(type) ? toUnit(v, units) : v);
  const value = conv(raw);

  // Pick the prior entry closest to ~4 weeks before the latest one.
  const latestMs = new Date(latest.date).getTime();
  let prior: Measurement | undefined;
  let bestGap = Infinity;
  for (const m of series.slice(1)) {
    const v = valueOf(m);
    if (v === undefined) continue;
    const ageMs = latestMs - new Date(m.date).getTime();
    if (ageMs <= 0) continue;
    const gap = Math.abs(ageMs - FOUR_WEEKS_MS);
    if (gap < bestGap) {
      bestGap = gap;
      prior = m;
    }
  }
  const priorRaw = prior ? valueOf(prior) : undefined;
  if (priorRaw === undefined) return { value };
  return { value, delta: value - conv(priorRaw) };
}

/** Round a stat number for display: weight to 1 decimal, lengths to whole. */
const fmtStat = (n: number, type: string): string =>
  isWeight(type) ? String(Math.round(n * 10) / 10) : String(Math.round(n));

/** Signed, rounded delta string, e.g. "+0.6" / "−1". */
function fmtDelta(delta: number, type: string): string {
  const r = isWeight(type) ? Math.round(delta * 10) / 10 : Math.round(delta);
  const sign = r > 0 ? '+' : r < 0 ? '−' : '';
  return `${sign}${Math.abs(r)}`;
}

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

function StatCard({
  label,
  stat,
  type,
  unit,
}: {
  label: string;
  stat?: Stat;
  type: string;
  unit: string;
}) {
  const delta = stat?.delta;
  // Positive change on bodyweight reads as a gain (success); on a measurement it's neutral.
  const deltaColor =
    delta === undefined
      ? 'var(--muted)'
      : delta > 0 && isWeight(type)
        ? 'var(--success)'
        : 'var(--muted)';
  return (
    <div
      className="flex-1 rounded-[var(--r-md)] border p-4"
      style={{ background: 'var(--surface)', borderColor: 'var(--border-card)' }}
    >
      <div className="text-[11px] text-muted">{label}</div>
      <div className="mt-1 text-[22px] font-semibold text-text" style={numFont}>
        {stat !== undefined ? fmtStat(stat.value, type) : '—'}
        {stat !== undefined && <span className="text-[12px] text-muted">{unit}</span>}
      </div>
      <div className="mt-1 text-[11px]" style={{ color: deltaColor }}>
        {stat === undefined
          ? 'not logged'
          : delta !== undefined
            ? `${fmtDelta(delta, type)} / 4wk`
            : 'latest'}
      </div>
    </div>
  );
}

/** Camera icon ported from the prototype's progress-photo tile (lines 571/575). */
function CameraIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="8.5" cy="10" r="1.5" fill="currentColor" />
      <path
        d="M5 17l4.5-4 3 2.5L17 11l2 2"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Resolve a measurement type's latest value (display units) for a photo caption. */
function captionWeight(rows: Measurement[], units: WeightUnit): string | undefined {
  const bw = rows.find((m) => m.type === 'bodyweight');
  if (!bw || bw.valueLb === undefined) return undefined;
  return `${fmtWeight(bw.valueLb, units)} ${units}`;
}

/** A single empty "Add photo" tile that opens a file picker and stores the Blob. */
function AddPhotoTile() {
  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const photo: ProgressPhoto = {
      id: newId(),
      date: nowIso(),
      blob: file,
    };
    await db.photos.add(photo);
  }
  return (
    <label
      className="flex aspect-[3/4] cursor-pointer flex-col items-center justify-center gap-1.5 rounded-[var(--r-md)] border border-dashed text-faint"
      style={{ background: 'var(--surface)', borderColor: 'var(--border-strong)' }}
    >
      <CameraIcon />
      <span className="text-[10px]">Add photo</span>
      <input
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => void onPick(e)}
      />
    </label>
  );
}

/** A stored progress photo rendered from its Blob, with date + bodyweight caption.
 *  Owns the object URL and revokes it on unmount / blob change to avoid leaks. */
function PhotoTile({ photo, caption }: { photo: ProgressPhoto; caption?: string }) {
  const [url, setUrl] = useState<string | undefined>();
  const blob = photo.blob;
  useEffect(() => {
    if (!blob) return;
    // Creating an object URL syncs React to an external resource (the object-URL
    // table) that we own and must revoke on cleanup — a valid effect; the
    // set-state-in-effect heuristic over-fires here. Mirrors usePersistentStorage.
    const objUrl = URL.createObjectURL(blob);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUrl(objUrl);
    return () => URL.revokeObjectURL(objUrl);
  }, [blob]);

  return (
    <div className="flex-1">
      <div
        className="aspect-[3/4] overflow-hidden rounded-[var(--r-md)] border"
        style={{ background: 'var(--surface)', borderColor: 'var(--border-card)' }}
      >
        {url !== undefined && (
          <img src={url} alt="Progress photo" className="size-full object-cover" />
        )}
      </div>
      <div
        className="mt-1.5 text-center text-[11px] text-muted"
        style={{ fontFamily: 'var(--font-num)' }}
      >
        {fmtDate(photo.date)}
        {caption !== undefined ? ` · ${caption}` : ''}
      </div>
    </div>
  );
}

/** The PROGRESS PHOTOS row: newest photos first, padded with an Add tile so the
 *  two-tile row stays full (prototype shows two 3:4 tiles). */
function ProgressPhotos({ caption }: { caption?: string }) {
  const photos = useLiveQuery(() =>
    db.photos.orderBy('date').reverse().toArray(),
  );
  const list = photos ?? [];
  // The prototype's row holds two tiles. Show the newest photos, then fill the
  // remainder with Add tiles (always at least one Add affordance).
  const ROW = 2;
  const shown = list.slice(0, ROW);
  const addTiles = Math.max(ROW - shown.length, shown.length >= ROW ? 1 : 0);

  return (
    <>
      <div
        className="mx-1 mb-2.5 mt-[22px] text-[11px] font-bold uppercase text-faint"
        style={capsLabel}
      >
        Progress photos
      </div>
      <div className="flex gap-2.5">
        {shown.map((p) => (
          <PhotoTile key={p.id} photo={p} caption={caption} />
        ))}
        {Array.from({ length: addTiles }).map((_, i) => (
          <div key={`add-${i}`} className="flex-1">
            <AddPhotoTile />
          </div>
        ))}
      </div>
    </>
  );
}

function MeasurementRow({ m, units }: { m: Measurement; units: WeightUnit }) {
  const display = displayValue(m, units);
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
        {display !== undefined ? display : '—'}
        <span className="text-[12px] text-muted">{unitFor(m.type, units)}</span>
      </span>
    </div>
  );
}

function LogMeasurementSheet({ onClose, units }: { onClose: () => void; units: WeightUnit }) {
  const [type, setType] = useState<string>('bodyweight');
  const [value, setValue] = useState('');
  const [date, setDate] = useState(today());

  const unit = unitFor(type, units);
  const valueNum = Number(value);
  const valid = value.trim() !== '' && Number.isFinite(valueNum) && valueNum > 0 && date !== '';

  async function save() {
    if (!valid) return;
    // Bodyweight is entered in the user's unit but stored canonical lb; lengths store inches as-is.
    const storedWeightLb = units === 'kg' ? kgToLb(valueNum) : valueNum;
    const m: Measurement = {
      id: newId(),
      type,
      date: nowIso(),
      ...(isWeight(type) ? { valueLb: storedWeightLb } : { valueIn: valueNum }),
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
  const { units } = useSettings();
  const measurements = useLiveQuery(() => db.measurements.toArray());
  const [logging, setLogging] = useState(false);

  const recent = [...(measurements ?? [])].sort((a, b) => b.date.localeCompare(a.date));
  const bodyweightStat = statFor(recent, 'bodyweight', units);
  const waistStat = statFor(recent, 'waist', units);
  const photoCaption = captionWeight(recent, units);

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
          <StatCard label="Bodyweight" stat={bodyweightStat} type="bodyweight" unit={units} />
          <StatCard label="Waist" stat={waistStat} type="waist" unit="in" />
        </div>

        <ProgressPhotos caption={photoCaption} />

        <div
          className="mx-1 mb-2.5 mt-[22px] text-[11px] font-bold uppercase text-faint"
          style={capsLabel}
        >
          Recent
        </div>
        {recent.length > 0 ? (
          <div className="flex flex-col gap-2">
            {recent.map((m) => (
              <MeasurementRow key={m.id} m={m} units={units} />
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

      {logging && <LogMeasurementSheet onClose={() => setLogging(false)} units={units} />}
    </div>
  );
}

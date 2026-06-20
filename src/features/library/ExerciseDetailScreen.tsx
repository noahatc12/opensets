import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { useCatalog } from './useCatalog';
import { getCatalogExercise } from '../../db/catalog';
import { e1rm, isE1rmEligible } from '../../engine';
import type { Muscle, LoggedSet } from '../../db/types';

const titleCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const MUSCLE_LABELS: Partial<Record<Muscle, string>> = {
  lowerBack: 'Lower back',
  middleBack: 'Mid back',
};
const muscleLabel = (m: Muscle) => MUSCLE_LABELS[m] ?? titleCase(m);

const numFont = {
  fontFamily: 'var(--font-num)',
  fontWeight: 'var(--num-weight)' as unknown as number,
  fontVariantNumeric: 'tabular-nums' as const,
};

function Img({ src, label }: { src?: string; label: string }) {
  const [failed, setFailed] = useState(false);
  if (src && !failed) {
    return (
      <img
        src={src}
        alt=""
        onError={() => setFailed(true)}
        className="aspect-square flex-1 rounded-[var(--r-md)] object-cover"
        style={{ background: 'var(--surface)' }}
      />
    );
  }
  return (
    <div
      className="flex aspect-square flex-1 flex-col items-center justify-center gap-1.5 rounded-[var(--r-md)] text-faint"
      style={{ background: 'var(--surface)', border: '1px dashed var(--border-strong)' }}
    >
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
        <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="8.5" cy="10" r="1.5" fill="currentColor" />
        <path d="M5 17l4.5-4 3 2.5L17 11l2 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="text-[10px]">{label}</span>
    </div>
  );
}

function Engagement({ name, pct, primary }: { name: string; pct: number; primary?: boolean }) {
  return (
    <div>
      <div className="mb-1.5 flex justify-between text-[12.5px]">
        <span className="whitespace-nowrap font-medium text-text">
          {name}
          {primary && (
            <span className="ml-1 text-[9.5px] uppercase tracking-wide text-accent">
              Primary
            </span>
          )}
        </span>
        <span className="text-muted" style={numFont}>
          {pct}%
        </span>
      </div>
      <div className="h-[7px] overflow-hidden rounded-[5px]" style={{ background: 'var(--bg)' }}>
        <div
          className="h-full rounded-[5px]"
          style={{
            width: `${pct}%`,
            background: primary
              ? 'var(--accent)'
              : 'color-mix(in oklab, var(--accent) 60%, var(--surface-2))',
          }}
        />
      </div>
    </div>
  );
}

export function ExerciseDetailScreen() {
  const catalog = useCatalog();
  const navigate = useNavigate();
  const { id = '' } = useParams();
  const ex = catalog ? getCatalogExercise(decodeURIComponent(id)) : undefined;

  const sets = useLiveQuery(
    () =>
      ex
        ? db.sets.where('exerciseId').equals(ex.id).toArray()
        : Promise.resolve<LoggedSet[]>([]),
    [ex?.id],
  );

  const trend = useMemo(() => {
    const eligible = (sets ?? [])
      .filter((s) => !s.deletedAt)
      .filter((s) => isE1rmEligible(s))
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((s) => e1rm(s.weightKg, s.reps));
    return eligible;
  }, [sets]);

  if (catalog === null) {
    return <p className="p-8 text-center text-muted">Loading…</p>;
  }
  if (!ex) {
    return (
      <div className="p-8 text-center text-muted">
        <p>Exercise not found.</p>
        <button onClick={() => navigate('/library')} className="mt-4 text-accent">
          ‹ Back to library
        </button>
      </div>
    );
  }

  const latestE1rm = trend.length ? trend[trend.length - 1]! : null;
  const spark = (() => {
    if (trend.length < 2) return null;
    const min = Math.min(...trend),
      max = Math.max(...trend);
    const span = max - min || 1;
    const pts = trend
      .map((v, i) => {
        const x = 6 + (i / (trend.length - 1)) * 288;
        const y = 52 - ((v - min) / span) * 40;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
    const lastX = 6 + 288;
    const lastY = 52 - ((trend[trend.length - 1]! - min) / span) * 40;
    return { pts, lastX, lastY };
  })();

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2.5 px-[18px] pb-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
        <button
          onClick={() => navigate('/library')}
          className="size-10 bg-transparent text-[22px] text-muted"
          aria-label="Back"
        >
          ‹
        </button>
        <div
          className="text-[20px] font-bold text-text"
          style={{ letterSpacing: 'var(--tracking-snug)' }}
        >
          {ex.name}
        </div>
      </div>

      <div className="os-scroll flex-1 overflow-auto px-[22px] pb-8 pt-1.5">
        <div className="flex gap-2.5">
          <Img src={ex.images[0]} label="Start" />
          <Img src={ex.images[1]} label="End" />
        </div>

        <div className="mt-3.5 flex flex-wrap gap-1.5">
          {ex.primaryMuscles.map((m) => (
            <span
              key={m}
              className="rounded-[var(--r-pill)] px-[11px] py-[5px] text-[11px] font-semibold"
              style={{ background: 'var(--accent)', color: 'var(--accent-ink)' }}
            >
              {muscleLabel(m)}
            </span>
          ))}
          {ex.secondaryMuscles.map((m) => (
            <span
              key={m}
              className="rounded-[var(--r-pill)] px-[11px] py-[5px] text-[11px] text-muted"
              style={{ background: 'var(--surface)', border: '1px solid var(--border-card)' }}
            >
              {muscleLabel(m)}
            </span>
          ))}
        </div>

        {(ex.primaryMuscles.length > 0 || ex.secondaryMuscles.length > 0) && (
          <div
            className="mt-4 rounded-[var(--r-lg)] border p-[18px]"
            style={{ background: 'var(--surface)', borderColor: 'var(--border-card)' }}
          >
            <div className="mb-4 flex items-baseline justify-between">
              <span className="text-[13px] font-semibold text-text">Muscles worked</span>
              <span className="text-[10px] uppercase tracking-wide text-faint">
                Engagement
              </span>
            </div>
            <div className="flex flex-col gap-3.5">
              {ex.primaryMuscles.map((m) => (
                <Engagement key={m} name={muscleLabel(m)} pct={100} primary />
              ))}
              {ex.secondaryMuscles.map((m) => (
                <Engagement key={m} name={muscleLabel(m)} pct={50} />
              ))}
            </div>
          </div>
        )}

        <div
          className="mt-4 rounded-[var(--r-lg)] border p-4"
          style={{ background: 'var(--surface)', borderColor: 'var(--border-card)' }}
        >
          <div className="flex items-baseline justify-between">
            <span className="text-[12px] text-muted">Your e1RM</span>
            {latestE1rm ? (
              <span className="text-[20px] text-text" style={numFont}>
                {Math.round(latestE1rm * 10) / 10}{' '}
                <span className="text-[12px] text-muted">kg</span>
              </span>
            ) : (
              <span className="text-[12px] text-faint">no history yet</span>
            )}
          </div>
          {spark && (
            <svg width="100%" viewBox="0 0 300 60" className="mt-2.5 block">
              <polyline
                points={spark.pts}
                fill="none"
                stroke="var(--accent)"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle cx={spark.lastX} cy={spark.lastY} r="3.5" fill="var(--accent)" />
            </svg>
          )}
        </div>

        {ex.instructions.length > 0 && (
          <>
            <div className="mx-1 mb-2.5 mt-5 text-[11px] font-bold uppercase tracking-wide text-faint">
              How to
            </div>
            <div className="flex flex-col gap-3">
              {ex.instructions.map((step, i) => (
                <div key={i} className="flex gap-3">
                  <span
                    className="grid size-[22px] flex-none place-items-center rounded-[var(--r-pill)] text-[12px] font-bold text-text"
                    style={{ background: 'var(--surface-2)', ...numFont }}
                  >
                    {i + 1}
                  </span>
                  <span className="text-[13px] leading-[1.5] text-text">{step}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

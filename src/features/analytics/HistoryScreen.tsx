import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { useCatalog } from '../library/useCatalog';
import { getCatalogExercise } from '../../db/catalog';
import { e1rm, isE1rmEligible } from '../../engine';
import { EmptyState } from '../../components/EmptyState';
import { HistoryIcon } from '../../components/icons';
import type { LoggedSet } from '../../db/types';

const numFont = {
  fontFamily: 'var(--font-num)',
  fontWeight: 'var(--num-weight)' as unknown as number,
  fontVariantNumeric: 'tabular-nums' as const,
};
const titleCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Build an area-chart path (line + filled area) from a value series. */
function areaPaths(values: number[], w = 330, h = 140) {
  const pad = 10;
  const min = Math.min(...values),
    max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => {
    const x = pad + (i / Math.max(1, values.length - 1)) * (w - 2 * pad);
    const y = h - 26 - ((v - min) / span) * (h - 52);
    return [x, y] as const;
  });
  const line = pts
    .map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`)
    .join(' ');
  const area = `${line} L${pts[pts.length - 1]![0].toFixed(1)},${h - 12} L${pts[0]![0].toFixed(1)},${h - 12} Z`;
  return { line, area, last: pts[pts.length - 1]! };
}

export function HistoryScreen() {
  useCatalog();
  const navigate = useNavigate();
  const sets = useLiveQuery(() => db.sets.toArray());

  const live = useMemo(
    () => (sets ?? []).filter((s) => !s.deletedAt && s.completed),
    [sets],
  );

  const analytics = useMemo(() => {
    if (live.length === 0) return null;

    // Tonnage (working/amrap, loaded).
    const tonnage =
      live
        .filter((s) => s.type === 'working' || s.type === 'amrap')
        .reduce((t, s) => t + Math.max(0, s.weightKg) * s.reps, 0) / 1000;

    // Top-tracked exercise by eligible-set count → its e1RM trend.
    const byExercise = new Map<string, LoggedSet[]>();
    for (const s of live) {
      const arr = byExercise.get(s.exerciseId) ?? [];
      arr.push(s);
      byExercise.set(s.exerciseId, arr);
    }
    let topId = '';
    let topTrend: number[] = [];
    for (const [id, arr] of byExercise) {
      const trend = arr
        .filter((s) => isE1rmEligible(s))
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((s) => e1rm(s.weightKg, s.reps));
      if (trend.length > topTrend.length) {
        topTrend = trend;
        topId = id;
      }
    }
    const e1rmDelta =
      topTrend.length >= 2
        ? ((topTrend[topTrend.length - 1]! - topTrend[0]!) / topTrend[0]!) * 100
        : 0;

    // Weekly volume = hard sets per primary muscle.
    const muscleSets = new Map<string, number>();
    for (const s of live) {
      if (s.type !== 'working' && s.type !== 'amrap') continue;
      const m = getCatalogExercise(s.exerciseId)?.primaryMuscles[0];
      if (m) muscleSets.set(m, (muscleSets.get(m) ?? 0) + 1);
    }
    const volume = [...muscleSets.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4);

    // Intensity distribution by reps.
    const buckets = [0, 0, 0, 0]; // 1-5, 6-8, 9-12, 13+
    let counted = 0;
    for (const s of live) {
      if (s.type !== 'working' && s.type !== 'amrap') continue;
      counted++;
      if (s.reps <= 5) buckets[0]!++;
      else if (s.reps <= 8) buckets[1]!++;
      else if (s.reps <= 12) buckets[2]!++;
      else buckets[3]!++;
    }
    const intensity = buckets.map((b) => (counted ? Math.round((b / counted) * 100) : 0));

    return {
      tonnage,
      topId,
      topTrend,
      e1rmDelta,
      latestE1rm: topTrend[topTrend.length - 1] ?? null,
      volume,
      intensity,
      totalSets: live.length,
    };
  }, [live]);

  if (!analytics) {
    return (
      <div className="h-full overflow-auto px-[22px] pt-[max(1rem,env(safe-area-inset-top))]">
        <div className="text-[30px] font-bold text-text" style={{ letterSpacing: 'var(--tracking-tight)' }}>
          Trends
        </div>
        <EmptyState
          icon={<HistoryIcon />}
          title="No trends yet"
          body="Log a few workouts and your e1RM trend, tonnage, weekly volume, and intensity show up here."
          action={
            <button
              onClick={() => navigate('/today')}
              className="rounded-[var(--r-lg)] bg-accent px-5 py-3 text-[15px] font-bold text-accent-ink"
            >
              Start a workout
            </button>
          }
        />
      </div>
    );
  }

  const a = analytics;
  const chart = a.topTrend.length >= 2 ? areaPaths(a.topTrend) : null;
  const MAX_VOL = Math.max(20, ...a.volume.map(([, n]) => n));

  return (
    <div className="h-full overflow-auto px-[22px] pb-24 pt-[max(1rem,env(safe-area-inset-top))]">
      <div className="text-[30px] font-bold text-text" style={{ letterSpacing: 'var(--tracking-tight)' }}>
        Trends
      </div>

      {/* e1RM */}
      {chart && (
        <div className="mt-3.5 rounded-[var(--r-xl)] bg-surface p-5">
          <div className="text-[13px] text-muted">
            {getCatalogExercise(a.topId)?.name ?? 'Top lift'} · estimated 1RM
          </div>
          <div className="mt-2 flex items-baseline gap-2.5">
            <span className="text-text" style={{ fontSize: 'var(--num-md)', ...numFont }}>
              {Math.round((a.latestE1rm ?? 0) * 10) / 10}
            </span>
            <span className="text-[15px] text-muted">kg</span>
            {a.e1rmDelta !== 0 && (
              <span
                className="ml-auto text-[13px] font-semibold"
                style={{ color: a.e1rmDelta >= 0 ? 'var(--accent)' : 'var(--danger)' }}
              >
                {a.e1rmDelta >= 0 ? '+' : ''}
                {a.e1rmDelta.toFixed(1)}%
              </span>
            )}
          </div>
          <svg width="100%" viewBox="0 0 330 140" className="mt-3.5 block">
            <defs>
              <linearGradient id="osArea" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="var(--accent)" stopOpacity=".2" />
                <stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d={chart.area} fill="url(#osArea)" />
            <path d={chart.line} fill="none" stroke="var(--accent)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx={chart.last[0]} cy={chart.last[1]} r="4.5" fill="var(--accent)" />
          </svg>
        </div>
      )}

      {/* stats */}
      <div className="mt-3.5 flex gap-3">
        <div className="flex-1 rounded-[var(--r-lg)] bg-surface p-4">
          <div className="text-[11px] text-muted">Tonnage</div>
          <div className="mt-1 text-[22px] text-text" style={numFont}>
            {a.tonnage.toFixed(1)}
            <span className="text-[12px] text-muted"> t</span>
          </div>
        </div>
        <div className="flex-1 rounded-[var(--r-lg)] bg-surface p-4">
          <div className="text-[11px] text-muted">Sets logged</div>
          <div className="mt-1 text-[22px] text-accent" style={numFont}>
            {a.totalSets}
          </div>
        </div>
      </div>

      {/* weekly volume */}
      {a.volume.length > 0 && (
        <div className="mt-3.5 rounded-[var(--r-xl)] bg-surface p-5">
          <div className="mb-4 flex items-center justify-between">
            <span className="text-[13px] font-semibold text-text">Volume by muscle</span>
            <span className="text-[10px] text-faint">hard sets</span>
          </div>
          <div className="flex flex-col gap-[15px]">
            {a.volume.map(([m, n]) => (
              <div key={m}>
                <div className="mb-1.5 flex justify-between text-[12px]">
                  <span className="text-text">{titleCase(m)}</span>
                  <span className="text-muted" style={numFont}>
                    {n} sets
                  </span>
                </div>
                <div className="h-[7px] rounded-[5px]" style={{ background: 'var(--bg)' }}>
                  <div
                    className="h-full rounded-[5px]"
                    style={{
                      width: `${Math.min(100, (n / MAX_VOL) * 100)}%`,
                      background: n > 20 ? 'var(--warning)' : 'var(--accent)',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* intensity */}
      <div className="mt-3.5 rounded-[var(--r-xl)] bg-surface p-5">
        <div className="mb-3.5 text-[13px] font-semibold text-text">Intensity distribution</div>
        <div className="flex h-3 gap-0.5 overflow-hidden rounded-md">
          {a.intensity.map((pct, i) => (
            <div
              key={i}
              style={{
                width: `${pct}%`,
                background: [
                  'color-mix(in oklab, var(--accent) 35%, var(--surface-2))',
                  'var(--accent)',
                  'color-mix(in oklab, var(--accent) 62%, var(--surface-2))',
                  'var(--surface-2)',
                ][i],
              }}
            />
          ))}
        </div>
        <div className="mt-3 flex justify-between text-[11px] text-muted" style={{ fontFamily: 'var(--font-num)' }}>
          <span>1–5 · {a.intensity[0]}%</span>
          <span>6–8 · {a.intensity[1]}%</span>
          <span>9–12 · {a.intensity[2]}%</span>
          <span>13+ · {a.intensity[3]}%</span>
        </div>
      </div>
    </div>
  );
}

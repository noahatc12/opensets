import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { useThemeStore } from '../../state/theme';
import { useCatalog } from '../library/useCatalog';
import { getCatalogExercise } from '../../db/catalog';
import { e1rm, isE1rmEligible } from '../../engine';
import { weeklyVolumeByMuscle } from './weeklyVolume';
import { EmptyState } from '../../components/EmptyState';
import { HistoryIcon } from '../../components/icons';
import { useSettings } from '../../db/hooks';
import { toUnit, roundDisplay } from '../../lib/units';
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
  return { line, area, pts, last: pts[pts.length - 1]! };
}

/** e1RM series point carrying the date + PR flag (drives range filter, month axis, PR dot). */
type SeriesPoint = { date: string; value: number; isPR: boolean };

/** Range options for the analytics selector. ms windows anchored to the latest data point. */
const RANGE_MS: Record<'4W' | '3M' | '1Y', number> = {
  '4W': 28 * 86_400_000,
  '3M': 91 * 86_400_000,
  '1Y': 365 * 86_400_000,
};

/** Filter a date-sorted series to a range window anchored at its latest point ('All' = passthrough). */
function filterByRange(series: SeriesPoint[], range: '4W' | '3M' | '1Y' | 'All'): SeriesPoint[] {
  if (range === 'All' || series.length === 0) return series;
  const last = series[series.length - 1]!;
  const cutoff = new Date(last.date).getTime() - RANGE_MS[range];
  const out = series.filter((p) => new Date(p.date).getTime() >= cutoff);
  return out.length >= 2 ? out : series;
}

/**
 * Derive 4 distinct, evenly-spaced month labels (e.g. "Mar") spanning the series
 * date range. Steps by whole calendar months across the range so short windows
 * never collapse to duplicates ("May May Jun Jun"); evenly distributes 4 labels
 * across however many months the data actually covers.
 */
function monthTicks(series: SeriesPoint[]): string[] {
  if (series.length === 0) return [];
  const firstD = new Date(series[0]!.date);
  const lastD = new Date(series[series.length - 1]!.date);
  // Whole-month index (year*12 + month) so we count distinct calendar months.
  const firstM = firstD.getFullYear() * 12 + firstD.getMonth();
  const lastM = lastD.getFullYear() * 12 + lastD.getMonth();
  const totalMonths = lastM - firstM; // inclusive span = totalMonths + 1 months
  const n = 4;
  const fmt = (monthIndex: number) =>
    new Date(Math.floor(monthIndex / 12), monthIndex % 12, 1).toLocaleDateString('en-US', {
      month: 'short',
    });
  // Range covers <4 distinct months: emit one label per covered month (no dupes).
  if (totalMonths < n - 1) {
    const ticks: string[] = [];
    for (let m = firstM; m <= lastM; m++) ticks.push(fmt(m));
    return ticks;
  }
  // Range covers ≥4 months: 4 evenly-spaced, distinct month labels end-to-end.
  const ticks: string[] = [];
  for (let i = 0; i < n; i++) {
    const m = firstM + Math.round((totalMonths * i) / (n - 1));
    ticks.push(fmt(m));
  }
  return ticks;
}

/**
 * Build an instrument-style readout chart from a value series: straight-segment
 * polyline + filled area (the Readout layout draws the trend as a tabular
 * readout, not a smoothed curve). Matches prototype viewBox 330×150.
 */
function readoutPaths(values: number[], w = 330, h = 150) {
  const padX = 10;
  const top = 36; // baseline of the top hairline grid row
  const bottom = h - 12;
  const min = Math.min(...values),
    max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => {
    const x = padX + (i / Math.max(1, values.length - 1)) * (w - 2 * padX);
    const y = bottom - 16 - ((v - min) / span) * (bottom - 16 - top);
    return [x, y] as const;
  });
  const points = pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const last = pts[pts.length - 1]!;
  const first = pts[0]!;
  const area = `M${first[0].toFixed(1)},${first[1].toFixed(1)} ${pts
    .slice(1)
    .map(([x, y]) => `L${x.toFixed(1)},${y.toFixed(1)}`)
    .join(' ')} L${last[0].toFixed(1)},${bottom} L${first[0].toFixed(1)},${bottom} Z`;
  return { points, area, last };
}

export function HistoryScreen() {
  useCatalog();
  const navigate = useNavigate();
  const ds = useThemeStore((s) => s.selection.ds) ?? 'tempo';
  const { units } = useSettings();
  const sets = useLiveQuery(() => db.sets.toArray());
  const [range, setRange] = useState<'4W' | '3M' | '1Y' | 'All'>('3M');

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
        .reduce((t, s) => t + Math.max(0, s.weightLb) * s.reps, 0) / 1000;

    // Top-tracked exercise by eligible-set count → its e1RM trend.
    const byExercise = new Map<string, LoggedSet[]>();
    for (const s of live) {
      const arr = byExercise.get(s.exerciseId) ?? [];
      arr.push(s);
      byExercise.set(s.exerciseId, arr);
    }
    let topId = '';
    let topTrend: number[] = [];
    let topSeries: SeriesPoint[] = [];
    for (const [id, arr] of byExercise) {
      const eligible = arr
        .filter((s) => isE1rmEligible(s))
        .sort((a, b) => a.date.localeCompare(b.date));
      const trend = eligible.map((s) => e1rm(s.weightLb, s.reps));
      if (trend.length > topTrend.length) {
        topTrend = trend;
        topSeries = eligible.map((s) => ({
          date: s.date,
          value: e1rm(s.weightLb, s.reps),
          isPR: (s.isPR?.length ?? 0) > 0,
        }));
        topId = id;
      }
    }
    const e1rmDelta =
      topTrend.length >= 2
        ? ((topTrend[topTrend.length - 1]! - topTrend[0]!) / topTrend[0]!) * 100
        : 0;

    // Weekly hard-set volume per muscle (spec §242): rolling 7-day window,
    // primary 1.0 / secondary 0.5 weighting. See weeklyVolumeByMuscle.
    const volume = weeklyVolumeByMuscle(live, (id) => {
      const ex = getCatalogExercise(id);
      return ex ? { primary: ex.primaryMuscles, secondary: ex.secondaryMuscles } : undefined;
    });

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
      topSeries,
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
  const topName = getCatalogExercise(a.topId)?.name ?? 'Top lift';

  // ---- Tempo layout (existing) ---------------------------------------------
  function TempoBody() {
    const ranges = ['4W', '3M', '1Y', 'All'] as const;
    const series = filterByRange(a.topSeries, range);
    const values = series.map((p) => p.value);
    const chart = values.length >= 2 ? areaPaths(values) : null;
    const months = chart ? monthTicks(series) : [];
    // Latest PR point in the displayed range → its plotted coordinate for the PR marker.
    const prIdx = chart ? series.reduce((acc, p, i) => (p.isPR ? i : acc), -1) : -1;
    const prPt = chart && prIdx >= 0 ? chart.pts[prIdx] : undefined;
    const latest = values.length > 0 ? values[values.length - 1]! : (a.latestE1rm ?? 0);
    const delta =
      values.length >= 2 ? ((values[values.length - 1]! - values[0]!) / values[0]!) * 100 : 0;
    const MAX_VOL = Math.max(20, ...a.volume.map(([, n]) => n));
    return (
      <>
        <div className="text-[30px] font-bold text-text" style={{ letterSpacing: 'var(--tracking-tight)' }}>
          Trends
        </div>

        {/* range selector */}
        <div className="mt-4 flex gap-1">
          {ranges.map((r) => {
            const active = r === range;
            return (
              <button
                key={r}
                onClick={() => setRange(r)}
                className="h-9 flex-1 text-[13px]"
                style={{
                  border: 'none',
                  borderRadius: 'var(--r-sm)',
                  cursor: 'pointer',
                  background: active ? 'var(--accent)' : 'var(--surface)',
                  color: active ? 'var(--accent-ink)' : 'var(--muted)',
                  fontWeight: active ? 700 : 600,
                }}
              >
                {r}
              </button>
            );
          })}
        </div>

        {/* e1RM */}
        {chart && (
          <div className="mt-3.5 rounded-[var(--r-xl)] bg-surface p-5">
            <div className="text-[13px] text-muted">{topName} · estimated 1RM</div>
            <div className="mt-2 flex items-baseline gap-2.5">
              <span className="text-text" style={{ fontSize: 'var(--num-md)', ...numFont }}>
                {roundDisplay(toUnit(latest, units), units)}
              </span>
              <span className="text-[15px] text-muted">{units}</span>
              {delta !== 0 && (
                <span
                  className="ml-auto text-[13px] font-semibold"
                  style={{ color: delta >= 0 ? 'var(--accent)' : 'var(--danger)' }}
                >
                  {delta >= 0 ? '+' : ''}
                  {delta.toFixed(1)}%
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
              {prPt && (
                <circle cx={prPt[0]} cy={prPt[1]} r="4" fill="var(--bg)" stroke="var(--pr)" strokeWidth="2.2" />
              )}
              <circle cx={chart.last[0]} cy={chart.last[1]} r="4.5" fill="var(--accent)" />
            </svg>
            <div className="flex justify-between text-[10px] text-faint" style={{ padding: '0 2px' }}>
              {months.map((m, i) => (
                <span key={i}>{m}</span>
              ))}
            </div>
          </div>
        )}

        {/* stats */}
        <div className="mt-3.5 flex gap-3">
          <div className="flex-1 rounded-[var(--r-lg)] bg-surface p-4">
            <div className="text-[11px] text-muted">Tonnage</div>
            <div className="mt-1 text-[22px] text-text" style={numFont}>
              {units === 'lb'
                ? (toUnit(a.tonnage * 1000, 'lb') / 1000).toFixed(1)
                : a.tonnage.toFixed(1)}
              <span className="text-[12px] text-muted"> {units === 'lb' ? 'k lb' : 't'}</span>
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
              <span className="text-[10px] text-faint" style={{ whiteSpace: 'nowrap' }}>
                MEV · MAV · MRV
              </span>
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
                  <div className="relative h-[7px] rounded-[5px]" style={{ background: 'var(--bg)' }}>
                    <div
                      className="absolute inset-y-0 left-0 rounded-[5px]"
                      style={{
                        width: `${Math.min(100, (n / MAX_VOL) * 100)}%`,
                        background: n > 20 ? 'var(--warning)' : 'var(--accent)',
                      }}
                    />
                    {/* MEV / MRV threshold ticks (match prototype: 40% / 85%, 2px, border-strong) */}
                    <div className="absolute inset-y-0 w-0.5" style={{ left: '40%', background: 'var(--border-strong)' }} />
                    <div className="absolute inset-y-0 w-0.5" style={{ left: '85%', background: 'var(--border-strong)' }} />
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
      </>
    );
  }

  // ---- Readout layout (instrument-style port of prototype 422-505) ----------
  function ReadoutBody() {
    // Range-aware like TempoBody: filter the e1RM series to the selected window,
    // derive the chart + month axis + latest/delta from it (not the full trend).
    const series = filterByRange(a.topSeries, range);
    const values = series.map((p) => p.value);
    const chart = values.length >= 2 ? readoutPaths(values) : null;
    const months = chart ? monthTicks(series) : [];
    const latest = values.length > 0 ? values[values.length - 1]! : (a.latestE1rm ?? 0);
    const delta =
      values.length >= 2 ? ((values[values.length - 1]! - values[0]!) / values[0]!) * 100 : 0;
    const MAX_VOL = Math.max(20, ...a.volume.map(([, n]) => n));
    const capLabel = {
      fontSize: '10px',
      letterSpacing: '.14em',
      color: 'var(--muted)',
      fontFamily: 'var(--font-label)',
      textTransform: 'uppercase' as const,
    };
    const card = {
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--r-lg)',
    } as const;
    return (
      <>
        <div style={{ fontSize: '25px', fontWeight: 800, letterSpacing: 'var(--tracking-snug)' }} className="text-text">
          Analytics
        </div>

        {/* period selector (instrument segmented control — wired to range) */}
        <div
          className="mt-4 flex gap-1.5 p-1"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)' }}
        >
          {([['3M', '3M'], ['4W', '4W'], ['1Y', '1Y'], ['ALL', 'All']] as const).map(
            ([label, value]) => {
              const active = value === range;
              return (
                <button
                  key={value}
                  onClick={() => setRange(value)}
                  className="h-[34px] flex-1 text-[12px]"
                  style={{
                    border: 'none',
                    borderRadius: 'var(--r-sm)',
                    cursor: 'pointer',
                    fontFamily: 'var(--font-num)',
                    background: active ? 'var(--accent)' : 'transparent',
                    color: active ? 'var(--accent-ink)' : 'var(--muted)',
                    fontWeight: active ? 700 : 400,
                  }}
                >
                  {label}
                </button>
              );
            },
          )}
        </div>

        {/* e1RM card */}
        {chart && (
          <div className="mt-3.5" style={{ ...card, padding: '16px 16px 8px' }}>
            <div className="flex items-start justify-between">
              <div>
                <div style={capLabel}>{topName} · e1RM</div>
                <div className="mt-1.5 flex items-baseline gap-2">
                  <span style={{ fontSize: '34px', letterSpacing: 'var(--tracking-snug)', ...numFont }} className="text-text">
                    {roundDisplay(toUnit(latest, units), units)}
                  </span>
                  <span className="text-[13px] font-semibold text-muted">{units}</span>
                </div>
              </div>
              {delta !== 0 && (
                <span
                  className="text-[12px] font-bold"
                  style={{
                    color: delta >= 0 ? 'var(--accent)' : 'var(--danger)',
                    background:
                      delta >= 0
                        ? 'color-mix(in oklab, var(--accent) 12%, transparent)'
                        : 'color-mix(in oklab, var(--danger) 12%, transparent)',
                    padding: '4px 9px',
                    borderRadius: 'var(--r-sm)',
                    fontFamily: 'var(--font-num)',
                  }}
                >
                  {delta >= 0 ? '▲ ' : '▼ '}
                  {Math.abs(delta).toFixed(1)}%
                </span>
              )}
            </div>
            <svg width="100%" viewBox="0 0 330 150" className="mt-2 block">
              <line x1="10" y1="36" x2="320" y2="36" stroke="var(--text)" strokeOpacity=".05" />
              <line x1="10" y1="78" x2="320" y2="78" stroke="var(--text)" strokeOpacity=".05" />
              <line x1="10" y1="120" x2="320" y2="120" stroke="var(--text)" strokeOpacity=".05" />
              <defs>
                <linearGradient id="osReadArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="var(--accent)" stopOpacity=".22" />
                  <stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path d={chart.area} fill="url(#osReadArea)" />
              <polyline points={chart.points} fill="none" stroke="var(--accent)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx={chart.last[0]} cy={chart.last[1]} r="4" fill="var(--accent)" />
            </svg>
            <div
              className="flex justify-between"
              style={{ fontSize: '9.5px', color: 'var(--faint)', padding: '0 4px 4px', fontFamily: 'var(--font-label)' }}
            >
              {months.map((m, i) => (
                <span key={i}>{m.toUpperCase()}</span>
              ))}
            </div>
          </div>
        )}

        {/* stat row */}
        <div className="mt-3.5 flex gap-2.5">
          <div className="flex-1 p-3" style={{ ...card, borderRadius: 'var(--r-md)' }}>
            <div style={{ ...capLabel, fontSize: '9.5px', letterSpacing: '.1em' }}>Tonnage</div>
            <div className="mt-1.5 text-[22px] text-text" style={numFont}>
              {units === 'lb'
                ? (toUnit(a.tonnage * 1000, 'lb') / 1000).toFixed(1)
                : a.tonnage.toFixed(1)}
              <span className="text-[12px] text-muted">{units === 'lb' ? ' k lb' : 't'}</span>
            </div>
          </div>
          <div className="flex-1 p-3" style={{ ...card, borderRadius: 'var(--r-md)' }}>
            <div style={{ ...capLabel, fontSize: '9.5px', letterSpacing: '.1em' }}>Sets</div>
            <div className="mt-1.5 text-[22px] text-accent" style={numFont}>
              {a.totalSets}
            </div>
          </div>
        </div>

        {/* volume heatmap */}
        {a.volume.length > 0 && (
          <div className="mt-3.5" style={{ ...card, padding: '15px 16px' }}>
            <div className="mb-3.5 flex items-center justify-between">
              <span style={capLabel}>Weekly volume · sets</span>
              <span style={{ ...capLabel, fontSize: '9px', letterSpacing: '.06em', color: 'var(--faint)' }}>MEV·MAV·MRV</span>
            </div>
            <div className="flex flex-col gap-[13px]">
              {a.volume.map(([m, n]) => {
                const heavy = n > 20;
                const light = n < 10;
                return (
                  <div key={m}>
                    <div className="mb-1.5 flex justify-between text-[11.5px]">
                      <span className="text-text">{titleCase(m)}</span>
                      <span
                        style={{
                          fontFamily: 'var(--font-num)',
                          color: heavy ? 'var(--warning)' : light ? 'var(--muted)' : 'var(--accent)',
                        }}
                      >
                        {n}
                      </span>
                    </div>
                    <div className="relative h-2 rounded-[5px]" style={{ background: 'var(--bg)' }}>
                      <div
                        className="absolute inset-y-0 left-0 rounded-[5px]"
                        style={{
                          width: `${Math.min(100, (n / MAX_VOL) * 100)}%`,
                          background: heavy ? 'var(--warning)' : light ? 'var(--faint)' : 'var(--accent)',
                        }}
                      />
                      <div className="absolute inset-y-0 w-0.5" style={{ left: '40%', background: 'var(--border-strong)' }} />
                      <div className="absolute inset-y-0 w-0.5" style={{ left: '85%', background: 'var(--border-strong)' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* intensity distribution */}
        <div className="mt-3.5" style={{ ...card, padding: '15px 16px' }}>
          <div className="mb-3" style={capLabel}>
            Intensity distribution
          </div>
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
          <div className="mt-3 flex justify-between text-[10px] text-muted" style={{ fontFamily: 'var(--font-num)' }}>
            <span>1–5 · {a.intensity[0]}%</span>
            <span>6–8 · {a.intensity[1]}%</span>
            <span>9–12 · {a.intensity[2]}%</span>
            <span>13+ · {a.intensity[3]}%</span>
          </div>
        </div>
      </>
    );
  }

  return (
    <div className="h-full overflow-auto px-[22px] pb-24 pt-[max(1rem,env(safe-area-inset-top))]">
      {ds === 'readout' ? <ReadoutBody /> : <TempoBody />}
    </div>
  );
}

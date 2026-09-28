import { useMemo, useState } from 'react';
import { useNav } from '../../ui/nav';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { useCatalog } from '../library/useCatalog';
import { getCatalogExercise } from '../../db/catalog';
import { e1rm, isE1rmEligible } from '../../engine';
import { weeklyVolumeByMuscle } from './weeklyVolume';
import { useSettings } from '../../db/hooks';
import { toUnit, roundDisplay, fmtWeight } from '../../lib/units';
import { compact, monthDay, shortName, titleCase } from '../../lib/format';
import { ScreenTitle, SectionHead, StatTiles } from '../../ui/StatGrid';
import { TrendChart, type TrendPoint } from '../../ui/TrendChart';
import type { LoggedSet } from '../../db/types';
import { useScrollMemory } from '../../ui/scrollMemory';

/* Trends: one layout. A range, the lifts with the most eligible sets as chips, the
   estimated one-rep max for the chosen lift with its delta, three tiles, weekly volume
   by muscle, and the records in range. */

type Range = '4W' | '12W' | 'All';
const RANGE_MS: Record<Exclude<Range, 'All'>, number> = {
  '4W': 28 * 86_400_000,
  '12W': 84 * 86_400_000,
};

const nameOf = (id: string) => getCatalogExercise(id)?.name ?? id;

export function HistoryScreen() {
  const [, scrollRef] = useScrollMemory('history');
  useCatalog();
  const nav = useNav();
  const { units } = useSettings();
  const sets = useLiveQuery(() => db.sets.toArray());
  const completedCount = useLiveQuery(() =>
    db.sessions.where('status').equals('completed').count(),
  );
  const [range, setRange] = useState<Range>('12W');
  const [liftId, setLiftId] = useState<string | null>(null);

  const live = useMemo(
    () => (sets ?? []).filter((s) => !s.deletedAt && s.completed),
    [sets],
  );

  // The window is anchored to the latest logged set, so an idle stretch still shows the
  // last active period rather than an empty screen.
  const inRange = useMemo(() => {
    if (range === 'All' || live.length === 0) return live;
    const latest = live.reduce(
      (m, s) => (s.date > m ? s.date : m),
      live[0]!.date,
    );
    const cutoff = Date.parse(latest) - RANGE_MS[range];
    return live.filter((s) => Date.parse(s.date) >= cutoff);
  }, [live, range]);

  // Lifts ordered by how many eligible sets they have in range.
  const lifts = useMemo(() => {
    const count = new Map<string, number>();
    for (const s of inRange)
      if (isE1rmEligible(s))
        count.set(s.exerciseId, (count.get(s.exerciseId) ?? 0) + 1);
    // Ties go by name, so equally trained lifts keep their places between visits.
    return [...count.entries()]
      .sort((a, b) => b[1] - a[1] || nameOf(a[0]).localeCompare(nameOf(b[0])))
      .map(([id]) => id);
  }, [inRange]);
  const lift = liftId && lifts.includes(liftId) ? liftId : (lifts[0] ?? null);

  // Best e1RM per session for the chosen lift, in date order.
  const series = useMemo<TrendPoint[]>(() => {
    if (!lift) return [];
    const bySession = new Map<string, LoggedSet[]>();
    for (const s of inRange) {
      if (s.exerciseId !== lift || !isE1rmEligible(s)) continue;
      const arr = bySession.get(s.sessionId) ?? [];
      arr.push(s);
      bySession.set(s.sessionId, arr);
    }
    return [...bySession.values()]
      .map((arr) => ({
        date: arr[0]!.date,
        value: Math.max(...arr.map((s) => e1rm(s.weightLb, s.reps))),
        isPR: arr.some((s) => s.isPR?.includes('e1rm')),
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [inRange, lift]);

  const volume = useMemo(
    () =>
      weeklyVolumeByMuscle(inRange, (id) => {
        const ex = getCatalogExercise(id);
        return ex
          ? { primary: ex.primaryMuscles, secondary: ex.secondaryMuscles }
          : undefined;
      }),
    [inRange],
  );

  const records = useMemo(
    () =>
      inRange
        .filter((s) => s.isPR?.length)
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 12),
    [inRange],
  );

  if (live.length === 0) {
    return (
      <div
        ref={scrollRef}
        className="h-full overflow-auto px-[18px] pb-[120px] pt-2"
      >
        <ScreenTitle eyebrow="No workouts yet" title="Trends" />
        <div className="os-card mt-4">
          <div
            className="text-[17px] font-extrabold"
            style={{ letterSpacing: '-.02em' }}
          >
            Nothing to chart yet
          </div>
          <p className="os-t mt-1 leading-snug">
            Log a workout and your estimated one-rep max, weekly volume and
            records show up here.
          </p>
          <button
            type="button"
            onClick={() => nav.tab('/today')}
            className="os-btn os-btn--sm os-btn--pri os-press mt-3.5"
          >
            Start a workout
          </button>
        </div>
      </div>
    );
  }

  const sessionsInRange = new Set(inRange.map((s) => s.sessionId)).size;
  const tonnage = inRange
    .filter((s) => s.type === 'working' || s.type === 'amrap')
    .reduce((t, s) => t + Math.max(0, s.weightLb) * s.reps, 0);
  const latest = series.length ? series[series.length - 1]!.value : null;
  const delta =
    series.length >= 2
      ? series[series.length - 1]!.value - series[0]!.value
      : null;
  const maxVol = Math.max(1, ...volume.map(([, n]) => n));

  return (
    <div
      ref={scrollRef}
      className="h-full overflow-auto px-[18px] pb-[120px] pt-2"
    >
      <ScreenTitle
        eyebrow={`${completedCount ?? 0} ${completedCount === 1 ? 'workout' : 'workouts'}`}
        title="Trends"
      />

      <div className="os-seg mt-3.5" role="radiogroup" aria-label="Range">
        {(['4W', '12W', 'All'] as const).map((r) => (
          <button
            key={r}
            type="button"
            role="radio"
            aria-checked={range === r}
            onClick={() => setRange(r)}
          >
            {r}
          </button>
        ))}
      </div>

      {lifts.length > 0 && (
        <div className="os-chips mt-1">
          {lifts.slice(0, 8).map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setLiftId(id)}
              aria-pressed={lift === id}
              className={`os-chip os-press ${lift === id ? 'os-chip--acc' : ''}`}
            >
              {shortName(nameOf(id), 18)}
            </button>
          ))}
        </div>
      )}

      <div className="os-card mt-3">
        <div className="flex justify-between">
          <span className="os-t">
            Estimated one-rep max
            {lift ? `, ${shortName(nameOf(lift), 22)}` : ''}
          </span>
          {delta !== null && (
            <span
              className="os-t"
              style={{
                color: delta >= 0 ? 'var(--pos)' : 'var(--danger)',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {delta >= 0 ? '+' : ''}
              {roundDisplay(toUnit(delta, units), units)} {units}
            </span>
          )}
        </div>
        {latest !== null ? (
          <>
            <div className="flex items-baseline gap-1.5">
              <span className="os-num text-[52px]">
                {roundDisplay(toUnit(latest, units), units)}
              </span>
              <span className="os-t">{units}</span>
            </div>
            {series.length >= 2 ? (
              <>
                <div className="mt-1.5">
                  <TrendChart points={series} />
                </div>
                <div className="os-t mt-1 flex justify-between text-[11px]">
                  <span>{monthDay(series[0]!.date)}</span>
                  {series.some((p) => p.isPR) && (
                    <span style={{ color: 'var(--pr)' }}>● record</span>
                  )}
                  <span>{monthDay(series[series.length - 1]!.date)}</span>
                </div>
              </>
            ) : (
              <p className="os-t mt-2 leading-snug">
                One session in this range. The line draws from the second.
              </p>
            )}
          </>
        ) : (
          <p className="os-t mt-2 leading-snug">
            No sets in this range count toward a one-rep max (1 to 10 reps with
            load).
          </p>
        )}
      </div>

      <div className="mt-2.5">
        <StatTiles
          cols={3}
          size={24}
          stats={[
            { label: 'Sessions', value: sessionsInRange },
            { label: 'Sets', value: inRange.length },
            {
              label: 'Volume',
              value: compact(toUnit(tonnage, units)),
              unit: units,
            },
          ]}
        />
      </div>

      {volume.length > 0 && (
        <>
          <SectionHead right="sets, 7 days">Weekly volume</SectionHead>
          <div className="os-card">
            <div className="flex flex-col gap-3">
              {volume.map(([m, n], i) => (
                <div key={m}>
                  <div className="mb-1.5 flex justify-between text-[12.5px]">
                    <span className="font-semibold">{titleCase(m)}</span>
                    <span
                      className="os-t"
                      style={{ fontVariantNumeric: 'tabular-nums' }}
                    >
                      {n} {n === 1 ? 'set' : 'sets'}
                    </span>
                  </div>
                  <div
                    className="h-2 overflow-hidden rounded-[5px]"
                    style={{ background: 'var(--s3)' }}
                  >
                    <div
                      className="h-full rounded-[5px]"
                      style={{
                        width: `${Math.max(4, (n / maxVol) * 100)}%`,
                        background:
                          i === 0
                            ? 'linear-gradient(90deg, var(--acc2), var(--acc))'
                            : 'var(--mute)',
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      <SectionHead
        right={
          range === 'All' ? 'all time' : range === '4W' ? '4 weeks' : '12 weeks'
        }
      >
        Records
      </SectionHead>
      {records.length === 0 ? (
        <div className="os-card">
          <div className="text-[15px] font-extrabold">
            No records in this range
          </div>
          <p className="os-t mt-1">
            A set that beats your best on a lift lands here.
          </p>
        </div>
      ) : (
        <div className="os-card" style={{ padding: '4px 16px' }}>
          {records.map((s) => {
            const v = isE1rmEligible(s) ? e1rm(s.weightLb, s.reps) : null;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() =>
                  nav.push(`/library/${encodeURIComponent(s.exerciseId)}`)
                }
                className="os-row os-press"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-semibold">
                    {nameOf(s.exerciseId)}
                  </span>
                  <span
                    className="mt-0.5 block text-[12px] font-medium"
                    style={{
                      color: 'var(--mute)',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {monthDay(s.date)} ·{' '}
                    {s.weightLb > 0 ? fmtWeight(s.weightLb, units) : 'BW'} ×{' '}
                    {s.reps}
                  </span>
                </span>
                <span
                  className="os-num text-[17px]"
                  style={{ letterSpacing: '-.02em', color: 'var(--pr)' }}
                >
                  {v !== null
                    ? roundDisplay(toUnit(v, units), units)
                    : `${s.reps} reps`}
                </span>
                <span className="os-chev" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { useSettings } from '../../db/hooks';
import { getCatalogExercise } from '../../db/catalog';
import { ChevronLeftIcon, ChevronRightIcon } from '../../components/icons';
import {
  dayKey,
  exercisesOf,
  localDayKey,
  monthCells,
  setChip,
  workoutDays,
} from './calendar';
import type { LoggedSet, WorkoutSession } from '../../db/types';

/* The workout calendar at the top of Trends (Noah, 2026-10-14). A month on the page
   ground, each trained day marked, a record day in gold, today outlined. It opens on
   the month of the latest workout with that day picked, so it never opens blank after
   a break (the same anchoring as the charts below). Tap a day to see the workout. */

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const WEEKDAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];
const PR_SOFT = 'color-mix(in oklab, var(--pr) 16%, transparent)';

const nameOf = (id: string) => getCatalogExercise(id)?.name ?? id;

interface Month {
  y: number;
  m: number;
}
const monthOf = (key: string): Month => ({
  y: Number(key.slice(0, 4)),
  m: Number(key.slice(5, 7)) - 1,
});
const prefixOf = ({ y, m }: Month) => dayKey(y, m, 1).slice(0, 8);

export function WorkoutCalendar() {
  const { units } = useSettings();
  const sessions = useLiveQuery(() => db.sessions.toArray());
  const sets = useLiveQuery(() => db.sets.toArray());
  const templates = useLiveQuery(() => db.templates.toArray());
  const days = useMemo(
    () => workoutDays(sessions ?? [], sets ?? []),
    [sessions, sets],
  );
  const latest = useMemo(() => [...days.keys()].sort().at(-1) ?? null, [days]);
  const [shown, setShown] = useState<Month | null>(null);
  const [picked, setPicked] = useState<string | null>(null);

  if (!sessions || !sets) return null;

  const now = new Date();
  const todayKey = localDayKey(now.toISOString());
  const thisMonth = { y: now.getFullYear(), m: now.getMonth() };
  const month = shown ?? (latest ? monthOf(latest) : thisMonth);
  const prefix = prefixOf(month);
  const inMonth = [...days.keys()].filter((k) => k.startsWith(prefix)).sort();
  const selected =
    picked && picked.startsWith(prefix) ? picked : (inMonth.at(-1) ?? null);
  const atThisMonth = month.y === thisMonth.y && month.m === thisMonth.m;

  const go = (delta: number) => {
    const d = new Date(month.y, month.m + delta, 1);
    setShown({ y: d.getFullYear(), m: d.getMonth() });
    setPicked(null);
  };

  const count = inMonth.reduce((n, k) => n + days.get(k)!.sessionIds.length, 0);

  return (
    <section aria-label="Workout calendar" className="mt-3.5">
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="os-t">
            {count === 0
              ? 'No workouts'
              : `${count} ${count === 1 ? 'workout' : 'workouts'}`}
          </div>
          <h2
            className="text-[22px] font-extrabold"
            style={{ letterSpacing: '-.02em' }}
          >
            {MONTHS[month.m]}
            {month.y !== thisMonth.y ? ` ${month.y}` : ''}
          </h2>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => go(-1)}
            className="os-icon-btn os-press"
            aria-label="Previous month"
          >
            <ChevronLeftIcon width={18} height={18} strokeWidth={2.2} />
          </button>
          <button
            type="button"
            onClick={() => go(1)}
            disabled={atThisMonth}
            className="os-icon-btn os-press"
            aria-label="Next month"
          >
            <ChevronRightIcon width={18} height={18} strokeWidth={2.2} />
          </button>
        </div>
      </div>

      <div className="mt-2.5 grid grid-cols-7 gap-1 text-center">
        {WEEKDAYS.map((w, i) => (
          <div
            key={i}
            aria-hidden
            className="pb-1 text-[11px] font-bold"
            style={{ color: 'var(--mute)' }}
          >
            {w}
          </div>
        ))}
        {monthCells(month.y, month.m).map((d, i) => {
          if (d === null) return <div key={i} aria-hidden />;
          const key = dayKey(month.y, month.m, d);
          const day = days.get(key);
          const isToday = key === todayKey;
          const ring = [
            isToday ? 'inset 0 0 0 1.5px var(--ink2)' : null,
            key === selected
              ? `inset 0 0 0 2px ${day?.record ? 'var(--pr)' : 'var(--acc)'}`
              : null,
          ]
            .filter(Boolean)
            .join(', ');
          const cellStyle = {
            background: day
              ? day.record
                ? PR_SOFT
                : 'var(--acc-soft)'
              : undefined,
            color: day
              ? day.record
                ? 'var(--pr)'
                : 'var(--acc-tx)'
              : key > todayKey
                ? 'var(--faint)'
                : 'var(--ink2)',
            boxShadow: ring || undefined,
          };
          const cls = `grid aspect-square place-items-center rounded-[12px] text-[14px] ${day ? 'font-extrabold' : 'font-semibold'}`;
          if (!day)
            return (
              <div key={i} className={cls} style={cellStyle}>
                {d}
              </div>
            );
          const date = new Date(month.y, month.m, d);
          return (
            <button
              key={i}
              type="button"
              onClick={() => setPicked(key)}
              aria-pressed={key === selected}
              aria-label={`${WEEKDAY_NAMES[date.getDay()]}, ${MONTHS[month.m]} ${d}: ${day.sessionIds.length === 1 ? 'a workout' : `${day.sessionIds.length} workouts`}${day.record ? ', new record' : ''}`}
              className={`${cls} os-press`}
              style={{ ...cellStyle, fontVariantNumeric: 'tabular-nums' }}
            >
              {d}
            </button>
          );
        })}
      </div>

      <div
        className="mt-2 flex flex-wrap gap-x-3.5 gap-y-1 text-[12px]"
        style={{ color: 'var(--mute)' }}
        aria-hidden
      >
        <Key bg="var(--acc-soft)" ring="var(--acc)" label="Trained" />
        <Key bg={PR_SOFT} ring="var(--pr)" label="New record" />
        <Key ring="var(--ink2)" label="Today" />
      </div>

      {selected ? (
        days.get(selected)!.sessionIds.map((id) => {
          const s = sessions.find((x) => x.id === id)!;
          return (
            <WorkoutCard
              key={id}
              session={s}
              name={
                templates?.find((t) => t.id === s.templateId)?.name ?? 'Workout'
              }
              sets={sets.filter((x) => x.sessionId === id)}
              units={units}
            />
          );
        })
      ) : (
        <p className="os-t mt-3 leading-snug">
          No workouts logged in {MONTHS[month.m]}.
        </p>
      )}
    </section>
  );
}

function Key({
  bg,
  ring,
  label,
}: {
  bg?: string;
  ring: string;
  label: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <i
        className="inline-block h-2.5 w-2.5 rounded-[3px]"
        style={{ background: bg, boxShadow: `inset 0 0 0 1.5px ${ring}` }}
      />
      {label}
    </span>
  );
}

function WorkoutCard({
  session,
  name,
  sets,
  units,
}: {
  session: WorkoutSession;
  name: string;
  sets: LoggedSet[];
  units: 'lb' | 'kg';
}) {
  const exercises = exercisesOf(sets);
  const total = exercises.reduce((n, e) => n + e.sets.length, 0);
  const start = new Date(session.startedAt);
  const minutes = session.endedAt
    ? Math.max(
        1,
        Math.round((Date.parse(session.endedAt) - start.getTime()) / 60_000),
      )
    : null;
  return (
    <article
      className="os-card mt-3"
      aria-label={`${name}, ${WEEKDAY_NAMES[start.getDay()]}, ${MONTHS[start.getMonth()]} ${start.getDate()}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="os-t">
            {WEEKDAY_NAMES[start.getDay()]}, {MONTHS[start.getMonth()]}{' '}
            {start.getDate()}
          </div>
          <h3
            className="truncate text-[20px] font-extrabold"
            style={{ letterSpacing: '-.02em' }}
          >
            {name}
          </h3>
        </div>
        <div
          className="flex-none text-right text-[12px] leading-[1.5]"
          style={{ color: 'var(--mute)' }}
        >
          {minutes !== null && (
            <div>
              <b className="text-[14px]" style={{ color: 'var(--ink)' }}>
                {minutes}
              </b>{' '}
              min
            </div>
          )}
          <div>
            <b className="text-[14px]" style={{ color: 'var(--ink)' }}>
              {total}
            </b>{' '}
            {total === 1 ? 'set' : 'sets'}
          </div>
        </div>
      </div>
      {exercises.map((e) => (
        <div
          key={e.exerciseId}
          className="mt-2.5 pt-2.5"
          style={{ borderTop: '1px solid var(--line)' }}
        >
          <div className="flex items-center gap-2 text-[14px] font-bold">
            <span className="min-w-0 truncate">{nameOf(e.exerciseId)}</span>
            {e.record && (
              <span
                className="flex-none rounded-full px-2 text-[11px] font-extrabold"
                style={{ background: PR_SOFT, color: 'var(--pr)' }}
              >
                Record
              </span>
            )}
          </div>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {e.sets.map((s) => {
              const hit = (s.isPR?.length ?? 0) > 0;
              return (
                <span
                  key={s.id}
                  className="rounded-[8px] px-2 py-0.5 text-[13px] font-semibold"
                  style={{
                    background: hit ? PR_SOFT : 'var(--s2)',
                    color: hit ? 'var(--pr)' : 'var(--ink2)',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {setChip(s, units)}
                </span>
              );
            })}
          </div>
        </div>
      ))}
    </article>
  );
}

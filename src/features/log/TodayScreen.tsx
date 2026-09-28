import { useEffect, useMemo } from 'react';
import { useNav } from '../../ui/nav';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { t } from '../../i18n/strings';
import { useSessionStore } from '../../state/session';
import { useCatalog } from '../library/useCatalog';
import { getCatalogExercise } from '../../db/catalog';
import { e1rm } from '../../engine';
import { useSettings } from '../../db/hooks';
import { toUnit, roundDisplay, fmtWeight } from '../../lib/units';
import {
  compact,
  daysAgoLabel,
  shortName,
  startOfWeek,
  weekdayShort,
} from '../../lib/format';
import {
  getActiveProgram,
  listTemplates,
  nextTemplateForProgram,
  startSessionFromTemplate,
  getActiveWorkoutSession,
} from '../../db/repositories';
import { seedSampleData } from '../../db/sampleData';
import { ActiveSession } from './ActiveSession';
import { ProteinCard } from './ProteinCard';
import { Ring } from '../../ui/Ring';
import { StatTiles, SectionHead } from '../../ui/StatGrid';
import type {
  ExerciseStateRow,
  LoggedSet,
  WorkoutSession,
} from '../../db/types';
import { useScrollMemory } from '../../ui/scrollMemory';

/* Today: the hub. A hero for the next workout, the week ring, two tiles, recent sessions.
   Every number comes from Dexie or the engine; the only sample path is seedSampleData. */

const nowIso = () => new Date().toISOString();
const nameOf = (id: string) => getCatalogExercise(id)?.name ?? id;
const DAY_MS = 86_400_000;
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** Consecutive weeks (ending this week or last) with at least one completed session. */
function weekStreak(completed: WorkoutSession[], now: Date): number {
  if (completed.length === 0) return 0;
  const weeks = new Set(
    completed.map((s) => startOfWeek(new Date(s.startedAt)).getTime()),
  );
  let cursor = startOfWeek(now).getTime();
  if (!weeks.has(cursor)) cursor -= 7 * DAY_MS;
  let n = 0;
  while (weeks.has(cursor)) {
    n++;
    cursor -= 7 * DAY_MS;
  }
  return n;
}

/** The weight of the most recent logged working set per exercise. */
function lastWeights(sets: LoggedSet[]): Map<string, number> {
  const date = new Map<string, string>();
  const weight = new Map<string, number>();
  for (const s of sets) {
    if (s.type !== 'working' && s.type !== 'amrap') continue;
    const d = date.get(s.exerciseId);
    if (d === undefined || s.date > d) {
      date.set(s.exerciseId, s.date);
      weight.set(s.exerciseId, s.weightLb);
    }
  }
  return weight;
}

export function TodayScreen() {
  const [, scrollRef] = useScrollMemory('today');
  const catalog = useCatalog();
  const nav = useNav();
  const { units } = useSettings();
  const activeSessionId = useSessionStore((s) => s.activeSessionId);
  const leftSessionId = useSessionStore((s) => s.leftSessionId);
  const beginSession = useSessionStore((s) => s.beginSession);

  // The in-progress session, if any (live). Drives auto-resume and the Resume control.
  const resumable = useLiveQuery(() => getActiveWorkoutSession());
  const activeProgram = useLiveQuery(() => getActiveProgram());
  const templates = useLiveQuery(
    () =>
      activeProgram ? listTemplates(activeProgram.id) : Promise.resolve([]),
    [activeProgram?.id],
  );
  // The next day in the rotation (not always Day 1).
  const nextTpl = useLiveQuery(
    () =>
      activeProgram
        ? nextTemplateForProgram(activeProgram.id)
        : Promise.resolve(undefined),
    [activeProgram?.id],
  );
  const states = useLiveQuery(
    () =>
      activeProgram
        ? db.exerciseState
            .filter((r) => r.programId === activeProgram.id)
            .toArray()
        : Promise.resolve([] as ExerciseStateRow[]),
    [activeProgram?.id],
  );
  const completed = useLiveQuery(() =>
    db.sessions.where('status').equals('completed').toArray(),
  );
  const allSets = useLiveQuery(() => db.sets.toArray());

  useEffect(() => {
    if (activeSessionId) return;
    // Auto-resume on a cold reopen, but NOT a session the user just LEFT via Back;
    // that one is offered through the Resume control instead of bouncing back in.
    if (resumable && resumable.id !== leftSessionId) beginSession(resumable.id);
  }, [activeSessionId, resumable, leftSessionId, beginSession]);

  const live = useMemo(
    () => (allSets ?? []).filter((s) => !s.deletedAt && s.completed),
    [allSets],
  );

  if (activeSessionId) return <ActiveSession />;

  const tpl = nextTpl ?? templates?.[0];
  const ready = tpl && tpl.slots.length > 0;
  const meso = activeProgram?.mesocycle;
  const newBlock = meso && (meso.blockIndex ?? 0) > 0 && meso.weekIndex === 0;
  const now = new Date();
  const dateLabel = now.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  const header = (
    <div className="flex items-end justify-between pt-[max(0.5rem,env(safe-area-inset-top))]">
      <div>
        <div className="os-t">{dateLabel}</div>
        <h1 className="os-h1 mt-0.5">Today</h1>
      </div>
      <button
        type="button"
        onClick={() => nav.tab('/settings')}
        aria-label="You"
        className="os-press grid size-11 place-items-center rounded-full"
        style={{
          background: 'var(--s2)',
          boxShadow: 'inset 0 1px 0 var(--hl2)',
          color: 'var(--ink)',
        }}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          aria-hidden
        >
          <circle cx="12" cy="8.5" r="3.8" />
          <path d="M4.5 20c1.2-3.6 4-5.5 7.5-5.5s6.3 1.9 7.5 5.5" />
        </svg>
      </button>
    </div>
  );

  // Resume control for a session the user left via Back (kept active and resumable).
  // Rendered in every hub state so an in-progress workout can never be stranded.
  const resumeBanner = resumable ? (
    <button
      type="button"
      onClick={() => beginSession(resumable.id)}
      className="os-btn os-btn--pri os-press mt-4"
    >
      Resume workout in progress
    </button>
  ) : null;

  if (!ready) {
    return (
      <div
        ref={scrollRef}
        className="h-full overflow-auto px-[18px] pb-[120px] pt-2"
      >
        {header}
        {resumeBanner}
        <div
          className="os-card os-card--hero mt-[18px]"
          style={{ padding: '18px 18px 16px' }}
        >
          <span className="os-t os-hero-t">Nothing scheduled</span>
          <h2
            className="mt-1.5 text-[30px] font-extrabold leading-[1.05]"
            style={{ letterSpacing: '-.035em' }}
          >
            No plan yet
          </h2>
          <p
            className="mt-2.5 text-[14px] font-semibold leading-[1.4]"
            style={{ opacity: 0.85 }}
          >
            Answer five questions and OpenSets builds a program that tells you
            what to lift and when to add weight.
          </p>
          <button
            type="button"
            onClick={() => nav.push('/onboarding')}
            className="os-btn os-btn--hero os-press mt-4"
          >
            Build my plan <span className="text-[18px]">→</span>
          </button>
        </div>
        <div className="mt-2.5 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => nav.push('/routine/new')}
            className="os-btn os-btn--sm os-press"
          >
            Build manually
          </button>
          <button
            type="button"
            onClick={() => void seedSampleData(catalog ?? [], nowIso())}
            disabled={!catalog}
            className="os-btn os-btn--sm os-press"
          >
            Load sample data
          </button>
        </div>
        <ProteinCard />
        <p className="os-t mt-7 text-center">{t.today.disclaimer}</p>
      </div>
    );
  }

  const slots = tpl.slots;
  const dayCount = templates?.length ?? 1;
  const dayIndex = Math.max(
    0,
    (templates ?? []).findIndex((x) => x.id === tpl.id),
  );
  const estMin = Math.round(
    slots.reduce((m, s) => m + s.scheme.sets * (s.restWorkSec + 35), 0) / 60,
  );

  // Chips: the exercise and the weight the engine prescribes for it, with a rise marker
  // when that is more than the last logged weight.
  const stateByEx = new Map((states ?? []).map((r) => [r.exerciseId, r]));
  const lastByEx = lastWeights(live);
  const chips = slots.slice(0, 3).map((s) => {
    const target = stateByEx.get(s.exerciseId)?.pending?.sets[0]
      ?.targetWeightLb;
    const last = lastByEx.get(s.exerciseId);
    const rose =
      target !== undefined && last !== undefined && target > last + 0.01;
    return {
      id: s.slotId,
      name: shortName(nameOf(s.exerciseId)),
      weight:
        target !== undefined && target > 0 ? fmtWeight(target, units) : null,
      rise: rose ? fmtWeight(target - last, units) : null,
    };
  });
  const extra = slots.length - chips.length;

  // The week ring: sessions done since Monday against the number of days in the plan.
  const weekStart = startOfWeek(now).getTime();
  const done = completed ?? [];
  const thisWeek = done.filter((s) => Date.parse(s.startedAt) >= weekStart);
  const doneDays = new Set(
    thisWeek.map((s) => (new Date(s.startedAt).getDay() + 6) % 7),
  );
  const todayIdx = (now.getDay() + 6) % 7;
  const weekTarget = Math.max(1, dayCount);
  const weekDone = Math.min(thisWeek.length, weekTarget);
  const streak = weekStreak(done, now);
  const weekTitle =
    thisWeek.length >= weekTarget
      ? 'Week complete'
      : `${thisWeek.length} of ${weekTarget} this week`;
  const weekSub = [
    thisWeek.length >= weekTarget
      ? 'Every session done'
      : `${weekTarget - thisWeek.length} to go`,
    streak >= 2 ? `${streak} weeks running` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  // Tiles: volume over the last seven days, and the most recent record.
  const sevenAgo = now.getTime() - 7 * DAY_MS;
  const volume7 = live
    .filter(
      (s) =>
        (s.type === 'working' || s.type === 'amrap') &&
        Date.parse(s.date) >= sevenAgo,
    )
    .reduce((sum, s) => sum + Math.max(0, s.weightLb) * s.reps, 0);
  const lastPR = live
    .filter((s) => s.isPR?.length)
    .sort((a, b) => b.date.localeCompare(a.date))[0];
  const lastPRe1rm =
    lastPR && lastPR.weightLb > 0 ? e1rm(lastPR.weightLb, lastPR.reps) : null;

  // Recent sessions with their set counts and whether one held a record.
  const setsBySession = new Map<string, LoggedSet[]>();
  for (const s of live) {
    const arr = setsBySession.get(s.sessionId) ?? [];
    arr.push(s);
    setsBySession.set(s.sessionId, arr);
  }
  const tplName = new Map((templates ?? []).map((x) => [x.id, x.name]));
  const recent = done
    .slice()
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
    .slice(0, 4);

  async function start() {
    if (!tpl) return;
    const s = await startSessionFromTemplate(tpl, nowIso());
    beginSession(s.id);
  }

  return (
    <div
      ref={scrollRef}
      className="h-full overflow-auto px-[18px] pb-[120px] pt-2"
    >
      {header}
      {resumeBanner}
      {newBlock && (
        <p role="status" className="os-t mt-3 leading-snug">
          Block {(meso.blockIndex ?? 0) + 1} started. Same exercises, with
          volume back at the start of the ramp.
        </p>
      )}

      {/* hero: the next workout */}
      <div
        className="os-card os-card--hero mt-[18px]"
        style={{ padding: '18px 18px 16px' }}
      >
        <div className="flex items-center justify-between">
          <span className="os-t os-hero-t">
            Up next · Day {dayIndex + 1} of {dayCount}
          </span>
          <span
            className="os-t os-hero-t"
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            {estMin} min
          </span>
        </div>
        <h2
          className="mt-1.5 truncate text-[30px] font-extrabold leading-[1.05]"
          style={{ letterSpacing: '-.035em' }}
        >
          {tpl.name}
        </h2>
        {activeProgram && activeProgram.name !== tpl.name && (
          <div
            className="mt-0.5 text-[13px] font-semibold"
            style={{ opacity: 0.75 }}
          >
            {activeProgram.name}
          </div>
        )}
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {chips.map((c) => (
            <span key={c.id} className="os-chip os-hero-chip">
              {c.name}
              {c.weight && (
                <span
                  style={{
                    fontVariantNumeric: 'tabular-nums',
                    fontWeight: 700,
                  }}
                >
                  {c.weight}
                </span>
              )}
              {c.rise && (
                <b
                  style={{
                    fontVariantNumeric: 'tabular-nums',
                    fontWeight: 800,
                  }}
                >
                  ↑{c.rise}
                </b>
              )}
            </span>
          ))}
          {extra > 0 && <span className="os-chip os-hero-chip">+{extra}</span>}
        </div>
        {/* While a workout is in progress (left via Back), Resume is the only entry:
            no Start here, so a second active session cannot be spawned. */}
        {!resumable && (
          <button
            type="button"
            onClick={() => void start()}
            className="os-btn os-btn--hero os-press mt-4"
          >
            Start workout <span className="text-[18px]">→</span>
          </button>
        )}
      </div>

      {/* the week */}
      <div
        className="os-card mt-3 flex items-center gap-4"
        style={{ padding: '14px 16px' }}
      >
        <Ring
          size={66}
          stroke={8}
          value={weekDone / weekTarget}
          color="var(--pos)"
          label={`${weekDone} of ${weekTarget} sessions this week`}
        >
          <span className="os-num text-[16px]">
            {weekDone}
            <span
              className="text-[12px] font-bold"
              style={{ color: 'var(--mute)', letterSpacing: 0 }}
            >
              /{weekTarget}
            </span>
          </span>
        </Ring>
        <div className="min-w-0 flex-1">
          <div
            className="text-[16px] font-extrabold"
            style={{ letterSpacing: '-.02em' }}
          >
            {weekTitle}
          </div>
          <div className="os-t mt-0.5">{weekSub}</div>
          <div className="mt-2.5 flex gap-[5px]" aria-hidden>
            {DAYS.map((d, i) => (
              <i
                key={d}
                className="h-1.5 flex-1 rounded-[3px]"
                style={{
                  background: doneDays.has(i) ? 'var(--pos)' : 'var(--s3)',
                  boxShadow:
                    i === todayIdx && !doneDays.has(i)
                      ? 'inset 0 0 0 1.5px var(--mute)'
                      : undefined,
                }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* tiles */}
      <div className="mt-3">
        <StatTiles
          stats={[
            {
              label: 'Lifted, 7 days',
              value: compact(toUnit(volume7, units)),
              unit: units,
            },
            lastPR && lastPRe1rm
              ? {
                  label: 'Last record',
                  value: roundDisplay(toUnit(lastPRe1rm, units), units),
                  unit: units,
                  color: 'var(--pr)',
                  sub: `${shortName(nameOf(lastPR.exerciseId))} · ${daysAgoLabel(lastPR.date)}`,
                }
              : {
                  label: 'Last record',
                  value: <span className="text-[22px]">None yet</span>,
                  sub: 'Beat a best to set one',
                },
          ]}
        />
      </div>

      <ProteinCard />

      {/* recent */}
      {recent.length > 0 && (
        <>
          <SectionHead right="All" onRight={() => nav.tab('/history')}>
            Recent
          </SectionHead>
          <div className="os-card" style={{ padding: '4px 16px' }}>
            {recent.map((s) => {
              const mins = s.endedAt
                ? Math.round(
                    (Date.parse(s.endedAt) - Date.parse(s.startedAt)) / 60000,
                  )
                : null;
              const sets = setsBySession.get(s.id) ?? [];
              const pr = sets.some((x) => x.isPR?.length);
              const sub = [
                weekdayShort(s.startedAt),
                mins !== null ? `${mins} min` : null,
                `${sets.length} sets`,
              ]
                .filter(Boolean)
                .join(' · ');
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => nav.tab('/history')}
                  className="os-row os-press"
                >
                  <span
                    className="os-num grid size-10 flex-none place-items-center rounded-[12px] text-[15px]"
                    style={{
                      background: 'var(--s2)',
                      boxShadow: 'inset 0 1px 0 var(--hl)',
                    }}
                  >
                    {new Date(s.startedAt).getDate()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-semibold">
                      {(s.templateId && tplName.get(s.templateId)) ??
                        activeProgram?.name ??
                        'Workout'}
                    </span>
                    <span
                      className="mt-0.5 block text-[12px] font-medium"
                      style={{ color: 'var(--mute)' }}
                    >
                      {sub}
                    </span>
                  </span>
                  {pr && <span className="os-tag os-tag--pr">PR</span>}
                  <span className="os-chev" />
                </button>
              );
            })}
          </div>
        </>
      )}

      <p className="os-t mt-7 text-center">{t.today.disclaimer}</p>
    </div>
  );
}

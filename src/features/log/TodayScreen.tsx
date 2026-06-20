import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { DumbbellIcon } from '../../components/icons';
import { t } from '../../i18n/strings';
import { useSessionStore } from '../../state/session';
import { useCatalog } from '../library/useCatalog';
import { getCatalogExercise } from '../../db/catalog';
import { e1rm } from '../../engine';
import {
  getActiveProgram,
  listTemplates,
  startSessionFromTemplate,
  getActiveWorkoutSession,
} from '../../db/repositories';
import { seedSampleData } from '../../db/sampleData';
import { ActiveSession } from './ActiveSession';

const nowIso = () => new Date().toISOString();
const nameOf = (id: string) => getCatalogExercise(id)?.name ?? id;

const numFont = {
  fontFamily: 'var(--font-num)',
  fontWeight: 'var(--num-weight)' as unknown as number,
  fontVariantNumeric: 'tabular-nums' as const,
};

function startOfWeek(d: Date): number {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); // Monday
  return x.getTime();
}

export function TodayScreen() {
  const catalog = useCatalog();
  const navigate = useNavigate();
  const activeSessionId = useSessionStore((s) => s.activeSessionId);
  const beginSession = useSessionStore((s) => s.beginSession);

  const activeProgram = useLiveQuery(() => getActiveProgram());
  const templates = useLiveQuery(
    () => (activeProgram ? listTemplates(activeProgram.id) : Promise.resolve([])),
    [activeProgram?.id],
  );
  const completed = useLiveQuery(() =>
    db.sessions.where('status').equals('completed').toArray(),
  );
  const prSets = useLiveQuery(() => db.sets.filter((s) => !!s.isPR?.length).toArray());

  useEffect(() => {
    if (activeSessionId) return;
    void getActiveWorkoutSession().then((s) => {
      if (s) beginSession(s.id);
    });
  }, [activeSessionId, beginSession]);

  if (activeSessionId) return <ActiveSession />;

  const tpl = templates?.[0];
  const ready = tpl && tpl.slots.length > 0;
  const dateLabel = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });

  const Header = (
    <div className="flex items-start justify-between">
      <div>
        <div className="text-[13px] font-medium text-muted">{dateLabel}</div>
        <div
          className="mt-0.5 text-[30px] font-bold text-text"
          style={{ letterSpacing: 'var(--tracking-tight)' }}
        >
          Today
        </div>
      </div>
      <button
        onClick={() => navigate('/settings')}
        aria-label="Settings"
        className="grid size-[42px] place-items-center rounded-[var(--r-md)] bg-surface text-muted"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="3.2" stroke="currentColor" strokeWidth="1.6" />
          <path
            d="M12 2.5v2.5M12 19v2.5M21.5 12H19M5 12H2.5M18.7 5.3l-1.8 1.8M7.1 16.9l-1.8 1.8M18.7 18.7l-1.8-1.8M7.1 7.1L5.3 5.3"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      </button>
    </div>
  );

  if (!ready) {
    return (
      <div className="h-full overflow-auto px-[22px] pb-6 pt-[max(1rem,env(safe-area-inset-top))]">
        {Header}
        <div className="mt-6">
          <EmptyState
            icon={<DumbbellIcon />}
            title="Let's build your plan"
            body="Answer a few questions and OpenSets generates a starter routine — or build one yourself."
            action={
              <div className="flex flex-col items-center gap-3">
                <Button onClick={() => navigate('/onboarding')}>Get started</Button>
                <button
                  onClick={() => navigate('/routine/new')}
                  className="text-[13px] text-muted underline-offset-2 hover:underline"
                >
                  Build manually
                </button>
                <button
                  onClick={() => void seedSampleData(catalog ?? [], new Date().toISOString())}
                  disabled={!catalog}
                  className="text-[13px] text-faint underline-offset-2 hover:underline disabled:opacity-40"
                >
                  Load sample data
                </button>
              </div>
            }
          />
          <p className="mt-2 text-center text-[12px] text-faint">{t.today.disclaimer}</p>
        </div>
      </div>
    );
  }

  const slots = tpl.slots;
  const estMin = Math.round(
    slots.reduce((m, s) => m + s.scheme.sets * (s.restWorkSec + 35), 0) / 60,
  );
  const chips = slots.slice(0, 3).map((s) => nameOf(s.exerciseId));
  const extra = slots.length - chips.length;

  const weekStart = startOfWeek(new Date());
  const thisWeek = (completed ?? []).filter(
    (s) => Date.parse(s.startedAt) >= weekStart,
  ).length;

  const lastPR = (prSets ?? [])
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date))[0];
  const lastPRe1rm =
    lastPR && lastPR.weightKg > 0 ? e1rm(lastPR.weightKg, lastPR.reps) : null;

  const recent = (completed ?? [])
    .slice()
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
    .slice(0, 4);

  async function start() {
    if (!tpl) return;
    const s = await startSessionFromTemplate(tpl, nowIso());
    beginSession(s.id);
  }

  return (
    <div className="h-full overflow-auto px-[22px] pb-24 pt-[max(1rem,env(safe-area-inset-top))]">
      {Header}

      {/* today's workout card */}
      <div
        className="mt-[18px] rounded-[var(--r-xl)] border bg-surface p-5"
        style={{ borderColor: 'var(--border-card)', boxShadow: 'var(--hairline-top)' }}
      >
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wide text-accent">
            Scheduled
          </span>
          <span className="text-[12px] text-muted" style={numFont}>
            ~{estMin} min · {slots.length} exercises
          </span>
        </div>
        <div
          className="mt-2.5 text-[24px] font-bold text-text"
          style={{ letterSpacing: 'var(--tracking-snug)' }}
        >
          {activeProgram?.name ?? tpl.name}
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {chips.map((c, i) => (
            <span
              key={i}
              className="rounded-[var(--r-pill)] bg-bg px-[11px] py-1.5 text-[12px] text-muted"
            >
              {c}
            </span>
          ))}
          {extra > 0 && (
            <span className="rounded-[var(--r-pill)] bg-bg px-[11px] py-1.5 text-[12px] text-muted">
              +{extra} more
            </span>
          )}
        </div>
        <button
          onClick={() => void start()}
          className="mt-[18px] h-14 w-full rounded-[var(--r-lg)] bg-accent text-[16px] font-bold text-accent-ink"
        >
          Start workout
        </button>
      </div>

      {/* stats */}
      <div className="mt-3.5 flex gap-3">
        <div className="flex-1 rounded-[var(--r-lg)] bg-surface p-4">
          <div className="text-[11px] font-medium text-muted">This week</div>
          <div className="mt-1 text-[24px] text-text" style={numFont}>
            {thisWeek}
          </div>
          <div className="mt-2.5 text-[11px] text-faint">workouts</div>
        </div>
        <div className="flex-1 rounded-[var(--r-lg)] bg-surface p-4">
          <div className="text-[11px] font-medium text-muted">Last PR</div>
          <div className="mt-1 text-[24px] text-pr" style={numFont}>
            {lastPRe1rm ? Math.round(lastPRe1rm * 10) / 10 : '—'}
          </div>
          <div className="mt-2 text-[11px] text-muted">
            {lastPRe1rm ? 'e1RM' : 'no PRs yet'}
          </div>
        </div>
      </div>

      {/* recent */}
      {recent.length > 0 && (
        <>
          <div
            onClick={() => navigate('/history')}
            className="mx-1 mb-2.5 mt-[22px] flex cursor-pointer items-center justify-between text-[11px] font-bold uppercase tracking-wide text-faint"
          >
            Recent <span className="normal-case tracking-normal text-accent">All ›</span>
          </div>
          <div className="flex flex-col gap-2">
            {recent.map((s) => {
              const mins =
                s.endedAt
                  ? Math.round((Date.parse(s.endedAt) - Date.parse(s.startedAt)) / 60000)
                  : null;
              return (
                <div
                  key={s.id}
                  className="flex items-center gap-3.5 rounded-[var(--r-md)] bg-surface px-4 py-3.5"
                >
                  <div className="grid size-[38px] place-items-center rounded-[var(--r-sm)] bg-bg text-muted">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                      <path d="M4 12h16M7 8v8M17 8v8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <div className="text-[14px] font-semibold text-text">
                      {activeProgram?.name ?? 'Workout'}
                    </div>
                    <div className="text-[12px] text-muted">
                      {new Date(s.date).toLocaleDateString(undefined, {
                        weekday: 'short',
                      })}
                      {mins !== null ? ` · ${mins} min` : ''}
                    </div>
                  </div>
                  <span className="text-[18px] text-faint">›</span>
                </div>
              );
            })}
          </div>
        </>
      )}

      <p className="mt-7 text-center text-[12px] text-faint">{t.today.disclaimer}</p>
    </div>
  );
}

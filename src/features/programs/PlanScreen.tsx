import { useNav } from '../../ui/nav';
import { useLiveQuery } from 'dexie-react-hooks';
import { useCatalog } from '../library/useCatalog';
import { getCatalogExercise } from '../../db/catalog';
import { useProfile, useSettings } from '../../db/hooks';
import { openWorkout } from '../log/workoutMotion';
import { loadTypeFor } from '../../engine/loading';
import { weightWithLoad } from '../../lib/units';
import { shortName } from '../../lib/format';
import {
  getActiveProgram,
  getActiveWorkoutSession,
  listTemplates,
  nextTemplateForProgram,
  setActiveProgram,
  startSessionFromTemplate,
} from '../../db/repositories';
import { db } from '../../db/db';
import { ScreenTitle } from '../../ui/StatGrid';
import type { WorkoutTemplate } from '../../db/types';
import { useKeptState, useScrollMemory } from '../../ui/scrollMemory';

/* Plan: the week card, then each day as a card. Tapping a day expands it to its exercises
   and collapses the open one (one open at a time). The next day is lifted with an accent
   ring and a Next chip and starts from here. The open day is kept while you stay in this
   tab, so coming back from Edit or a workout finds it still open (NAV.md, rule 2), and
   an open day lists every exercise with its sets, reps and weight (rule 8). */

const nameOf = (id: string) => getCatalogExercise(id)?.name ?? id;
const nowIso = () => new Date().toISOString();
const estMin = (t: WorkoutTemplate) =>
  Math.round(
    t.slots.reduce((m, s) => m + s.scheme.sets * (s.restWorkSec + 35), 0) / 60,
  );

const PHASE_LABEL: Record<string, string> = {
  accumulation: 'Building up',
  intensification: 'Pushing harder',
  deload: 'Deload week',
};

export function PlanScreen() {
  const [, scrollRef] = useScrollMemory('plan');
  useCatalog();
  const nav = useNav();
  const profile = useProfile();
  const { units } = useSettings();
  const programs = useLiveQuery(() => db.programs.toArray());
  const activeProgram = useLiveQuery(() => getActiveProgram());
  const templates = useLiveQuery(
    () =>
      activeProgram
        ? listTemplates(activeProgram.id)
        : Promise.resolve([] as WorkoutTemplate[]),
    [activeProgram?.id],
  );
  const nextTpl = useLiveQuery(
    () =>
      activeProgram
        ? nextTemplateForProgram(activeProgram.id)
        : Promise.resolve(undefined),
    [activeProgram?.id],
  );
  const [openId, setOpenId] = useKeptState<string | null>(
    'plan:open',
    () => null,
  );
  const open = openId ?? nextTpl?.id ?? null;
  // One workout at a time: while one is in progress its day offers Resume and no other
  // day offers Start, so a second session cannot be opened alongside it.
  const inProgress = useLiveQuery(() => getActiveWorkoutSession());
  // Each lift's next working weight in this program, for the open day's list.
  const weightOf = useLiveQuery(async () => {
    if (!activeProgram) return new Map<string, number>();
    const rows = await db.exerciseState
      .filter((r) => r.programId === activeProgram.id)
      .toArray();
    return new Map(
      rows.map((r) => [
        r.exerciseId,
        r.pending?.sets.find((x) => x.type !== 'warmup')?.targetWeightLb ??
          r.workingWeightLb,
      ]),
    );
  }, [activeProgram?.id]);

  // The workout rises over Plan and lowers back onto it (NAV.md, rule 5).
  async function start(t: WorkoutTemplate) {
    const s = await startSessionFromTemplate(t, nowIso());
    openWorkout(s.id);
  }

  const meso = activeProgram?.mesocycle;
  const eyebrow = activeProgram
    ? [activeProgram.name, profile?.goal].filter(Boolean).join(' · ')
    : 'Your program';

  return (
    <div
      ref={scrollRef}
      className="h-full overflow-auto px-[18px] pb-[120px] pt-2"
    >
      <ScreenTitle eyebrow={eyebrow} title="Plan" />

      {!programs?.length ? (
        <>
          <div
            className="os-card os-card--hero mt-4"
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
              Build one from your goals in five questions, or put a day together
              by hand.
            </p>
            <button
              type="button"
              onClick={() => nav.push('/onboarding')}
              className="os-btn os-btn--hero os-press mt-4"
            >
              Build my plan <span className="text-[18px]">→</span>
            </button>
          </div>
          <button
            type="button"
            onClick={() => nav.push('/routine/new')}
            className="os-btn os-btn--sm os-press mt-2.5"
          >
            Build manually
          </button>
        </>
      ) : activeProgram ? (
        <>
          {meso && (
            <div
              className="os-card mt-4 flex items-center gap-3.5"
              style={{ padding: '14px 16px' }}
            >
              <div className="min-w-0 flex-1">
                <div
                  className="text-[16px] font-extrabold"
                  style={{ letterSpacing: '-.02em' }}
                >
                  Week {meso.weekIndex + 1} of {meso.totalWeeks}
                </div>
                <div className="os-t mt-0.5">
                  {PHASE_LABEL[meso.phase] ?? meso.phase}
                  {meso.phase !== 'deload' &&
                    ` · deload in week ${meso.totalWeeks}`}
                  {(meso.blockIndex ?? 0) > 0 &&
                    ` · block ${(meso.blockIndex ?? 0) + 1}`}
                </div>
              </div>
              <div className="flex gap-1" aria-hidden>
                {Array.from({ length: meso.totalWeeks }, (_, i) => (
                  <i
                    key={i}
                    style={{
                      width: 12,
                      height: 22,
                      borderRadius: 4,
                      background:
                        i < meso.weekIndex
                          ? 'var(--acc)'
                          : i === meso.weekIndex
                            ? 'var(--acc)'
                            : 'var(--s3)',
                      opacity: i === meso.weekIndex ? 0.45 : 1,
                      boxShadow:
                        i === meso.totalWeeks - 1 && i > meso.weekIndex
                          ? 'inset 0 0 0 1.5px var(--mute)'
                          : undefined,
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          {(templates ?? []).length === 0 && (
            <div
              className="os-card mt-3 text-[14px] font-semibold"
              style={{ color: 'var(--mute)' }}
            >
              No days in this program yet. Add one below.
            </div>
          )}

          {(templates ?? []).map((t) => {
            const isNext = t.id === nextTpl?.id;
            const isOpen = t.id === open;
            const names = t.slots.map((s) =>
              shortName(nameOf(s.exerciseId), 16),
            );
            const shown = isOpen ? names : names.slice(0, 3);
            const extra = names.length - shown.length;
            return (
              <div
                key={t.id}
                className={`os-card ${isNext ? 'os-card--lift os-card--next' : ''} ${meso || isNext ? 'mt-2.5' : 'mt-4'}`}
                style={{ marginTop: isNext ? 12 : 10 }}
              >
                <button
                  type="button"
                  onClick={() => setOpenId(isOpen ? '' : t.id)}
                  aria-expanded={isOpen}
                  aria-label={`${t.name}, ${t.slots.length} exercises`}
                  className="os-press block w-full text-left"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span
                      className="truncate font-extrabold"
                      style={{
                        fontSize: isOpen ? 20 : 18,
                        letterSpacing: '-.025em',
                      }}
                    >
                      {t.name}
                    </span>
                    {isNext ? (
                      <span
                        className="os-chip os-chip--acc"
                        style={{ height: 26, fontSize: 12 }}
                      >
                        Next
                      </span>
                    ) : (
                      <span
                        className="os-t"
                        style={{ fontVariantNumeric: 'tabular-nums' }}
                      >
                        {estMin(t)} min
                      </span>
                    )}
                  </div>
                  {isOpen && (
                    <div className="os-t mt-0.5">
                      {t.slots.length}{' '}
                      {t.slots.length === 1 ? 'exercise' : 'exercises'} ·{' '}
                      {estMin(t)} min
                    </div>
                  )}
                  <div
                    className={`mt-2.5 flex-wrap gap-1.5 ${isOpen ? 'hidden' : 'flex'}`}
                  >
                    {shown.map((n, i) => (
                      <span
                        key={i}
                        className="os-chip"
                        style={isNext ? { background: 'var(--s1)' } : undefined}
                      >
                        {n}
                      </span>
                    ))}
                    {extra > 0 && (
                      <span
                        className="os-chip"
                        style={isNext ? { background: 'var(--s1)' } : undefined}
                      >
                        +{extra}
                      </span>
                    )}
                  </div>
                </button>
                <div className={`os-acc ${isOpen ? 'os-acc--open' : ''}`}>
                  <div>
                    <div className="mt-1.5">
                      {t.slots.map((sl, i) => {
                        const ex = getCatalogExercise(sl.exerciseId);
                        const lt =
                          sl.loadType ??
                          (ex
                            ? loadTypeFor(ex.equipment, ex.isBodyweight)
                            : undefined);
                        const lb = weightOf?.get(sl.exerciseId);
                        const reps =
                          sl.scheme.repTarget ??
                          (sl.scheme.repRange
                            ? `${sl.scheme.repRange[0]}–${sl.scheme.repRange[1]}`
                            : '');
                        return (
                          <div
                            key={sl.slotId}
                            className="os-row"
                            style={{ padding: '9px 0' }}
                          >
                            <span
                              className="os-t w-4"
                              style={{ fontVariantNumeric: 'tabular-nums' }}
                            >
                              {i + 1}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[14px] font-semibold">
                                {nameOf(sl.exerciseId)}
                              </span>
                              <span
                                className="os-t block text-[12px]"
                                style={{ fontVariantNumeric: 'tabular-nums' }}
                              >
                                {sl.scheme.sets} × {reps}
                              </span>
                            </span>
                            <span
                              className="text-right text-[14px] font-bold"
                              style={{ fontVariantNumeric: 'tabular-nums' }}
                            >
                              {lb === undefined
                                ? ''
                                : weightWithLoad(lb, units, lt)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                    <div className="mt-3.5 flex items-center gap-2">
                      {inProgress?.templateId === t.id ? (
                        <button
                          type="button"
                          onClick={() => openWorkout(inProgress.id)}
                          className="os-btn os-btn--sm os-btn--pri os-press flex-1"
                          tabIndex={isOpen ? 0 : -1}
                        >
                          Resume
                        </button>
                      ) : inProgress ? (
                        <span className="os-t flex-1 leading-snug">
                          Finish the workout in progress to start this day.
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => void start(t)}
                          className={`os-btn os-btn--sm os-press flex-1 ${isNext ? 'os-btn--pri' : ''}`}
                          tabIndex={isOpen ? 0 : -1}
                          style={
                            !isNext ? { background: 'var(--s2)' } : undefined
                          }
                        >
                          {isNext ? 'Start' : 'Start this day instead'}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => nav.push(`/routine/${t.id}`)}
                        className="os-btn os-btn--sm os-press flex-none px-5"
                        tabIndex={isOpen ? 0 : -1}
                        style={{ background: 'var(--s2)', width: 'auto' }}
                        aria-label={`Edit ${t.name}`}
                      >
                        Edit
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => nav.push('/routine/new')}
              className="os-btn os-btn--sm os-press"
            >
              + New day
            </button>
            <button
              type="button"
              onClick={() => nav.push('/onboarding')}
              className="os-btn os-btn--sm os-press"
            >
              Regenerate
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="os-h2">Your programs</div>
          <div className="os-card" style={{ padding: '4px 16px' }}>
            {programs.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => void setActiveProgram(p.id)}
                className="os-row os-press"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-semibold">
                    {p.name}
                  </span>
                  <span
                    className="mt-0.5 block text-[12px] font-medium"
                    style={{ color: 'var(--mute)' }}
                  >
                    Tap to make active
                  </span>
                </span>
                <span className="os-chev" />
              </button>
            ))}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => nav.push('/routine/new')}
              className="os-btn os-btn--sm os-press"
            >
              + New day
            </button>
            <button
              type="button"
              onClick={() => nav.push('/onboarding')}
              className="os-btn os-btn--sm os-press"
            >
              Build my plan
            </button>
          </div>
        </>
      )}
    </div>
  );
}

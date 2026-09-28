import { useState } from 'react';
import { useNav } from '../../ui/nav';
import { useLiveQuery } from 'dexie-react-hooks';
import { useCatalog } from '../library/useCatalog';
import { getCatalogExercise } from '../../db/catalog';
import { useProfile } from '../../db/hooks';
import { useSessionStore } from '../../state/session';
import { shortName } from '../../lib/format';
import {
  getActiveProgram,
  listTemplates,
  nextTemplateForProgram,
  setActiveProgram,
  startSessionFromTemplate,
} from '../../db/repositories';
import { db } from '../../db/db';
import { ScreenTitle } from '../../ui/StatGrid';
import type { WorkoutTemplate } from '../../db/types';
import { useScrollMemory } from '../../ui/scrollMemory';

/* Plan: the week card, then each day as a card. Tapping a day expands it to its exercises
   and collapses the open one (one open at a time). The next day is lifted with an accent
   ring and a Next chip and starts from here. */

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
  const beginSession = useSessionStore((s) => s.beginSession);
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
  const [openId, setOpenId] = useState<string | null>(null);
  const open = openId ?? nextTpl?.id ?? null;

  async function start(t: WorkoutTemplate) {
    const s = await startSessionFromTemplate(t, nowIso());
    beginSession(s.id);
    nav.pop('/today');
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
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
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
                    <div className="mt-3.5">
                      <button
                        type="button"
                        onClick={() => void start(t)}
                        className={`os-btn os-btn--sm os-press ${isNext ? 'os-btn--pri' : ''}`}
                        tabIndex={isOpen ? 0 : -1}
                        style={
                          !isNext ? { background: 'var(--s2)' } : undefined
                        }
                      >
                        {isNext ? 'Start' : 'Start this day instead'}
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

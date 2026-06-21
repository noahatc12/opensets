import { fmtWeight } from '../../lib/units';
import { getCatalogExercise } from '../../db/catalog';
import { useLogger } from './useLogger';
import { PrCelebration } from './PrCelebration';
import { ExercisePicker } from '../library/ExercisePicker';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  MinusIcon,
  PlusIcon,
} from '../../components/icons';

/* Readout logger — the single active logger for the build. It is a PRESENTATIONAL
   shell over useLogger(): every value and action comes from the hook, so a future
   Tempo skin is a second component over the same logic, not a rebuild. Ported from
   the Claude Design prototype (reference/OpenSets.dc.html): columnar set-list —
   header + per-set rows, the active set a columnar hero card with Weight │ Reps. */

const nameOf = (id: string) => getCatalogExercise(id)?.name ?? id;
const fmt = (n: number) => String(n);

function clock(totalSec: number): string {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

const numFont = {
  fontFamily: 'var(--font-num)',
  fontWeight: 'var(--num-weight)' as unknown as number,
  fontVariantNumeric: 'tabular-nums' as const,
};

export function ActiveSession() {
  const vm = useLogger();
  if (!vm) return null;
  const {
    sessionTitle,
    elapsed,
    exId,
    metaLine,
    lastWeights,
    totalSets,
    activeIndex,
    exerciseComplete,
    doneSets,
    pres,
    activePrescribed,
    activeSlot,
    last,
    slots,
    current,
    setCurrent,
    units,
    weight,
    reps,
    rpe,
    setWeight,
    setReps,
    setRpe,
    wStep,
    rest,
    restRemain,
    adjustRest,
    stopRest,
    whyOpen,
    setWhyOpen,
    celebrate,
    setCelebrate,
    toast,
    setToast,
    finishing,
    multiTabConflict,
    pickerMode,
    log,
    finish,
    undoSet,
    skip,
    openSwap,
    openAdd,
    closePicker,
    onPickExercise,
  } = vm;

  const totalForGrid = Math.max(totalSets, 1);

  return (
    <div className="relative flex h-full flex-col">
      {celebrate && (
        <PrCelebration
          kinds={celebrate.kinds}
          e1rm={celebrate.e1rm}
          onDismiss={() => setCelebrate(null)}
        />
      )}
      {/* Top bar */}
      <div className="flex flex-none items-center justify-between px-[22px] pb-3 pt-[max(0.625rem,env(safe-area-inset-top))]">
        <button
          onClick={() => void finish()}
          className="grid size-[42px] place-items-center border-none bg-transparent text-muted"
          aria-label="Back"
        >
          <ChevronLeftIcon className="size-[22px]" />
        </button>
        <div className="text-center">
          <div className="whitespace-nowrap text-[13px] font-semibold text-text">
            {sessionTitle}
          </div>
          <div className="mt-0.5 text-[11.5px] text-accent" style={numFont}>
            {elapsed} elapsed
          </div>
        </div>
        <button
          onClick={() => void finish()}
          disabled={finishing}
          className="h-[42px] border-none bg-transparent px-2.5 text-[14px] font-semibold text-muted"
        >
          {finishing ? '…' : 'Finish'}
        </button>
      </div>

      {multiTabConflict && (
        <div
          className="mx-[22px] mb-2 flex-none rounded-[var(--r-md)] px-3.5 py-2.5 text-[12px] font-medium"
          style={{
            background: 'color-mix(in oklab, var(--danger) 12%, var(--surface))',
            border: '1px solid color-mix(in oklab, var(--danger) 32%, transparent)',
            color: 'var(--danger)',
          }}
        >
          This workout is open in another tab. Logging is paused here to protect your
          data — finish in the original tab.
        </div>
      )}

      {/* Scroll area — Readout columnar set-list */}
      <div className="os-scroll flex-1 overflow-auto px-[22px] pb-2 pt-1">
        {/* exercise header */}
        <div className="pb-3.5">
          <div className="flex items-baseline justify-between gap-2.5">
            <div
              className="min-w-0 flex-1 truncate text-[25px] font-extrabold text-text"
              style={{ letterSpacing: 'var(--tracking-snug)' }}
            >
              {nameOf(exId)}
            </div>
            <div
              className="flex-none whitespace-nowrap text-[12px] text-muted"
              style={{ fontFamily: 'var(--font-num)' }}
            >
              {Math.min(activeIndex + 1, totalForGrid)} / {totalForGrid}
            </div>
          </div>
          <div className="mt-1.5 flex items-center gap-2.5">
            {metaLine && <span className="text-[12.5px] text-muted">{metaLine}</span>}
            {metaLine && lastWeights && <span className="size-[3px] rounded-full bg-faint" />}
            {lastWeights && (
              <span
                className="text-[12px] text-muted"
                style={{ fontFamily: 'var(--font-num)', letterSpacing: '.02em' }}
              >
                LAST {lastWeights}
              </span>
            )}
          </div>
          <div className="mt-3 flex gap-1">
            {Array.from({ length: totalForGrid }).map((_, i) => (
              <div
                key={i}
                className="h-[3px] flex-1 rounded-[2px]"
                style={{ background: i < activeIndex ? 'var(--accent)' : 'var(--surface-2)' }}
              />
            ))}
          </div>
        </div>

        {/* set rows */}
        <div className="flex flex-col gap-2.5">
          {Array.from({ length: totalForGrid }).map((_, i) => {
            const prescribed = pres?.sets[i];
            const done = doneSets[i];

            // Logged set: render done / missed row.
            if (done) {
              const target = pres?.sets[i]?.targetReps;
              const missed = target !== undefined && done.reps < target;
              const isPr = (done.isPR?.length ?? 0) > 0;
              return (
                <div
                  key={done.id}
                  className="flex items-center gap-3.5 rounded-[var(--r-md)] border bg-surface px-4 py-[11px]"
                  style={{
                    borderColor: missed
                      ? 'color-mix(in oklab, var(--danger) 28%, var(--border-card))'
                      : 'var(--border-card)',
                  }}
                >
                  <span className="w-3.5 text-[13px] text-faint" style={{ fontFamily: 'var(--font-num)' }}>
                    {done.order + 1}
                  </span>
                  <span className="text-[17px] font-semibold text-muted" style={numFont}>
                    {fmtWeight(done.weightLb, units)}
                    <span className="text-[11px] text-faint">{units}</span> × {done.reps}
                  </span>
                  {isPr ? (
                    <span
                      className="ml-auto rounded-[var(--r-pill)] px-[7px] py-0.5 text-[10px] uppercase text-pr"
                      style={{
                        fontFamily: 'var(--font-label)',
                        letterSpacing: '.1em',
                        border: '1px solid color-mix(in oklab, var(--pr) 40%, transparent)',
                      }}
                    >
                      PR
                    </span>
                  ) : missed ? (
                    <span
                      className="ml-auto flex items-center gap-1.5 text-[11px] uppercase text-danger"
                      style={{ fontFamily: 'var(--font-label)', letterSpacing: '.1em' }}
                    >
                      <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                        <path d="M4 4l6 6M10 4l-6 6" stroke="var(--danger)" strokeWidth="2" strokeLinecap="round" />
                      </svg>
                      Missed
                    </span>
                  ) : (
                    <span
                      className="ml-auto flex items-center gap-1.5 text-[11px] uppercase text-accent"
                      style={{ fontFamily: 'var(--font-label)', letterSpacing: '.1em' }}
                    >
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <path d="M2.5 7.5L5.5 10.5L11.5 3.5" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      Done
                    </span>
                  )}
                </div>
              );
            }

            // Active set: columnar hero card.
            if (i === activeIndex && !exerciseComplete && activePrescribed) {
              return (
                <div
                  key={`active-${i}`}
                  className="rounded-[var(--r-lg)] bg-surface px-4 pb-[18px] pt-4"
                  style={{
                    border: '1.5px solid var(--accent)',
                    boxShadow: '0 0 0 4px color-mix(in oklab, var(--accent) 7%, transparent)',
                  }}
                >
                  <div className="mb-3 flex items-center justify-between">
                    <span
                      className="text-[11px] uppercase text-accent"
                      style={{ fontFamily: 'var(--font-label)', letterSpacing: '.16em' }}
                    >
                      Set {activeIndex + 1} · Now
                    </span>
                    <span
                      className="rounded-[var(--r-pill)] px-2 py-[3px] text-[10px] uppercase text-muted"
                      style={{
                        fontFamily: 'var(--font-label)',
                        letterSpacing: '.08em',
                        background: 'color-mix(in oklab, var(--accent) 10%, transparent)',
                      }}
                    >
                      Target RPE {activePrescribed.targetRpe ?? 8}
                    </span>
                  </div>
                  <div className="flex items-stretch gap-2.5">
                    {/* Weight column */}
                    <div className="flex flex-1 flex-col items-center gap-2">
                      <span
                        className="text-[10px] uppercase text-muted"
                        style={{ fontFamily: 'var(--font-label)', letterSpacing: '.16em' }}
                      >
                        Weight
                      </span>
                      <div className="flex items-baseline gap-[3px]">
                        <span
                          className="text-[52px] leading-none text-text"
                          style={{ letterSpacing: 'var(--tracking-snug)', ...numFont }}
                        >
                          {fmtWeight(weight, units)}
                        </span>
                        <span className="text-[14px] font-semibold text-muted">{units}</span>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setWeight((w) => Math.max(0, Math.round((w - wStep) * 100) / 100))}
                          className="grid size-[46px] place-items-center rounded-[var(--r-sm)] border bg-surface-2 text-text"
                          style={{ borderColor: 'var(--border-strong)' }}
                          aria-label="decrease weight"
                        >
                          <MinusIcon className="size-6" />
                        </button>
                        <button
                          onClick={() => setWeight((w) => Math.round((w + wStep) * 100) / 100)}
                          className="grid size-[46px] place-items-center rounded-[var(--r-sm)] border bg-surface-2 text-text"
                          style={{ borderColor: 'var(--border-strong)' }}
                          aria-label="increase weight"
                        >
                          <PlusIcon className="size-6" />
                        </button>
                      </div>
                    </div>
                    <div className="w-px" style={{ background: 'var(--border)' }} />
                    {/* Reps column */}
                    <div className="flex flex-1 flex-col items-center gap-2">
                      <span
                        className="text-[10px] uppercase text-muted"
                        style={{ fontFamily: 'var(--font-label)', letterSpacing: '.16em' }}
                      >
                        Reps
                      </span>
                      <div className="flex items-baseline">
                        <span
                          className="text-[52px] leading-none text-text"
                          style={{ letterSpacing: 'var(--tracking-snug)', ...numFont }}
                        >
                          {fmt(reps)}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setReps((r) => Math.max(0, r - 1))}
                          className="grid size-[46px] place-items-center rounded-[var(--r-sm)] border bg-surface-2 text-text"
                          style={{ borderColor: 'var(--border-strong)' }}
                          aria-label="decrease reps"
                        >
                          <MinusIcon className="size-6" />
                        </button>
                        <button
                          onClick={() => setReps((r) => r + 1)}
                          className="grid size-[46px] place-items-center rounded-[var(--r-sm)] border bg-surface-2 text-text"
                          style={{ borderColor: 'var(--border-strong)' }}
                          aria-label="increase reps"
                        >
                          <PlusIcon className="size-6" />
                        </button>
                      </div>
                    </div>
                  </div>
                  {/* RPE */}
                  <div className="mt-3.5 flex items-center gap-[7px]">
                    <span
                      className="text-[10px] uppercase text-muted"
                      style={{ fontFamily: 'var(--font-label)', letterSpacing: '.12em' }}
                    >
                      RPE
                    </span>
                    {[7, 8, 9].map((n) => {
                      const sel = rpe === n;
                      return (
                        <button
                          key={n}
                          onClick={() => setRpe(sel ? undefined : n)}
                          className="rounded-[var(--r-sm)] px-[11px] py-1.5 text-[12px]"
                          style={{
                            fontFamily: 'var(--font-num)',
                            background: sel ? 'var(--accent)' : 'var(--bg)',
                            color: sel ? 'var(--accent-ink)' : 'var(--muted)',
                            fontWeight: sel ? 700 : 400,
                          }}
                        >
                          {n}
                        </button>
                      );
                    })}
                    <span className="ml-auto text-[10px] text-faint">optional</span>
                  </div>
                  {/* why this weight */}
                  {pres?.reason && (
                    <>
                      <button
                        onClick={() => setWhyOpen((v) => !v)}
                        className="mt-3.5 flex w-full items-start gap-2.5 rounded-[var(--r-sm)] px-3 py-2.5 text-left"
                        style={{
                          background: 'color-mix(in oklab, var(--accent) 6%, transparent)',
                          border: '1px solid color-mix(in oklab, var(--accent) 16%, transparent)',
                        }}
                      >
                        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" className="mt-px flex-none">
                          <circle cx="8" cy="8" r="7" stroke="var(--accent)" strokeWidth="1.3" />
                          <path d="M8 7.2v4M8 4.8h.01" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" />
                        </svg>
                        <span className="flex-1 text-[12.5px] leading-[1.45] text-muted">{pres.reason}</span>
                        {whyOpen ? (
                          <ChevronUpIcon className="size-4 flex-none text-faint" />
                        ) : (
                          <ChevronDownIcon className="size-4 flex-none text-faint" />
                        )}
                      </button>
                      {whyOpen && (
                        <div className="mt-2 rounded-[var(--r-sm)] bg-bg px-3 py-3 text-[12.5px] leading-[1.55] text-muted">
                          <Row k="Rule" v={activeSlot.progressionRule.kind} />
                          <Row
                            k="Last session"
                            v={last.length ? `${fmtWeight(last[0]!.weightLb, units)} ${units} · ${last.map((s) => s.reps).join('/')} reps` : '—'}
                          />
                          {pres.flags.length > 0 && <Row k="Flags" v={pres.flags.join(', ')} accent />}
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            }

            // Upcoming set (or, when complete, the active-index row): plain row.
            const isAmrapSet = prescribed?.amrap ?? false;
            return (
              <div
                key={`up-${i}`}
                className="flex items-center gap-3.5 rounded-[var(--r-md)] border bg-surface px-4 py-[11px]"
                style={{ borderColor: 'var(--border-card)' }}
              >
                <span className="w-3.5 text-[13px] text-faint" style={{ fontFamily: 'var(--font-num)' }}>
                  {i + 1}
                </span>
                <span className="text-[17px] font-semibold text-text" style={numFont}>
                  {prescribed ? fmtWeight(prescribed.targetWeightLb, units) : '—'}
                  <span className="text-[11px] text-faint">{units}</span> ×{' '}
                  {prescribed ? `${prescribed.targetReps}${isAmrapSet ? '+' : ''}` : '—'}
                </span>
                {isAmrapSet ? (
                  <span
                    className="ml-auto rounded-[var(--r-pill)] px-[7px] py-0.5 text-[10px] uppercase text-pr"
                    style={{
                      fontFamily: 'var(--font-label)',
                      letterSpacing: '.1em',
                      border: '1px solid color-mix(in oklab, var(--pr) 40%, transparent)',
                    }}
                  >
                    AMRAP
                  </span>
                ) : (
                  <span
                    className="ml-auto text-[10px] uppercase text-faint"
                    style={{ fontFamily: 'var(--font-label)', letterSpacing: '.12em' }}
                  >
                    Up next
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {exerciseComplete && current < slots.length - 1 && (
          <button
            onClick={() => setCurrent(current + 1)}
            className="mt-5 w-full rounded-[var(--r-lg)] bg-surface-2 py-3.5 text-[14px] font-semibold text-text"
          >
            Next: {nameOf(slots[current + 1]!.exerciseId)} →
          </button>
        )}

        <div className="h-2" />
      </div>

      {/* mid-session actions */}
      <div className="flex flex-none items-center gap-[7px] px-[22px] pb-2 pt-0.5">
        <button
          onClick={() => setCurrent(Math.max(0, current - 1))}
          className="grid size-[42px] flex-none place-items-center rounded-[var(--r-sm)] bg-surface text-muted"
          aria-label="Previous exercise"
        >
          <ChevronLeftIcon className="size-[18px]" />
        </button>
        <button
          onClick={openSwap}
          className="h-[42px] flex-1 rounded-[var(--r-sm)] bg-surface text-[13px] font-semibold text-text"
        >
          Swap
        </button>
        <button
          onClick={() => void skip()}
          className="h-[42px] flex-1 rounded-[var(--r-sm)] bg-surface text-[13px] font-semibold text-text"
        >
          Skip
        </button>
        <button
          onClick={openAdd}
          className="h-[42px] flex-1 rounded-[var(--r-sm)] bg-surface text-[13px] font-semibold text-text"
        >
          Add
        </button>
        <button
          onClick={() => setCurrent(Math.min(slots.length - 1, current + 1))}
          className="grid size-[42px] flex-none place-items-center rounded-[var(--r-sm)] bg-surface text-muted"
          aria-label="Next exercise"
        >
          <ChevronRightIcon className="size-[18px]" />
        </button>
      </div>

      {/* bottom thumb zone */}
      <div
        className="flex-none px-[22px] pb-[max(1.75rem,env(safe-area-inset-bottom))] pt-3"
        style={{ background: 'linear-gradient(180deg,transparent,var(--bg) 22%)' }}
      >
        {rest && (
          <div className="mb-3 flex items-center gap-3.5 rounded-[var(--r-lg)] bg-surface px-4 py-[11px]">
            <span className="text-[11px] font-bold uppercase tracking-wide text-muted">Rest</span>
            <span className="text-[26px] leading-none text-text" style={numFont}>
              {clock(restRemain)}
            </span>
            <div className="ml-auto flex gap-2">
              <button
                onClick={() => adjustRest(-15)}
                className="size-11 rounded-[var(--r-md)] bg-surface-2 text-[12px] font-semibold text-muted"
              >
                −15
              </button>
              <button
                onClick={() => adjustRest(15)}
                className="size-11 rounded-[var(--r-md)] bg-surface-2 text-[12px] font-semibold text-muted"
              >
                +15
              </button>
              <button
                onClick={stopRest}
                className="h-11 rounded-[var(--r-md)] bg-surface-2 px-4 text-[13px] font-semibold text-text"
              >
                Skip
              </button>
            </div>
          </div>
        )}
        {!exerciseComplete && activePrescribed ? (
          <button
            onClick={() => void log()}
            disabled={multiTabConflict}
            className="flex h-[60px] w-full items-center justify-center gap-2.5 rounded-[var(--r-lg)] bg-accent text-[16px] font-bold text-accent-ink disabled:opacity-50"
            style={{ letterSpacing: '.01em' }}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M4 10.5L8 14.5L16 5.5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Log Set {activeIndex + 1} ·{' '}
            <span style={{ fontFamily: 'var(--font-num)', fontVariantNumeric: 'tabular-nums' }}>
              {fmtWeight(weight, units)} × {fmt(reps)}
            </span>
          </button>
        ) : (
          <button
            onClick={() => void finish()}
            disabled={finishing}
            className="h-[62px] w-full rounded-[var(--r-xl)] bg-accent text-[17px] font-bold text-accent-ink"
          >
            {finishing ? 'Saving…' : 'Finish workout'}
          </button>
        )}
      </div>

      {/* set-logged undo toast: above the Log CTA / rest bar */}
      {toast && (
        <div
          className="absolute left-[18px] right-[18px] bottom-[calc(96px+env(safe-area-inset-bottom))] z-10 flex items-center gap-3 rounded-[var(--r-md)] px-4 py-3.5"
          style={{
            background: 'var(--elevated)',
            border: '1px solid var(--border)',
            boxShadow: 'var(--shadow-lg)',
            animation: 'os-toast-in var(--dur-base) var(--ease-out)',
          }}
        >
          <span className="flex-1 text-[13px] font-medium text-text">Set logged</span>
          <button
            onClick={() => {
              void undoSet(toast.setId);
              setToast(null);
            }}
            className="border-none bg-transparent text-[13px] font-bold text-accent"
          >
            Undo
          </button>
        </div>
      )}

      {pickerMode && (
        <ExercisePicker onPick={(ex) => void onPickExercise(ex)} onClose={closePicker} />
      )}
    </div>
  );
}

function Row({ k, v, accent }: { k: string; v: string; accent?: boolean }) {
  return (
    <div className="flex justify-between py-[3px]">
      <span>{k}</span>
      <span className={accent ? 'font-semibold text-success' : 'font-semibold text-text'}>{v}</span>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { fmtWeight, kgToLb, loadWord, toUnit } from '../../lib/units';
import {
  clock,
  compact,
  flagLabel,
  humanReason,
  ruleLabel,
  shortName,
  titleCase,
  weekdayLong,
} from '../../lib/format';
import { getCatalogExercise } from '../../db/catalog';
import { useSettings } from '../../db/hooks';
import { platesForWeight, roundToLoadable } from '../../engine';
import { plateList } from '../../lib/plates';
import { useLogger, type LoggerVM } from './useLogger';
import { PrCelebration } from './PrCelebration';
import { ExercisePicker } from '../library/ExercisePicker';
import { Sheet, SheetHeader, ConfirmSheet } from '../../ui/Sheet';
import { KeypadSheet } from '../../ui/Keypad';
import { Toast } from '../../ui/Toast';
import { Ring } from '../../ui/Ring';
import { StatTiles, BackButton } from '../../ui/StatGrid';
import { PlateMarks, BarDiagram } from '../../ui/Plates';
import type { LoggedSet } from '../../db/types';

/* The logger. A presentational shell over useLogger(): every value and action comes from
   the hook. Layout follows the premium reference: top bar, exercise strip, exercise head
   with the WHY strip, the active-set card with two numerals, the set rows, the CTA. Rest
   turns the bottom into a panel with a draining ring; Finish opens the summary. */

const nameOf = (id: string) => getCatalogExercise(id)?.name ?? id;
/** "3-1-1-0" reads as "3·1·1·0". */
const fmtTempo = (t: string) => t.replace(/-/g, '·');

export function ActiveSession() {
  const vm = useLogger();
  if (!vm) return null;
  if (vm.summaryOpen) return <Summary vm={vm} />;
  return <Logger vm={vm} />;
}

function Logger({ vm }: { vm: LoggerVM }) {
  const settings = useSettings();
  const loadType = vm.loadType;
  const pureBodyweight = loadType === 'bodyweight' && vm.weight === 0;
  const suggested = vm.pres?.flags.includes('suggested') ?? false;
  // A pure bodyweight load reads "BW" everywhere it is shown, never "0".
  const isBw = (lb: number) => loadType === 'bodyweight' && lb === 0;
  const w = (lb: number) => (isBw(lb) ? 'BW' : fmtWeight(lb, units));
  const {
    templateName,
    elapsed,
    exId,
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
    loggedAll,
    setSummaryOpen,
    log,
    leave,
    undoSet,
    skip,
    openSwap,
    openAdd,
    closePicker,
    onPickExercise,
  } = vm;

  const [keypad, setKeypad] = useState<'weight' | 'reps' | null>(null);
  const [platesOpen, setPlatesOpen] = useState(false);

  // Buzz at zero, then the panel goes away on its own.
  useEffect(() => {
    if (!rest || restRemain > 0) return;
    if (
      typeof navigator !== 'undefined' &&
      typeof navigator.vibrate === 'function'
    )
      navigator.vibrate([120, 60, 120]);
    stopRest();
  }, [rest, restRemain, stopRest]);

  const ex = getCatalogExercise(exId);
  const scheme = activeSlot.scheme;
  const repsLabel =
    scheme.repTarget ??
    (scheme.repRange ? `${scheme.repRange[0]}–${scheme.repRange[1]}` : '');
  const eyebrow = [
    `${current + 1} of ${slots.length}`,
    ex?.primaryMuscles[0] ? titleCase(ex.primaryMuscles[0]) : null,
    `${scheme.sets} × ${repsLabel}`,
  ]
    .filter(Boolean)
    .join(' · ');
  const coaching = [
    activeSlot.tempo ? `Tempo ${fmtTempo(activeSlot.tempo)}` : null,
    activeSlot.restTier
      ? `${titleCase(activeSlot.restTier)} rest ${clock(activeSlot.restWorkSec)}`
      : null,
  ]
    .filter(Boolean)
    .join(' · ');

  // Per-side plates follow the draft weight as the steppers move (barbell only).
  const barbell = loadType === 'barbell';
  const plates = barbell
    ? platesForWeight(weight, settings.barLb, settings.plateInventoryLb)
    : null;
  const nearest =
    barbell && plates === null
      ? roundToLoadable(weight, settings.barLb, settings.plateInventoryLb)
      : null;

  const perExercise = new Map<string, number>();
  for (const s of loggedAll)
    perExercise.set(s.exerciseId, (perExercise.get(s.exerciseId) ?? 0) + 1);
  const slotDone = (exerciseId: string, i: number) => {
    const n = perExercise.get(exerciseId) ?? 0;
    const need = slots[i]?.scheme.sets ?? 0;
    return need > 0 && n >= need;
  };

  // Every weight says what it is (docs/redesign/NAV.md, rule 7).
  const weightLabel =
    loadType === 'bodyweight' ? 'Added weight' : loadWord(loadType);
  const numeralSize = (s: string) =>
    s.length > 4 ? 52 : s.length > 3 ? 60 : 72;
  const ctaLabel = `Log set ${activeIndex + 1} · ${w(weight)} × ${reps}`;
  // Only promise a buzz where the browser can vibrate; WebKit on iPhone has had no
  // navigator.vibrate since 2017, so there the panel just ends.
  const zeroLine =
    typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function'
      ? 'The phone buzzes at zero.'
      : 'Rest ends at zero.';

  return (
    <div className="relative flex h-full flex-col">
      {celebrate && (
        <PrCelebration
          kinds={celebrate.kinds}
          e1rm={celebrate.e1rm}
          exerciseName={nameOf(celebrate.exerciseId)}
          weightLb={celebrate.weightLb}
          reps={celebrate.reps}
          previousBestE1rm={celebrate.previousBestE1rm}
          onDismiss={() => setCelebrate(null)}
        />
      )}

      {/* top bar */}
      <div className="flex flex-none items-center justify-between px-[18px] pt-[max(0.375rem,env(safe-area-inset-top))]">
        <button
          type="button"
          onClick={leave}
          className="os-icon-btn os-press"
          aria-label="Leave workout (keeps it resumable)"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
        <div className="min-w-0 text-center">
          <div className="truncate text-[14px] font-extrabold">
            {templateName}
          </div>
          <div className="os-t" style={{ fontVariantNumeric: 'tabular-nums' }}>
            {elapsed} · {loggedAll.length}{' '}
            {loggedAll.length === 1 ? 'set' : 'sets'}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setSummaryOpen(true)}
          disabled={finishing}
          className="os-chip os-press"
          style={{ height: 40, borderRadius: 13, fontSize: 14 }}
        >
          Finish
        </button>
      </div>

      {/* exercise strip */}
      <div className="flex flex-none items-center gap-1.5 px-[18px] pt-3">
        <button
          type="button"
          onClick={() => setCurrent(Math.max(0, current - 1))}
          disabled={current === 0}
          className="os-icon-btn os-press"
          style={{ width: 32, height: 32, borderRadius: 10 }}
          aria-label="Previous exercise"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M15 6l-6 6 6 6" />
          </svg>
        </button>
        <div className="os-chips min-w-0 flex-1">
          {slots.map((s, i) => {
            const done = slotDone(s.exerciseId, i);
            const on = i === current;
            return (
              <button
                key={s.slotId}
                type="button"
                onClick={() => setCurrent(i)}
                className={`os-chip os-press ${on ? 'os-chip--on' : ''}`}
                style={!on && done ? { color: 'var(--pos)' } : undefined}
                aria-current={on ? 'step' : undefined}
              >
                {done && !on ? '✓' : i + 1}{' '}
                {shortName(nameOf(s.exerciseId), 14)}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={() => setCurrent(Math.min(slots.length - 1, current + 1))}
          disabled={current >= slots.length - 1}
          className="os-icon-btn os-press"
          style={{ width: 32, height: 32, borderRadius: 10 }}
          aria-label="Next exercise"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M9 6l6 6-6 6" />
          </svg>
        </button>
      </div>

      {multiTabConflict && (
        <div
          className="mx-[18px] mt-3 flex-none rounded-[14px] px-3.5 py-2.5 text-[12.5px] font-semibold"
          style={{
            background: 'color-mix(in oklab, var(--danger) 12%, transparent)',
            color: 'var(--danger)',
          }}
        >
          This workout is open in another tab. Logging is paused here to protect
          your data. Finish in the original tab.
        </div>
      )}

      {/* scroll area */}
      <div className="flex-1 overflow-auto px-[18px] pb-3 pt-3.5">
        <div className="os-t">{eyebrow}</div>
        <h1 className="os-h1 mt-0.5" style={{ fontSize: 28 }}>
          {nameOf(exId)}
        </h1>
        {(coaching || activeSlot.coachingCue) && (
          <div className="os-t mt-1.5 leading-snug">
            {coaching}
            {coaching && activeSlot.coachingCue ? ' · ' : ''}
            {activeSlot.coachingCue}
          </div>
        )}

        {pres?.reason && (
          <>
            <button
              type="button"
              onClick={() => setWhyOpen((v) => !v)}
              className="os-why os-press mt-2.5"
              aria-expanded={whyOpen}
            >
              <span
                className="mt-px text-[12px] font-extrabold"
                style={{ color: 'var(--acc-tx)' }}
              >
                WHY
              </span>
              <span
                className="flex-1 text-[13px] leading-[1.4]"
                style={{ color: 'var(--ink2)' }}
              >
                {humanReason(pres.reason)}
              </span>
            </button>
            {whyOpen && (
              <div
                className="os-card mt-2 text-[12.5px] leading-[1.55]"
                style={{ padding: '10px 14px', color: 'var(--mute)' }}
              >
                <Row
                  k="How it grows"
                  v={ruleLabel(activeSlot.progressionRule.kind)}
                />
                <Row
                  k="Last session"
                  v={
                    last.length
                      ? `${fmtWeight(last[0]!.weightLb, units)} ${units} · ${last.map((s) => s.reps).join('/')} reps`
                      : 'none yet'
                  }
                />
                {pres.flags.length > 0 && (
                  <Row
                    k="Note"
                    v={pres.flags.map(flagLabel).join(', ')}
                    accent
                  />
                )}
              </div>
            )}
          </>
        )}

        {/* set rows: done above, the active card, upcoming below. During rest the card
            collapses and every row sits in one card, the staged set highlighted, so the
            Done and Next tags share one right edge. */}
        {(() => {
          const from = doneSets.length + (exerciseComplete ? 0 : 1);
          const upcoming = (pres?.sets ?? []).slice(from);
          const doneRows = doneSets.map((d) => (
            <SetRow
              key={d.id}
              n={d.order + 1}
              done={d}
              target={pres?.sets[d.order]?.targetReps}
              w={w}
            />
          ));
          const upRows = upcoming.map((p, j) => (
            <div key={`up-${j}`} className="os-row">
              <span className="os-t w-4">{from + j + 1}</span>
              <span
                className="os-num text-[18px]"
                style={{ color: 'var(--faint)' }}
              >
                {w(p.targetWeightLb)} × {p.targetReps}
                {p.amrap ? '+' : ''}
              </span>
              <span className="os-t ml-auto">
                {p.amrap ? 'AMRAP' : 'Up next'}
              </span>
            </div>
          ));
          const staged = !exerciseComplete && activePrescribed;
          if (rest) {
            if (!doneRows.length && !staged && !upRows.length) return null;
            return (
              <div className="os-card mt-3" style={{ padding: '6px 16px' }}>
                {doneRows}
                {staged && (
                  <div
                    className="os-row"
                    style={{
                      background: 'var(--acc-soft)',
                      margin: '0 -16px',
                      width: 'calc(100% + 32px)',
                      padding: '12px 16px',
                      borderTop: 0,
                      borderRadius: 14,
                    }}
                  >
                    <span
                      className="os-t w-4"
                      style={{ color: 'var(--acc-tx)' }}
                    >
                      {activeIndex + 1}
                    </span>
                    <span className="os-num text-[18px]">
                      {w(weight)} × {reps}
                    </span>
                    <span
                      className="os-t ml-auto"
                      style={{ color: 'var(--acc-tx)' }}
                    >
                      Next
                    </span>
                  </div>
                )}
                {upRows}
              </div>
            );
          }
          return (
            <>
              {doneRows.length > 0 && (
                <div className="os-card mt-3" style={{ padding: '6px 16px' }}>
                  {doneRows}
                </div>
              )}
              {/* active set */}
              {staged && (
                <div
                  className="os-card os-card--lift mt-3"
                  style={{ padding: '14px 16px 16px' }}
                >
                  <div className="flex justify-between">
                    <span className="os-t" style={{ color: 'var(--acc-tx)' }}>
                      Set {activeIndex + 1} of {totalSets}
                    </span>
                    <span className="os-t">
                      {activePrescribed.targetRpe !== undefined
                        ? `Target RPE ${activePrescribed.targetRpe}`
                        : `Target ${activePrescribed.targetReps}${activePrescribed.amrap ? '+' : ''} reps`}
                    </span>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-3.5 text-center">
                    <div>
                      <div className="os-t">
                        {weightLabel}
                        {!pureBodyweight && <span> · {units}</span>}
                      </div>
                      <button
                        type="button"
                        onClick={() => setKeypad('weight')}
                        aria-label="Type weight"
                        className="os-num os-press mt-1 w-full"
                        style={{ fontSize: numeralSize(w(weight)) }}
                      >
                        {pureBodyweight ? 'BW' : fmtWeight(weight, units)}
                      </button>
                      <div className="mt-2.5 flex justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => vm.stepWeight(-1)}
                          className="os-step os-press"
                          aria-label="decrease weight"
                        >
                          <Minus />
                        </button>
                        <button
                          type="button"
                          onClick={() => vm.stepWeight(1)}
                          className="os-step os-press"
                          aria-label="increase weight"
                        >
                          <Plus />
                        </button>
                      </div>
                    </div>
                    <div>
                      <div className="os-t">Reps</div>
                      <button
                        type="button"
                        onClick={() => setKeypad('reps')}
                        aria-label="Type reps"
                        className="os-num os-press mt-1 w-full"
                        style={{ fontSize: numeralSize(String(reps)) }}
                      >
                        {reps}
                      </button>
                      <div className="mt-2.5 flex justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => setReps((r) => Math.max(0, r - 1))}
                          className="os-step os-press"
                          aria-label="decrease reps"
                        >
                          <Minus />
                        </button>
                        <button
                          type="button"
                          onClick={() => setReps((r) => r + 1)}
                          className="os-step os-press"
                          aria-label="increase reps"
                        >
                          <Plus />
                        </button>
                      </div>
                    </div>
                  </div>

                  {barbell && (
                    <button
                      type="button"
                      onClick={() => setPlatesOpen(true)}
                      className="os-press mt-3.5 flex h-11 w-full items-center gap-2.5 rounded-[13px] px-3 text-left"
                      style={{
                        background: 'var(--s1)',
                        boxShadow: 'inset 0 1px 0 var(--hl)',
                      }}
                    >
                      <span className="os-t">Per side</span>
                      {plates && plates.length > 0 && (
                        <PlateMarks platesLb={plates} units={units} />
                      )}
                      <span
                        className="text-[14px] font-extrabold"
                        style={{ fontVariantNumeric: 'tabular-nums' }}
                      >
                        {plates
                          ? plateList(plates, units)
                          : `not loadable, nearest ${fmtWeight(nearest ?? settings.barLb, units)}`}
                      </span>
                      <span className="os-chev ml-auto" />
                    </button>
                  )}

                  {/* A weight nobody has lifted yet: say so, and say how to calibrate it. */}
                  {suggested && (
                    <p
                      className="mt-3 text-center text-[12px] font-medium leading-snug"
                      style={{ color: 'var(--mute)' }}
                    >
                      <span
                        className="font-bold"
                        style={{ color: 'var(--ink)' }}
                      >
                        Suggested start.
                      </span>{' '}
                      Pick a weight you could lift 2 to 3 more times. Your log
                      sets the next one.
                    </p>
                  )}

                  <div className="mt-2.5 flex items-center gap-2.5">
                    <span className="os-t w-[34px]">RPE</span>
                    <div
                      className="os-seg flex-1"
                      role="group"
                      aria-label="RPE"
                    >
                      {[6, 7, 8, 9, 10].map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setRpe(rpe === n ? undefined : n)}
                          aria-pressed={rpe === n}
                          style={{ fontVariantNumeric: 'tabular-nums' }}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {upRows.length > 0 && (
                <div className="os-card mt-3" style={{ padding: '6px 16px' }}>
                  {upRows}
                </div>
              )}
            </>
          );
        })()}

        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={openSwap}
            className="os-btn os-btn--sm os-press flex-1"
          >
            Swap
          </button>
          <button
            type="button"
            onClick={() => void skip()}
            className="os-btn os-btn--sm os-press flex-1"
          >
            Skip
          </button>
          <button
            type="button"
            onClick={openAdd}
            className="os-btn os-btn--sm os-press flex-1"
          >
            Add
          </button>
        </div>
      </div>

      {/* The undo toast sits in the flow above the bottom panel: floating, it covered
          Swap, Skip and Add for its whole 10 seconds (persona check, 09-28). */}
      {toast && (
        <div className="flex-none px-4 pb-2 pt-1">
          <Toast
            action="Undo"
            onAction={() => {
              void undoSet(toast.setId);
              setToast(null);
            }}
          >
            Set logged
          </Toast>
        </div>
      )}

      {/* bottom: rest panel or the CTA */}
      {rest ? (
        <div
          className="os-sheet flex-none"
          style={{
            position: 'relative',
            paddingBottom: 'calc(20px + env(safe-area-inset-bottom, 0px))',
            animation: 'none',
            maxHeight: 'none',
          }}
        >
          <div className="os-grab" />
          <div className="flex items-center gap-[18px]">
            <Ring
              size={112}
              stroke={9}
              value={restRemain / rest.durationSec}
              animate
              label={`${clock(restRemain)} of ${clock(rest.durationSec)} rest`}
            >
              <div className="os-num text-[30px]">{clock(restRemain)}</div>
              <div className="os-t" style={{ fontSize: 11 }}>
                of {clock(rest.durationSec)}
              </div>
            </Ring>
            <div className="min-w-0 flex-1">
              <div
                className="text-[18px] font-extrabold"
                style={{ letterSpacing: '-.02em' }}
              >
                Rest
              </div>
              <div className="os-t mt-0.5 leading-[1.4]">
                {!exerciseComplete && activePrescribed
                  ? `Set ${activeIndex + 1} is staged at ${w(weight)} × ${reps}. ${zeroLine}`
                  : zeroLine}
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => adjustRest(-15)}
                  className="os-chip os-press flex-1 justify-center"
                  style={{ height: 40, borderRadius: 13 }}
                >
                  −15
                </button>
                <button
                  type="button"
                  onClick={() => adjustRest(15)}
                  className="os-chip os-press flex-1 justify-center"
                  style={{ height: 40, borderRadius: 13 }}
                >
                  +15
                </button>
                <button
                  type="button"
                  onClick={stopRest}
                  aria-label="Skip rest"
                  className="os-chip os-chip--on os-press justify-center"
                  style={{ height: 40, borderRadius: 13, flex: 1.3 }}
                >
                  Skip
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="os-fade-under flex-none px-[18px] pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-2.5">
          {!exerciseComplete && activePrescribed ? (
            <button
              type="button"
              onClick={() => void log()}
              disabled={multiTabConflict}
              className="os-btn os-btn--pri os-press"
              style={{ height: 60, fontSize: 18 }}
            >
              {ctaLabel}
            </button>
          ) : current < slots.length - 1 ? (
            <button
              type="button"
              onClick={() => setCurrent(current + 1)}
              className="os-btn os-btn--ink os-press"
              style={{ height: 60, fontSize: 17 }}
            >
              Next: {shortName(nameOf(slots[current + 1]!.exerciseId), 22)} →
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setSummaryOpen(true)}
              disabled={finishing}
              className="os-btn os-btn--pri os-press"
              style={{ height: 60, fontSize: 17 }}
            >
              Finish workout
            </button>
          )}
        </div>
      )}

      <KeypadSheet
        open={keypad === 'weight'}
        label={`${weightLabel}, ${units}`}
        current={pureBodyweight ? '0' : fmtWeight(weight, units)}
        decimal
        onDone={(v) => setWeight(Math.max(0, units === 'kg' ? kgToLb(v) : v))}
        onClose={() => setKeypad(null)}
      />
      <KeypadSheet
        open={keypad === 'reps'}
        label="Reps"
        current={String(reps)}
        decimal={false}
        onDone={(v) => setReps(Math.max(0, Math.round(v)))}
        onClose={() => setKeypad(null)}
      />

      <Sheet
        open={platesOpen}
        onClose={() => setPlatesOpen(false)}
        label="Plate math"
      >
        <SheetHeader
          title="Plate math"
          action="Done"
          onAction={() => setPlatesOpen(false)}
        />
        <div className="mt-1.5 flex items-baseline gap-2">
          <span className="os-num text-[64px]">{fmtWeight(weight, units)}</span>
          <span className="os-t text-[14px]">{units} on the bar</span>
        </div>
        <div className="mt-3.5">
          <BarDiagram platesLb={plates ?? []} units={units} />
        </div>
        <div
          className="os-card mt-3"
          style={{ padding: '4px 16px', background: 'var(--s2)' }}
        >
          <div className="os-row">
            <span className="os-t flex-1 text-[15px]">Each side</span>
            <span
              className="os-num text-[17px]"
              style={{ letterSpacing: '-.02em' }}
            >
              {plates ? plateList(plates, units) : 'not loadable'}
            </span>
          </div>
          <div className="os-row">
            <span className="os-t flex-1 text-[15px]">Bar</span>
            <span
              className="os-num text-[17px]"
              style={{ letterSpacing: '-.02em' }}
            >
              {fmtWeight(settings.barLb, units)}
              <small className="os-t ml-1 text-[12px]">{units}</small>
            </span>
          </div>
          <div className="os-row">
            <span className="os-t flex-1 text-[15px]">Your plates</span>
            <PlateMarks
              platesLb={settings.plateInventoryLb}
              units={units}
              sleeve={false}
              label={`${settings.plateInventoryLb.length} plate sizes`}
            />
          </div>
        </div>
        {plates === null && nearest !== null && (
          <div className="os-t mt-3 text-center">
            {fmtWeight(weight, units)} cannot be loaded exactly. Nearest is{' '}
            {fmtWeight(nearest, units)} {units},{' '}
            {fmtWeight(Math.abs(weight - nearest), units)} {units}{' '}
            {nearest < weight ? 'under' : 'over'}.
          </div>
        )}
        <div className="os-t mt-3 text-center">
          Change bar and plates in You, then Training
        </div>
      </Sheet>

      {pickerMode && (
        <ExercisePicker
          title={
            pickerMode === 'swap'
              ? `Swap ${shortName(nameOf(exId), 24)}`
              : 'Add exercise'
          }
          verb={pickerMode === 'swap' ? 'Swap to' : 'Add'}
          onPick={(e) => void onPickExercise(e)}
          onClose={closePicker}
        />
      )}
    </div>
  );
}

function SetRow({
  n,
  done,
  target,
  w,
}: {
  n: number;
  done: LoggedSet;
  target: number | undefined;
  w: (lb: number) => string;
}) {
  const missed = target !== undefined && done.reps < target;
  const isPr = (done.isPR?.length ?? 0) > 0;
  return (
    <div className="os-row">
      <span className="os-t w-4">{n}</span>
      <span className="os-num text-[18px]">
        {w(done.weightLb)} × {done.reps}
      </span>
      {done.rpe !== undefined && (
        <span className="os-t ml-1.5">@{done.rpe}</span>
      )}
      {isPr ? (
        <span className="os-tag os-tag--pr ml-auto">PR</span>
      ) : missed ? (
        <span
          className="os-tag ml-auto"
          style={{
            background: 'color-mix(in oklab, var(--danger) 14%, transparent)',
            color: 'var(--danger)',
          }}
        >
          Missed
        </span>
      ) : (
        <span className="os-tag os-tag--pos ml-auto">Done</span>
      )}
    </div>
  );
}

function Summary({ vm }: { vm: LoggerVM }) {
  const {
    session,
    templateName,
    elapsed,
    slots,
    loggedAll,
    units,
    finish,
    discard,
    finishing,
    setSummaryOpen,
  } = vm;
  const [confirm, setConfirm] = useState(false);
  // elapsed is the hook's ticking m:ss clock; the summary reads whole minutes off it.
  const mins = Math.max(
    1,
    Math.round(
      parseInt(elapsed.split(':')[0] ?? '0', 10) +
        parseInt(elapsed.split(':')[1] ?? '0', 10) / 60,
    ),
  );
  const volume = loggedAll.reduce(
    (s, x) => s + Math.max(0, x.weightLb) * x.reps,
    0,
  );
  const records = loggedAll.filter((x) => x.isPR?.length).length;
  const byEx = new Map<string, LoggedSet[]>();
  for (const s of loggedAll) {
    const arr = byEx.get(s.exerciseId) ?? [];
    arr.push(s);
    byEx.set(s.exerciseId, arr);
  }
  // Every exercise in the session, then any with logged sets that left it (skipped after
  // a set was logged): the Sets tile counts those sets, so the list shows them too.
  const inSlots = new Set(slots.map((s) => s.exerciseId));
  const rows = [
    ...slots.map((s) => ({ key: s.slotId, exerciseId: s.exerciseId })),
    ...[...byEx.keys()]
      .filter((id) => !inSlots.has(id))
      .map((id) => ({ key: `left-${id}`, exerciseId: id })),
  ];
  const wr = (s: LoggedSet) =>
    `${s.weightLb > 0 ? fmtWeight(s.weightLb, units) : 'BW'}×${s.reps}`;

  return (
    <div className="relative flex h-full flex-col">
      <div className="flex-1 overflow-auto px-[18px] pb-[150px] pt-[max(0.5rem,env(safe-area-inset-top))]">
        <BackButton
          onClick={() => setSummaryOpen(false)}
          label="Back to the workout"
        />
        <div className="os-t mt-3.5" style={{ color: 'var(--acc-tx)' }}>
          {templateName} · {weekdayLong(session.startedAt)}
        </div>
        <h1 className="os-h1 mt-0.5" style={{ fontSize: 36 }}>
          Nice work.
        </h1>
        <div className="mt-4">
          <StatTiles
            stats={[
              { label: 'Time', value: mins, unit: 'min' },
              { label: 'Sets', value: loggedAll.length },
              {
                label: 'Volume',
                value: compact(toUnit(volume, units)),
                unit: units,
              },
              {
                label: 'Records',
                value: records,
                color: records > 0 ? 'var(--pr)' : undefined,
              },
            ]}
          />
        </div>
        <div className="os-card mt-3" style={{ padding: '4px 16px' }}>
          {rows.map((s) => {
            const sets = byEx.get(s.exerciseId) ?? [];
            const pr = sets.some((x) => x.isPR?.length);
            return (
              <div key={s.key} className="os-row">
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
                    {sets.length
                      ? sets
                          .sort((a, b) => a.order - b.order)
                          .map(wr)
                          .join(' · ')
                      : 'no sets logged'}
                  </span>
                </span>
                {pr && <span className="os-tag os-tag--pr">PR</span>}
              </div>
            );
          })}
        </div>
      </div>
      <div className="os-dock">
        <button
          type="button"
          onClick={() => void finish()}
          disabled={finishing}
          className="os-btn os-btn--pri os-press"
          style={{ height: 58, fontSize: 17 }}
        >
          {finishing ? 'Saving…' : 'Save workout'}
        </button>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setSummaryOpen(false)}
            className="os-btn os-btn--sm os-press"
          >
            Keep training
          </button>
          <button
            type="button"
            onClick={() => setConfirm(true)}
            className="os-btn os-btn--sm os-btn--danger os-press"
          >
            Discard
          </button>
        </div>
      </div>
      <ConfirmSheet
        open={confirm}
        title="Discard this workout?"
        body={`${loggedAll.length} logged ${loggedAll.length === 1 ? 'set' : 'sets'} will be removed and nothing will progress. This cannot be undone.`}
        cta="Discard workout"
        onConfirm={() => {
          setConfirm(false);
          void discard();
        }}
        onClose={() => setConfirm(false)}
      />
    </div>
  );
}

function Row({ k, v, accent }: { k: string; v: string; accent?: boolean }) {
  return (
    <div className="flex justify-between py-[3px]">
      <span>{k}</span>
      <span
        className="font-semibold"
        style={{ color: accent ? 'var(--pos)' : 'var(--ink)' }}
      >
        {v}
      </span>
    </div>
  );
}

function Minus() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M5 12h14" />
    </svg>
  );
}
function Plus() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

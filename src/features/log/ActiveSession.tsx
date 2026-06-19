import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useActiveWorkout } from './useActiveWorkout';
import { useSessionStore } from '../../state/session';
import { useCatalog } from '../library/useCatalog';
import { getCatalogExercise } from '../../db/catalog';
import {
  logSet,
  softDeleteSet,
  completeSessionAndAdvance,
} from '../../db/repositories';
import { Button } from '../../components/Button';
import { Stepper } from '../../components/Stepper';
import { cn } from '../../components/cn';
import type { PrescribedSet, SetType } from '../../engine/types';

const nowIso = () => new Date().toISOString();
const fmt = (n: number) => (Number.isInteger(n) ? String(n) : String(n));
const nameOf = (id: string) => getCatalogExercise(id)?.name ?? id;

export function ActiveSession() {
  useCatalog(); // ensure the catalog is loaded so exercise names resolve
  const { session, prescriptions, lastByExercise, logged } = useActiveWorkout();
  const current = useSessionStore((s) => s.currentExercise);
  const setCurrent = useSessionStore((s) => s.setCurrentExercise);
  const startRest = useSessionStore((s) => s.startRest);
  const stopRest = useSessionStore((s) => s.stopRest);
  const endSession = useSessionStore((s) => s.endSession);
  const navigate = useNavigate();
  const [finishing, setFinishing] = useState(false);

  if (!session) return null;
  const slots = session.executedSlots ?? [];
  const slot = slots[Math.min(current, slots.length - 1)];
  if (!slot) return null;

  const exId = slot.exerciseId;
  const pres = prescriptions[exId];
  const last = lastByExercise[exId] ?? [];
  const doneSets = logged
    .filter((l) => l.exerciseId === exId)
    .sort((a, b) => a.order - b.order);

  const totalDone = logged.length;
  const totalSets = slots.reduce(
    (n, s) => n + (prescriptions[s.exerciseId]?.sets.length ?? 0),
    0,
  );

  async function log(weightKg: number, reps: number, type: SetType) {
    await logSet({
      sessionId: session!.id,
      exerciseId: exId,
      date: session!.date,
      order: doneSets.length,
      type,
      weightKg,
      reps,
      completed: true,
    });
    startRest(slot!.restWorkSec);
  }

  async function finish() {
    setFinishing(true);
    stopRest();
    await completeSessionAndAdvance(session!.id, nowIso());
    endSession();
    navigate('/today');
  }

  const lastLine = last.length
    ? `Last: ${last.map((s) => `${fmt(s.weightKg)}×${s.reps}`).join(', ')}`
    : 'First time — no history yet';

  const exerciseComplete = pres ? doneSets.length >= pres.sets.length : false;

  return (
    <div className="min-h-full pb-40">
      <header className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-border bg-bg/90 px-4 pb-3 pt-[max(1rem,env(safe-area-inset-top))] backdrop-blur">
        <div className="min-w-0">
          <div className="truncate text-lg font-bold text-text">Workout</div>
          <div className="text-[12px] text-muted">
            {totalDone}/{totalSets} sets logged
          </div>
        </div>
        <Button
          variant="primary"
          className="min-h-10 px-4"
          disabled={finishing}
          onClick={() => void finish()}
        >
          {finishing ? 'Saving…' : 'Finish'}
        </Button>
      </header>

      {/* Exercise switcher */}
      <div className="flex gap-2 overflow-x-auto px-4 py-3">
        {slots.map((s, i) => {
          const dn = logged.filter((l) => l.exerciseId === s.exerciseId).length;
          const tot = prescriptions[s.exerciseId]?.sets.length ?? 0;
          const complete = tot > 0 && dn >= tot;
          return (
            <button
              key={s.slotId}
              type="button"
              onClick={() => setCurrent(i)}
              className={cn(
                'flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px]',
                i === current
                  ? 'border-accent bg-accent/10 text-text'
                  : 'border-border text-muted',
              )}
            >
              <span className="max-w-32 truncate">{nameOf(s.exerciseId)}</span>
              <span className={complete ? 'text-accent' : 'text-faint'}>
                {complete ? '✓' : `${dn}/${tot}`}
              </span>
            </button>
          );
        })}
      </div>

      {/* Current exercise */}
      <div className="px-4">
        <h2 className="text-xl font-bold text-text">{nameOf(exId)}</h2>
        <p className="mt-0.5 text-[13px] text-muted">{lastLine}</p>
        {pres?.reason && (
          <div className="mt-2 rounded-lg border border-accent/30 bg-accent/5 px-3 py-2 text-[13px] text-text">
            <span className="text-accent">●</span> {pres.reason}
          </div>
        )}

        <div className="mt-4 flex flex-col gap-2">
          {pres?.sets.map((ps, i) => {
            if (i < doneSets.length) {
              const d = doneSets[i]!;
              return (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-lg border border-border bg-surface px-3 py-2.5"
                >
                  <span className="text-[14px] text-muted">Set {i + 1}</span>
                  <div className="flex items-center gap-3">
                    <span className="tnum text-[15px] font-semibold text-text">
                      {fmt(d.weightKg)} kg × {d.reps}
                    </span>
                    <span className="text-accent">✓</span>
                    <button
                      type="button"
                      aria-label="Undo set"
                      onClick={() => void softDeleteSet(d.id, nowIso())}
                      className="text-faint hover:text-danger"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              );
            }
            if (i === doneSets.length) {
              return (
                <ActiveSetRow key={i} index={i} prescribed={ps} onLog={log} />
              );
            }
            return (
              <div
                key={i}
                className="flex items-center justify-between rounded-lg border border-dashed border-border px-3 py-2.5 opacity-50"
              >
                <span className="text-[14px] text-muted">Set {i + 1}</span>
                <span className="tnum text-[14px] text-muted">
                  {fmt(ps.targetWeightKg)} kg × {ps.targetReps}
                  {ps.amrap ? '+' : ''}
                </span>
              </div>
            );
          })}
        </div>

        {exerciseComplete && current < slots.length - 1 && (
          <Button
            block
            variant="secondary"
            className="mt-4"
            onClick={() => setCurrent(current + 1)}
          >
            Next: {nameOf(slots[current + 1]!.exerciseId)} →
          </Button>
        )}
      </div>
    </div>
  );
}

function ActiveSetRow({
  index,
  prescribed,
  onLog,
}: {
  index: number;
  prescribed: PrescribedSet;
  onLog: (weightKg: number, reps: number, type: SetType) => void;
}) {
  const [weight, setWeight] = useState(prescribed.targetWeightKg);
  const [reps, setReps] = useState(prescribed.targetReps);

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-accent bg-surface px-3 py-2.5">
      <span className="text-[14px] font-medium text-text">
        Set {index + 1}
        {prescribed.amrap && <span className="ml-1 text-accent">AMRAP</span>}
      </span>
      <div className="ml-auto flex items-center gap-2">
        <Stepper
          ariaLabel="weight"
          value={weight}
          step={2.5}
          suffix="kg"
          onChange={setWeight}
        />
        <Stepper
          ariaLabel="reps"
          value={reps}
          step={1}
          min={0}
          onChange={setReps}
        />
        <Button
          className="min-h-11 px-3"
          onClick={() => onLog(weight, reps, prescribed.type)}
        >
          ✓
        </Button>
      </div>
    </div>
  );
}

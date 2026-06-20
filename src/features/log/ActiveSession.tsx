import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useActiveWorkout } from './useActiveWorkout';
import { useSessionStore } from '../../state/session';
import { useCatalog } from '../library/useCatalog';
import { getCatalogExercise } from '../../db/catalog';
import {
  logSet,
  softDeleteSet,
  completeSessionAndAdvance,
  detectAndMarkPRs,
} from '../../db/repositories';
import type { PrescribedSet, SetType } from '../../engine/types';

/* Ported from the Claude Design "Tempo" prototype (reference/OpenSets.dc.html):
   centered hero — scoreboard weight×reps, paired steppers, RPE, why-this-weight,
   done-set glances, mid-session actions, bottom rest bar + Log CTA. Inline,
   token-based styles to match the reference exactly. */

const nowIso = () => new Date().toISOString();
const nameOf = (id: string) => getCatalogExercise(id)?.name ?? id;
const fmt = (n: number) => (Number.isInteger(n) ? String(n) : String(n));

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
  useCatalog();
  const { session, prescriptions, lastByExercise, logged } = useActiveWorkout();
  const current = useSessionStore((s) => s.currentExercise);
  const setCurrent = useSessionStore((s) => s.setCurrentExercise);
  const startRest = useSessionStore((s) => s.startRest);
  const adjustRest = useSessionStore((s) => s.adjustRest);
  const stopRest = useSessionStore((s) => s.stopRest);
  const rest = useSessionStore((s) => s.rest);
  const endSession = useSessionStore((s) => s.endSession);
  const navigate = useNavigate();

  const [finishing, setFinishing] = useState(false);
  const [whyOpen, setWhyOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  // Active-set edit state, reset when the active set (exercise / set index) changes.
  const [weight, setWeight] = useState(0);
  const [reps, setReps] = useState(0);
  const [rpe, setRpe] = useState<number | undefined>(undefined);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const slots = session?.executedSlots ?? [];
  const slot = slots[Math.min(current, Math.max(0, slots.length - 1))];
  const exId = slot?.exerciseId ?? '';
  const pres = exId ? prescriptions[exId] : undefined;
  const doneSets = logged
    .filter((l) => l.exerciseId === exId)
    .sort((a, b) => a.order - b.order);
  const activeIndex = doneSets.length;
  const activePrescribed: PrescribedSet | undefined = pres?.sets[activeIndex];

  // Sync the editable values to the active prescribed set.
  const sig = `${exId}:${activeIndex}:${activePrescribed?.targetWeightKg}:${activePrescribed?.targetReps}`;
  const [sigSeen, setSigSeen] = useState('');
  if (sig !== sigSeen && activePrescribed) {
    setSigSeen(sig);
    setWeight(activePrescribed.targetWeightKg);
    setReps(activePrescribed.targetReps);
    setRpe(undefined);
  }

  if (!session || !slot) return null;

  const last = lastByExercise[exId] ?? [];
  const lastLine = last.length
    ? `last ${fmt(last[0]!.weightKg)} × ${last.map((s) => s.reps).join(', ')}`
    : 'first time';
  const totalSets = pres?.sets.length ?? 0;
  const exerciseComplete = totalSets > 0 && activeIndex >= totalSets;
  const elapsed = clock(Math.max(0, Math.floor((now - Date.parse(session.startedAt)) / 1000)));
  const isAmrap = activePrescribed?.amrap ?? false;

  async function log() {
    if (!activePrescribed) return;
    const loggedRow = await logSet({
      sessionId: session!.id,
      exerciseId: exId,
      date: session!.date,
      order: activeIndex,
      type: (isAmrap ? 'amrap' : 'working') as SetType,
      weightKg: weight,
      reps,
      completed: true,
      ...(rpe !== undefined ? { rpe } : {}),
    });
    await detectAndMarkPRs(loggedRow);
    setWhyOpen(false);
    startRest(slot!.restWorkSec);
  }

  async function finish() {
    setFinishing(true);
    stopRest();
    await completeSessionAndAdvance(session!.id, nowIso());
    endSession();
    navigate('/today');
  }

  const restRemain = rest ? Math.max(0, Math.ceil((rest.endsAt - now) / 1000)) : 0;

  return (
    <div className="flex h-full flex-col">
      {/* Top bar */}
      <div
        className="flex flex-none items-center justify-between px-[22px] pb-3 pt-[max(0.625rem,env(safe-area-inset-top))]"
      >
        <button
          onClick={() => void finish()}
          className="size-[42px] border-none bg-transparent text-[22px] text-muted"
          aria-label="Back"
        >
          ‹
        </button>
        <div className="text-center">
          <div className="whitespace-nowrap text-[13px] font-semibold text-text">
            Workout
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

      {/* Scroll area */}
      <div className="os-scroll flex-1 overflow-auto px-[22px] pb-2 pt-1">
        {/* exercise header */}
        <div className="pb-1.5 text-center">
          <div
            className="text-[28px] font-bold text-text"
            style={{ letterSpacing: 'var(--tracking-tight)' }}
          >
            {nameOf(exId)}
          </div>
          <div className="mt-[5px] text-[13px] text-muted" style={numFont}>
            {exerciseComplete
              ? `${totalSets} of ${totalSets} done`
              : `Set ${activeIndex + 1} of ${totalSets} · ${lastLine}`}
          </div>
          <div className="mt-3.5 flex justify-center gap-2">
            {Array.from({ length: Math.max(totalSets, 1) }).map((_, i) => (
              <span
                key={i}
                className="h-[5px] w-8 rounded-[3px]"
                style={{
                  background: i < activeIndex ? 'var(--accent)' : 'var(--surface-2)',
                }}
              />
            ))}
          </div>
        </div>

        {/* hero set card */}
        {!exerciseComplete && activePrescribed && (
          <div
            className="mt-3.5 rounded-[var(--r-2xl)] border bg-surface px-5 pb-5 pt-6"
            style={{ borderColor: 'var(--border-card)', boxShadow: 'var(--hairline-top)' }}
          >
            <div className="flex items-baseline justify-center gap-[7px]">
              <span
                className="text-text"
                style={{
                  fontSize: 'var(--num-xl)',
                  lineHeight: 0.9,
                  letterSpacing: 'var(--tracking-tight)',
                  ...numFont,
                }}
              >
                {fmt(weight)}
              </span>
              <span className="text-[18px] font-medium text-muted">kg</span>
              <span className="mx-2 text-[28px] font-light text-faint">×</span>
              <span
                className="text-text"
                style={{
                  fontSize: 'var(--num-xl)',
                  lineHeight: 0.9,
                  letterSpacing: 'var(--tracking-tight)',
                  ...numFont,
                }}
              >
                {fmt(reps)}
              </span>
              <span className="text-[18px] font-medium text-muted">reps</span>
            </div>

            {/* steppers */}
            <div className="mt-[22px] flex gap-3">
              <StepRow
                label="2.5 kg"
                onDec={() => setWeight((w) => Math.max(0, Math.round((w - 2.5) * 100) / 100))}
                onInc={() => setWeight((w) => Math.round((w + 2.5) * 100) / 100)}
              />
              <StepRow
                label="rep"
                onDec={() => setReps((r) => Math.max(0, r - 1))}
                onInc={() => setReps((r) => r + 1)}
              />
            </div>

            {/* RPE */}
            <div className="mt-3.5 flex items-center gap-2">
              <span className="text-[12px] font-semibold text-muted">RPE</span>
              {[7, 8, 9].map((n) => {
                const sel = rpe === n;
                return (
                  <button
                    key={n}
                    onClick={() => setRpe(sel ? undefined : n)}
                    className="rounded-[var(--r-pill)] px-[13px] py-[7px] text-[13px]"
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
              <span className="ml-auto text-[11px] text-faint">optional</span>
            </div>

            {/* why this weight */}
            {pres?.reason && (
              <>
                <button
                  onClick={() => setWhyOpen((v) => !v)}
                  className="mt-4 flex w-full items-center gap-2.5 rounded-[var(--r-md)] px-4 py-[13px] text-left"
                  style={{
                    background: 'color-mix(in oklab, var(--accent) 9%, var(--surface))',
                    border: '1px solid color-mix(in oklab, var(--accent) 22%, transparent)',
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="flex-none">
                    <circle cx="8" cy="8" r="7" stroke="var(--accent)" strokeWidth="1.3" />
                    <path d="M8 7.2v4M8 4.8h.01" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                  <span className="flex-1 text-[12.5px] leading-[1.4] text-text">
                    {pres.reason}
                  </span>
                  <span className="text-[18px] text-faint">{whyOpen ? '⌃' : '⌄'}</span>
                </button>
                {whyOpen && (
                  <div className="mt-2 rounded-[var(--r-md)] bg-bg px-4 py-3.5 text-[12.5px] leading-[1.55] text-muted">
                    <Row k="Rule" v={slot.progressionRule.kind} />
                    <Row
                      k="Last session"
                      v={last.length ? `${fmt(last[0]!.weightKg)} kg · ${last.map((s) => s.reps).join('/')} reps` : '—'}
                    />
                    {pres.flags.length > 0 && (
                      <Row k="Flags" v={pres.flags.join(', ')} accent />
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* done-set glances */}
        {doneSets.map((d) => (
          <div
            key={d.id}
            className="mt-[18px] flex items-center justify-center gap-2.5 text-[13px] text-muted"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="7.5" fill="color-mix(in oklab, var(--accent) 18%, transparent)" />
              <path d="M5 8l2 2 4-4.5" stroke="var(--accent)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>
              Set {d.order + 1} logged —{' '}
              <span className="text-text" style={numFont}>
                {fmt(d.weightKg)} kg × {d.reps}
              </span>
            </span>
            {d.isPR && d.isPR.length > 0 && (
              <span
                className="rounded px-1.5 text-[10px] font-bold uppercase tracking-wide text-pr"
                style={{ border: '1px solid color-mix(in oklab, var(--pr) 40%, transparent)' }}
              >
                PR
              </span>
            )}
            <button
              onClick={() => void softDeleteSet(d.id, nowIso())}
              className="text-faint"
              aria-label="Undo set"
            >
              ✕
            </button>
          </div>
        ))}

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
          className="size-[42px] flex-none rounded-[var(--r-sm)] bg-surface text-[18px] text-muted"
        >
          ‹
        </button>
        <button className="h-[42px] flex-1 rounded-[var(--r-sm)] bg-surface text-[13px] font-semibold text-text">
          Swap
        </button>
        <button className="h-[42px] flex-1 rounded-[var(--r-sm)] bg-surface text-[13px] font-semibold text-text">
          Skip
        </button>
        <button className="h-[42px] flex-1 rounded-[var(--r-sm)] bg-surface text-[13px] font-semibold text-text">
          Add
        </button>
        <button
          onClick={() => setCurrent(Math.min(slots.length - 1, current + 1))}
          className="size-[42px] flex-none rounded-[var(--r-sm)] bg-surface text-[18px] text-muted"
        >
          ›
        </button>
      </div>

      {/* bottom thumb zone */}
      <div
        className="flex-none px-[22px] pb-[max(1.75rem,env(safe-area-inset-bottom))] pt-3"
        style={{ background: 'linear-gradient(180deg,transparent,var(--bg) 22%)' }}
      >
        {rest && (
          <div className="mb-3 flex items-center gap-3.5 rounded-[var(--r-lg)] bg-surface px-4 py-[11px]">
            <span className="text-[11px] font-bold uppercase tracking-wide text-muted">
              Rest
            </span>
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
            className="h-[62px] w-full rounded-[var(--r-xl)] bg-accent text-[17px] font-bold text-accent-ink"
          >
            Log Set {activeIndex + 1}
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
    </div>
  );
}

function StepRow({
  label,
  onDec,
  onInc,
}: {
  label: string;
  onDec: () => void;
  onInc: () => void;
}) {
  return (
    <div className="flex flex-1 items-center justify-between rounded-[var(--r-lg)] bg-bg p-1.5">
      <button
        onClick={onDec}
        className="size-12 rounded-[var(--r-md)] bg-surface-2 text-[24px] text-text"
        aria-label={`decrease ${label}`}
      >
        −
      </button>
      <span className="text-[12px] font-semibold text-muted">{label}</span>
      <button
        onClick={onInc}
        className="size-12 rounded-[var(--r-md)] bg-surface-2 text-[24px] text-text"
        aria-label={`increase ${label}`}
      >
        +
      </button>
    </div>
  );
}

function Row({ k, v, accent }: { k: string; v: string; accent?: boolean }) {
  return (
    <div className="flex justify-between py-[3px]">
      <span>{k}</span>
      <span
        className={accent ? 'font-semibold text-success' : 'font-semibold text-text'}
      >
        {v}
      </span>
    </div>
  );
}

/**
 * useLogger — all functional logic for the active-session logger, extracted from
 * ActiveSession so the Readout screen is a pure presentational shell over it
 * (and a future Tempo skin is a second presentational component over the same
 * hook, not a rebuild). No JSX here: state, derived values, and actions only.
 */
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { useSettings } from '../../db/hooks';
import { fmtWeight, weightStepKg, weightStepLabel } from '../../lib/units';
import { useActiveWorkout } from './useActiveWorkout';
import { useSessionStore, type RestTimer } from '../../state/session';
import { getCatalogExercise } from '../../db/catalog';
import { useCatalog } from '../library/useCatalog';
import {
  logSet,
  softDeleteSet,
  completeSessionAndAdvance,
  detectAndMarkPRs,
  setSessionSlots,
  makeSlot,
} from '../../db/repositories';
import {
  saveActiveSnapshot,
  getActiveSnapshot,
  clearActiveSnapshot,
} from '../../db/recovery';
import { guardActiveSession } from '../../db/multiTab';
import type {
  Exercise,
  ExerciseSlot,
  LoggedSet,
  WorkoutSession,
} from '../../db/types';
import type {
  Prescription,
  PrescribedSet,
  PRKind,
  ProgressionRule,
  SetType,
  SetResult,
} from '../../engine/types';

export type PickerMode = 'swap' | 'add' | null;

/** Default progression for an ad-hoc exercise added mid-workout (hypertrophy double). */
const ADD_RULE: ProgressionRule = {
  kind: 'double',
  repMin: 8,
  repMax: 12,
  incrementKg: 2.5,
  perSet: false,
};
const ADD_SCHEME = { sets: 3, repRange: [8, 12] as [number, number] };

const nowIso = () => new Date().toISOString();

/** "lowerBack" / "barbell" → "Lower Back" / "Barbell" for the meta row. */
function titleCase(s: string): string {
  const spaced = s.replace(/([a-z])([A-Z])/g, '$1 $2');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function clock(totalSec: number): string {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export interface LoggerVM {
  // identity / header
  sessionTitle: string;
  elapsed: string;
  exId: string;
  metaLine: string;
  lastWeights: string;
  // progress + sets
  totalSets: number;
  activeIndex: number;
  exerciseComplete: boolean;
  doneSets: LoggedSet[];
  pres: Prescription | undefined;
  activePrescribed: PrescribedSet | undefined;
  activeSlot: ExerciseSlot;
  last: SetResult[];
  // exercise nav
  slots: ExerciseSlot[];
  current: number;
  setCurrent: (i: number) => void;
  // active-set editing
  units: 'kg' | 'lb';
  weight: number;
  reps: number;
  rpe: number | undefined;
  setWeight: React.Dispatch<React.SetStateAction<number>>;
  setReps: React.Dispatch<React.SetStateAction<number>>;
  setRpe: React.Dispatch<React.SetStateAction<number | undefined>>;
  wStep: number;
  wStepLabel: string;
  // rest timer
  rest: ReturnType<typeof useSessionStore.getState>['rest'];
  restRemain: number;
  adjustRest: (deltaSec: number) => void;
  stopRest: () => void;
  // overlays / transient
  whyOpen: boolean;
  setWhyOpen: React.Dispatch<React.SetStateAction<boolean>>;
  celebrate: { kinds: PRKind[]; e1rm: number | null } | null;
  setCelebrate: React.Dispatch<
    React.SetStateAction<{ kinds: PRKind[]; e1rm: number | null } | null>
  >;
  toast: { setId: string } | null;
  setToast: React.Dispatch<React.SetStateAction<{ setId: string } | null>>;
  finishing: boolean;
  multiTabConflict: boolean;
  pickerMode: PickerMode;
  // actions
  log: () => Promise<void>;
  finish: () => Promise<void>;
  undoSet: (setId: string) => Promise<void>;
  skip: () => Promise<void>;
  openSwap: () => void;
  openAdd: () => void;
  closePicker: () => void;
  onPickExercise: (exercise: Exercise) => Promise<void>;
  session: WorkoutSession;
}

export function useLogger(): LoggerVM | null {
  useCatalog();
  const { units, restAutoStart, defaultRestWarmupSec, defaultRestWorkSec } =
    useSettings();
  const { session, prescriptions, lastByExercise, logged } = useActiveWorkout();
  const current = useSessionStore((s) => s.currentExercise);
  const setCurrent = useSessionStore((s) => s.setCurrentExercise);
  const startRest = useSessionStore((s) => s.startRest);
  const adjustRest = useSessionStore((s) => s.adjustRest);
  const stopRest = useSessionStore((s) => s.stopRest);
  const rest = useSessionStore((s) => s.rest);
  const endSession = useSessionStore((s) => s.endSession);
  const restoreUI = useSessionStore((s) => s.restoreUI);
  const navigate = useNavigate();

  const [finishing, setFinishing] = useState(false);
  const [whyOpen, setWhyOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [celebrate, setCelebrate] = useState<{
    kinds: PRKind[];
    e1rm: number | null;
  } | null>(null);
  const [toast, setToast] = useState<{ setId: string } | null>(null);
  const [pickerMode, setPickerMode] = useState<PickerMode>(null);
  const [multiTabConflict, setMultiTabConflict] = useState(false);
  const [readyToSave, setReadyToSave] = useState(false);
  const restoredForRef = useRef<string | null>(null);

  // Multi-tab guard: if another tab already holds the active session, warn + go
  // read-only here. Browser-only (no-op in node/tests).
  useEffect(() => {
    const guard = guardActiveSession(() => setMultiTabConflict(true));
    return () => guard.release();
  }, []);

  const program = useLiveQuery(
    () => (session?.programId ? db.programs.get(session.programId) : undefined),
    [session?.programId],
  );
  const template = useLiveQuery(
    () => (session?.templateId ? db.templates.get(session.templateId) : undefined),
    [session?.templateId],
  );
  const sessionTitle =
    program && template ? `${program.name} · ${template.name}` : 'Workout';

  const [weight, setWeight] = useState(0);
  const [reps, setReps] = useState(0);
  const [rpe, setRpe] = useState<number | undefined>(undefined);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Auto-dismiss the set-logged undo toast (10 s undo window, spec §5 P1).
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 10_000);
    return () => clearTimeout(id);
  }, [toast]);

  // Crash recovery: restore the ephemeral UI (current exercise + rest timer) from
  // the snapshot once per session BEFORE we start overwriting it, so a reload
  // resumes exactly where the lifter left off (the rest timer's absolute endsAt
  // survives the reload). Then enable debounced snapshotting.
  useEffect(() => {
    if (!session || restoredForRef.current === session.id) return;
    restoredForRef.current = session.id;
    let live = true;
    void getActiveSnapshot().then((snap) => {
      if (!live) return;
      if (snap && snap.sessionId === session.id) {
        const p = snap.payload as
          | { currentExercise?: number; rest?: RestTimer | null }
          | null;
        if (p) restoreUI(p.currentExercise ?? 0, p.rest ?? null);
      }
      setReadyToSave(true);
    });
    return () => {
      live = false;
    };
  }, [session, restoreUI]);

  // Debounced snapshot (≤ 250 ms after a mutation, spec §9). Gated on readyToSave
  // so the initial mount can't overwrite the snapshot before it's been restored.
  useEffect(() => {
    if (!session || !readyToSave) return;
    const id = setTimeout(() => {
      void saveActiveSnapshot(
        session.id,
        { currentExercise: current, rest },
        nowIso(),
      );
    }, 250);
    return () => clearTimeout(id);
  }, [session, readyToSave, current, rest, logged.length]);

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
  const activeSlot = slot;

  const last = lastByExercise[exId] ?? [];
  const totalSets = pres?.sets.length ?? 0;
  const exerciseComplete = totalSets > 0 && activeIndex >= totalSets;
  const elapsed = clock(
    Math.max(0, Math.floor((now - Date.parse(session.startedAt)) / 1000)),
  );
  const isAmrap = activePrescribed?.amrap ?? false;

  const restRemain = rest ? Math.max(0, Math.ceil((rest.endsAt - now) / 1000)) : 0;
  const ex = exId ? getCatalogExercise(exId) : undefined;
  const metaLine = ex
    ? [
        ex.equipment ? titleCase(ex.equipment) : null,
        ex.primaryMuscles[0] ? titleCase(ex.primaryMuscles[0]) : null,
      ]
        .filter(Boolean)
        .join(' · ')
    : '';
  const lastWeights = last.length
    ? `${fmtWeight(last[0]!.weightKg, units)}×${last.map((s) => s.reps).join(',')}`
    : '';
  const wStep = weightStepKg(units);
  const wStepLabel = weightStepLabel(units);

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
    const pr = await detectAndMarkPRs(loggedRow);
    if (pr.kinds.length > 0) {
      setCelebrate({ kinds: pr.kinds, e1rm: pr.e1rm });
    }
    setToast({ setId: loggedRow.id });
    setWhyOpen(false);
    if (restAutoStart ?? true) startRest(slot!.restWorkSec);
  }

  async function finish() {
    setFinishing(true);
    stopRest();
    await completeSessionAndAdvance(session!.id, nowIso());
    await clearActiveSnapshot();
    endSession();
    navigate('/today');
  }

  async function undoSet(setId: string) {
    await softDeleteSet(setId, nowIso());
  }

  /** Mid-workout edits mutate the session's frozen slots only (template untouched). */
  async function skip() {
    const next = slots.filter((_, i) => i !== current);
    await setSessionSlots(session!.id, next);
    if (next.length === 0) {
      await finish();
      return;
    }
    setCurrent(Math.min(current, next.length - 1));
  }

  const openSwap = () => setPickerMode('swap');
  const openAdd = () => setPickerMode('add');
  const closePicker = () => setPickerMode(null);

  async function onPickExercise(exercise: Exercise) {
    const mode = pickerMode;
    setPickerMode(null);
    if (mode === 'swap') {
      const next = slots.map((s, i) =>
        i === current ? { ...s, exerciseId: exercise.id } : s,
      );
      await setSessionSlots(session!.id, next);
    } else if (mode === 'add') {
      const slot = makeSlot(exercise.id, slots.length, ADD_RULE, ADD_SCHEME, {
        warmupSec: defaultRestWarmupSec,
        workSec: defaultRestWorkSec,
      });
      await setSessionSlots(session!.id, [...slots, slot]);
      setCurrent(slots.length);
    }
  }

  return {
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
    wStepLabel,
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
    session,
  };
}

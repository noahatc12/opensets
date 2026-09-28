/**
 * useLogger: all functional logic for the active-session logger, extracted from
 * ActiveSession so the Readout screen is a pure presentational shell over it
 * (and a future Tempo skin is a second presentational component over the same
 * hook, not a rebuild). No JSX here: state, derived values, and actions only.
 */
import { useEffect, useRef, useState } from 'react';
import { useNav } from '../../ui/nav';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { useSettings } from '../../db/hooks';
import { fmtWeight, weightStepLb, weightStepLabel } from '../../lib/units';
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
import { loadTypeFor, roundForLoad } from '../../engine/loading';
import { e1rm, isE1rmEligible } from '../../engine/e1rm';
import { loadStepsOf } from '../../db/repositories';
import type { LoadType } from '../../engine/types';
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

/** What the record screen shows: the set that set it and the best it beat. */
export interface Celebration {
  kinds: PRKind[];
  e1rm: number | null;
  exerciseId: string;
  weightLb: number;
  reps: number;
  previousBestE1rm: number | null;
}

/** Default progression for an ad-hoc exercise added mid-workout (hypertrophy double). */
const ADD_RULE: ProgressionRule = {
  kind: 'double',
  repMin: 8,
  repMax: 12,
  incrementLb: 2.5,
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
  /** The day's name alone, for the logger's top bar. */
  templateName: string;
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
  loadType: LoadType | undefined;
  stepWeight: (dir: 1 | -1) => void;
  // rest timer
  rest: ReturnType<typeof useSessionStore.getState>['rest'];
  restRemain: number;
  adjustRest: (deltaSec: number) => void;
  stopRest: () => void;
  // overlays / transient
  whyOpen: boolean;
  setWhyOpen: React.Dispatch<React.SetStateAction<boolean>>;
  celebrate: Celebration | null;
  setCelebrate: React.Dispatch<React.SetStateAction<Celebration | null>>;
  toast: { setId: string } | null;
  setToast: React.Dispatch<React.SetStateAction<{ setId: string } | null>>;
  finishing: boolean;
  multiTabConflict: boolean;
  pickerMode: PickerMode;
  /** Every set logged this session (all exercises), for the strip and the summary. */
  loggedAll: LoggedSet[];
  summaryOpen: boolean;
  setSummaryOpen: React.Dispatch<React.SetStateAction<boolean>>;
  // actions
  log: () => Promise<void>;
  /** Save: complete the session and advance progression. */
  finish: () => Promise<void>;
  /** Discard: soft-delete the logged sets and close the session without advancing. */
  discard: () => Promise<void>;
  leave: () => void;
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
  const settings = useSettings();
  const { units, restAutoStart, defaultRestWarmupSec, defaultRestWorkSec } =
    settings;
  const { session, prescriptions, lastByExercise, logged } = useActiveWorkout();
  const current = useSessionStore((s) => s.currentExercise);
  const setCurrent = useSessionStore((s) => s.setCurrentExercise);
  const startRest = useSessionStore((s) => s.startRest);
  const adjustRest = useSessionStore((s) => s.adjustRest);
  const stopRest = useSessionStore((s) => s.stopRest);
  const rest = useSessionStore((s) => s.rest);
  const endSession = useSessionStore((s) => s.endSession);
  const leaveSession = useSessionStore((s) => s.leaveSession);
  const restoreUI = useSessionStore((s) => s.restoreUI);
  const nav = useNav();

  const [finishing, setFinishing] = useState(false);
  const [whyOpen, setWhyOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [celebrate, setCelebrate] = useState<Celebration | null>(null);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [toast, setToast] = useState<{ setId: string } | null>(null);
  const [pickerMode, setPickerMode] = useState<PickerMode>(null);
  const [multiTabConflict, setMultiTabConflict] = useState(false);
  const [readyToSave, setReadyToSave] = useState(false);
  const restoredForRef = useRef<string | null>(null);
  // In-flight guards. State updates land after a re-render, so a fast double tap would
  // read the same activeIndex twice and log a duplicate set; refs flip synchronously.
  const loggingRef = useRef(false);
  const finishingRef = useRef(false);

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
    () =>
      session?.templateId ? db.templates.get(session.templateId) : undefined,
    [session?.templateId],
  );
  const sessionTitle =
    program && template ? `${program.name} · ${template.name}` : 'Workout';
  const templateName = template?.name ?? program?.name ?? 'Workout';

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
        const p = snap.payload as {
          currentExercise?: number;
          rest?: RestTimer | null;
        } | null;
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
  const sig = `${exId}:${activeIndex}:${activePrescribed?.targetWeightLb}:${activePrescribed?.targetReps}`;
  const [sigSeen, setSigSeen] = useState('');
  if (sig !== sigSeen && activePrescribed) {
    setSigSeen(sig);
    setWeight(activePrescribed.targetWeightLb);
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

  const restRemain = rest
    ? Math.max(0, Math.ceil((rest.endsAt - now) / 1000))
    : 0;
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
    ? `${fmtWeight(last[0]!.weightLb, units)}×${last.map((s) => s.reps).join(',')}`
    : '';
  const wStep = weightStepLb(units);
  const wStepLabel = weightStepLabel(units);
  // How this exercise is loaded (older slots lack the field: derive it from the catalog).
  const loadType: LoadType | undefined =
    activeSlot.loadType ??
    (ex ? loadTypeFor(ex.equipment, ex.isBodyweight) : undefined);

  /** The +/- weight buttons. Dumbbells and stacks step along what the gym actually has
   *  (15 -> 17.5 -> 20 -> 25 on a dumbbell rack); barbell and bodyweight keep the flat
   *  step. */
  function stepWeight(dir: 1 | -1) {
    if (loadType === 'dumbbell' || loadType === 'stack') {
      const args = [
        loadType,
        settings.barLb,
        settings.plateInventoryLb,
        loadStepsOf(settings),
      ] as const;
      setWeight((w) =>
        dir > 0
          ? roundForLoad(w + 0.01, ...args, 'up')
          : Math.max(0, roundForLoad(w - 0.01, ...args, 'down')),
      );
      return;
    }
    setWeight((w) => Math.max(0, Math.round((w + dir * wStep) * 100) / 100));
  }

  async function log() {
    if (!activePrescribed || loggingRef.current) return;
    loggingRef.current = true;
    try {
      const loggedRow = await logSet({
        sessionId: session!.id,
        exerciseId: exId,
        date: session!.date,
        order: activeIndex,
        type: (isAmrap ? 'amrap' : 'working') as SetType,
        weightLb: weight,
        reps,
        completed: true,
        ...(rpe !== undefined ? { rpe } : {}),
      });
      const pr = await detectAndMarkPRs(loggedRow);
      if (pr.kinds.length > 0) {
        // The best this set beat, for the record screen's "previous best" line.
        const prior = (
          await db.sets.where('exerciseId').equals(exId).toArray()
        ).filter(
          (s) =>
            s.id !== loggedRow.id &&
            !s.deletedAt &&
            s.completed &&
            isE1rmEligible(s),
        );
        const previousBestE1rm = prior.length
          ? Math.max(...prior.map((s) => e1rm(s.weightLb, s.reps)))
          : null;
        setCelebrate({
          kinds: pr.kinds,
          e1rm: pr.e1rm,
          exerciseId: exId,
          weightLb: weight,
          reps,
          previousBestE1rm,
        });
      }
      setToast({ setId: loggedRow.id });
      setWhyOpen(false);
      if (restAutoStart ?? true) startRest(slot!.restWorkSec);
    } finally {
      loggingRef.current = false;
    }
  }

  async function finish() {
    if (finishingRef.current) return;
    finishingRef.current = true;
    setFinishing(true);
    stopRest();
    await completeSessionAndAdvance(session!.id, nowIso());
    await clearActiveSnapshot();
    endSession();
    nav.pop('/today');
  }

  /** Throw the session away: every logged set is soft-deleted (undoable in the data),
   *  the session is closed as partial so it neither resumes nor counts as done, and no
   *  progression state moves. */
  async function discard() {
    if (finishingRef.current) return;
    finishingRef.current = true;
    setFinishing(true);
    stopRest();
    const now = nowIso();
    for (const s of logged) await softDeleteSet(s.id, now);
    await db.sessions.update(session!.id, { status: 'partial', endedAt: now });
    await clearActiveSnapshot();
    endSession();
    nav.pop('/today');
  }

  /** Non-destructive leave: step out to Today without finalizing. The session stays
   *  status:'active' in Dexie and its recovery snapshot is kept, so it's fully
   *  resumable. Does NOT complete, advance progression, or clear the snapshot — a
   *  misclick on Back can never finalize a workout. (Finish is the only finalize.) */
  function leave() {
    stopRest();
    leaveSession();
    nav.pop('/today');
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
    const loadType = loadTypeFor(exercise.equipment, exercise.isBodyweight);
    if (mode === 'swap') {
      // The swapped-in exercise brings its own load type. The old exercise's cue and
      // tempo do not transfer (a hip-thrust must not inherit a deadlift cue), and a
      // bodyweight swap progresses by reps rather than by added plates.
      const next = slots.map((s, i) => {
        if (i !== current) return s;
        const { coachingCue: _cue, tempo: _tempo, ...rest } = s;
        void _cue;
        void _tempo;
        const rule: ProgressionRule =
          loadType === 'bodyweight'
            ? { kind: 'repsOnly', repIncrement: 1 }
            : s.progressionRule.kind === 'repsOnly'
              ? ADD_RULE
              : s.progressionRule;
        return {
          ...rest,
          exerciseId: exercise.id,
          loadType,
          progressionRule: rule,
        };
      });
      await setSessionSlots(session!.id, next);
    } else if (mode === 'add') {
      const slot = makeSlot(
        exercise.id,
        slots.length,
        loadType === 'bodyweight'
          ? { kind: 'repsOnly', repIncrement: 1 }
          : ADD_RULE,
        ADD_SCHEME,
        { warmupSec: defaultRestWarmupSec, workSec: defaultRestWorkSec },
        { loadType },
      );
      await setSessionSlots(session!.id, [...slots, slot]);
      setCurrent(slots.length);
    }
  }

  return {
    sessionTitle,
    templateName,
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
    loadType,
    stepWeight,
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
    loggedAll: logged,
    summaryOpen,
    setSummaryOpen,
    log,
    finish,
    discard,
    leave,
    undoSet,
    skip,
    openSwap,
    openAdd,
    closePicker,
    onPickExercise,
    session,
  };
}

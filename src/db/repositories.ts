/**
 * Repositories — the seam between the pure engine and Dexie storage (spec §9).
 *
 * Progression runs at session COMPLETION (the progression event): the engine reads
 * what you logged and computes the next session's prescription, which is cached on
 * the exercise-state row (`pending`) so the Today view never re-runs progression
 * (which would double-advance). All timestamping takes `now` in for testability —
 * the UI passes `new Date().toISOString()`.
 */
import { db, getSettings } from './db';
import { newId } from './ids';
import { nextPrescription, detectPRs, type PRResult } from '../engine';
import type {
  EngineSettings,
  ExerciseState,
  Prescription,
  ProgressionRule,
  SetResult,
  SetScheme,
} from '../engine/types';
import type {
  ExerciseSlot,
  ExerciseStateRow,
  LoggedSet,
  Program,
  UserSettings,
  WorkoutSession,
  WorkoutTemplate,
} from './types';

const localDate = (iso: string) => iso.slice(0, 10);

function engineSettings(s: UserSettings): EngineSettings {
  return {
    barLb: s.barLb,
    plateInventoryLb: s.plateInventoryLb,
    rounding: 'nearest',
    units: s.units,
  };
}

function schemeOf(slot: ExerciseSlot): SetScheme {
  return {
    sets: slot.scheme.sets,
    repTarget: slot.scheme.repTarget,
    repRange: slot.scheme.repRange,
    amrapLast: slot.scheme.amrapLast,
  };
}

function toSetResult(s: LoggedSet): SetResult {
  return {
    weightLb: s.weightLb,
    reps: s.reps,
    type: s.type,
    completed: s.completed,
    ...(s.rpe !== undefined ? { rpe: s.rpe } : {}),
    ...(s.durationSec !== undefined ? { durationSec: s.durationSec } : {}),
    ...(s.distanceM !== undefined ? { distanceM: s.distanceM } : {}),
  };
}

// --- Programs ---

export function listPrograms(): Promise<Program[]> {
  return db.programs.toArray();
}

export function getActiveProgram(): Promise<Program | undefined> {
  return db.programs.filter((p) => p.isActive).first();
}

export async function createProgram(
  name: string,
  now: string,
): Promise<Program> {
  const program: Program = {
    id: newId(),
    name,
    isActive: false,
    createdAt: now,
  };
  await db.programs.add(program);
  return program;
}

export async function setActiveProgram(id: string): Promise<void> {
  await db.transaction('rw', db.programs, async () => {
    await db.programs.toCollection().modify((p) => {
      p.isActive = p.id === id;
    });
  });
}

export async function renameProgram(id: string, name: string): Promise<void> {
  await db.programs.update(id, { name });
}

// --- Templates & slots ---

export function listTemplates(programId: string): Promise<WorkoutTemplate[]> {
  return db.templates.where('programId').equals(programId).sortBy('dayIndex');
}

export async function createTemplate(
  programId: string,
  name: string,
  dayIndex: number,
): Promise<WorkoutTemplate> {
  const tpl: WorkoutTemplate = {
    id: newId(),
    programId,
    name,
    dayIndex,
    slots: [],
  };
  await db.templates.add(tpl);
  return tpl;
}

export async function saveTemplate(tpl: WorkoutTemplate): Promise<void> {
  await db.templates.put(tpl);
}

/** Append a slot to a template, defaulting the rest/warm-up/substitution fields. */
export function makeSlot(
  exerciseId: string,
  order: number,
  rule: ProgressionRule,
  scheme: ExerciseSlot['scheme'],
  rest: { warmupSec: number; workSec: number },
): ExerciseSlot {
  return {
    slotId: newId(),
    exerciseId,
    order,
    scheme,
    progressionRule: rule,
    restWarmupSec: rest.warmupSec,
    restWorkSec: rest.workSec,
    warmupPolicy: 'auto',
    substitutionPolicy: 'carryState',
  };
}

// --- Exercise progression state ---

export function getExerciseState(
  programId: string,
  exerciseId: string,
): Promise<ExerciseStateRow | undefined> {
  return db.exerciseState.get([programId, exerciseId]);
}

/**
 * Seed the progression state for a slot from a starting weight, computing the
 * first prescription (empty history → "starting weight"). Idempotent per slot.
 */
export async function seedExerciseState(
  programId: string,
  slot: ExerciseSlot,
  startingWeightLb: number,
  now: string,
): Promise<ExerciseStateRow> {
  const settings = engineSettings(await getSettings());
  const base: ExerciseState = {
    workingWeightLb: startingWeightLb,
    consecutiveFails: 0,
    stage: 0,
    cyclePos: 0,
  };
  const { prescription, nextState } = nextPrescription(
    slot.progressionRule,
    base,
    [],
    settings,
    schemeOf(slot),
  );
  const row: ExerciseStateRow = {
    ...nextState,
    programId,
    exerciseId: slot.exerciseId,
    updatedAt: now,
    pending: prescription,
  };
  await db.exerciseState.put(row);
  return row;
}

/** The prescription to show today for a slot (the cached `pending`, or a seed). */
export async function prescriptionForSlot(
  programId: string,
  slot: ExerciseSlot,
  now: string,
): Promise<Prescription> {
  const existing = await getExerciseState(programId, slot.exerciseId);
  if (existing?.pending) return existing.pending;
  const seeded = await seedExerciseState(
    programId,
    slot,
    (await getSettings()).barLb,
    now,
  );
  return seeded.pending!;
}

// --- Sessions ---

/**
 * Start a session from a template. Freezes a copy of the executed slots onto the
 * session (program-edit snapshot, P1 refinement) so later template edits never
 * rewrite this session's history or progression.
 */
export async function startSessionFromTemplate(
  template: WorkoutTemplate,
  now: string,
): Promise<WorkoutSession> {
  const session: WorkoutSession = {
    id: newId(),
    programId: template.programId,
    templateId: template.id,
    date: localDate(now),
    startedAt: now,
    status: 'active',
    executedSlots: structuredClone(template.slots),
  };
  await db.sessions.add(session);
  return session;
}

export function getSession(id: string): Promise<WorkoutSession | undefined> {
  return db.sessions.get(id);
}

export function getActiveWorkoutSession(): Promise<WorkoutSession | undefined> {
  return db.sessions.where('status').equals('active').first();
}

/**
 * Replace a session's executed slots (mid-workout Skip / Swap / Add). Mutates the
 * session's frozen copy only — the program template is never touched.
 */
export async function setSessionSlots(
  sessionId: string,
  slots: ExerciseSlot[],
): Promise<void> {
  await db.sessions.update(sessionId, { executedSlots: slots });
}

/**
 * Complete a session and ADVANCE progression: for every executed slot, run the
 * engine over what was logged and persist the next state + cached prescription.
 */
export async function completeSessionAndAdvance(
  sessionId: string,
  now: string,
): Promise<void> {
  const session = await db.sessions.get(sessionId);
  if (!session) return;
  const settings = engineSettings(await getSettings());
  const slots = session.executedSlots ?? [];

  await db.transaction(
    'rw',
    db.sessions,
    db.exerciseState,
    db.sets,
    async () => {
      for (const slot of slots) {
        const logged = await sessionSetsForExercise(sessionId, slot.exerciseId);
        const state =
          (await getExerciseState(session.programId!, slot.exerciseId)) ??
          startStateFromLogged(logged);
        const { prescription, nextState } = nextPrescription(
          slot.progressionRule,
          state,
          logged.map(toSetResult),
          settings,
          schemeOf(slot),
        );
        const row: ExerciseStateRow = {
          ...nextState,
          programId: session.programId!,
          exerciseId: slot.exerciseId,
          updatedAt: now,
          pending: prescription,
        };
        await db.exerciseState.put(row);
      }
      await db.sessions.update(sessionId, {
        status: 'completed',
        endedAt: now,
      });
    },
  );
}

function startStateFromLogged(logged: LoggedSet[]): ExerciseState {
  const working = logged.find(
    (s) => s.type === 'working' || s.type === 'amrap',
  );
  return {
    workingWeightLb: working?.weightLb ?? 0,
    consecutiveFails: 0,
    stage: 0,
    cyclePos: 0,
  };
}

// --- Sets (logging + undo) ---

export async function logSet(set: Omit<LoggedSet, 'id'>): Promise<LoggedSet> {
  const row: LoggedSet = { ...set, id: newId() };
  await db.sets.add(row);
  return row;
}

export async function updateSet(
  id: string,
  patch: Partial<LoggedSet>,
): Promise<void> {
  await db.sets.update(id, patch);
}

/** Soft-delete for undo (10 s snackbar, spec §5 P1). */
export async function softDeleteSet(id: string, now: string): Promise<void> {
  await db.sets.update(id, { deletedAt: now });
}

export async function restoreSet(id: string): Promise<void> {
  await db.sets.update(id, { deletedAt: undefined });
}

/** Non-deleted sets for a session, in logged order. */
export async function getSessionSets(sessionId: string): Promise<LoggedSet[]> {
  const all = await db.sets.where('sessionId').equals(sessionId).toArray();
  return all.filter((s) => !s.deletedAt).sort((a, b) => a.order - b.order);
}

async function sessionSetsForExercise(
  sessionId: string,
  exerciseId: string,
): Promise<LoggedSet[]> {
  const all = await getSessionSets(sessionId);
  return all.filter((s) => s.exerciseId === exerciseId);
}

/**
 * The working/AMRAP sets from the most recent COMPLETED session containing this
 * exercise — the "last: 84 kg × 8,8,7" line and the engine's `lastSession` input.
 */
export async function lastWorkingSetsForExercise(
  exerciseId: string,
  excludeSessionId?: string,
): Promise<SetResult[]> {
  const sets = (await db.sets.where('exerciseId').equals(exerciseId).toArray())
    .filter((s) => !s.deletedAt && s.sessionId !== excludeSessionId)
    .filter((s) => s.type === 'working' || s.type === 'amrap');
  if (sets.length === 0) return [];
  // Most recent session for this exercise (sets carry the session date).
  sets.sort((a, b) => b.date.localeCompare(a.date));
  const latestSessionId = sets[0]!.sessionId;
  return sets
    .filter((s) => s.sessionId === latestSessionId)
    .sort((a, b) => a.order - b.order)
    .map(toSetResult);
}

// --- Personal records ---

/** Detect PRs for a just-logged set vs the exercise's prior history; persist flags. */
export async function detectAndMarkPRs(set: LoggedSet): Promise<PRResult> {
  const all = await db.sets
    .where('exerciseId')
    .equals(set.exerciseId)
    .toArray();
  const prior = all
    .filter((s) => s.id !== set.id && !s.deletedAt)
    .map(toSetResult);
  const result = detectPRs(toSetResult(set), prior);
  if (result.kinds.length > 0) {
    await db.sets.update(set.id, { isPR: result.kinds });
  }
  return result;
}

/** All PR sets for an exercise, most recent first (the PR history list). */
export async function getExercisePRs(exerciseId: string): Promise<LoggedSet[]> {
  const all = await db.sets.where('exerciseId').equals(exerciseId).toArray();
  return all
    .filter((s) => !s.deletedAt && s.isPR !== undefined && s.isPR.length > 0)
    .sort((a, b) => b.date.localeCompare(a.date));
}

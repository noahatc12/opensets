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
import { getCatalogExercise, loadCatalog } from './catalog';
import {
  nextPrescription,
  detectPRs,
  buildMesocyclePlan,
  phaseForWeek,
  targetRpeForWeek,
  intensifierForPhase,
  weeklyRampFactor,
  landmarksFor,
  loadTypeFor,
  defaultStartLb,
  DEFAULT_LOAD_STEPS,
  type PRResult,
} from '../engine';
import type {
  EngineSettings,
  ExerciseState,
  LoadType,
  Prescription,
  ProgressionRule,
  SetResult,
  SetScheme,
} from '../engine/types';
import type {
  ExerciseSlot,
  ExerciseStateRow,
  LoggedSet,
  Mesocycle,
  Muscle,
  Program,
  UserSettings,
  WorkoutSession,
  WorkoutTemplate,
} from './types';

const localDate = (iso: string) => iso.slice(0, 10);

/** The muscle a slot's volume rides on + its MRV headroom — the R3.5 ramp context passed
 *  into `periodize`. `baseTotal` is the muscle's WHOLE-program week-1 set count (Σ over
 *  its slots); scaling this slot by the same per-muscle factor makes the muscle's weekly
 *  total ramp `baseTotal → mrv` and reset at deload. */
interface RampCtx {
  baseTotal: number;
  mrv: number;
}

/** Per-muscle week-1 base set counts (Σ `scheme.sets` over each muscle's slots) across the
 *  whole program — the R3 static allocation the temporal ramp scales up from. */
async function baseSetsByMuscle(programId: string): Promise<Map<Muscle, number>> {
  const tpls = await db.templates.where('programId').equals(programId).toArray();
  const base = new Map<Muscle, number>();
  for (const t of tpls) {
    for (const s of t.slots) {
      if (s.primaryMuscle) base.set(s.primaryMuscle, (base.get(s.primaryMuscle) ?? 0) + s.scheme.sets);
    }
  }
  return base;
}

/** Build the ramp context for one slot, or undefined when it can't/shouldn't ramp
 *  (no mesocycle, non-volume goal, pre-R3.5 slot without `primaryMuscle`, or no base). */
function rampCtxForSlot(
  slot: ExerciseSlot,
  meso: Mesocycle | undefined,
  baseByMuscle: Map<Muscle, number>,
): RampCtx | undefined {
  if (!meso?.rampsVolume || !slot.primaryMuscle) return undefined;
  const baseTotal = baseByMuscle.get(slot.primaryMuscle) ?? 0;
  if (baseTotal <= 0) return undefined;
  return { baseTotal, mrv: landmarksFor(slot.primaryMuscle).mrv };
}

/** Apply the program's current mesocycle phase/week to a prescription. No-op for
 *  programs without a mesocycle (GZCLP, legacy) — the schedule is reconstructed
 *  deterministically from totalWeeks, so only weekIndex needs storing.
 *
 *  Stamps the phase RPE on every working set and appends the intensification intensifier.
 *  R3.5 — when the program ramps volume (hypertrophy/recomp) and a per-muscle `ramp`
 *  context is supplied, the working-set COUNT ramps too: each muscle grows from its R3
 *  static base toward its MRV across the block and resets at deload. The factor is ≥ 1
 *  every week (= 1 at week-1 and deload), so no muscle ever drops below its R3 base
 *  (≥ MEV) — the floor holds by construction. Without a ramp context (strength, fat-loss,
 *  or pre-R3.5 slots) only the RPE stamp applies and set count is preserved. */
function periodize(
  prescription: Prescription,
  meso: Mesocycle | undefined,
  ramp?: RampCtx,
): Prescription {
  if (!meso) return prescription;
  const plan = buildMesocyclePlan(meso.totalWeeks);
  const week = Math.max(0, Math.min(plan.totalWeeks - 1, Math.round(meso.weekIndex)));
  const phase = phaseForWeek(plan, week);
  const rpe = targetRpeForWeek(plan, week);

  const warmups = prescription.sets.filter((s) => s.type === 'warmup');
  const working = prescription.sets.filter((s) => s.type !== 'warmup');
  if (working.length === 0) return prescription;

  // R3.5 per-muscle temporal ramp — grow the working-set count toward this muscle's MRV.
  let ramped = working;
  if (ramp) {
    const factor = weeklyRampFactor(ramp.baseTotal, ramp.mrv, plan, week);
    const targetCount = Math.max(1, Math.round(working.length * factor));
    ramped = Array.from({ length: targetCount }, (_, i) => ({
      ...working[Math.min(i, working.length - 1)]!,
    }));
  }

  const scaled = ramped.map((s) => ({ ...s, targetRpe: rpe })); // RPE stamp
  const intensifier = intensifierForPhase(phase);
  if (intensifier) {
    const last = scaled[scaled.length - 1]!;
    scaled.push({
      type: intensifier,
      targetReps: Math.max(1, Math.round(last.targetReps * 0.6)),
      targetWeightLb: last.targetWeightLb,
      targetRpe: 10,
    });
  }

  const phaseLabel = phase[0]!.toUpperCase() + phase.slice(1);
  return {
    sets: [...warmups, ...scaled],
    reason: `${prescription.reason} · Wk ${week + 1} ${phaseLabel} (RPE ${rpe})`,
    flags: phase === 'deload' ? [...prescription.flags, 'deload'] : prescription.flags,
  };
}

function engineSettings(s: UserSettings, loadType: LoadType): EngineSettings {
  return {
    barLb: s.barLb,
    plateInventoryLb: s.plateInventoryLb,
    rounding: 'nearest',
    units: s.units,
    loadType,
    steps: {
      dumbbellStepLb: s.dumbbellStepLb ?? DEFAULT_LOAD_STEPS.dumbbellStepLb,
      dumbbellSmallStepLb: s.dumbbellSmallStepLb ?? DEFAULT_LOAD_STEPS.dumbbellSmallStepLb,
      dumbbellSmallBelowLb: s.dumbbellSmallBelowLb ?? DEFAULT_LOAD_STEPS.dumbbellSmallBelowLb,
      stackStepLb: s.stackStepLb ?? DEFAULT_LOAD_STEPS.stackStepLb,
    },
  };
}

/**
 * The slot's load type: its own, else derived from the catalog exercise (slots made
 * before the field existed), else barbell (the original behaviour). May load the
 * catalog, so call it OUTSIDE a Dexie transaction when the slot lacks the field.
 */
export async function loadTypeOf(slot: ExerciseSlot): Promise<LoadType> {
  if (slot.loadType) return slot.loadType;
  let ex = getCatalogExercise(slot.exerciseId);
  if (!ex) {
    await loadCatalog().catch(() => undefined);
    ex = getCatalogExercise(slot.exerciseId);
  }
  return ex ? loadTypeFor(ex.equipment, ex.isBodyweight) : 'barbell';
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

/**
 * The program's next workout: the day after the most recently completed session's
 * day, wrapping round; Day 1 before anything is completed. (Audit 2026-09-24: Today
 * always started the first template, so Days 2+ of a generated plan never ran.)
 */
export async function nextTemplateForProgram(
  programId: string,
): Promise<WorkoutTemplate | undefined> {
  const tpls = await listTemplates(programId);
  if (tpls.length === 0) return undefined;
  const done = (await db.sessions.where('programId').equals(programId).toArray()).filter(
    (s) => s.status === 'completed' && s.templateId,
  );
  if (done.length === 0) return tpls[0];
  const when = (s: WorkoutSession) => s.endedAt ?? s.startedAt;
  const last = done.reduce((a, b) => (when(b) > when(a) ? b : a));
  const i = tpls.findIndex((t) => t.id === last.templateId);
  return tpls[(i + 1) % tpls.length]; // a deleted day (i = -1) restarts at Day 1
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

/** Append a slot to a template, defaulting the rest/warm-up/substitution fields.
 *  `coaching` carries the generated tempo/cue/restTier (§3.3/§3.4/§3.7); omitted for
 *  ad-hoc slots added mid-workout (they simply render without coaching detail). */
export function makeSlot(
  exerciseId: string,
  order: number,
  rule: ProgressionRule,
  scheme: ExerciseSlot['scheme'],
  rest: { warmupSec: number; workSec: number },
  coaching?: {
    tempo?: string;
    coachingCue?: string;
    restTier?: ExerciseSlot['restTier'];
    primaryMuscle?: Muscle;
    loadType?: LoadType;
  },
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
    ...(coaching?.tempo ? { tempo: coaching.tempo } : {}),
    ...(coaching?.coachingCue ? { coachingCue: coaching.coachingCue } : {}),
    ...(coaching?.restTier ? { restTier: coaching.restTier } : {}),
    ...(coaching?.primaryMuscle ? { primaryMuscle: coaching.primaryMuscle } : {}),
    ...(coaching?.loadType ? { loadType: coaching.loadType } : {}),
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
  const settings = engineSettings(await getSettings(), await loadTypeOf(slot));
  const meso = (await db.programs.get(programId))?.mesocycle;
  const ramp = rampCtxForSlot(slot, meso, await baseSetsByMuscle(programId));
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
    pending: periodize(prescription, meso, ramp),
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
  // Unseeded (a mid-workout swap or add): start from a plausible weight for how the
  // exercise is loaded, not the empty bar for everything.
  const start = defaultStartLb(await loadTypeOf(slot), (await getSettings()).barLb);
  const seeded = await seedExerciseState(programId, slot, start, now);
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
  // Anything that may leave IndexedDB (the catalog lookup behind loadTypeOf) happens
  // BEFORE the transaction; a non-Dexie await inside one would let it auto-commit.
  const pre = await db.sessions.get(sessionId);
  if (!pre || pre.status !== 'active') return;
  const userSettings = await getSettings();
  const loadTypes = new Map<string, LoadType>();
  for (const slot of pre.executedSlots ?? []) loadTypes.set(slot.slotId, await loadTypeOf(slot));

  await db.transaction(
    'rw',
    [db.sessions, db.exerciseState, db.sets, db.programs, db.templates],
    async () => {
      // Re-read inside the transaction. A second Finish (a double tap, a second tab)
      // finds the session already completed and does nothing, so progression and the
      // week counter advance exactly once. (Audit 2026-09-24.)
      const session = await db.sessions.get(sessionId);
      if (!session || session.status !== 'active') return;
      const slots = session.executedSlots ?? [];

      // Advance the mesocycle week (§2.2): a "training week" is one full pass through
      // the program's day-templates. After the deload week the program starts the NEXT
      // block at week 0 (same exercises, volume ramp restarts) instead of parking in
      // deload forever. A program already parked there restarts at week 0 too, rather
      // than jumping mid-block from its lifetime session count.
      let nextMeso: Mesocycle | undefined;
      const meso = session.programId
        ? (await db.programs.get(session.programId))?.mesocycle
        : undefined;
      if (meso && session.programId) {
        const plan = buildMesocyclePlan(meso.totalWeeks);
        const dayCount = Math.max(
          1,
          await db.templates.where('programId').equals(session.programId).count(),
        );
        const done =
          (await db.sessions.where('programId').equals(session.programId).toArray()).filter(
            (s) => s.status === 'completed',
          ).length + 1;
        let blockStart = meso.blockStartSessions ?? 0;
        let blockIndex = meso.blockIndex ?? 0;
        let weekIndex = Math.floor((done - blockStart) / dayCount);
        if (weekIndex >= plan.totalWeeks) {
          blockIndex += 1;
          blockStart = done - ((done - blockStart) % dayCount);
          weekIndex = 0;
        }
        nextMeso = {
          ...meso,
          weekIndex,
          blockIndex,
          blockStartSessions: blockStart,
          phase: phaseForWeek(plan, weekIndex),
        };
      }

      // R3.5: the muscle→week-1-base map for the per-muscle temporal ramp (computed once).
      const baseByMuscle = session.programId
        ? await baseSetsByMuscle(session.programId)
        : new Map<Muscle, number>();

      for (const slot of slots) {
        const settings = engineSettings(
          userSettings,
          loadTypes.get(slot.slotId) ?? slot.loadType ?? 'barbell',
        );
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
          pending: periodize(prescription, nextMeso, rampCtxForSlot(slot, nextMeso, baseByMuscle)),
        };
        await db.exerciseState.put(row);
      }
      await db.sessions.update(sessionId, {
        status: 'completed',
        endedAt: now,
      });
      if (nextMeso && session.programId) {
        await db.programs.update(session.programId, { mesocycle: nextMeso });
      }
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
  // Durability barrier: await the rw transaction's COMPLETION (commit), not just
  // the add request's success. A bare add lets the caller proceed (and Dexie's
  // optimistic liveQuery flip the set to "logged") while the transaction is still
  // in flight; if the page is then torn down — a reload, or the user backgrounding
  // / reopening the app right after logging — the uncommitted transaction is
  // aborted and the set is silently lost. This was reproducible (~50%+) when a
  // concurrent write (e.g. the sample-data seed) starved the commit. Awaiting the
  // transaction guarantees the set is committed before "Set logged" is shown, so a
  // reopen always finds it. (Commit survives reload; this is not, and need not be,
  // protection against an OS/process crash before physical flush.)
  await db.transaction('rw', db.sets, async () => {
    await db.sets.add(row);
  });
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

/**
 * Onboarding finish, as plain functions (extracted from OnboardingScreen so it can be
 * tested in node). Audit 2026-09-24 found two problems in the inline version:
 *  - the generator got only goal, sex and bodyweight, so the age (older-lifter volume
 *    cap) and goal timeframe (block length) the wizard captured never reached it;
 *  - the writes were not a transaction, so a failure part-way left an active program
 *    with missing days, and the button stayed on "Building…".
 */
import { db } from '../../db/db';
import { newId } from '../../db/ids';
import {
  createProgram,
  setActiveProgram,
  createTemplate,
  saveTemplate,
  makeSlot,
  seedExerciseState,
} from '../../db/repositories';
import { ageFromBirthDate } from '../../lib/age';
import type {
  GenProfile,
  GeneratorResult,
  TrainingGoal,
  EquipmentProfile,
  Experience,
} from '../../engine';
import type {
  BiologicalSex,
  Muscle,
  MuscleVolumeState,
  Profile,
  ProfileRow,
  SplitChoice,
} from '../../db/types';

/** Everything the wizard collects, in canonical units (lb, inches). */
export interface OnboardingInputs {
  goal: string;
  experience: string;
  days: number;
  equipment: string;
  splitChoice: SplitChoice;
  priorityMuscles: Muscle[];
  sex?: BiologicalSex;
  /** yyyy-mm-dd */
  birthDate?: string;
  bodyweightLb?: number;
  heightIn?: number;
  bodyFatPct?: number;
  targetBodyFatPct?: number;
  goalTimeframeWeeks?: number;
}

/** The generator's profile input, including the age and timeframe it was missing. */
export function genProfileFrom(
  i: OnboardingInputs,
  nowIso: string,
): GenProfile {
  return {
    goal: i.goal as TrainingGoal,
    ...(i.sex ? { sex: i.sex } : {}),
    ...(i.bodyweightLb ? { bodyweightLb: i.bodyweightLb } : {}),
    ...(ageFromBirthDate(i.birthDate, nowIso) !== undefined
      ? { ageYears: ageFromBirthDate(i.birthDate, nowIso) }
      : {}),
    ...(i.targetBodyFatPct ? { targetBodyFatPct: i.targetBodyFatPct } : {}),
    ...(i.goalTimeframeWeeks
      ? { goalTimeframeWeeks: i.goalTimeframeWeeks }
      : {}),
  };
}

export const genPreferencesFrom = (i: OnboardingInputs) => ({
  days: i.days,
  equipment: i.equipment as EquipmentProfile,
  experience: i.experience as Experience,
  splitChoice: i.splitChoice,
  priorityMuscles: i.priorityMuscles,
});

function profileFrom(i: OnboardingInputs, nowIso: string): ProfileRow {
  const p: Partial<Profile> = {
    goal: i.goal,
    experience: i.experience as Profile['experience'],
    days: i.days,
    equipment: i.equipment as Profile['equipment'],
    splitChoice: i.splitChoice,
  };
  if (i.priorityMuscles.length) p.priorityMuscles = i.priorityMuscles;
  if (i.sex) p.sex = i.sex;
  if (i.birthDate) p.birthDate = i.birthDate;
  if (i.heightIn) p.heightIn = i.heightIn;
  if (i.bodyFatPct) p.bodyFatPct = i.bodyFatPct;
  if (i.targetBodyFatPct) p.targetBodyFatPct = i.targetBodyFatPct;
  if (i.goalTimeframeWeeks) p.goalTimeframeWeeks = i.goalTimeframeWeeks;
  return { ...p, key: 'user', updatedAt: nowIso };
}

/**
 * Persist a generated plan as the active program, plus the profile and starting
 * bodyweight, in ONE transaction: it all lands or none of it does. Returns the new
 * program id.
 */
export async function createProgramFromPlan(
  plan: GeneratorResult,
  inputs: OnboardingInputs,
  nowIso: string,
): Promise<string> {
  return db.transaction(
    'rw',
    [
      db.programs,
      db.templates,
      db.exerciseState,
      db.settings,
      db.measurements,
      db.profile,
    ],
    async () => {
      const program = await createProgram(plan.program.name, nowIso);
      await setActiveProgram(program.id);
      // The block mesocycle (null for self-periodizing GZCLP) and the per-muscle volume
      // state seeded at MEV from its landmarks.
      if (plan.mesocycle) {
        const volumeState: Partial<Record<Muscle, MuscleVolumeState>> = {};
        for (const [m, lm] of Object.entries(
          plan.mesocycle.volumeTargets ?? {},
        )) {
          if (lm)
            volumeState[m as Muscle] = {
              current: lm.mev,
              mev: lm.mev,
              mav: lm.mav,
              mrv: lm.mrv,
            };
        }
        await db.programs.update(program.id, {
          mesocycle: plan.mesocycle,
          volumeState,
        });
      }

      for (let di = 0; di < plan.program.days.length; di++) {
        const day = plan.program.days[di]!;
        const tpl = await createTemplate(program.id, day.name, di);
        tpl.slots = day.slots.map((sp, i) =>
          makeSlot(sp.exerciseId, i, sp.rule, sp.scheme, sp.rest, {
            tempo: sp.tempo,
            coachingCue: sp.coachingCue,
            restTier: sp.restTier,
            primaryMuscle: sp.primaryMuscle,
            loadType: sp.loadType,
          }),
        );
        await saveTemplate(tpl);
        for (let i = 0; i < tpl.slots.length; i++) {
          await seedExerciseState(
            program.id,
            tpl.slots[i]!,
            day.slots[i]!.startWeightLb,
            nowIso,
          );
        }
      }

      if (inputs.bodyweightLb) {
        await db.measurements.add({
          id: newId(),
          type: 'bodyweight',
          date: nowIso,
          valueLb: inputs.bodyweightLb,
        });
      }
      // Merge, like updateProfile: a re-run of onboarding must not drop fields set in
      // Settings (e.g. the avoid-list).
      const current = await db.profile.get('user');
      await db.profile.put({ ...current, ...profileFrom(inputs, nowIso) });
      return program.id;
    },
  );
}

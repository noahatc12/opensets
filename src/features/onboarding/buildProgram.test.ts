/**
 * Onboarding finish, extracted from the screen so it can be proven in node:
 *  - the generator now receives age (from DOB) and the goal timeframe, which the wizard
 *    captured but never passed (the older-lifter cap and block length were dead);
 *  - the whole write is one transaction, so a failure leaves no half-built program.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { db, DEFAULT_SETTINGS } from '../../db/db';
import {
  genProfileFrom,
  createProgramFromPlan,
  type OnboardingInputs,
} from './buildProgram';
import type { GeneratorResult } from '../../engine';

const NOW = '2026-09-24T17:00:00.000Z';

const inputs = (over: Partial<OnboardingInputs> = {}): OnboardingInputs => ({
  goal: 'Build muscle',
  experience: 'Novice',
  days: 2,
  equipment: 'Full gym',
  splitChoice: 'auto',
  priorityMuscles: [],
  ...over,
});

const slot = (
  exerciseId: string,
  rule: unknown = {
    kind: 'double',
    repMin: 8,
    repMax: 12,
    incrementLb: 2.5,
    perSet: false,
  },
) => ({
  exerciseId,
  exerciseName: exerciseId,
  compound: true,
  rule,
  scheme: { sets: 3, repRange: [8, 12] },
  rest: { warmupSec: 60, workSec: 120 },
  startWeightLb: 95,
  primaryMuscle: 'chest',
  loadType: 'barbell',
});

function plan(day2Rule?: unknown): GeneratorResult {
  return {
    program: {
      name: 'Hypertrophy · 2d',
      days: [
        { name: 'Upper', slots: [slot('bench')] },
        { name: 'Lower', slots: [slot('squat', day2Rule)] },
      ],
    },
    mesocycle: {
      phase: 'accumulation',
      weekIndex: 0,
      totalWeeks: 6,
      volumeTargets: {},
      rampsVolume: true,
    },
    weeklyVolumeByMuscle: {},
    cardioProtocol: {
      weeklyMinutesTarget: 0,
      dailyStepTarget: 0,
      sessions: [],
    },
    goals: [],
    calibrationWeek: {
      isCalibrationWeek: true,
      topSetRepRange: [8, 10],
      note: '',
    },
  } as unknown as GeneratorResult;
}

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
  await db.settings.put({ key: 'user', ...DEFAULT_SETTINGS });
});

describe('genProfileFrom', () => {
  it('derives age from the birth date (birthday not yet reached this year) and passes the timeframe', () => {
    const p = genProfileFrom(
      inputs({
        sex: 'female',
        birthDate: '1960-10-01',
        bodyweightLb: 150,
        goalTimeframeWeeks: 8,
      }),
      NOW,
    );
    expect(p).toMatchObject({
      goal: 'Build muscle',
      sex: 'female',
      bodyweightLb: 150,
      ageYears: 65,
      goalTimeframeWeeks: 8,
    });
  });

  it('leaves age undefined without a birth date', () => {
    expect(genProfileFrom(inputs(), NOW).ageYears).toBeUndefined();
  });
});

describe('createProgramFromPlan', () => {
  it('writes the program, templates, profile and bodyweight together', async () => {
    const id = await createProgramFromPlan(
      plan(),
      inputs({ bodyweightLb: 180, heightIn: 70, sex: 'male' }),
      NOW,
    );
    expect((await db.programs.get(id))!.isActive).toBe(true);
    expect(await db.templates.where('programId').equals(id).count()).toBe(2);
    expect(await db.exerciseState.count()).toBe(2);
    expect((await db.profile.get('user'))!).toMatchObject({
      heightIn: 70,
      sex: 'male',
      days: 2,
    });
    expect((await db.measurements.toArray())[0]).toMatchObject({
      type: 'bodyweight',
      valueLb: 180,
    });
    const tpl = (await db.templates.where('programId').equals(id).first())!;
    expect(tpl.slots[0]!.loadType).toBe('barbell');
  });

  it('re-running onboarding keeps profile fields set elsewhere (the avoid-list)', async () => {
    await db.profile.put({
      key: 'user',
      avoidExerciseIds: ['ex_dips'],
      updatedAt: NOW,
    });
    await createProgramFromPlan(plan(), inputs({ sex: 'female' }), NOW);
    expect((await db.profile.get('user'))!).toMatchObject({
      avoidExerciseIds: ['ex_dips'],
      sex: 'female',
    });
  });

  it('is all-or-nothing: a failure on day 2 leaves no program behind', async () => {
    await expect(
      createProgramFromPlan(
        plan({ kind: 'bogus' }),
        inputs({ bodyweightLb: 180 }),
        NOW,
      ),
    ).rejects.toThrow();
    expect(await db.programs.count()).toBe(0);
    expect(await db.templates.count()).toBe(0);
    expect(await db.exerciseState.count()).toBe(0);
    expect(await db.measurements.count()).toBe(0);
    expect(await db.profile.count()).toBe(0);
  });
});

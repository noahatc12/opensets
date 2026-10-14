import { describe, expect, it } from 'vitest';
import { generatePlan, type GenPreferences, type GenProfile } from './index';
import { VETTED, mulberry32, roleOrder } from './roles';
import { landmarksFor } from '../mesocycle';
import { VETTED_CATALOG } from './__fixtures__/vettedCatalog';
import type { Muscle } from '../types';

/*
 * R4 · selection (2026-10-14). The generator builds plans from the vetted library in
 * roles.ts. These proofs run on real catalog rows (the fixture), because the stand-in
 * catalog in index.test.ts has one lift per pattern, which would make every variety
 * proof vacuous (the plan's own test-fixture trap).
 */

const gen = (p: Partial<GenProfile> = {}, q: Partial<GenPreferences> = {}) =>
  generatePlan(
    VETTED_CATALOG,
    {
      goal: 'Build muscle',
      sex: 'male',
      bodyweightLb: 175,
      ageYears: 25,
      ...p,
    },
    { days: 4, equipment: 'Full gym', experience: 'Intermediate', ...q },
  );

const ids = (r: ReturnType<typeof gen>, day: number) =>
  r.program.days[day]!.slots.map((s) => s.exerciseId);
const allIds = (r: ReturnType<typeof gen>) =>
  r.program.days.flatMap((d) => d.slots.map((s) => s.exerciseId));

describe('R4 selection: a coach would program these lifts', () => {
  it('a second chest slot on one day takes a different job: bench, then incline dumbbell press', () => {
    const upperA = ids(gen(), 0);
    expect(upperA).toContain('Barbell_Bench_Press_-_Medium_Grip');
    expect(upperA).toContain('Incline_Dumbbell_Press');
    expect(upperA).not.toContain('Decline_Barbell_Bench_Press');
  });

  it('the same squat never leads both leg days: back squat, then front squat', () => {
    const r = gen();
    expect(ids(r, 1)[0]).toBe('Barbell_Squat');
    expect(ids(r, 3)[0]).toBe('Front_Barbell_Squat');
    expect(allIds(r)).not.toContain('Barbell_Full_Squat');
  });

  it('a hinge rotates to a fresh compound before repeating: deadlift, then Romanian deadlift', () => {
    const r = gen();
    expect(ids(r, 1)).toContain('Barbell_Deadlift');
    expect(ids(r, 3)).toContain('Romanian_Deadlift');
  });

  it('an isolation slot varies before it repeats', () => {
    const r = gen();
    const abs = r.program.days
      .flatMap((d) => d.slots)
      .filter((s) => s.primaryMuscle === 'abdominals')
      .map((s) => s.exerciseId);
    expect(new Set(abs).size).toBe(abs.length);
  });

  it('never puts one exercise twice in a session', () => {
    for (const exp of ['Novice', 'Intermediate', 'Advanced'] as const)
      for (const days of [3, 4, 5, 6])
        for (const d of gen({}, { experience: exp, days }).program.days) {
          const day = d.slots.map((s) => s.exerciseId);
          expect(new Set(day).size).toBe(day.length);
        }
  });
});

describe('R4 selection: novices repeat their main lifts', () => {
  it('a novice strength plan runs the same squat, bench, row and press every day', () => {
    const r = gen({ goal: 'Get stronger' }, { experience: 'Novice', days: 3 });
    const firsts = r.program.days.map((d) => d.slots[0]!.exerciseId);
    expect(new Set(firsts)).toEqual(new Set(['Barbell_Squat']));
    for (const d of r.program.days)
      expect(d.slots.map((s) => s.exerciseId)).toContain(
        'Barbell_Bench_Press_-_Medium_Grip',
      );
  });

  it('a dumbbell-only novice repeats the stretch hinge as the main lift, never a band good morning', () => {
    const r = gen(
      { goal: 'General fitness' },
      { experience: 'Novice', days: 3, equipment: 'Minimal' },
    );
    const all = allIds(r);
    expect(all).not.toContain('Band_Good_Morning');
    const hinges = r.program.days
      .flatMap((d) => d.slots)
      .filter((s) => s.primaryMuscle === 'hamstrings')
      .map((s) => s.exerciseId);
    expect(hinges.length).toBeGreaterThan(0);
    expect(new Set(hinges)).toEqual(
      new Set(['Stiff-Legged_Dumbbell_Deadlift']),
    );
  });
});

describe('R4 selection: cues belong to the exercise', () => {
  it('a hip thrust in a hinge slot gets the glute cue, not the hamstring cue', () => {
    const r = gen({
      avoidExerciseIds: [
        'Barbell_Deadlift',
        'Romanian_Deadlift',
        'Stiff-Legged_Dumbbell_Deadlift',
        'Good_Morning',
      ],
    });
    const thrust = r.program.days
      .flatMap((d) => d.slots)
      .find((s) => s.exerciseId === 'Barbell_Hip_Thrust');
    expect(thrust).toBeDefined();
    expect(thrust!.coachingCue).toMatch(/glutes/);
    expect(thrust!.coachingCue).not.toMatch(/hamstring/);
  });

  it('every vetted pick carries its own vetted cue', () => {
    const cueOf = new Map(
      Object.values(VETTED)
        .flat()
        .map((v) => [v.id, v.cue] as const),
    );
    for (const s of gen().program.days.flatMap((d) => d.slots))
      if (cueOf.has(s.exerciseId))
        expect(s.coachingCue).toBe(cueOf.get(s.exerciseId));
  });
});

describe('R4 selection: the lifter and the fallback', () => {
  it('never programs an avoided exercise', () => {
    const avoid = [
      'Barbell_Squat',
      'Barbell_Bench_Press_-_Medium_Grip',
      'Pullups',
    ];
    for (const id of avoid)
      expect(allIds(gen({ avoidExerciseIds: avoid }))).not.toContain(id);
  });

  it('the generic fallback never picks an odd variant', () => {
    // Avoid every vetted ab lift so the abs slots fall back to generic matches.
    const vettedAbs = VETTED.abs!.map((v) => v.id);
    const all = allIds(gen({ avoidExerciseIds: vettedAbs }));
    expect(all).not.toContain('Bosu_Ball_Cable_Crunch_With_Side_Bends');
    expect(all.some((id) => id === 'Decline_Crunch' || id === 'Crunches')).toBe(
      true,
    );
  });
});

describe('R4 selection: seeded variety', () => {
  it('no seed gives the vetted order, so the same inputs give the same plan', () => {
    expect(allIds(gen())).toEqual(allIds(gen()));
  });
  it('the same seed gives the same plan; different seeds can rotate among equals', () => {
    expect(allIds(gen({}, { seed: 7 }))).toEqual(allIds(gen({}, { seed: 7 })));
    const plans = new Set(
      [1, 2, 3, 4, 5, 6, 7, 8].map((seed) =>
        allIds(gen({}, { seed })).join(','),
      ),
    );
    expect(plans.size).toBeGreaterThan(1);
  });
  it('mulberry32 is deterministic and stays in [0, 1)', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    for (let i = 0; i < 50; i++) {
      const x = a();
      expect(x).toBe(b());
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
  });
  it('role order: heavy first for a main compound, stretch first for an isolation', () => {
    expect(roleOrder(true, 0, false)[0]).toBe('heavy');
    expect(roleOrder(true, 1, false)[0]).toBe('stretch');
    expect(roleOrder(false, 0, false)[0]).toBe('stretch');
    expect(roleOrder(false, 1, false)[0]).toBe('squeeze');
    expect(roleOrder(true, 1, true)[0]).toBe('heavy');
  });
});

describe('R4 coverage diagnostic (the July plan: evidence-gated)', () => {
  it('every priority muscle with a home in the split reaches its MEV', () => {
    const cases: Muscle[][] = [
      ['chest'],
      ['biceps', 'triceps'],
      ['quadriceps', 'hamstrings'],
      ['lats', 'shoulders'],
    ];
    for (const priority of cases) {
      const r = gen({}, { priorityMuscles: priority });
      for (const m of priority) {
        const vol = r.weeklyVolumeByMuscle[m];
        if (vol === undefined) continue; // no home in this split: rides compounds
        expect(vol).toBeGreaterThanOrEqual(landmarksFor(m).mev);
      }
    }
  });
});

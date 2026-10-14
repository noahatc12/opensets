import { describe, expect, it } from 'vitest';
import { generatePlan, type GenPreferences, type GenProfile } from './index';
import { landmarksFor } from '../mesocycle';
import { VETTED_CATALOG } from './__fixtures__/vettedCatalog';
import type { Muscle } from '../types';

/*
 * Crowded days (2026-10-14). On a 3-day push/pull/legs week each muscle's weekly
 * minimum lands in one session, and the allocator used to spread it over new 3-set
 * exercises: the pull day carried 9 exercises, 10 with the curl. A day at or over its
 * exercise budget now raises its existing exercises toward the 5-set cap before it adds
 * another; a day with room keeps the variety.
 */

const gen = (p: Partial<GenProfile> = {}, q: Partial<GenPreferences> = {}) =>
  generatePlan(
    VETTED_CATALOG,
    {
      goal: 'Recomposition',
      sex: 'female',
      bodyweightLb: 150,
      ageYears: 30,
      ...p,
    },
    { days: 3, equipment: 'Full gym', experience: 'Intermediate', ...q },
  );

const PROFILES: [Partial<GenProfile>, Partial<GenPreferences>][] = [
  [{}, {}],
  [{ goal: 'Build muscle' }, {}],
  [{ goal: 'Lose fat' }, { equipment: 'Home rack' }],
  [{ goal: 'Build muscle' }, { days: 4 }],
  [{ goal: 'Recomposition' }, { days: 5, experience: 'Advanced' }],
  [{ goal: 'Build muscle' }, { days: 6 }],
  [{ goal: 'Get stronger' }, { days: 4 }],
];

describe('crowded days', () => {
  it('a 3-day push/pull/legs pull day fits in 7 exercises', () => {
    const pull = gen().program.days.find((d) => /^Pull/.test(d.name))!;
    expect(pull.slots.length).toBeLessThanOrEqual(7);
  });

  it.each(PROFILES)('no session runs past 8 exercises (%j %j)', (p, q) => {
    for (const d of gen(p, q).program.days)
      expect(d.slots.length).toBeLessThanOrEqual(8);
  });

  it.each(PROFILES)('no exercise exceeds 5 sets (%j %j)', (p, q) => {
    for (const d of gen(p, q).program.days)
      for (const s of d.slots) expect(s.scheme.sets).toBeLessThanOrEqual(5);
  });

  // Strength aims below the hypertrophy MEV by design (direct sets, a 6-set floor).
  it.each(PROFILES.filter(([p]) => p.goal !== 'Get stronger'))(
    'every allocated muscle still meets its MEV (%j %j)',
    (p, q) => {
      const r = gen(p, q);
      for (const [m, vol] of Object.entries(r.weeklyVolumeByMuscle))
        expect(vol).toBeGreaterThanOrEqual(landmarksFor(m as Muscle).mev);
    },
  );

  it('a day with room keeps two chest exercises (bench, then incline dumbbell press)', () => {
    const upperA = gen({ goal: 'Build muscle' }, { days: 4 }).program.days[0]!;
    const ids = upperA.slots.map((s) => s.exerciseId);
    expect(ids).toContain('Barbell_Bench_Press_-_Medium_Grip');
    expect(ids).toContain('Incline_Dumbbell_Press');
  });
});

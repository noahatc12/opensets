import { describe, expect, it } from 'vitest';
import { generatePlan, type GenPreferences, type GenProfile } from './index';
import { landmarksFor } from '../mesocycle';
import { VETTED_CATALOG } from './__fixtures__/vettedCatalog';
import type { Muscle } from '../types';

/*
 * Direct arm and side-delt work on hypertrophy days (Noah, 2026-10-14: "ship both and
 * keep building", after the review flagged that a Build muscle upper day had no curl,
 * no triceps work and no lateral raise). Press and row synergist credit met those
 * muscles' MEV on paper, and "shoulders" lumps all three delt heads, so a lateral raise
 * never earned a slot. For the hypertrophy goals (Build muscle, Recomposition) the
 * allocator now places a direct-work floor: a lateral raise on each upper-body day and
 * one arm exercise per day, alternating biceps and triceps.
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

const isLateral = (id: string) => /Lateral_Raise/.test(id);

describe('direct work: upper/lower, Build muscle', () => {
  const r = gen();
  const uppers = r.program.days.filter((d) => /^Upper/.test(d.name));

  it('each upper day has exactly one lateral raise', () => {
    expect(uppers).toHaveLength(2);
    for (const d of uppers)
      expect(d.slots.filter((s) => isLateral(s.exerciseId))).toHaveLength(1);
  });

  it('each upper day has one arm exercise, biceps on one and triceps on the other', () => {
    const arms = uppers.map((d) =>
      d.slots
        .map((s) => s.primaryMuscle)
        .filter((m) => m === 'biceps' || m === 'triceps'),
    );
    for (const a of arms) expect(a).toHaveLength(1);
    expect(new Set(arms.flat())).toEqual(new Set(['biceps', 'triceps']));
  });

  it('adds at most two exercises to a day, about 10 minutes', () => {
    for (const d of uppers) expect(d.slots.length).toBeLessThanOrEqual(7);
  });
});

describe('direct work: push/pull/legs, Recomposition', () => {
  const r = gen({ goal: 'Recomposition' }, { days: 3 });

  it('push has a lateral raise and a triceps exercise; pull has a biceps exercise', () => {
    const push = r.program.days.find((d) => /^Push/.test(d.name))!;
    const pull = r.program.days.find((d) => /^Pull/.test(d.name))!;
    expect(push.slots.some((s) => isLateral(s.exerciseId))).toBe(true);
    expect(push.slots.some((s) => s.primaryMuscle === 'triceps')).toBe(true);
    expect(pull.slots.some((s) => s.primaryMuscle === 'biceps')).toBe(true);
  });
});

describe('direct work: other goals are unchanged', () => {
  it.each(['Get stronger', 'Lose fat', 'General fitness'] as const)(
    '%s gets no forced lateral raise on an upper day',
    (goal) => {
      const r = gen({ goal });
      const forced = r.program.days
        .filter((d) => /^Upper/.test(d.name))
        .flatMap((d) => d.slots)
        .filter((s) => isLateral(s.exerciseId));
      expect(forced).toHaveLength(0);
    },
  );
});

describe('direct work: no floor regressed', () => {
  it.each([
    [{}, { days: 4 }],
    [{ goal: 'Recomposition' }, { days: 3 }],
    [{}, { days: 5, experience: 'Advanced' }],
    [{}, { days: 6 }],
  ] as const)('every allocated muscle still meets its MEV (%j %j)', (p, q) => {
    const r = gen(p as Partial<GenProfile>, q as Partial<GenPreferences>);
    for (const [m, vol] of Object.entries(r.weeklyVolumeByMuscle))
      expect(vol).toBeGreaterThanOrEqual(landmarksFor(m as Muscle).mev);
  });
});

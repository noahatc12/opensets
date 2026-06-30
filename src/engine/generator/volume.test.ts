/**
 * R3 volume-allocator proof (spec §2.5, §6.4 + generator-research §1/1C).
 *
 * Across the five R2 spread profiles, proves: every allocated muscle ≥ its goal floor
 * (the abs / tail-accessory must-fix — abs ≈ 6, never 0); priority protects weekly VOLUME
 * (not just structure); the counting method switches by goal (hypertrophy fractional +
 * 12–20 band vs strength direct + a lower floor); per-muscle totals land in [MEV, MRV];
 * and the older / female modifiers apply.
 */
import { describe, it, expect } from 'vitest';
import { generatePlan, creditFor, type GenExercise, type GenProfile, type GenPreferences } from './index';
import { landmarksFor } from '../mesocycle';
import type { Muscle } from '../types';

const ex = (id: string, name: string, pm: GenExercise['primaryMuscles'], eq: string, mech: 'compound' | 'isolation', bw = false): GenExercise =>
  ({ id, name, nameNorm: name.toLowerCase(), primaryMuscles: pm, equipment: eq, mechanic: mech, isBodyweight: bw });

const CATALOG: GenExercise[] = [
  ex('bb-bench', 'Barbell Bench Press', ['chest'], 'barbell', 'compound'),
  ex('db-bench', 'Dumbbell Bench Press', ['chest'], 'dumbbell', 'compound'),
  ex('mach-press', 'Machine Chest Press', ['chest'], 'machine', 'compound'),
  ex('incl-db', 'Incline Dumbbell Press', ['chest'], 'dumbbell', 'compound'),
  ex('ohp', 'Standing Military Press', ['shoulders'], 'barbell', 'compound'),
  ex('db-press', 'Seated Dumbbell Press', ['shoulders'], 'dumbbell', 'compound'),
  ex('lat-raise', 'Side Lateral Raise', ['shoulders'], 'dumbbell', 'isolation'),
  ex('face-pull', 'Face Pull', ['shoulders'], 'cable', 'isolation'),
  ex('pushdown', 'Triceps Pushdown', ['triceps'], 'cable', 'isolation'),
  ex('bb-curl', 'Barbell Curl', ['biceps'], 'barbell', 'isolation'),
  ex('incl-curl', 'Incline Dumbbell Curl', ['biceps'], 'dumbbell', 'isolation'),
  ex('squat', 'Barbell Squat', ['quadriceps'], 'barbell', 'compound'),
  ex('leg-press', 'Leg Press', ['quadriceps'], 'machine', 'compound'),
  ex('leg-ext', 'Leg Extensions', ['quadriceps'], 'machine', 'isolation'),
  ex('rdl', 'Romanian Deadlift', ['hamstrings', 'glutes'], 'barbell', 'compound'),
  ex('leg-curl', 'Lying Leg Curls', ['hamstrings'], 'machine', 'isolation'),
  ex('calf', 'Standing Calf Raises', ['calves'], 'machine', 'isolation'),
  ex('pulldown', 'Wide-Grip Lat Pulldown', ['lats'], 'cable', 'compound'),
  ex('pullup', 'Pullups', ['lats'], 'bodyweight', 'compound', true),
  ex('bb-row', 'Bent Over Barbell Row', ['middleBack', 'lats'], 'barbell', 'compound'),
  ex('cable-row', 'Seated Cable Rows', ['middleBack', 'lats'], 'cable', 'compound'),
  ex('hlr', 'Hanging Leg Raise', ['abdominals'], 'bodyweight', 'isolation', true),
  ex('cable-crunch', 'Cable Crunch', ['abdominals'], 'cable', 'isolation'),
];
const gen = (p: GenProfile, q: GenPreferences) => generatePlan(CATALOG, p, q);
const vol = (p: GenProfile, q: GenPreferences) => gen(p, q).weeklyVolumeByMuscle;

// The five R2 spread profiles (same as the split-matrix tests).
const PROFILES: Array<{ label: string; p: GenProfile; q: GenPreferences; strength?: boolean }> = [
  { label: 'noviceFB3', p: { goal: 'Build muscle' }, q: { days: 3, equipment: 'Full gym', experience: 'Novice' } },
  { label: 'hyperInt5', p: { goal: 'Build muscle' }, q: { days: 5, equipment: 'Full gym', experience: 'Intermediate' } },
  { label: 'strengthInt4', p: { goal: 'Get stronger' }, q: { days: 4, equipment: 'Full gym', experience: 'Intermediate' }, strength: true },
  { label: 'generalFit3', p: { goal: 'General fitness' }, q: { days: 3, equipment: 'Full gym', experience: 'Intermediate' } },
  { label: 'advHyper6', p: { goal: 'Build muscle' }, q: { days: 6, equipment: 'Full gym', experience: 'Advanced' } },
];

describe('R3 must-fix — every allocated muscle ≥ its floor; abs ≈ 6 never 0', () => {
  it.each(PROFILES)('$label floors every trained muscle (no positional drop)', ({ p, q, strength }) => {
    const v = vol(p, q);
    const muscles = Object.keys(v) as Muscle[];
    expect(muscles.length).toBeGreaterThan(4);
    for (const m of muscles) {
      const floor = strength ? 6 : landmarksFor(m).mev; // strength uses the lower per-movement floor (C2)
      expect(v[m], `${m}=${v[m]} below floor ${floor}`).toBeGreaterThanOrEqual(floor);
    }
  });

  it.each(PROFILES)('$label gives abs ≈ 6 (the headline must-fix), never 0/undefined', ({ p, q }) => {
    const v = vol(p, q);
    expect(v.abdominals).toBeDefined();
    expect(v.abdominals!).toBeGreaterThanOrEqual(6); // abs MEV; the perDay slice used to drop it to 0
  });
});

describe('R3 priority protects weekly VOLUME (not just structure)', () => {
  it('priority-chest raises chest aggregate weekly sets vs priority-off (freq ≥ 2 muscle)', () => {
    const off = vol({ goal: 'Build muscle' }, { days: 5, equipment: 'Full gym', experience: 'Intermediate' });
    const on = vol({ goal: 'Build muscle' }, { days: 5, equipment: 'Full gym', experience: 'Intermediate', priorityMuscles: ['chest'] });
    expect(on.chest!).toBeGreaterThan(off.chest!); // 16 vs 10 — the chest-wash R2 could NOT close
    expect(on.chest!).toBeGreaterThanOrEqual(landmarksFor('chest').mav); // biased to MAV
  });

  it('priority creates within-muscle doubling (≥ 2 chest slots in a session)', () => {
    const r = gen({ goal: 'Build muscle' }, { days: 5, equipment: 'Full gym', experience: 'Intermediate', priorityMuscles: ['chest'] });
    const push = r.program.days.find((d) => /Push|Upper/.test(d.name))!;
    const chestSlots = push.slots.filter((s) => /press|bench/i.test(s.exerciseName));
    expect(chestSlots.length).toBeGreaterThanOrEqual(2);
  });
});

describe('R3 counting switch — fractional (hypertrophy) vs direct (strength)', () => {
  it('a press credits synergists 0.5 fractionally, but ONLY the primary when direct', () => {
    const fractional = new Map(creditFor('horizPress', false));
    expect(fractional.get('chest')).toBe(1);
    expect(fractional.get('triceps')).toBe(0.5);
    expect(fractional.get('shoulders')).toBe(0.5);

    const direct = creditFor('horizPress', true);
    expect(direct).toEqual([['chest', 1]]); // strength counts the primary only
  });

  it('strength runs much lower per-muscle volume than hypertrophy (lower band)', () => {
    const strength = vol({ goal: 'Get stronger' }, { days: 4, equipment: 'Full gym', experience: 'Intermediate' });
    const hyper = vol({ goal: 'Build muscle' }, { days: 4, equipment: 'Full gym', experience: 'Intermediate' });
    expect(strength.chest!).toBeLessThan(hyper.chest!);
    expect(strength.chest!).toBeLessThan(12); // strength stays well below hypertrophy's 12–20
  });
});

describe('R3 bands — per-muscle totals land in [MEV, MRV]', () => {
  it.each(PROFILES.filter((x) => !x.strength))('$label keeps every muscle within [MEV, MRV]', ({ p, q }) => {
    const v = vol(p, q);
    for (const m of Object.keys(v) as Muscle[]) {
      const { mev, mrv } = landmarksFor(m);
      expect(v[m]!, `${m}=${v[m]}`).toBeGreaterThanOrEqual(mev);
      expect(v[m]!, `${m}=${v[m]} over MRV ${mrv}`).toBeLessThanOrEqual(mrv);
    }
  });
});

describe('R3 older + female modifiers (research C3 / C4)', () => {
  it('older (≥50) caps hypertrophy volume lower (priority chest ≤ 12 vs 16 young)', () => {
    const young = vol({ goal: 'Build muscle' }, { days: 5, equipment: 'Full gym', experience: 'Intermediate', priorityMuscles: ['chest'] });
    const older = vol({ goal: 'Build muscle', ageYears: 58 }, { days: 5, equipment: 'Full gym', experience: 'Intermediate', priorityMuscles: ['chest'] });
    expect(older.chest!).toBeLessThanOrEqual(12);
    expect(older.chest!).toBeLessThan(young.chest!);
  });

  it('female tolerates more accessory volume (abs + calves up; between-SET only)', () => {
    const male = vol({ goal: 'Build muscle', sex: 'male' }, { days: 5, equipment: 'Full gym', experience: 'Intermediate' });
    const female = vol({ goal: 'Build muscle', sex: 'female' }, { days: 5, equipment: 'Full gym', experience: 'Intermediate' });
    expect(female.abdominals!).toBeGreaterThan(male.abdominals!);
    expect(female.calves!).toBeGreaterThan(male.calves!);
  });
});

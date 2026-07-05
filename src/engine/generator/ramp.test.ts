/**
 * R3.5 per-muscle temporal ramp proof (restores the R3 Option-1 paused ramp).
 *
 * The load-bearing proof: across a real generated program's mesocycle, each muscle's
 * WEEKLY set count ramps from its R3 static base UP toward its own MRV and resets at
 * deload — at a DIFFERENT per-muscle rate (NOT a shared multiplier), and never below MEV
 * at any week (the R3 must-fix holds through the whole block, not just the static plan).
 *
 * The per-muscle weekly total is computed here EXACTLY as `periodize` applies it at
 * runtime: base_m = Σ scheme.sets over the muscle's slots; each slot scales by
 * weeklyRampFactor(base_m, mrv_m, plan, week); sum the per-slot-rounded counts.
 */
import { describe, it, expect } from 'vitest';
import {
  generatePlan,
  type GenExercise,
  type GenProfile,
  type GenPreferences,
  type GeneratedProgram,
} from './index';
import { buildMesocyclePlan, landmarksFor, weeklyRampFactor, type MesocyclePlan } from '../mesocycle';
import type { Muscle } from '../types';

const ex = (id: string, name: string, pm: GenExercise['primaryMuscles'], eq: string, mech: 'compound' | 'isolation', bw = false): GenExercise =>
  ({ id, name, nameNorm: name.toLowerCase(), primaryMuscles: pm, equipment: eq, mechanic: mech, isBodyweight: bw });

const CATALOG: GenExercise[] = [
  ex('bb-bench', 'Barbell Bench Press', ['chest'], 'barbell', 'compound'),
  ex('db-bench', 'Dumbbell Bench Press', ['chest'], 'dumbbell', 'compound'),
  ex('incl-db', 'Incline Dumbbell Press', ['chest'], 'dumbbell', 'compound'),
  ex('mach-press', 'Machine Chest Press', ['chest'], 'machine', 'compound'),
  ex('ohp', 'Standing Military Press', ['shoulders'], 'barbell', 'compound'),
  ex('db-press', 'Seated Dumbbell Press', ['shoulders'], 'dumbbell', 'compound'),
  ex('lat-raise', 'Side Lateral Raise', ['shoulders'], 'dumbbell', 'isolation'),
  ex('face-pull', 'Face Pull', ['shoulders'], 'cable', 'isolation'),
  ex('pushdown', 'Triceps Pushdown', ['triceps'], 'cable', 'isolation'),
  ex('skull', 'Lying Triceps Extension', ['triceps'], 'barbell', 'isolation'),
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

/** Per-muscle week-1 static base (Σ scheme.sets over the muscle's slots). */
function baseByMuscle(program: GeneratedProgram): Map<Muscle, number> {
  const base = new Map<Muscle, number>();
  for (const day of program.days)
    for (const s of day.slots) base.set(s.primaryMuscle, (base.get(s.primaryMuscle) ?? 0) + s.scheme.sets);
  return base;
}

/** Per-muscle weekly total at `week`, mirroring periodize's per-slot rounding. */
function rampedByMuscle(
  program: GeneratedProgram,
  base: Map<Muscle, number>,
  plan: MesocyclePlan,
  week: number,
): Map<Muscle, number> {
  const out = new Map<Muscle, number>();
  for (const day of program.days)
    for (const s of day.slots) {
      const m = s.primaryMuscle;
      const factor = weeklyRampFactor(base.get(m) ?? 0, landmarksFor(m).mrv, plan, week);
      out.set(m, (out.get(m) ?? 0) + Math.round(s.scheme.sets * factor));
    }
  return out;
}

describe('R3.5 gate — only volume-model goals ramp; slots carry their muscle', () => {
  it('hypertrophy + recomp set rampsVolume; strength + fat-loss do not', () => {
    expect(gen({ goal: 'Build muscle' }, { days: 5, equipment: 'Full gym', experience: 'Intermediate' }).mesocycle!.rampsVolume).toBe(true);
    expect(gen({ goal: 'Recomposition' }, { days: 4, equipment: 'Full gym', experience: 'Intermediate' }).mesocycle!.rampsVolume).toBe(true);
    expect(gen({ goal: 'Get stronger' }, { days: 4, equipment: 'Full gym', experience: 'Intermediate' }).mesocycle!.rampsVolume).toBe(false);
    expect(gen({ goal: 'Lose fat' }, { days: 4, equipment: 'Full gym', experience: 'Intermediate' }).mesocycle!.rampsVolume).toBe(false);
  });

  it('every generated slot carries its primaryMuscle (the ramp key)', () => {
    const r = gen({ goal: 'Build muscle' }, { days: 5, equipment: 'Full gym', experience: 'Intermediate' });
    for (const day of r.program.days) for (const s of day.slots) expect(s.primaryMuscle).toBeTruthy();
  });
});

describe('R3.5 ramp across the block (hypertrophy, 5-day intermediate)', () => {
  const r = gen({ goal: 'Build muscle' }, { days: 5, equipment: 'Full gym', experience: 'Intermediate' });
  const plan = buildMesocyclePlan(r.mesocycle!.totalWeeks);
  const base = baseByMuscle(r.program);
  const weeks = [...Array(plan.totalWeeks).keys()];
  const deloadWeek = plan.weeks.indexOf('deload');
  const peakWeek = plan.weeks.lastIndexOf('intensification');
  const muscles = [...base.keys()];

  it("R3's MEV floor holds through the ramp: no muscle ever drops below its week-1 base", () => {
    // The ramp factor is ≥ 1 every week, so a muscle's home volume never falls below its
    // week-1 base. R3 already floors EFFECTIVE volume (home + fractional synergist credit)
    // at MEV (volume.test.ts) — so "≥ base every week" + "base effective ≥ MEV" together
    // mean no week prescribes below MEV. (Raw home sets CAN sit below MEV when synergist
    // credit fills the gap — e.g. shoulders ride press credit — which is R3 by design.)
    for (const w of weeks) {
      const v = rampedByMuscle(r.program, base, plan, w);
      for (const m of muscles) {
        expect(v.get(m)!, `${m} wk${w + 1}=${v.get(m)} < base ${base.get(m)}`).toBeGreaterThanOrEqual(base.get(m)!);
      }
    }
  });

  it("R3's effective floor (the ramp's week-1 anchor) is ≥ MEV for every muscle", () => {
    for (const m of muscles) {
      expect(r.weeklyVolumeByMuscle[m]!, `${m} effective ${r.weeklyVolumeByMuscle[m]} < MEV`).toBeGreaterThanOrEqual(
        landmarksFor(m).mev - 0.01, // effective volume is fractional
      );
    }
  });

  it('week-1 = the R3 static base; deload resets to it', () => {
    const wk1 = rampedByMuscle(r.program, base, plan, 0);
    const dl = rampedByMuscle(r.program, base, plan, deloadWeek);
    for (const m of muscles) {
      expect(wk1.get(m)).toBe(base.get(m)); // ramp floor
      expect(dl.get(m)).toBe(base.get(m)); // reset
    }
  });

  it('volume climbs from week-1 to the intensification peak (real ramp)', () => {
    const wk1 = rampedByMuscle(r.program, base, plan, 0);
    const peak = rampedByMuscle(r.program, base, plan, peakWeek);
    // at least one primary-home muscle strictly increases, and none decreases below base
    let anyClimb = false;
    for (const m of muscles) {
      expect(peak.get(m)!).toBeGreaterThanOrEqual(wk1.get(m)!);
      if (peak.get(m)! > wk1.get(m)!) anyClimb = true;
    }
    expect(anyClimb).toBe(true);
  });

  it('two muscles with different MEV→MRV ratios ramp at DIFFERENT rates (not a shared multiplier)', () => {
    // chest (MRV 22 / MEV 10 = 2.2×) vs abdominals (MRV 25 / MEV 6 ≈ 4.2×) — both allocated
    // primary-home muscles. (glutes/lowerBack are never a pattern's muscles[0], so they ride
    // compound credit and aren't allocated a home slot — R3's archetype-coverage note.)
    expect(base.has('chest')).toBe(true);
    expect(base.has('abdominals')).toBe(true);
    const peak = rampedByMuscle(r.program, base, plan, peakWeek);
    const chestRatio = peak.get('chest')! / base.get('chest')!; // ≈ 22/base ≈ 2.2×
    const absRatio = peak.get('abdominals')! / base.get('abdominals')!; // ≈ 25/base ≈ 4.2×
    // Each muscle ramps toward its OWN mrv/base — abs (low MEV, high MRV) far steeper than
    // chest. A shared multiplier would make these equal; they differ by > 1× (rounding-safe).
    expect(chestRatio).toBeGreaterThan(1.8);
    expect(chestRatio).toBeLessThan(2.6);
    expect(absRatio).toBeGreaterThan(chestRatio + 1);
  });
});

describe('R3.5 priority — a higher base ramps a shallower ratio (same muscle, base-dependent)', () => {
  it('priority chest has a higher week-1 base but a shallower peak/base ratio than non-priority', () => {
    const q: GenPreferences = { days: 5, equipment: 'Full gym', experience: 'Intermediate' };
    const nonPri = gen({ goal: 'Build muscle' }, q);
    const pri = gen({ goal: 'Build muscle' }, { ...q, priorityMuscles: ['chest'] });

    const planN = buildMesocyclePlan(nonPri.mesocycle!.totalWeeks);
    const baseN = baseByMuscle(nonPri.program);
    const baseP = baseByMuscle(pri.program);
    const peakWeek = planN.weeks.lastIndexOf('intensification');

    expect(baseP.get('chest')!).toBeGreaterThan(baseN.get('chest')!); // priority protects base volume

    const peakN = rampedByMuscle(nonPri.program, baseN, planN, peakWeek).get('chest')! / baseN.get('chest')!;
    const peakP = rampedByMuscle(pri.program, baseP, planN, peakWeek).get('chest')! / baseP.get('chest')!;
    expect(peakP).toBeLessThan(peakN); // higher base ⇒ less headroom to MRV ⇒ shallower ratio
  });
});

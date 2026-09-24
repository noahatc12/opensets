/**
 * Body-aware starting weights and the protein target (feature, 2026-09-24).
 * Starting weights are deliberately conservative: undershooting costs one easy
 * session (the first log replaces the seed), overshooting risks a failed or unsafe
 * set. Height does not enter load at all; it enters protein only, and only at BMI 30+.
 */
import { describe, it, expect } from 'vitest';
import { startingWeightLb, proteinTarget } from './body';

describe('startingWeightLb', () => {
  it('novice female, 140 lb, dumbbell lateral raise: a light per-hand start (about 2.5 lb)', () => {
    const w = startingWeightLb({
      loadType: 'dumbbell',
      pattern: 'lateralRaise',
      bodyweightLb: 140,
      sex: 'female',
      experience: 'Novice',
    });
    expect(w).toBeGreaterThan(2);
    expect(w).toBeLessThanOrEqual(5);
  });

  it('novice male at the reference 165 lb: barbell bench about 0.4 x bodyweight', () => {
    expect(
      startingWeightLb({
        loadType: 'barbell',
        pattern: 'horizPress',
        bodyweightLb: 165,
        sex: 'male',
        experience: 'Novice',
      }),
    ).toBeCloseTo(66, 0);
  });

  it('scales with bodyweight less than proportionally (strength ~ bodyweight^2/3)', () => {
    const at = (bw: number) =>
      startingWeightLb({
        loadType: 'barbell',
        pattern: 'horizPress',
        bodyweightLb: bw,
        sex: 'male',
        experience: 'Novice',
      });
    expect(at(330)).toBeGreaterThan(at(165));
    expect(at(330)).toBeLessThan(2 * at(165));
    expect(at(330)).toBeCloseTo(66 * 2 ** (2 / 3), 0);
  });

  it('training age, age and sex move it in the expected direction', () => {
    const base = {
      loadType: 'barbell' as const,
      pattern: 'squat',
      bodyweightLb: 180,
      sex: 'male' as const,
    };
    const novice = startingWeightLb({ ...base, experience: 'Novice' });
    expect(
      startingWeightLb({ ...base, experience: 'Intermediate' }),
    ).toBeCloseTo(novice * 1.5, 5);
    expect(startingWeightLb({ ...base, experience: 'Advanced' })).toBeCloseTo(
      novice * 1.9,
      5,
    );
    expect(
      startingWeightLb({ ...base, experience: 'Novice', ageYears: 70 }),
    ).toBeCloseTo(novice * 0.8, 5);
    expect(
      startingWeightLb({ ...base, experience: 'Novice', ageYears: 55 }),
    ).toBeCloseTo(novice * 0.9, 5);
    expect(
      startingWeightLb({ ...base, experience: 'Novice', ageYears: 16 }),
    ).toBeCloseTo(novice * 0.8, 5);
    // Female lower body keeps more of the male ratio than upper body does.
    const f = startingWeightLb({
      ...base,
      sex: 'female',
      bodyweightLb: 180,
      experience: 'Novice',
    });
    expect(f / novice).toBeCloseTo(0.7, 5);
  });

  it('with no sex or bodyweight it assumes the lighter, more cautious reference', () => {
    const anon = startingWeightLb({
      loadType: 'barbell',
      pattern: 'horizPress',
    });
    const female = startingWeightLb({
      loadType: 'barbell',
      pattern: 'horizPress',
      sex: 'female',
      bodyweightLb: 140,
    });
    expect(anon).toBeCloseTo(female, 5);
  });

  it('bodyweight lifts start at 0 external load', () => {
    expect(
      startingWeightLb({
        loadType: 'bodyweight',
        pattern: 'vertPull',
        bodyweightLb: 200,
        sex: 'male',
      }),
    ).toBe(0);
  });

  it('falls back by load type and mechanic when the movement is unknown (a swap or add)', () => {
    const iso = startingWeightLb({
      loadType: 'dumbbell',
      compound: false,
      sex: 'male',
      bodyweightLb: 165,
    });
    const comp = startingWeightLb({
      loadType: 'dumbbell',
      compound: true,
      sex: 'male',
      bodyweightLb: 165,
    });
    expect(iso).toBeLessThan(comp);
    expect(
      startingWeightLb({
        loadType: 'stack',
        pattern: 'nope',
        compound: true,
        sex: 'male',
        bodyweightLb: 165,
      }),
    ).toBeGreaterThan(0);
  });

  it('clamps implausible bodyweights instead of extrapolating', () => {
    const at = (bw: number) =>
      startingWeightLb({
        loadType: 'barbell',
        pattern: 'squat',
        bodyweightLb: bw,
        sex: 'male',
      });
    expect(at(1000)).toBe(at(350));
    expect(at(20)).toBe(at(90));
  });
});

describe('proteinTarget (1.6 to 2.2 g per kg a day; Morton 2018 plateau 1.62, CI to 2.2)', () => {
  it('180 lb -> about 130 to 180 g, on bodyweight', () => {
    expect(proteinTarget({ bodyweightLb: 180 })).toMatchObject({
      lowG: 130,
      highG: 180,
      basis: 'bodyweight',
    });
  });

  it('at BMI 30 or more, uses a height-based reference weight (BMI 25) so the target does not balloon', () => {
    const t = proteinTarget({ bodyweightLb: 300, heightIn: 70 })!;
    expect(t.basis).toBe('heightAdjusted');
    expect(t.lowG).toBe(125);
    expect(t.highG).toBe(175);
  });

  it('without a height it stays on bodyweight', () => {
    expect(proteinTarget({ bodyweightLb: 300 })).toMatchObject({
      lowG: 220,
      highG: 300,
      basis: 'bodyweight',
    });
  });

  it('below BMI 30 height does not change anything', () => {
    expect(proteinTarget({ bodyweightLb: 180, heightIn: 70 })).toMatchObject({
      lowG: 130,
      highG: 180,
      basis: 'bodyweight',
    });
  });

  it('flags under 18 so the screen can add the check-with-a-professional line', () => {
    expect(
      proteinTarget({ bodyweightLb: 150, ageYears: 16 })!.underEighteen,
    ).toBe(true);
    expect(
      proteinTarget({ bodyweightLb: 150, ageYears: 30 })!.underEighteen,
    ).toBe(false);
  });

  it('is absent without a bodyweight', () => {
    expect(proteinTarget({})).toBeNull();
    expect(proteinTarget({ bodyweightLb: 0 })).toBeNull();
  });
});

import { describe, it, expect } from 'vitest';
import {
  buildMesocyclePlan,
  targetRpeForWeek,
  weeklyVolumeTarget,
  rampProgress,
  weeklyRampFactor,
  intensifierForPhase,
  applyPeriodization,
  landmarksFor,
} from './mesocycle';
import type { Prescription } from './types';

const plan6 = buildMesocyclePlan(6); // [acc, acc, acc, int, int, deload]
const intWeek = plan6.weeks.indexOf('intensification');
const deloadWeek = plan6.weeks.indexOf('deload');

const base: Prescription = {
  sets: [
    { type: 'working', targetReps: 8, targetWeightLb: 135 },
    { type: 'working', targetReps: 8, targetWeightLb: 135 },
    { type: 'working', targetReps: 8, targetWeightLb: 135 },
  ],
  reason: 'Hit 8/8/8 — hold 135 lb.',
  flags: [],
};
const working = (p: Prescription) =>
  p.sets.filter((s) => s.type === 'working' || s.type === 'amrap');

describe('mesocycle plan (§2.2)', () => {
  it('schedules accumulation → intensification → a final deload, clamped 4–12 wk', () => {
    expect(plan6.totalWeeks).toBe(6);
    expect(plan6.weeks[5]).toBe('deload');
    expect(plan6.weeks).toContain('accumulation');
    expect(plan6.weeks).toContain('intensification');
    expect(buildMesocyclePlan(2).totalWeeks).toBe(4); // clamped up
    expect(buildMesocyclePlan(99).totalWeeks).toBe(12); // clamped down
    expect(buildMesocyclePlan(8).weeks.at(-1)).toBe('deload');
  });
});

describe('RPE moves by phase + ramps within phase (§3.5 setup)', () => {
  it('accumulation < intensification, deload is lowest', () => {
    expect(targetRpeForWeek(plan6, 0)).toBe(7); // accumulation start
    expect(targetRpeForWeek(plan6, intWeek)).toBeGreaterThanOrEqual(8);
    expect(targetRpeForWeek(plan6, deloadWeek)).toBe(6);
    // ramps within accumulation (week 0 < week 2)
    expect(targetRpeForWeek(plan6, 2)).toBeGreaterThan(
      targetRpeForWeek(plan6, 0),
    );
  });
});

describe('volume landmark fallback + degenerate input', () => {
  it('a muscle with no explicit landmarks falls back to the default range', () => {
    expect(landmarksFor('neck')).toEqual({ mev: 8, mav: 14, mrv: 20 });
  });
  it('a prescription with no working sets is returned unchanged', () => {
    const warmupOnly: Prescription = {
      sets: [{ type: 'warmup', targetReps: 5, targetWeightLb: 95 }],
      reason: 'warm up',
      flags: [],
    };
    expect(applyPeriodization(warmupOnly, plan6, intWeek)).toBe(warmupOnly);
  });
});

describe('per-muscle weekly volume lands in MEV/MRV bands and ramps (§2.5)', () => {
  it('chest target stays within [MEV, MRV] every week and climbs toward intensification', () => {
    const { mev, mrv } = landmarksFor('chest');
    for (let w = 0; w < plan6.totalWeeks; w++) {
      const v = weeklyVolumeTarget('chest', plan6, w);
      expect(v).toBeGreaterThanOrEqual(mev);
      expect(v).toBeLessThanOrEqual(mrv);
    }
    expect(weeklyVolumeTarget('chest', plan6, 2)).toBeGreaterThan(
      weeklyVolumeTarget('chest', plan6, 0),
    );
    expect(weeklyVolumeTarget('chest', plan6, intWeek)).toBeGreaterThan(
      weeklyVolumeTarget('chest', plan6, 0),
    );
  });
});

describe('intensifiers gate to the intensification phase only (§2.13)', () => {
  it('rest-pause unlocks in intensification, nowhere else', () => {
    expect(intensifierForPhase('accumulation')).toBeNull();
    expect(intensifierForPhase('deload')).toBeNull();
    expect(intensifierForPhase('intensification')).toBe('restPause');
  });
});

describe('LOAD-BEARING: two different weeks → two different prescriptions for the same lift', () => {
  it('volume ramps + RPE moves + intensifier appears, weight untouched', () => {
    const wk0 = applyPeriodization(base, plan6, 0); // accumulation start
    const wkInt = applyPeriodization(base, plan6, intWeek); // intensification

    // RPE moved
    expect(working(wk0)[0]!.targetRpe).toBe(7);
    expect(working(wkInt)[0]!.targetRpe).toBeGreaterThanOrEqual(8);
    expect(working(wk0)[0]!.targetRpe).not.toBe(working(wkInt)[0]!.targetRpe);

    // Volume ramped (more working sets in intensification than accumulation start)
    expect(working(wkInt).length).toBeGreaterThan(working(wk0).length);

    // Intensifier gated: a rest-pause set only in intensification
    expect(wkInt.sets.some((s) => s.type === 'restPause')).toBe(true);
    expect(wk0.sets.some((s) => s.type === 'restPause')).toBe(false);

    // Weight is NOT changed by periodization (the rule owns load)
    expect(working(wkInt).every((s) => s.targetWeightLb === 135)).toBe(true);

    // The two prescriptions are genuinely different, not a re-render of the same thing
    expect(JSON.stringify(wk0.sets)).not.toBe(JSON.stringify(wkInt.sets));
  });

  it('deload pulls volume + RPE down and flags deload', () => {
    const dl = applyPeriodization(base, plan6, deloadWeek);
    expect(working(dl)[0]!.targetRpe).toBe(6);
    expect(working(dl).length).toBeLessThanOrEqual(working(base).length);
    expect(dl.sets.some((s) => s.type === 'restPause')).toBe(false);
    expect(dl.flags).toContain('deload');
  });

  it('phase is reflected in the human-readable reason (week + phase + RPE)', () => {
    expect(applyPeriodization(base, plan6, 0).reason).toMatch(
      /Wk 1 Accumulation \(RPE 7\)/,
    );
    expect(applyPeriodization(base, plan6, deloadWeek).reason).toMatch(
      /Deload/,
    );
  });
});

// ── R3.5 per-muscle temporal ramp (rampProgress + weeklyRampFactor) ─────────────
describe('rampProgress — 0 at week-1 and deload, 1 at the intensification peak', () => {
  it('is 0 at week-1 (the ramp floor = R3 static base)', () => {
    expect(rampProgress(plan6, 0)).toBe(0);
  });
  it('is 0 at deload (resets to base)', () => {
    expect(rampProgress(plan6, deloadWeek)).toBe(0);
  });
  it('reaches 1 at the final intensification week (the peak)', () => {
    const lastInt = plan6.weeks.lastIndexOf('intensification');
    expect(rampProgress(plan6, lastInt)).toBeCloseTo(1, 5);
  });
  it('climbs monotonically across the work weeks', () => {
    const work = [0, 1, 2, intWeek]; // acc,acc,acc,int
    for (let i = 1; i < work.length; i++) {
      expect(rampProgress(plan6, work[i]!)).toBeGreaterThan(
        rampProgress(plan6, work[i - 1]!),
      );
    }
  });
});

describe('weeklyRampFactor — ≥1 always, per-muscle ratio, resets at deload', () => {
  const chest = landmarksFor('chest'); // mev 10, mrv 22
  const glutes = landmarksFor('glutes'); // mev 4, mrv 16

  it('is exactly 1 at week-1 and deload (base preserved, MEV floor holds)', () => {
    expect(weeklyRampFactor(chest.mev, chest.mrv, plan6, 0)).toBe(1);
    expect(weeklyRampFactor(chest.mev, chest.mrv, plan6, deloadWeek)).toBe(1);
  });

  it('never drops below 1 on any week (⇒ never below the R3 base ⇒ never below MEV)', () => {
    for (let w = 0; w < plan6.totalWeeks; w++) {
      expect(
        weeklyRampFactor(chest.mev, chest.mrv, plan6, w),
      ).toBeGreaterThanOrEqual(1);
    }
  });

  it('peaks at mrv/base — different per muscle, NOT a shared multiplier', () => {
    const lastInt = plan6.weeks.lastIndexOf('intensification');
    const chestPeak = weeklyRampFactor(chest.mev, chest.mrv, plan6, lastInt);
    const glutesPeak = weeklyRampFactor(glutes.mev, glutes.mrv, plan6, lastInt);
    expect(chestPeak).toBeCloseTo(chest.mrv / chest.mev, 5); // 2.2×
    expect(glutesPeak).toBeCloseTo(glutes.mrv / glutes.mev, 5); // 4.0×
    expect(glutesPeak).toBeGreaterThan(chestPeak + 1); // the load-bearing differential
  });

  it('a higher base (priority) ramps LESS steeply than the same muscle at MEV', () => {
    const lastInt = plan6.weeks.lastIndexOf('intensification');
    const atMev = weeklyRampFactor(chest.mev, chest.mrv, plan6, lastInt); // 22/10
    const atMav = weeklyRampFactor(chest.mav, chest.mrv, plan6, lastInt); // 22/16
    expect(atMav).toBeLessThan(atMev);
    expect(atMav).toBeCloseTo(chest.mrv / chest.mav, 5);
  });

  it('is flat (1) when there is no headroom or no base', () => {
    for (let w = 0; w < plan6.totalWeeks; w++) {
      expect(weeklyRampFactor(0, chest.mrv, plan6, w)).toBe(1); // no base
      expect(weeklyRampFactor(chest.mrv, chest.mrv, plan6, w)).toBe(1); // base == mrv
      expect(weeklyRampFactor(chest.mrv + 5, chest.mrv, plan6, w)).toBe(1); // base > mrv
    }
  });
});

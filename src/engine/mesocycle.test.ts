import { describe, it, expect } from 'vitest';
import {
  buildMesocyclePlan,
  targetRpeForWeek,
  weeklyVolumeTarget,
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
const working = (p: Prescription) => p.sets.filter((s) => s.type === 'working' || s.type === 'amrap');

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
    expect(targetRpeForWeek(plan6, 2)).toBeGreaterThan(targetRpeForWeek(plan6, 0));
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
    expect(weeklyVolumeTarget('chest', plan6, 2)).toBeGreaterThan(weeklyVolumeTarget('chest', plan6, 0));
    expect(weeklyVolumeTarget('chest', plan6, intWeek)).toBeGreaterThan(weeklyVolumeTarget('chest', plan6, 0));
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
    expect(applyPeriodization(base, plan6, 0).reason).toMatch(/Wk 1 Accumulation \(RPE 7\)/);
    expect(applyPeriodization(base, plan6, deloadWeek).reason).toMatch(/Deload/);
  });
});

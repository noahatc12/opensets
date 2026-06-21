import { describe, it, expect } from 'vitest';
import {
  roundToLoadable,
  generateWarmupRamp,
  isLoadable,
  platesForWeight,
} from './rounding';

// Standard lb gym set (denominations; each usable as a pair, unlimited quantity).
const STD = [1.25, 2.5, 5, 10, 25, 35, 45];
const NO_MICRO = [2.5, 5, 10, 15, 20, 25]; // smallest jump 2.5/side = 5 lb total
const MICRO = [0.25, 0.5, 1.25, 2.5, 5, 10, 20]; // microplates present
const BAR = 20;

describe('roundToLoadable', () => {
  it('returns the bar when the target is at or below the empty bar', () => {
    expect(roundToLoadable(20, BAR, STD)).toBe(20);
    expect(roundToLoadable(15, BAR, STD)).toBe(20);
    expect(roundToLoadable(0, BAR, STD)).toBe(20);
  });

  it('rounds to an exactly loadable weight (bar + plate pairs)', () => {
    // 60 = 20 bar + 2×20
    expect(roundToLoadable(60, BAR, STD)).toBe(60);
    // 62.5 = 20 + 2×(20+1.25)
    expect(roundToLoadable(62.5, BAR, STD)).toBe(62.5);
  });

  it('nearest mode picks the closest achievable load', () => {
    // Without microplates, smallest step is 5 lb total. 61 → nearest of {60,65} = 60.
    expect(roundToLoadable(61, BAR, NO_MICRO)).toBe(60);
    // 63.5 → nearest of {60,65} = 65.
    expect(roundToLoadable(63.5, BAR, NO_MICRO)).toBe(65);
  });

  it('down mode never exceeds the target', () => {
    expect(roundToLoadable(63.5, BAR, NO_MICRO, 'down')).toBe(60);
    expect(roundToLoadable(64.9, BAR, NO_MICRO, 'down')).toBe(60);
    expect(roundToLoadable(65, BAR, NO_MICRO, 'down')).toBe(65);
  });

  it('up mode never undershoots the target', () => {
    expect(roundToLoadable(61, BAR, NO_MICRO, 'up')).toBe(65);
    expect(roundToLoadable(60, BAR, NO_MICRO, 'up')).toBe(60);
  });

  it('uses microplates when present to hit finer targets', () => {
    // 61 with 0.25 microplates → 61 exactly (2×0.5 = 1 lb over 60).
    expect(roundToLoadable(61, BAR, MICRO)).toBe(61);
    expect(roundToLoadable(60.5, BAR, MICRO)).toBe(60.5);
  });

  it('handles an empty plate inventory (only the bar is loadable)', () => {
    expect(roundToLoadable(80, BAR, [])).toBe(BAR);
  });

  it('handles a custom bar weight', () => {
    expect(roundToLoadable(50, 15, STD)).toBe(50); // 15 + 2×17.5 = 15 + 2×(15+2.5)
  });

  it('never returns a non-loadable weight (property over a sweep)', () => {
    for (let target = 20; target <= 200; target += 0.5) {
      const w = roundToLoadable(target, BAR, STD);
      expect(isLoadable(w, BAR, STD)).toBe(true);
    }
  });
});

describe('isLoadable', () => {
  it('accepts the bar alone and bar + plate pairs', () => {
    expect(isLoadable(20, BAR, STD)).toBe(true);
    expect(isLoadable(60, BAR, STD)).toBe(true);
    expect(isLoadable(62.5, BAR, STD)).toBe(true);
  });
  it('rejects weights not formable from pairs', () => {
    expect(isLoadable(61, BAR, NO_MICRO)).toBe(false);
    expect(isLoadable(19, BAR, STD)).toBe(false); // below bar
  });
  it('rejects an above-bar weight when no plates are available', () => {
    expect(isLoadable(60, BAR, [])).toBe(false);
    expect(isLoadable(20, BAR, [])).toBe(true); // bar alone
  });
});

describe('generateWarmupRamp', () => {
  it('ramps from the bar toward the working weight, plate-rounded and ascending', () => {
    const ramp = generateWarmupRamp(100, BAR, STD);
    expect(ramp.length).toBeGreaterThan(0);
    // strictly ascending, all loadable, all below the working weight
    for (let i = 0; i < ramp.length; i++) {
      expect(isLoadable(ramp[i]!.weightLb, BAR, STD)).toBe(true);
      expect(ramp[i]!.weightLb).toBeLessThan(100);
      if (i > 0)
        expect(ramp[i]!.weightLb).toBeGreaterThan(ramp[i - 1]!.weightLb);
    }
    expect(ramp[0]!.weightLb).toBe(BAR); // starts at the empty bar
  });

  it('returns no warmups when the working weight is the bar or lighter', () => {
    expect(generateWarmupRamp(20, BAR, STD)).toEqual([]);
    expect(generateWarmupRamp(15, BAR, STD)).toEqual([]);
  });

  it('collapses to just the bar when percentages round at/below it (skip branches)', () => {
    // 25 lb working: 40/60/80% all round down to the bar → only the bar survives.
    const ramp = generateWarmupRamp(25, BAR, STD);
    expect(ramp).toEqual([{ weightLb: BAR, reps: 8 }]);
  });
});

describe('platesForWeight', () => {
  it('breaks a loadable weight into largest-first per-side plates', () => {
    expect(platesForWeight(100, BAR, STD)).toEqual([35, 5]); // 20 + 2×40 = 35+5 per side
    expect(platesForWeight(62.5, BAR, STD)).toEqual([10, 10, 1.25]); // 20 + 2×21.25
  });

  it('returns an empty breakdown for the bar alone', () => {
    expect(platesForWeight(20, BAR, STD)).toEqual([]);
  });

  it('returns null for a weight not exactly loadable / below the bar', () => {
    expect(platesForWeight(61, BAR, NO_MICRO)).toBeNull();
    expect(platesForWeight(15, BAR, STD)).toBeNull();
    expect(platesForWeight(80, BAR, [])).toBeNull();
  });

  it('breakdown always reconstructs the weight (property)', () => {
    for (let w = 20; w <= 200; w += 2.5) {
      const loadable = roundToLoadable(w, BAR, STD);
      const plates = platesForWeight(loadable, BAR, STD);
      expect(plates).not.toBeNull();
      const total = BAR + 2 * plates!.reduce((a, b) => a + b, 0);
      expect(total).toBeCloseTo(loadable, 5);
    }
  });
});

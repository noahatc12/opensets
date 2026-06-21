import { describe, it, expect } from 'vitest';
import { detectPlateau, ewmaSeries } from './plateau';

describe('ewmaSeries', () => {
  it('seeds on the first value and smooths the rest (α = 0.3)', () => {
    const s = ewmaSeries([100, 110]);
    expect(s[0]).toBe(100);
    expect(s[1]).toBeCloseTo(103, 5); // 0.3*110 + 0.7*100
  });
});

describe('detectPlateau', () => {
  it('returns false with fewer than 3 sessions', () => {
    const r = detectPlateau([100, 101], false);
    expect(r.plateauSuspected).toBe(false);
    expect(r.reason).toMatch(/Not enough data/);
  });

  it('flags a plateau when e1RM is flat/down and there is no PR', () => {
    const r = detectPlateau([100, 99, 98, 98], false);
    expect(r.plateauSuspected).toBe(true);
    expect(r.reason).toMatch(/deload|rep-range/);
  });

  it('does not flag when a PR landed in the window', () => {
    const r = detectPlateau([100, 99, 98, 98], true);
    expect(r.plateauSuspected).toBe(false);
    expect(r.reason).toMatch(/PR/);
  });

  it('does not flag while the trend is still rising', () => {
    const r = detectPlateau([100, 102, 105, 108], false);
    expect(r.plateauSuspected).toBe(false);
    expect(r.reason).toMatch(/trending up/);
  });

  it('respects a custom window value', () => {
    const r = detectPlateau([100, 95, 90, 88], false, 3); // declining EWMA over the last 3
    expect(r.plateauSuspected).toBe(true);
  });

  it('singularises the no-data message', () => {
    expect(detectPlateau([100], false).reason).toMatch(/1 session\b/);
  });
});

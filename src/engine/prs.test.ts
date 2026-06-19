import { describe, it, expect } from 'vitest';
import { detectPRs } from './prs';
import type { SetResult } from './types';

const s = (
  weightKg: number,
  reps: number,
  over: Partial<SetResult> = {},
): SetResult => ({
  weightKg,
  reps,
  type: 'working',
  completed: true,
  ...over,
});

describe('detectPRs', () => {
  it('sets no PRs on the first-ever set (nothing to beat)', () => {
    expect(detectPRs(s(100, 5), []).kinds).toEqual([]);
  });

  it('flags a weight PR when heavier than all prior', () => {
    const prior = [s(100, 5), s(95, 5)];
    expect(detectPRs(s(105, 3), prior).kinds).toContain('weight');
  });

  it('does not flag a weight PR for a matching (non-greater) load', () => {
    expect(detectPRs(s(100, 5), [s(100, 5)]).kinds).not.toContain('weight');
  });

  it('flags a rep PR for more reps at the same weight', () => {
    const prior = [s(100, 5), s(100, 6)];
    const r = detectPRs(s(100, 8), prior);
    expect(r.kinds).toContain('reps');
  });

  it('does not flag a rep PR at a weight never used before', () => {
    // 110 is a new top weight (weight PR), but there is no prior 110 to out-rep.
    const r = detectPRs(s(110, 5), [s(100, 5)]);
    expect(r.kinds).toContain('weight');
    expect(r.kinds).not.toContain('reps');
  });

  it('flags an e1RM PR when the estimate beats all prior', () => {
    // 100×5 (e1RM ~114.6) beats prior 100×3 (~107)
    const r = detectPRs(s(100, 5), [s(100, 3)]);
    expect(r.kinds).toContain('e1rm');
    expect(r.e1rm).toBeGreaterThan(110);
  });

  it('handles bodyweight rep PRs (weight 0)', () => {
    const r = detectPRs(s(0, 15), [s(0, 12), s(0, 10)]);
    expect(r.kinds).toContain('reps');
    expect(r.kinds).not.toContain('weight'); // no load → no weight PR
  });

  it('ignores incomplete sets entirely', () => {
    expect(
      detectPRs(s(200, 5, { completed: false }), [s(100, 5)]).kinds,
    ).toEqual([]);
  });

  it('excludes prior incomplete sets from the comparison', () => {
    // The 200 prior was a failed attempt; 150 still PRs over the real 100.
    const prior = [s(100, 5), s(200, 1, { completed: false })];
    expect(detectPRs(s(150, 3), prior).kinds).toContain('weight');
  });

  it('reports e1RM PR when no prior set was e1RM-eligible', () => {
    // Prior only high-rep (>10, ineligible); first eligible set → e1RM PR.
    const r = detectPRs(s(100, 5), [s(40, 20)]);
    expect(r.kinds).toContain('e1rm');
  });
});

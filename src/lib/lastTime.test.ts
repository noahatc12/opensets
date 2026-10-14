import { describe, expect, it } from 'vitest';
import { lastTimeLine } from './lastTime';
import type { SetResult } from '../engine/types';

// Quick win (review 2026-10-14): the logger shows what the lifter did last time,
// in one line, beside today's prescription. Strong and Hevy both lead with this.

const s = (weightLb: number, reps: number, extra: Partial<SetResult> = {}) =>
  ({ weightLb, reps, type: 'working', ...extra }) as SetResult;

describe('lastTimeLine', () => {
  it('is empty when there is no last time', () => {
    expect(lastTimeLine([], 'lb')).toBe('');
  });

  it('names the weight once when every set used it', () => {
    expect(lastTimeLine([s(102.5, 10), s(102.5, 10), s(102.5, 9)], 'lb')).toBe(
      '102.5 lb × 10, 10, 9',
    );
  });

  it('starts a new run when the weight changes', () => {
    expect(lastTimeLine([s(105, 10), s(100, 9), s(100, 8)], 'lb')).toBe(
      '105 lb × 10 · 100 lb × 9, 8',
    );
  });

  it('says reps alone for bodyweight sets', () => {
    expect(lastTimeLine([s(0, 12), s(0, 10)], 'lb')).toBe('12, 10 reps');
  });

  it('says assisted for negative loads', () => {
    expect(lastTimeLine([s(-30, 8), s(-30, 7)], 'lb')).toBe(
      '30 lb assist × 8, 7',
    );
  });

  it('shows timed holds as seconds', () => {
    expect(
      lastTimeLine(
        [s(0, 1, { durationSec: 60 }), s(0, 1, { durationSec: 45 })],
        'lb',
      ),
    ).toBe('60 s, 45 s');
  });

  it('converts to kg for display', () => {
    expect(lastTimeLine([s(100, 5), s(100, 5)], 'kg')).toBe('45.5 kg × 5, 5');
  });
});

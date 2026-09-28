import { describe, it, expect } from 'vitest';
import { loadTypeFor, roundForLoad, DEFAULT_LOAD_STEPS } from './loading';

const PLATES = [1.25, 2.5, 5, 10, 25, 35, 45];
const S = DEFAULT_LOAD_STEPS;

describe('loadTypeFor', () => {
  it('maps catalog equipment to how the load is built', () => {
    expect(loadTypeFor('barbell')).toBe('barbell');
    expect(loadTypeFor('dumbbell')).toBe('dumbbell');
    expect(loadTypeFor('kettlebell')).toBe('dumbbell');
    expect(loadTypeFor('cable')).toBe('stack');
    expect(loadTypeFor('machine')).toBe('stack');
    expect(loadTypeFor('ezBar')).toBe('stack');
    expect(loadTypeFor('bodyweight')).toBe('bodyweight');
    expect(loadTypeFor('bands')).toBe('bodyweight');
    expect(loadTypeFor(undefined)).toBe('stack');
    expect(loadTypeFor('other')).toBe('stack');
  });

  it('the bodyweight flag wins over equipment', () => {
    expect(loadTypeFor('other', true)).toBe('bodyweight');
  });
});

describe('roundForLoad', () => {
  const r = (
    t: number,
    lt: Parameters<typeof roundForLoad>[1],
    mode: 'nearest' | 'up' | 'down' = 'nearest',
  ) => roundForLoad(t, lt, 45, PLATES, S, mode);

  it('barbell delegates to plate math (bar floor kept for barbells)', () => {
    expect(r(13, 'barbell')).toBe(45);
    expect(r(100, 'barbell')).toBe(100);
    expect(r(46.25, 'barbell', 'up')).toBe(47.5);
  });

  it('dumbbells: 2.5 steps under 20, 5 steps from 20, never below the smallest step', () => {
    expect(r(13, 'dumbbell')).toBe(12.5);
    expect(r(13.75, 'dumbbell')).toBe(12.5); // tie -> lower
    expect(r(13.75, 'dumbbell', 'up')).toBe(15);
    expect(r(21, 'dumbbell')).toBe(20);
    expect(r(23, 'dumbbell')).toBe(25);
    expect(r(21, 'dumbbell', 'up')).toBe(25);
    expect(r(24, 'dumbbell', 'down')).toBe(20);
    expect(r(1, 'dumbbell')).toBe(2.5);
    expect(r(0, 'dumbbell')).toBe(2.5);
  });

  it('stack: nearest step, minimum one step', () => {
    expect(r(22, 'stack')).toBe(20);
    expect(r(23, 'stack')).toBe(25);
    expect(r(21, 'stack', 'up')).toBe(25);
    expect(r(2, 'stack')).toBe(5);
  });

  it('bodyweight: 0 stays 0, added load rounds to 2.5, assisted (negative) is kept on the step', () => {
    expect(r(0, 'bodyweight')).toBe(0);
    expect(r(0, 'bodyweight', 'up')).toBe(0);
    expect(r(11, 'bodyweight')).toBe(10);
    expect(r(11, 'bodyweight', 'up')).toBe(12.5);
    expect(r(-31, 'bodyweight')).toBe(-30);
  });

  it('custom steps are honoured (editable on the Plates screen)', () => {
    const custom = {
      ...S,
      dumbbellStepLb: 10,
      dumbbellSmallBelowLb: 10,
      stackStepLb: 2.5,
    };
    expect(roundForLoad(24, 'dumbbell', 45, PLATES, custom)).toBe(20);
    expect(roundForLoad(26, 'dumbbell', 45, PLATES, custom)).toBe(30);
    expect(roundForLoad(21.2, 'stack', 45, PLATES, custom)).toBe(20);
  });
});

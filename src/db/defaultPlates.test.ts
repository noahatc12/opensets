import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from './db';
import { roundToLoadable } from '../engine';

// Noah, 2026-10-14: the 1.25 lb fractional pair is opt-in. Most gyms lack it, and
// with it in the default every plan landed on weights like 102.5.

describe('default plate set', () => {
  it('is the standard US set without the 1.25 lb pair', () => {
    expect(DEFAULT_SETTINGS.plateInventoryLb).toEqual([2.5, 5, 10, 25, 35, 45]);
  });

  it('so a barbell lands on a 5 lb step', () => {
    const { barLb, plateInventoryLb } = DEFAULT_SETTINGS;
    expect(roundToLoadable(102.5, barLb, plateInventoryLb) % 5).toBe(0);
    expect(roundToLoadable(137, barLb, plateInventoryLb) % 5).toBe(0);
  });
});

import { describe, it, expect } from 'vitest';
import {
  kgToLb,
  lbToKg,
  toUnit,
  fmtWeight,
  roundDisplay,
  displayWeight,
  weightStepLb,
  weightStepLabel,
} from './units';

describe('units (lb canonical)', () => {
  it('converts kg ↔ lb round-trip', () => {
    expect(kgToLb(100)).toBeCloseTo(220.462, 2);
    expect(lbToKg(220.462)).toBeCloseTo(100, 3);
    expect(lbToKg(kgToLb(84))).toBeCloseTo(84, 6);
  });

  it('toUnit passes lb through and converts to kg', () => {
    expect(toUnit(135, 'lb')).toBe(135);
    expect(toUnit(135, 'kg')).toBeCloseTo(61.235, 2);
  });

  // Was "lb to whole": that displayed a 12.5 lb dumbbell as 13 and a 47.5 lb bar as 48,
  // weights nobody can load (visual check, 2026-09-24). Loads are quarter-pound exact.
  it('fmtWeight: lb to the nearest 0.25 (real loads shown exactly), kg to nearest 0.5, drops .0', () => {
    expect(fmtWeight(135, 'lb')).toBe('135');
    expect(fmtWeight(12.5, 'lb')).toBe('12.5');
    expect(fmtWeight(47.5, 'lb')).toBe('47.5');
    expect(fmtWeight(46.25, 'lb')).toBe('46.25');
    expect(fmtWeight(185, 'kg')).toBe('84'); // 185 lb ≈ 83.9 kg → 84
    expect(fmtWeight(225, 'kg')).toBe('102'); // 225 lb ≈ 102.06 kg → 102
    expect(fmtWeight(134.6, 'lb')).toBe('134.5');
  });

  // Editable weight fields (routine builder): a 2.5 lb increment showed as "3" and a
  // 5 lb start as "2.3 kg" (visual check, 2026-09-24).
  it('displayWeight: an editable number, lb to 0.25 and kg to 0.5', () => {
    expect(displayWeight(2.5, 'lb')).toBe(2.5);
    expect(displayWeight(1.25, 'lb')).toBe(1.25);
    expect(displayWeight(5, 'kg')).toBe(2.5);
    expect(displayWeight(2.5, 'kg')).toBe(1);
  });

  it('roundDisplay keeps 1 decimal in kg, whole in lb', () => {
    expect(roundDisplay(123.34, 'kg')).toBe(123.3);
    expect(roundDisplay(271.8, 'lb')).toBe(272);
  });

  it('stepper increment is 5 lb / 2.5 kg-equivalent', () => {
    expect(weightStepLb('lb')).toBe(5);
    expect(weightStepLb('kg')).toBeCloseTo(5.5116, 3); // 2.5 kg in lb
    expect(weightStepLabel('lb')).toBe('5 lb');
    expect(weightStepLabel('kg')).toBe('2.5 kg');
  });
});

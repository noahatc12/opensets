import { describe, it, expect } from 'vitest';
import {
  kgToLb,
  lbToKg,
  toUnit,
  fmtWeight,
  roundDisplay,
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

  it('fmtWeight: lb to whole, kg to nearest 0.5, drops .0', () => {
    expect(fmtWeight(135, 'lb')).toBe('135');
    expect(fmtWeight(185, 'kg')).toBe('84'); // 185 lb ≈ 83.9 kg → 84
    expect(fmtWeight(225, 'kg')).toBe('102'); // 225 lb ≈ 102.06 kg → 102
    expect(fmtWeight(134.6, 'lb')).toBe('135');
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

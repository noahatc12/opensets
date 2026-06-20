import { describe, it, expect } from 'vitest';
import {
  kgToLb,
  lbToKg,
  toUnit,
  fmtWeight,
  roundDisplay,
  weightStepKg,
  weightStepLabel,
} from './units';

describe('units', () => {
  it('converts kg ↔ lb round-trip', () => {
    expect(kgToLb(100)).toBeCloseTo(220.462, 2);
    expect(lbToKg(220.462)).toBeCloseTo(100, 3);
    expect(lbToKg(kgToLb(84))).toBeCloseTo(84, 6);
  });

  it('toUnit passes kg through and converts lb', () => {
    expect(toUnit(60, 'kg')).toBe(60);
    expect(toUnit(60, 'lb')).toBeCloseTo(132.277, 2);
  });

  it('fmtWeight: kg to nearest 0.5, lb to whole, drops .0', () => {
    expect(fmtWeight(60, 'kg')).toBe('60');
    expect(fmtWeight(62.3, 'kg')).toBe('62.5');
    expect(fmtWeight(84, 'lb')).toBe('185'); // 84 kg ≈ 185.2 lb
    expect(fmtWeight(60, 'lb')).toBe('132');
  });

  it('roundDisplay keeps 1 decimal in kg, whole in lb', () => {
    expect(roundDisplay(123.34, 'kg')).toBe(123.3);
    expect(roundDisplay(271.8, 'lb')).toBe(272);
  });

  it('stepper increment is 2.5 kg / 5 lb-equivalent', () => {
    expect(weightStepKg('kg')).toBe(2.5);
    expect(weightStepKg('lb')).toBeCloseTo(2.2679, 3);
    expect(weightStepLabel('kg')).toBe('2.5 kg');
    expect(weightStepLabel('lb')).toBe('5 lb');
  });
});

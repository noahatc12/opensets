// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  backFeel,
  sheetFeel,
  scaleSpring,
  parseChoice,
  DEFAULT_CHOICE,
  type FeelChoice,
  type Speed,
} from './feel';

const ratio = (p: { stiffness: number; damping: number }) =>
  p.damping / (2 * Math.sqrt(p.stiffness));
const choice = (
  back: FeelChoice['back'],
  sheet: FeelChoice['sheet'] = DEFAULT_CHOICE.sheet,
): FeelChoice => ({ back, sheet });

describe('feel', () => {
  // The numbers are written out, not read from SHIPPED, so drift in either place fails.
  it('"now" on both axes is exactly what shipped on 2026-09-27', () => {
    expect(backFeel(DEFAULT_CHOICE)).toEqual({
      release: { stiffness: 260, damping: 30 },
      home: { stiffness: 420, damping: 38 },
      closeFraction: 0.33,
      flick: 0.45,
    });
    expect(sheetFeel(DEFAULT_CHOICE)).toEqual({
      close: { stiffness: 300, damping: 34 },
      home: { stiffness: 420, damping: 38 },
      flickHome: { stiffness: 320, damping: 26 },
      closeFraction: 0.35,
      flick: 0.4,
    });
  });

  it('speed changes the response time and never the damping ratio', () => {
    const base = { stiffness: 260, damping: 30 };
    for (const s of ['snappy', 'now', 'soft'] as Speed[]) {
      expect(ratio(scaleSpring(base, s))).toBeCloseTo(ratio(base), 10);
    }
    const snappy = scaleSpring(base, 'snappy').stiffness;
    const soft = scaleSpring(base, 'soft').stiffness;
    expect(snappy).toBeGreaterThan(base.stiffness);
    expect(soft).toBeLessThan(base.stiffness);
    // Period goes with 1/sqrt(k): snappy is 0.8 of shipped, soft 1.25.
    expect(Math.sqrt(base.stiffness / snappy)).toBeCloseTo(0.8, 10);
    expect(Math.sqrt(base.stiffness / soft)).toBeCloseTo(1.25, 10);
  });

  it('trigger moves how far and how fast a gesture must go to commit', () => {
    const easy = backFeel(choice({ speed: 'now', trigger: 'easy' }));
    const firm = backFeel(choice({ speed: 'now', trigger: 'firm' }));
    expect(easy.closeFraction).toBeLessThan(0.33);
    expect(firm.closeFraction).toBeGreaterThan(0.33);
    expect(easy.flick).toBeLessThan(0.45);
    expect(firm.flick).toBeGreaterThan(0.45);
    // Trigger leaves the springs alone.
    expect(firm.release).toEqual({ stiffness: 260, damping: 30 });
  });

  it('each gesture reads only its own setting', () => {
    const c = choice({ speed: 'soft', trigger: 'firm' });
    expect(sheetFeel(c)).toEqual(sheetFeel(DEFAULT_CHOICE));
  });

  it('stored junk falls back to what shipped, a partial choice keeps what is valid', () => {
    expect(parseChoice(null)).toEqual(DEFAULT_CHOICE);
    expect(parseChoice('not json')).toEqual(DEFAULT_CHOICE);
    expect(parseChoice('{"back":{"speed":"warp","trigger":"firm"}}')).toEqual({
      back: { speed: 'now', trigger: 'firm' },
      sheet: { speed: 'now', trigger: 'now' },
    });
  });
});

describe('feel store', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
  });

  it('a choice survives a relaunch and the next swipe reads it', async () => {
    const a = await import('./feel');
    let calls = 0;
    a.subscribeFeel(() => calls++);
    a.setFeel('back', { trigger: 'firm' });
    expect(calls).toBe(1);
    expect(a.backFeel().closeFraction).toBeCloseTo(0.429, 10);

    vi.resetModules();
    const b = await import('./feel');
    expect(b.getFeel().back).toEqual({ speed: 'now', trigger: 'firm' });
  });

  it('reset and turning tune mode off leave nothing stored', async () => {
    const a = await import('./feel');
    a.setFeel('sheet', { speed: 'soft' });
    a.setTuning(true);
    expect(localStorage.getItem('opensets-tune')).toBe('1');
    a.resetFeel();
    a.setTuning(false);
    expect(localStorage.getItem('opensets-feel')).toBeNull();
    expect(localStorage.getItem('opensets-tune')).toBeNull();
    expect(a.sheetFeel()).toEqual(a.sheetFeel(a.DEFAULT_CHOICE));
  });
});

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
  // They are the 09-27 numbers at Soft and Easy, Noah's pick in the hand on 09-28.
  it('"now" on both axes is what Noah picked on 2026-09-28', () => {
    expect(backFeel(DEFAULT_CHOICE)).toEqual({
      release: { stiffness: 166.4, damping: 24 },
      home: { stiffness: 268.8, damping: 30.4 },
      closeFraction: 0.2475,
      flick: 0.3375,
    });
    expect(sheetFeel(DEFAULT_CHOICE)).toEqual({
      close: { stiffness: 192, damping: 27.2 },
      home: { stiffness: 268.8, damping: 30.4 },
      flickHome: { stiffness: 204.8, damping: 20.8 },
      closeFraction: 0.2625,
      flick: 0.3,
    });
  });

  it('the 09-28 numbers are the 09-27 ones at Soft and Easy, damping ratio kept', () => {
    const old = { stiffness: 260, damping: 30 };
    expect(scaleSpring(old, 'soft').stiffness).toBeCloseTo(166.4, 10);
    expect(scaleSpring(old, 'soft').damping).toBeCloseTo(24, 10);
    expect(ratio(backFeel(DEFAULT_CHOICE).release)).toBeCloseTo(ratio(old), 10);
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
    expect(easy.closeFraction).toBeLessThan(0.2475);
    expect(firm.closeFraction).toBeGreaterThan(0.2475);
    expect(easy.flick).toBeLessThan(0.3375);
    expect(firm.flick).toBeGreaterThan(0.3375);
    // Trigger leaves the springs alone.
    expect(firm.release).toEqual({ stiffness: 166.4, damping: 24 });
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
    expect(a.backFeel().closeFraction).toBeCloseTo(0.2475 * 1.3, 10);

    vi.resetModules();
    const b = await import('./feel');
    expect(b.getFeel().back).toEqual({ speed: 'now', trigger: 'firm' });
  });

  it('a choice stored against the 09-27 numbers is dropped, not applied twice', async () => {
    localStorage.setItem(
      'opensets-feel',
      JSON.stringify({ back: { speed: 'soft', trigger: 'easy' } }),
    );
    const a = await import('./feel');
    expect(a.getFeel()).toEqual(a.DEFAULT_CHOICE);
    expect(localStorage.getItem('opensets-feel')).toBeNull();
  });

  it('reset and turning tune mode off leave nothing stored', async () => {
    const a = await import('./feel');
    a.setFeel('sheet', { speed: 'soft' });
    a.setTuning(true);
    expect(localStorage.getItem('opensets-tune')).toBe('1');
    a.resetFeel();
    a.setTuning(false);
    expect(localStorage.getItem('opensets-feel-v2')).toBeNull();
    expect(localStorage.getItem('opensets-tune')).toBeNull();
    expect(a.sheetFeel()).toEqual(a.sheetFeel(a.DEFAULT_CHOICE));
  });
});

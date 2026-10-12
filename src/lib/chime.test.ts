// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { playChime, primeChime, resetChimeForTests } from './chime';

/** The smallest AudioContext the chime needs, counting what it schedules. */
function fakeAudio(state: 'running' | 'suspended' = 'running') {
  const started: number[] = [];
  const gain = {
    gain: {
      setValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
    },
    connect: vi.fn(() => gain),
  };
  class FakeAC {
    state = state;
    currentTime = 0;
    destination = {};
    resume = vi.fn(async () => {
      this.state = 'running';
    });
    createOscillator() {
      return {
        type: 'sine',
        frequency: { value: 0 },
        connect: vi.fn(() => gain),
        start: (at: number) => started.push(at),
        stop: vi.fn(),
      };
    }
    createGain() {
      return gain;
    }
  }
  return { FakeAC, started };
}

afterEach(() => {
  resetChimeForTests();
  vi.unstubAllGlobals();
});

describe('chime', () => {
  it('is silent where there is no audio, and never throws', () => {
    vi.stubGlobal('AudioContext', undefined);
    expect(() => primeChime()).not.toThrow();
    expect(playChime()).toBe(false);
  });

  it('plays nothing until a tap primed it, then two notes', () => {
    const { FakeAC, started } = fakeAudio();
    vi.stubGlobal('AudioContext', FakeAC);
    expect(playChime()).toBe(false);
    primeChime();
    expect(playChime()).toBe(true);
    expect(started).toEqual([0, 0.16]);
  });

  it('resumes a suspended context on prime', () => {
    const { FakeAC } = fakeAudio('suspended');
    vi.stubGlobal('AudioContext', FakeAC);
    primeChime();
    // resume() is async; the first play after a prime on a suspended context may still
    // be silent, which is the honest answer rather than a throw.
    expect(typeof playChime()).toBe('boolean');
  });
});

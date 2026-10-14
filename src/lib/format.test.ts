import { describe, expect, it } from 'vitest';
import { explainTempo, humanReason, phaseWords } from './format';

// Review card f10 (Noah, 2026-10-01): plain words for new lifters. RPE becomes effort,
// the mesocycle phase names become what they mean, tempo explains itself.

describe('humanReason', () => {
  it('turns the engine week tail into words: week, phase, effort', () => {
    expect(
      humanReason(
        'Starting weight — build toward 12 reps. · Wk 2 Accumulation (RPE 8)',
      ),
    ).toBe(
      'Starting weight: build toward 12 reps. · week 2, building volume, effort 8',
    );
    expect(humanReason('Hold 185 lb · Wk 5 Deload (RPE 6)')).toBe(
      'Hold 185 lb · week 5, easy week, effort 6',
    );
  });

  it('says effort wherever the engine says RPE', () => {
    expect(humanReason('Hold 185 lb — log RPE to autoregulate.')).toBe(
      'Hold 185 lb: log effort to autoregulate.',
    );
    expect(humanReason('+2.5% — top set RPE 7.5 under target 9.')).toBe(
      '+2.5%: top set effort 7.5 under target 9.',
    );
  });
});

describe('phaseWords', () => {
  it('names each phase by what it means', () => {
    expect(phaseWords('accumulation')).toBe('building volume');
    expect(phaseWords('intensification')).toBe('pushing harder');
    expect(phaseWords('deload')).toBe('easy week');
    expect(phaseWords('peak')).toBe('peak');
  });
});

describe('explainTempo', () => {
  it('reads a four-count tempo as lower, pause, lift, pause', () => {
    expect(explainTempo('3-1-1-0')).toEqual([
      { count: '3', text: 'Lower the weight for 3 seconds' },
      { count: '1', text: 'Pause 1 second at the bottom' },
      { count: '1', text: 'Lift in 1 second' },
      { count: '0', text: 'No pause at the top' },
    ]);
  });

  it('reads X as fast, 0 as no pause, and plurals right', () => {
    expect(explainTempo('2-0-X-2')).toEqual([
      { count: '2', text: 'Lower the weight for 2 seconds' },
      { count: '0', text: 'No pause at the bottom' },
      { count: 'X', text: 'Lift as fast as you can' },
      { count: '2', text: 'Pause 2 seconds at the top' },
    ]);
  });

  it('copes with a three-count tempo and an unreadable one', () => {
    expect(explainTempo('3-0-1')).toHaveLength(3);
    expect(explainTempo('slow')).toEqual([]);
  });
});

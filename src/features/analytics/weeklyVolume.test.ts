import { describe, it, expect } from 'vitest';
import { weeklyVolumeByMuscle, type ExerciseMuscles } from './weeklyVolume';
import type { LoggedSet, Muscle } from '../../db/types';

let n = 0;
function set(exerciseId: string, date: string, type: LoggedSet['type'] = 'working'): LoggedSet {
  return {
    id: `s${n++}`,
    sessionId: 'sess',
    exerciseId,
    date,
    order: 0,
    type,
    weightLb: 100,
    reps: 5,
    completed: true,
  };
}

// bench → primary Chest, secondary Triceps+Shoulders; squat → primary Quads, secondary Glutes.
const muscles: Record<string, ExerciseMuscles> = {
  bench: { primary: ['chest' as Muscle], secondary: ['triceps' as Muscle, 'shoulders' as Muscle] },
  squat: { primary: ['quadriceps' as Muscle], secondary: ['glutes' as Muscle] },
};
const lookup = (id: string): ExerciseMuscles | undefined => muscles[id];

describe('weeklyVolumeByMuscle', () => {
  it('returns [] with no sets', () => {
    expect(weeklyVolumeByMuscle([], lookup)).toEqual([]);
  });

  it('weights primary 1.0 and secondary 0.5 per set', () => {
    // two bench sets in-window → chest 2.0, triceps 1.0, shoulders 1.0
    const v = weeklyVolumeByMuscle([set('bench', '2026-06-20'), set('bench', '2026-06-21')], lookup);
    expect(Object.fromEntries(v)).toEqual({ chest: 2, triceps: 1, shoulders: 1 });
  });

  it('only counts the 7-day window anchored at the latest set', () => {
    // anchor = 2026-06-20; window = 06-14..06-20 inclusive. 06-13 is out, 06-14 is in.
    const v = weeklyVolumeByMuscle(
      [
        set('squat', '2026-06-01'), // out
        set('squat', '2026-06-13'), // out (one day before window)
        set('squat', '2026-06-14'), // in (window edge)
        set('squat', '2026-06-20'), // in (anchor)
      ],
      lookup,
    );
    // 2 in-window squat sets → quads 2.0, glutes 1.0
    expect(Object.fromEntries(v)).toEqual({ quadriceps: 2, glutes: 1 });
  });

  it('ignores warmup / non-hard sets', () => {
    const v = weeklyVolumeByMuscle(
      [set('bench', '2026-06-20', 'warmup' as LoggedSet['type']), set('bench', '2026-06-20', 'amrap')],
      lookup,
    );
    // only the amrap counts → chest 1.0
    expect(Object.fromEntries(v)).toEqual({ chest: 1, triceps: 0.5, shoulders: 0.5 });
  });

  it('sorts descending and caps to topN', () => {
    const v = weeklyVolumeByMuscle(
      [set('bench', '2026-06-20'), set('bench', '2026-06-20'), set('squat', '2026-06-20')],
      lookup,
      2,
    );
    expect(v.length).toBe(2);
    expect(v[0]![0]).toBe('chest'); // 2.0, highest
    expect(v[0]![1]).toBeGreaterThanOrEqual(v[1]![1]);
  });

  it('skips exercises with no muscle map', () => {
    const v = weeklyVolumeByMuscle([set('unknown', '2026-06-20')], lookup);
    expect(v).toEqual([]);
  });
});

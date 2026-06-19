import { describe, it, expect } from 'vitest';
import {
  parseCsv,
  detectFormat,
  parseWorkoutCsv,
  serializeSetsToCsv,
  type ExportRow,
} from './csv';

describe('parseCsv', () => {
  it('parses simple rows', () => {
    expect(parseCsv('a,b,c\n1,2,3')).toEqual([
      ['a', 'b', 'c'],
      ['1', '2', '3'],
    ]);
  });
  it('handles quoted fields with commas, quotes, and newlines', () => {
    const text = 'name,note\n"Squat, high bar","he said ""go""\nnext line"';
    expect(parseCsv(text)).toEqual([
      ['name', 'note'],
      ['Squat, high bar', 'he said "go"\nnext line'],
    ]);
  });
  it('normalizes CRLF and skips blank lines', () => {
    expect(parseCsv('a,b\r\n1,2\r\n\r\n3,4')).toEqual([
      ['a', 'b'],
      ['1', '2'],
      ['3', '4'],
    ]);
  });
});

describe('detectFormat', () => {
  it('detects Hevy', () => {
    expect(
      detectFormat(['title', 'exercise_title', 'weight_lbs', 'reps']),
    ).toBe('hevy');
  });
  it('detects Strong', () => {
    expect(
      detectFormat([
        'Date',
        'Workout Name',
        'Exercise Name',
        'Set Order',
        'Weight',
        'Reps',
      ]),
    ).toBe('strong');
  });
  it('returns unknown otherwise', () => {
    expect(detectFormat(['foo', 'bar'])).toBe('unknown');
  });
});

describe('parseWorkoutCsv — Hevy', () => {
  const csv = [
    'title,start_time,exercise_title,set_index,set_type,weight_lbs,reps,rpe,duration_seconds,distance_miles',
    'Push,2026-06-19T17:00:00Z,Bench Press,0,normal,135,5,8,,',
    'Push,2026-06-19T17:00:00Z,Bench Press,1,warmup,45,10,,,',
  ].join('\n');

  it('converts lbs to kg and maps fields/types', () => {
    const { format, sets } = parseWorkoutCsv(csv);
    expect(format).toBe('hevy');
    expect(sets).toHaveLength(2);
    expect(sets[0]!.exerciseName).toBe('Bench Press');
    expect(sets[0]!.weightKg).toBeCloseTo(61.23, 1); // 135 lb
    expect(sets[0]!.reps).toBe(5);
    expect(sets[0]!.rpe).toBe(8);
    expect(sets[0]!.setType).toBe('working');
    expect(sets[1]!.setType).toBe('warmup');
  });
});

describe('parseWorkoutCsv — Strong', () => {
  const csv = [
    'Date,Workout Name,Exercise Name,Set Order,Weight,Reps,Distance,Seconds,RPE',
    '2026-06-19,Legs,Squat,1,100,5,,,9',
  ].join('\n');

  it('treats Strong weight as kg by default', () => {
    const { format, sets } = parseWorkoutCsv(csv);
    expect(format).toBe('strong');
    expect(sets[0]!.weightKg).toBe(100);
    expect(sets[0]!.reps).toBe(5);
    expect(sets[0]!.rpe).toBe(9);
  });
  it('converts when told the file is in lb', () => {
    const { sets } = parseWorkoutCsv(csv, { strongUnit: 'lb' });
    expect(sets[0]!.weightKg).toBeCloseTo(45.36, 1);
  });
});

describe('parseWorkoutCsv — unknown / empty', () => {
  it('returns empty for an unrecognized header', () => {
    expect(parseWorkoutCsv('a,b\n1,2').sets).toEqual([]);
  });
  it('returns empty for a header-only file', () => {
    expect(parseWorkoutCsv('title,exercise_title,weight_lbs').sets).toEqual([]);
  });
});

describe('serializeSetsToCsv', () => {
  const rows: ExportRow[] = [
    {
      workoutName: 'Legs, heavy',
      date: '2026-06-19',
      exerciseName: 'Back Squat',
      setIndex: 0,
      setType: 'working',
      weightKg: 100,
      reps: 5,
      rpe: 8,
    },
  ];

  it('writes a header and quotes fields containing commas', () => {
    const out = serializeSetsToCsv(rows);
    const lines = out.split('\n');
    expect(lines[0]).toContain('weight_kg');
    expect(lines[1]).toContain('"Legs, heavy"');
    expect(lines[1]).toContain('100');
  });

  it('round-trips back through parseCsv', () => {
    const parsed = parseCsv(serializeSetsToCsv(rows));
    expect(parsed[1]![0]).toBe('Legs, heavy');
    expect(parsed[1]![5]).toBe('100');
  });
});

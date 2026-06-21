/**
 * CSV import/export (spec §12) — pure parsing + serialization. The data-refugee
 * path (Strong/Hevy → OpenSets) and the anti-lock-in path (OpenSets → CSV).
 *
 * Pure functions over strings; the Dexie insertion + the unmatched-exercise
 * mapping UI sit on top of these. Imported sets are history-only: lb is canonical
 * (Hevy exports lbs → stored as-is; Strong kg → converted to lb), and no
 * progression state is inferred.
 */
import type { SetType } from '../engine/types';

const LB_TO_KG = 0.45359237;
const MILE_TO_M = 1609.344;

export type CsvFormat = 'hevy' | 'strong' | 'unknown';

export interface ImportedSet {
  workoutName: string;
  date: string;
  exerciseName: string;
  weightLb: number;
  reps: number;
  rpe?: number;
  durationSec?: number;
  distanceM?: number;
  setType: SetType;
}

/** RFC-4180-ish CSV parser: handles quoted fields, escaped quotes, embedded commas/newlines. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  const src = text.replace(/\r\n?/g, '\n');

  for (let i = 0; i < src.length; i++) {
    const c = src[i]!;
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += c;
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ''));
}

const norm = (h: string) => h.trim().toLowerCase();

export function detectFormat(headers: string[]): CsvFormat {
  const h = new Set(headers.map(norm));
  if (h.has('exercise_title') && (h.has('weight_lbs') || h.has('set_index'))) {
    return 'hevy';
  }
  if (h.has('exercise name') && (h.has('set order') || h.has('workout name'))) {
    return 'strong';
  }
  return 'unknown';
}

function num(v: string | undefined): number | undefined {
  if (v === undefined || v.trim() === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function mapSetType(raw: string | undefined): SetType {
  switch (norm(raw ?? '')) {
    case 'warmup':
    case 'warm up':
      return 'warmup';
    case 'dropset':
    case 'drop set':
    case 'drop':
      return 'drop';
    case 'amrap':
    case 'failure':
      return 'amrap';
    default:
      return 'working';
  }
}

function indexer(headers: string[]) {
  const map = new Map(headers.map((h, i) => [norm(h), i]));
  return (row: string[], key: string) => {
    const i = map.get(key);
    return i === undefined ? undefined : row[i];
  };
}

/**
 * Parse a Strong/Hevy workout CSV into normalized sets. `strongUnit` declares the
 * unit of Strong's ambiguous Weight column (Strong doesn't always label it).
 */
export function parseWorkoutCsv(
  text: string,
  opts: { strongUnit?: 'kg' | 'lb' } = {},
): { format: CsvFormat; sets: ImportedSet[] } {
  const rows = parseCsv(text);
  if (rows.length < 2) return { format: 'unknown', sets: [] };
  const headers = rows[0]!;
  const format = detectFormat(headers);
  if (format === 'unknown') return { format, sets: [] };

  const get = indexer(headers);
  const sets: ImportedSet[] = [];

  for (const row of rows.slice(1)) {
    if (format === 'hevy') {
      const reps = num(get(row, 'reps'));
      const lbs = num(get(row, 'weight_lbs'));
      sets.push({
        workoutName: get(row, 'title')?.trim() ?? '',
        date: get(row, 'start_time')?.trim() ?? '',
        exerciseName: get(row, 'exercise_title')?.trim() ?? '',
        weightLb: lbs ?? 0, // Hevy is already pounds — store as-is
        reps: reps ?? 0,
        rpe: num(get(row, 'rpe')),
        durationSec: num(get(row, 'duration_seconds')),
        distanceM: convert(num(get(row, 'distance_miles')), MILE_TO_M),
        setType: mapSetType(get(row, 'set_type')),
      });
    } else {
      const reps = num(get(row, 'reps'));
      const w = num(get(row, 'weight'));
      // Strong's Weight column is unit-ambiguous: lb stores as-is; kg converts to lb.
      const lb =
        w === undefined
          ? 0
          : opts.strongUnit === 'lb'
            ? w
            : round2(w / LB_TO_KG);
      sets.push({
        workoutName: get(row, 'workout name')?.trim() ?? '',
        date: get(row, 'date')?.trim() ?? '',
        exerciseName: get(row, 'exercise name')?.trim() ?? '',
        weightLb: lb,
        reps: reps ?? 0,
        rpe: num(get(row, 'rpe')),
        durationSec: num(get(row, 'seconds')),
        distanceM: num(get(row, 'distance')),
        setType: mapSetType(get(row, 'set type')),
      });
    }
  }
  return { format, sets };
}

function convert(v: number | undefined, factor: number): number | undefined {
  return v === undefined ? undefined : round2(v * factor);
}
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export interface ExportRow {
  workoutName: string;
  date: string;
  exerciseName: string;
  setIndex: number;
  setType: SetType;
  weightLb: number;
  reps: number;
  rpe?: number;
  durationSec?: number;
  distanceM?: number;
}

const EXPORT_HEADERS = [
  'workout_name',
  'date',
  'exercise_name',
  'set_index',
  'set_type',
  'weight_lb',
  'reps',
  'rpe',
  'duration_seconds',
  'distance_m',
] as const;

function csvCell(v: string | number | undefined): string {
  if (v === undefined) return '';
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Serialize sets to a clean, portable lb-canonical CSV (anti-lock-in export). */
export function serializeSetsToCsv(rows: ExportRow[]): string {
  const lines = [EXPORT_HEADERS.join(',')];
  for (const r of rows) {
    lines.push(
      [
        r.workoutName,
        r.date,
        r.exerciseName,
        r.setIndex,
        r.setType,
        r.weightLb,
        r.reps,
        r.rpe,
        r.durationSec,
        r.distanceM,
      ]
        .map(csvCell)
        .join(','),
    );
  }
  return lines.join('\n');
}

/**
 * Sample-data seeder — populates the app with a realistic PPL program + several
 * weeks of logged history so every screen (Today, Trends, exercise detail) looks
 * like the Claude Design prototype. Reversible: wipe the DB to clear it.
 */
import { db } from './db';
import { newId } from './ids';
import { searchCatalog } from './catalog';
import {
  createProgram,
  setActiveProgram,
  createTemplate,
  saveTemplate,
  makeSlot,
  seedExerciseState,
} from './repositories';
import type { Exercise } from './types';
import type { LoggedSet, WorkoutSession, Goal, Measurement } from './types';
import type { ProgressionRule } from '../engine/types';

const DAY_MS = 86_400_000;

function startWeight(ex: Exercise): number {
  const n = ex.nameNorm;
  if (n.includes('deadlift')) return 100;
  if (n.includes('squat')) return 80;
  if (n.includes('bench') || n.includes('row')) return 60;
  if (n.includes('press')) return 45;
  if (n.includes('curl') || n.includes('extension') || n.includes('pushdown') || n.includes('raise'))
    return 20;
  return ex.isBodyweight ? 0 : 40;
}

export async function seedSampleData(catalog: Exercise[], now: string): Promise<void> {
  const pick = (q: string): Exercise | undefined => searchCatalog(catalog, q, 5)[0];
  const resolve = (qs: string[]): Exercise[] => {
    const out: Exercise[] = [];
    const seen = new Set<string>();
    for (const q of qs) {
      const ex = pick(q);
      if (ex && !seen.has(ex.id)) {
        out.push(ex);
        seen.add(ex.id);
      }
    }
    return out;
  };

  const program = await createProgram('Push Pull Legs', now);
  await setActiveProgram(program.id);

  const dayDefs: Array<[string, string[]]> = [
    ['Push', ['barbell bench press', 'overhead press', 'incline dumbbell press', 'triceps pushdown']],
    ['Pull', ['barbell deadlift', 'bent over barbell row', 'lat pulldown', 'barbell curl']],
    ['Legs', ['barbell full squat', 'romanian deadlift', 'leg press', 'leg extension']],
  ];

  const rule: ProgressionRule = { kind: 'double', repMin: 8, repMax: 12, incrementKg: 2.5, perSet: false };
  const templates = [];
  for (let i = 0; i < dayDefs.length; i++) {
    const [name, queries] = dayDefs[i]!;
    const exs = resolve(queries);
    const tpl = await createTemplate(program.id, name, i);
    tpl.slots = exs.map((ex, j) =>
      makeSlot(ex.id, j, rule, { sets: 3, repRange: [8, 12] }, { warmupSec: 60, workSec: 150 }),
    );
    await saveTemplate(tpl);
    for (const slot of tpl.slots) {
      const ex = exs.find((e) => e.id === slot.exerciseId)!;
      await seedExerciseState(program.id, slot, startWeight(ex), now);
    }
    templates.push({ tpl, exs });
  }

  // ~5 weeks of completed history, 3 days/week, weights progressing ~2.5/week.
  const nowMs = Date.parse(now);
  const sessions: WorkoutSession[] = [];
  const sets: LoggedSet[] = [];

  for (let wk = 5; wk >= 0; wk--) {
    for (let d = 0; d < templates.length; d++) {
      const { tpl, exs } = templates[d]!;
      const dateMs = nowMs - (wk * 7 + (2 - d) * 2 + 1) * DAY_MS;
      const iso = new Date(dateMs).toISOString();
      const date = iso.slice(0, 10);
      const sid = newId();
      const newest = wk === 0;
      sessions.push({
        id: sid,
        programId: program.id,
        templateId: tpl.id,
        date,
        startedAt: iso,
        endedAt: new Date(dateMs + 50 * 60_000).toISOString(),
        status: 'completed',
        executedSlots: structuredClone(tpl.slots),
      });
      exs.forEach((ex, ei) => {
        const w = startWeight(ex) + (5 - wk) * 2.5;
        for (let s = 0; s < 3; s++) {
          sets.push({
            id: newId(),
            sessionId: sid,
            exerciseId: ex.id,
            date,
            order: s,
            type: 'working',
            weightKg: w,
            reps: 8 + (s === 0 ? 2 : 0),
            completed: true,
            rpe: 8,
            ...(newest && ei === 0 && s === 0 ? { isPR: ['weight', 'e1rm'] as const } : {}),
          });
        }
      });
    }
  }

  await db.sessions.bulkAdd(sessions);
  await db.sets.bulkAdd(sets);

  // A couple goals + bodyweight history so the Goals / Measurements screens
  // render their populated card layouts (instead of empty states).
  const benchId = templates[0]?.exs[0]?.id;
  const goals: Goal[] = [
    { id: newId(), type: 'bodyweight', target: 82, direction: 'increase', status: 'active', createdAt: now },
    ...(benchId
      ? [
          {
            id: newId(),
            type: 'liftTarget' as const,
            target: 100,
            direction: 'increase' as const,
            exerciseId: benchId,
            status: 'active' as const,
            createdAt: now,
          },
        ]
      : []),
  ];
  await db.goals.bulkAdd(goals);

  const measurements: Measurement[] = [];
  for (let wk = 4; wk >= 0; wk--) {
    measurements.push({
      id: newId(),
      date: new Date(nowMs - wk * 7 * DAY_MS).toISOString(),
      type: 'bodyweight',
      valueKg: Math.round((80 + (4 - wk) * 0.6) * 10) / 10,
    });
  }
  measurements.push({ id: newId(), date: now, type: 'waist', valueCm: 82 });
  await db.measurements.bulkAdd(measurements);
}

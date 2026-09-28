/**
 * build-exercises.ts — exercise library build pipeline (spec §7).
 *
 * Ingests yuhonas/free-exercise-db at a PINNED commit, normalizes names, maps the
 * muscle/equipment vocabulary to the app's canonical taxonomy, points images at
 * jsDelivr (pinned to the same commit), and emits:
 *   - public/data/exercises.json        the normalized library, with each exercise's
 *                                       search aliases and common-lift flag joined in
 *                                       from data/search/ (2026-09-28)
 *   - public/data/exercises-meta.json   provenance (sha, counts, license)
 *
 * Search runs over exercises.json itself (src/db/exerciseSearch.ts); the prebuilt
 * FlexSearch index it replaced was 1.9 MB of precache and scored 40.9% top 3.
 *
 * Pure build tool: runs in CI (and locally via `npm run build:exercises`). Node 24
 * runs this TypeScript directly (type-stripping). Includes a hard-fail sanity gate
 * so a bad fetch / wrong shape can never silently ship an empty library.
 */
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Exercise, Muscle, Equipment } from '../src/db/types.ts';

// Pinned commit — images + data come from exactly this SHA (immutable, cached).
const SHA = 'b0eed061e1c832b3ed815fbaa4b45b3cdc14df49';
const DATA_URL = `https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@${SHA}/dist/exercises.json`;
const IMG_BASE = `https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@${SHA}/exercises`;

const OUT_DIR = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../public/data',
);

/** Raw record shape from free-exercise-db. */
interface RawExercise {
  id?: string;
  name: string;
  force?: string | null;
  level?: string;
  mechanic?: 'compound' | 'isolation' | null;
  equipment?: string | null;
  primaryMuscles?: string[];
  secondaryMuscles?: string[];
  instructions?: string[];
  category?: string;
  images?: string[];
}

const MUSCLE_MAP: Record<string, Muscle> = {
  abdominals: 'abdominals',
  abductors: 'abductors',
  adductors: 'adductors',
  biceps: 'biceps',
  calves: 'calves',
  chest: 'chest',
  forearms: 'forearms',
  glutes: 'glutes',
  hamstrings: 'hamstrings',
  lats: 'lats',
  'lower back': 'lowerBack',
  'middle back': 'middleBack',
  neck: 'neck',
  quadriceps: 'quadriceps',
  shoulders: 'shoulders',
  traps: 'traps',
  triceps: 'triceps',
};

const EQUIPMENT_MAP: Record<string, Equipment> = {
  'body only': 'bodyweight',
  barbell: 'barbell',
  dumbbell: 'dumbbell',
  kettlebells: 'kettlebell',
  machine: 'machine',
  cable: 'cable',
  bands: 'bands',
  'medicine ball': 'medicineBall',
  'exercise ball': 'exerciseBall',
  'foam roll': 'foamRoll',
  'e-z curl bar': 'ezBar',
  other: 'other',
};

function normName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function mapMuscles(
  raw: string[] | undefined,
  unmapped: Set<string>,
): Muscle[] {
  if (!raw) return [];
  const out: Muscle[] = [];
  for (const m of raw) {
    const mapped = MUSCLE_MAP[m.toLowerCase()];
    if (mapped) out.push(mapped);
    else unmapped.add(`muscle:${m}`);
  }
  return out;
}

function mapEquipment(
  raw: string | null | undefined,
  unmapped: Set<string>,
): Equipment | undefined {
  if (!raw) return undefined;
  const mapped = EQUIPMENT_MAP[raw.toLowerCase()];
  if (!mapped) {
    unmapped.add(`equipment:${raw}`);
    return 'other';
  }
  return mapped;
}

function transform(raw: RawExercise, unmapped: Set<string>): Exercise {
  const equipment = mapEquipment(raw.equipment, unmapped);
  const isBodyweight = equipment === 'bodyweight';
  const trackingMode: Exercise['trackingMode'] =
    raw.category === 'cardio' ? 'duration' : isBodyweight ? 'reps' : 'load';

  return {
    id: raw.id ?? normName(raw.name).replace(/\s+/g, '_'),
    name: raw.name,
    nameNorm: normName(raw.name),
    primaryMuscles: mapMuscles(raw.primaryMuscles, unmapped),
    secondaryMuscles: mapMuscles(raw.secondaryMuscles, unmapped),
    equipment,
    mechanic: raw.mechanic ?? undefined,
    level: raw.level,
    instructions: raw.instructions ?? [],
    images: (raw.images ?? []).map((p) => `${IMG_BASE}/${p}`),
    isCustom: false,
    isBodyweight,
    trackingMode,
    license: 'unlicense',
    category: raw.category,
  };
}

/** M-001 gate: refuse to ship if the dataset is missing or implausibly small. */
function assertSane(exercises: Exercise[]): void {
  if (exercises.length < 500) {
    throw new Error(
      `Sanity gate failed: only ${exercises.length} exercises parsed (expected ~870). Aborting — refusing to ship a truncated library.`,
    );
  }
  const noPrimary = exercises.filter(
    (e) => e.primaryMuscles.length === 0,
  ).length;
  const noImages = exercises.filter((e) => e.images.length === 0).length;
  if (noPrimary / exercises.length > 0.15) {
    throw new Error(
      `Sanity gate failed: ${noPrimary}/${exercises.length} exercises have no primary muscle — taxonomy mapping likely broke.`,
    );
  }
  console.log(
    `  sanity: ${exercises.length} exercises · ${noPrimary} without primary muscle · ${noImages} without images`,
  );
}

/** Join the search aliases and the common-lift set (data/search/) onto the library,
 *  failing the build on an id that does not exist, so a renamed exercise cannot
 *  silently drop its aliases. */
function joinSearchData(exercises: Exercise[]): number {
  const dir = resolve(
    dirname(fileURLToPath(import.meta.url)),
    '../data/search',
  );
  const aliases = JSON.parse(
    readFileSync(resolve(dir, 'aliases.json'), 'utf8'),
  ) as Record<string, string[]>;
  const common = new Set(
    JSON.parse(readFileSync(resolve(dir, 'common.json'), 'utf8')) as string[],
  );
  const ids = new Set(exercises.map((e) => e.id));
  const unknown = [...Object.keys(aliases), ...common].filter(
    (id) => !ids.has(id),
  );
  if (unknown.length)
    throw new Error(
      `data/search names unknown exercise ids: ${unknown.slice(0, 5).join(', ')}`,
    );
  let count = 0;
  for (const ex of exercises) {
    const a = aliases[ex.id];
    if (a?.length) {
      ex.aliases = a;
      count += a.length;
    }
    if (common.has(ex.id)) ex.common = true;
  }
  return count;
}

async function main(): Promise<void> {
  console.log(
    `build-exercises: fetching free-exercise-db @ ${SHA.slice(0, 10)}…`,
  );
  const res = await fetch(DATA_URL);
  if (!res.ok) {
    throw new Error(
      `Fetch failed: ${res.status} ${res.statusText} for ${DATA_URL}`,
    );
  }
  const json = (await res.json()) as
    | RawExercise[]
    | { exercises: RawExercise[] };
  const raw: RawExercise[] = Array.isArray(json) ? json : json.exercises;
  if (!Array.isArray(raw)) {
    throw new Error('Unexpected dataset shape: no exercises array found.');
  }

  const unmapped = new Set<string>();
  const seen = new Set<string>();
  const exercises: Exercise[] = [];
  for (const r of raw) {
    if (!r?.name) continue;
    const ex = transform(r, unmapped);
    if (seen.has(ex.id)) continue; // drop duplicate ids
    seen.add(ex.id);
    exercises.push(ex);
  }
  exercises.sort((a, b) => a.name.localeCompare(b.name));

  assertSane(exercises);
  if (unmapped.size > 0) {
    console.log(
      `  note: ${unmapped.size} unmapped vocab values → ${[...unmapped].slice(0, 8).join(', ')}${unmapped.size > 8 ? '…' : ''}`,
    );
  }

  const aliasCount = joinSearchData(exercises);
  console.log(`  search: ${aliasCount} aliases joined`);

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(resolve(OUT_DIR, 'exercises.json'), JSON.stringify(exercises));

  writeFileSync(
    resolve(OUT_DIR, 'exercises-meta.json'),
    JSON.stringify(
      {
        source: 'yuhonas/free-exercise-db',
        sha: SHA,
        license: 'unlicense',
        count: exercises.length,
        aliases: aliasCount,
      },
      null,
      2,
    ),
  );

  console.log(
    `build-exercises: wrote ${exercises.length} exercises to public/data/ ✓`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

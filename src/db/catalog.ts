/**
 * Exercise catalog — the bundled, read-only library (spec §7). Loaded once from
 * the static `exercises.json` the build pipeline emits (873 public-domain
 * exercises). Custom exercises (Dexie) merge in later; this is the base catalog.
 *
 * P1 uses a fast substring filter (873 items, well under the 50 ms budget). The
 * prebuilt FlexSearch index is wired in when the full library browser lands.
 */
import type { Exercise } from './types';

let cache: Exercise[] | null = null;
let inflight: Promise<Exercise[]> | null = null;
let byId: Map<string, Exercise> | null = null;

export async function loadCatalog(): Promise<Exercise[]> {
  if (cache) return cache;
  if (!inflight) {
    inflight = fetch(`${import.meta.env.BASE_URL}data/exercises.json`)
      .then((r) => {
        if (!r.ok) throw new Error(`catalog fetch failed: ${r.status}`);
        return r.json() as Promise<Exercise[]>;
      })
      .then((data) => {
        cache = data;
        byId = new Map(data.map((e) => [e.id, e]));
        return data;
      });
  }
  return inflight;
}

export function getCatalogExercise(id: string): Exercise | undefined {
  return byId?.get(id);
}

export function searchCatalog(
  all: Exercise[],
  query: string,
  limit = 40,
): Exercise[] {
  const q = query.trim().toLowerCase();
  if (!q) return all.slice(0, limit);
  const terms = q.split(/\s+/);
  const out: Exercise[] = [];
  for (const e of all) {
    if (terms.every((t) => e.nameNorm.includes(t))) {
      out.push(e);
      if (out.length >= limit) break;
    }
  }
  return out;
}

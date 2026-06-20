/**
 * Runtime exercise search (spec §7). Loads the PREBUILT FlexSearch index emitted
 * by scripts/build-exercises.ts (no runtime indexing) and runs muscle-aware
 * queries over it. A synonym layer maps the terms people actually type
 * (abs, quads, delts…) onto the dataset's canonical muscle vocabulary, because
 * forward tokenization alone won't bridge them: "abs" is not a prefix of
 * "abdominals", so without expansion a muscle-group query returns nothing.
 *
 * The Document config here MUST stay in lockstep with build-exercises.ts
 * buildIndex() — a mismatched field list makes import() reconstruct an index
 * that silently returns no hits.
 */
import { Document } from 'flexsearch';

export type SearchIndex = Document;

/** Index fields — keep identical to scripts/build-exercises.ts buildIndex(). */
const INDEX_FIELDS = [
  'name',
  'nameNorm',
  'primaryMuscles',
  'secondaryMuscles',
  'equipment',
  'category',
];

/** A fresh Document configured exactly as the build pipeline serialized it. */
export function makeDocument(): SearchIndex {
  return new Document({
    document: { id: 'id', index: INDEX_FIELDS },
    tokenize: 'forward',
  });
}

/**
 * Common search term → canonical token in the dataset vocabulary, applied per
 * query token before searching. Only aliases that differ from the canonical
 * token are listed (identity entries like lats→lats are unnecessary). Singular
 * and short forms are included where people actually type them.
 */
const SYNONYMS: Record<string, string> = {
  abs: 'abdominals',
  ab: 'abdominals',
  core: 'abdominals',
  quad: 'quadriceps',
  quads: 'quadriceps',
  delt: 'shoulders',
  delts: 'shoulders',
  shoulder: 'shoulders',
  lat: 'lats',
  glute: 'glutes',
  ham: 'hamstrings',
  hams: 'hamstrings',
  hamstring: 'hamstrings',
  pec: 'chest',
  pecs: 'chest',
  bicep: 'biceps',
  bis: 'biceps',
  tricep: 'triceps',
  tris: 'triceps',
  calf: 'calves',
  trap: 'traps',
  forearm: 'forearms',
};

/** Expand a raw query into canonical tokens (synonym-mapped). Pure; tested. */
export function expandQuery(query: string): string {
  return query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((term) => SYNONYMS[term] ?? term)
    .join(' ');
}

interface FieldResult {
  field: string;
  result: Array<string | number>;
}

/**
 * Search the index, returning matching exercise ids in relevance order,
 * de-duplicated across fields. Empty (or whitespace) query → []. Pure given
 * `doc`; tested with an in-memory fixture index.
 */
export function searchIds(doc: SearchIndex, query: string, limit = 50): string[] {
  const q = expandQuery(query);
  if (!q) return [];
  // Non-enriched Document.search → Array<{ field, result: Id[] }>.
  const raw = doc.search(q, { limit }) as unknown as FieldResult[];
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const fr of raw) {
    for (const id of fr.result ?? []) {
      const s = String(id);
      if (!seen.has(s)) {
        seen.add(s);
        ids.push(s);
      }
    }
  }
  return ids;
}

let cache: SearchIndex | null = null;
let inflight: Promise<SearchIndex> | null = null;

/**
 * Fetch the prebuilt index JSON and rebuild the Document once (singleton).
 * Resolves to a ready-to-search index.
 */
export async function loadSearchIndex(): Promise<SearchIndex> {
  if (cache) return cache;
  if (!inflight) {
    inflight = fetch(`${import.meta.env.BASE_URL}data/exercises-index.json`)
      .then((r) => {
        if (!r.ok) throw new Error(`index fetch failed: ${r.status}`);
        return r.json() as Promise<Record<string, unknown>>;
      })
      .then((exported) => {
        const doc = makeDocument();
        for (const key of Object.keys(exported)) {
          // import() is typed `data: string` but accepts the parsed export
          // payload at runtime (that's how FlexSearch round-trips a Document).
          doc.import(key, exported[key] as unknown as string);
        }
        cache = doc;
        return doc;
      });
  }
  return inflight;
}

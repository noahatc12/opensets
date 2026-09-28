/**
 * Exercise search that knows what lifters call things (2026-09-28). The app has no AI, so
 * finding "pec fly" when the dataset says "Butterfly" has to come from data and matching:
 *
 *  1. Normalize: lowercase, "&" to "and", punctuation and hyphens to spaces, light plural
 *     stemming (flyes, flies to fly; raises to raise), spelling folds (dumbell, tyre).
 *  2. Every exercise is searchable by its name AND its aliases (data/search/aliases.json,
 *     760 sourced aliases on 234 exercises, joined into the catalog at build time).
 *  3. Word synonyms are ADDED, never substituted: "calf" also tries "calves" but still
 *     matches "Seated Calf Raise". (The FlexSearch version replaced words, which broke
 *     "lat pulldown" and the dataset's own "Seated Calf Raise".) Abbreviations and phrases
 *     (RDL, OHP, press-up, Hammer Strength) are tried as an extra reading of the query.
 *  4. Per query word: exact 1.0, synonym 0.95, prefix 0.75, one or two typos 0.6. A word
 *     may land on the equipment or a muscle instead of the name, so "cable chest" works.
 *  5. Rank: exact name, then exact alias, then the same words in any order, then how well
 *     the query covers the name; small tie-breaks for word order, canonical over alias,
 *     common lifts and your recent lifts; stretches sink a little.
 *  6. If fewer than 3 results come back, one query word may go unmatched, and those results
 *     rank below every full match.
 *
 * Measured against data/search/benchmark.json (347 real-style queries) by
 * exerciseSearch.test.ts, which fails the build below 90% top 3 overall or 100% top 1 on
 * the dataset's own names. The FlexSearch version scored 40.9% and returned nothing for
 * 52% of queries. Research, sources and the counter-case: docs/research/search/.
 */
import type { Exercise } from './types';

export interface SearchHit {
  id: string;
  /** The alias that matched best, when it beat the exercise's own name. */
  matchedAlias?: string;
}

export interface SearchOptions {
  limit?: number;
  /** Exercise ids logged recently, newest first: a tie-break inside a match tier. */
  recent?: readonly string[];
}

type Searchable = Pick<
  Exercise,
  | 'id'
  | 'name'
  | 'primaryMuscles'
  | 'secondaryMuscles'
  | 'equipment'
  | 'category'
> & { aliases?: string[]; common?: boolean };

const FOLD: Record<string, string> = {
  tyre: 'tire',
  tyres: 'tires',
  dumbell: 'dumbbell',
  dumbells: 'dumbbells',
  dumbel: 'dumbbell',
  dumbbel: 'dumbbell',
  barbel: 'barbell',
  kettlebel: 'kettlebell',
  flye: 'fly',
  flyes: 'fly',
  flies: 'fly',
};

/** Phrase rewrites, tried as an extra reading of the query (the original is always
 *  searched too). Sources: docs/research/search/token-synonyms.json. */
const PHRASES: [RegExp, string][] = [
  [/press ups?/g, 'push up'],
  [/hammer ?strength/g, 'leverage'],
  [/iso ?lateral/g, 'leverage'],
  [/concept ?2/g, 'rowing stationary'],
  [/c and j/g, 'clean and jerk'],
  [/c and p/g, 'clean and press'],
  [/\brdl\b/g, 'romanian deadlift'],
  [/\bsldl\b/g, 'stiff legged deadlift'],
  [/\bohp\b/g, 'overhead press'],
  [/\bbss\b/g, 'bulgarian split squat'],
  [/\brfess\b/g, 'rear foot elevated split squat'],
  [/\bcgbp\b/g, 'close grip bench press'],
  [/\bghr\b/g, 'glute ham raise'],
  [/\bbtn\b/g, 'behind neck'],
  [/\bhspu\b/g, 'handstand push up'],
  [/\bohs\b/g, 'overhead squat'],
  [/\btgu\b/g, 'turkish get up'],
  [/\bkbs\b/g, 'kettlebell swing'],
  [/\bdl\b/g, 'deadlift'],
  [/\btrx\b/g, 'suspended'],
  [/\bprowler\b/g, 'sled'],
];

/** Word synonyms, added beside the typed word. */
const TOKEN_SYN: Record<string, string[]> = {
  db: ['dumbbell'],
  bb: ['barbell'],
  kb: ['kettlebell'],
  bw: ['bodyweight'],
  sa: ['single', 'arm'],
  sl: ['single', 'leg'],
  abs: ['abdominals'],
  ab: ['abdominals'],
  core: ['abdominals'],
  quad: ['quadriceps'],
  quads: ['quadriceps'],
  delt: ['shoulders'],
  delts: ['shoulders'],
  shoulder: ['shoulders'],
  lat: ['lats'],
  glute: ['glutes'],
  ham: ['hamstrings'],
  hams: ['hamstrings'],
  hamstring: ['hamstrings'],
  pec: ['chest'],
  pecs: ['chest'],
  bicep: ['biceps'],
  tricep: ['triceps'],
  tris: ['triceps'],
  calf: ['calves'],
  trap: ['traps'],
  forearm: ['forearms'],
  back: ['lats', 'middleback', 'lowerback'],
  legs: ['quadriceps', 'hamstrings', 'glutes', 'calves'],
  leg: ['quadriceps', 'hamstrings'],
  band: ['bands'],
  ez: ['ezbar'],
};

const EQUIP_WORDS: Record<string, string> = {
  ezBar: 'ezbar ez bar',
  medicineBall: 'medicine ball',
  exerciseBall: 'exercise ball',
  foamRoll: 'foam roll',
  bodyweight: 'bodyweight body weight',
  bands: 'bands band',
};

export const normalize = (s: string): string =>
  s
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

function stem(t: string): string {
  const f = FOLD[t];
  if (f) return f;
  if (t.length > 4 && t.endsWith('ies')) return t.slice(0, -3) + 'y';
  if (t.length > 4 && /(ches|shes|sses|xes)$/.test(t)) return t.slice(0, -2);
  if (t.length > 3 && t.endsWith('s') && !t.endsWith('ss') && !t.endsWith('us'))
    return t.slice(0, -1);
  return t;
}

const toks = (s: string): string[] =>
  normalize(s).split(' ').filter(Boolean).map(stem);

/** Damerau-Levenshtein (optimal string alignment), stopping once past `max`. */
function osa(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0]![j] = j;
  for (let i = 1; i <= a.length; i++) {
    let rowMin = Infinity;
    for (let j = 1; j <= b.length; j++) {
      const c = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(
        d[i - 1]![j]! + 1,
        d[i]![j - 1]! + 1,
        d[i - 1]![j - 1]! + c,
      );
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1])
        v = Math.min(v, d[i - 2]![j - 2]! + 1);
      d[i]![j] = v;
      rowMin = Math.min(rowMin, v);
    }
    if (rowMin > max) return max + 1;
  }
  return d[a.length]![b.length]!;
}

interface Doc {
  id: string;
  text: string;
  canonical: boolean;
  norm: string;
  t: string[];
  sorted: string;
}
interface Fields {
  f: Set<string>;
  primary: Set<string>;
  category?: string;
  common: boolean;
}
interface Prepared {
  docs: Doc[];
  fields: Map<string, Fields>;
  vocab: string[];
  vocabSet: Set<string>;
}

const prepared = new WeakMap<readonly Searchable[], Prepared>();

function prepare(catalog: readonly Searchable[]): Prepared {
  const hit = prepared.get(catalog);
  if (hit) return hit;
  const docs: Doc[] = [];
  const fields = new Map<string, Fields>();
  for (const e of catalog) {
    const names = [
      { text: e.name, canonical: true },
      ...(e.aliases ?? []).map((a) => ({ text: a, canonical: false })),
    ];
    for (const n of names) {
      const t = toks(n.text);
      docs.push({
        id: e.id,
        text: n.text,
        canonical: n.canonical,
        norm: t.join(' '),
        t,
        sorted: [...t].sort().join(' '),
      });
    }
    const equip = e.equipment ? (EQUIP_WORDS[e.equipment] ?? e.equipment) : '';
    const f = new Set<string>();
    for (const w of [equip, ...e.primaryMuscles, ...e.secondaryMuscles])
      for (const t of toks(w)) f.add(t);
    const primary = new Set<string>([
      ...e.primaryMuscles.flatMap((m) => toks(m)),
      ...(equip ? toks(equip) : []),
    ]);
    fields.set(e.id, { f, primary, category: e.category, common: !!e.common });
  }
  const vocabSet = new Set<string>(docs.flatMap((d) => d.t));
  for (const { f } of fields.values()) for (const t of f) vocabSet.add(t);
  const p = { docs, fields, vocab: [...vocabSet], vocabSet };
  prepared.set(catalog, p);
  return p;
}

/** For one query word: vocabulary word to match strength. */
function expandToken(
  p: Prepared,
  q: string,
  isLast: boolean,
): Map<string, number> {
  const m = new Map<string, number>();
  const alts = [q, ...(TOKEN_SYN[q] ?? []).map(stem)];
  for (const v of p.vocab) {
    let s = 0;
    for (const a of alts) {
      if (v === a) s = Math.max(s, a === q ? 1 : 0.95);
      else if (v.startsWith(a) && (isLast ? a.length >= 1 : a.length >= 3))
        s = Math.max(s, a.length >= 3 ? 0.75 : 0.5);
      // Typos only on longer words, or short ones whose first letter agrees, so "abs"
      // never lands on an unrelated three-letter word.
      else if (a === q && q.length >= 3 && (q.length >= 5 || v[0] === q[0])) {
        const k = q.length >= 7 ? 2 : 1;
        if (osa(q, v, k) <= k) s = Math.max(s, 0.6);
      }
    }
    if (s) m.set(v, s);
  }
  return m;
}

function scoreOnce(
  p: Prepared,
  qt: string[],
  allowMiss: boolean,
  recent: Map<string, number>,
): Map<string, { score: number; doc: Doc }> {
  const qn = qt.join(' ');
  const qSorted = [...qt].sort().join(' ');
  const exp = qt.map((t, i) => expandToken(p, t, i === qt.length - 1));
  const best = new Map<string, { score: number; doc: Doc }>();
  for (const d of p.docs) {
    let sum = 0;
    let matchedName = 0;
    let fieldOnly = 0;
    let ok = true;
    let lastPos = -1;
    let inOrder = true;
    let missed = false;
    const used = new Set<number>();
    const fx = p.fields.get(d.id)!;
    for (const m of exp) {
      let s = 0;
      let pos = -1;
      d.t.forEach((w, i) => {
        const v = m.get(w);
        if (v && v > s && !used.has(i)) {
          s = v;
          pos = i;
        }
      });
      if (s) {
        used.add(pos);
        matchedName++;
        sum += s;
        if (pos < lastPos) inOrder = false;
        lastPos = pos;
        continue;
      }
      let fs = 0;
      for (const [w, v] of m)
        if (fx.f.has(w)) fs = Math.max(fs, v * (fx.primary.has(w) ? 0.8 : 0.3));
      if (fs) {
        fieldOnly++;
        sum += fs;
        continue;
      }
      if (allowMiss && !missed && qt.length > 1) {
        missed = true;
        continue;
      }
      ok = false;
      break;
    }
    if (!ok || (matchedName === 0 && fieldOnly < qt.length)) continue;
    let score = (100 * sum) / qt.length - (missed ? 45 : 0);
    if (d.norm === qn) score += d.canonical ? 1000 : 900;
    else if (d.sorted === qSorted) score += 600;
    score += 40 * (used.size / d.t.length);
    if (inOrder && matchedName > 1) score += 10;
    if (d.canonical) score += 3;
    if (fx.category === 'stretching') score -= 8;
    if (fx.common) score += 6;
    if (fieldOnly && !d.canonical) score -= 5;
    // Recency moves a lift up inside its tier, never past a stronger match: at most 8
    // points against tier gaps of 300 or more.
    score += recent.get(d.id) ?? 0;
    const prev = best.get(d.id);
    if (!prev || prev.score < score) best.set(d.id, { score, doc: d });
  }
  return best;
}

/** Search the catalog. Pure and synchronous; about 2 ms per query on a laptop. */
export function searchExercises(
  catalog: readonly Searchable[],
  query: string,
  opts: SearchOptions = {},
): SearchHit[] {
  const base = normalize(query);
  if (!base) return [];
  const p = prepare(catalog);
  const recent = new Map<string, number>();
  (opts.recent ?? []).slice(0, 20).forEach((id, i) => {
    if (!recent.has(id)) recent.set(id, i < 8 ? 8 : 4);
  });

  const variants = new Set<string>([base]);
  let rewritten = base;
  for (const [re, to] of PHRASES) rewritten = rewritten.replace(re, to);
  variants.add(rewritten);
  for (const v of [...variants]) {
    // Compound joins: "kettle bell" also tries "kettlebell" when that is a known word.
    const w = v.split(' ');
    for (let i = 0; i + 1 < w.length; i++)
      if (p.vocabSet.has(stem(w[i]! + w[i + 1]!)))
        variants.add(
          [...w.slice(0, i), w[i]! + w[i + 1]!, ...w.slice(i + 2)].join(' '),
        );
  }

  const merge = (allowMiss: boolean) => {
    const all = new Map<string, { score: number; doc: Doc }>();
    for (const v of variants)
      for (const [id, r] of scoreOnce(p, toks(v), allowMiss, recent)) {
        const prev = all.get(id);
        if (!prev || prev.score < r.score) all.set(id, r);
      }
    return all;
  };
  const all = merge(false);
  if (all.size < 3)
    for (const [id, r] of merge(true))
      if (!all.has(id)) all.set(id, { score: r.score - 200, doc: r.doc });

  return [...all.entries()]
    .sort((a, b) => b[1].score - a[1].score)
    .slice(0, opts.limit ?? 100)
    .map(([id, r]) =>
      r.doc.canonical ? { id } : { id, matchedAlias: r.doc.text },
    );
}

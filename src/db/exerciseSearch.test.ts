import { describe, it, expect } from 'vitest';
import { searchExercises, normalize } from './exerciseSearch';
import type { Exercise } from './types';
import fixture from './__fixtures__/search-catalog.json';
import aliases from '../../data/search/aliases.json';
import common from '../../data/search/common.json';
import benchmark from '../../data/search/benchmark.json';

/* The search regression bar (docs/research/search/field-study.md). The catalog fixture is
   the built library's search fields at the pinned free-exercise-db commit, committed
   because public/data is built after the tests run in CI; the last test checks it has not
   drifted from a local build. Thresholds sit below the prototype's 97.1% on purpose: the
   benchmark and the aliases were written by the same researcher, so 97% is optimistic. A
   blind set typed by real lifters is the number that counts (asked of Noah 09-28). */

type Row = Pick<
  Exercise,
  | 'id'
  | 'name'
  | 'primaryMuscles'
  | 'secondaryMuscles'
  | 'equipment'
  | 'category'
> & { aliases?: string[]; common?: boolean };

const commonSet = new Set(common as string[]);
const catalog: Row[] = (fixture as Row[]).map((e) => ({
  ...e,
  equipment: e.equipment ?? undefined,
  category: e.category ?? undefined,
  aliases: (aliases as Record<string, string[]>)[e.id],
  common: commonSet.has(e.id),
}));

interface Q {
  query: string;
  expect: string[];
  category: string;
  split: 'dev' | 'holdout';
}
const queries = benchmark as Q[];

function run(qs: Q[]) {
  let top1 = 0;
  let top3 = 0;
  let zero = 0;
  const misses: string[] = [];
  for (const q of qs) {
    const ids = searchExercises(catalog, q.query, { limit: 10 }).map(
      (h) => h.id,
    );
    if (ids.length === 0) zero++;
    const rank = ids.findIndex((id) => q.expect.includes(id));
    if (rank === 0) top1++;
    if (rank >= 0 && rank < 3) top3++;
    else misses.push(`${q.query} (${rank < 0 ? 'none' : '#' + (rank + 1)})`);
  }
  return {
    top1: top1 / qs.length,
    top3: top3 / qs.length,
    zero: zero / qs.length,
    misses,
  };
}

describe('exercise search: the benchmark bar', () => {
  it('finds every exercise by its own name, first', () => {
    const r = run(queries.filter((q) => q.category === 'canonical'));
    expect(r.misses).toEqual([]);
    expect(r.top1).toBe(1);
  });

  it('puts a right answer in the top 3 for at least 90% of all queries', () => {
    const r = run(queries);
    expect(r.top3, r.misses.join(', ')).toBeGreaterThanOrEqual(0.9);
  });

  it('holds 88% top 3 on the holdout split', () => {
    const r = run(queries.filter((q) => q.split === 'holdout'));
    expect(r.top3, r.misses.join(', ')).toBeGreaterThanOrEqual(0.88);
  });

  it('holds 75% top 3 in every category', () => {
    const cats = [...new Set(queries.map((q) => q.category))];
    const low = cats
      .map(
        (c) => [c, run(queries.filter((q) => q.category === c)).top3] as const,
      )
      .filter(([, v]) => v < 0.75);
    expect(low).toEqual([]);
  });

  it('returns nothing for at most 3% of queries', () => {
    expect(run(queries).zero).toBeLessThanOrEqual(0.03);
  });
});

describe('exercise search: the cases that were broken', () => {
  const first = (q: string) => searchExercises(catalog, q, { limit: 3 })[0];

  it('"pec fly" and "pec deck" find the Butterfly machine, and say why', () => {
    expect(first('pec fly')?.id).toBe('Butterfly');
    const deck = first('pec deck');
    expect(deck?.id).toBe('Butterfly');
    expect(deck?.matchedAlias?.toLowerCase()).toContain('pec deck');
  });

  it('synonyms are added, not substituted: the dataset own "Seated Calf Raise" and "lat pulldown" work', () => {
    expect(first('Seated Calf Raise')?.id).toBe('Seated_Calf_Raise');
    const lat = searchExercises(catalog, 'lat pulldown', { limit: 3 }).map(
      (h) => h.id,
    );
    expect(lat.length).toBeGreaterThan(0);
  });

  it('abbreviations, British English and typos', () => {
    expect(
      searchExercises(catalog, 'rdl', { limit: 3 })
        .map((h) => h.id)
        .join(' '),
    ).toMatch(/Romanian/);
    expect(
      searchExercises(catalog, 'press ups', { limit: 3 })
        .map((h) => h.id)
        .join(' '),
    ).toMatch(/Push/);
    expect(
      searchExercises(catalog, 'benhc press', { limit: 3 })
        .map((h) => h.id)
        .join(' '),
    ).toMatch(/Bench/);
  });

  it('an exact name beats a recent lift; recency only reorders inside a tier', () => {
    const plain = searchExercises(catalog, 'row', { limit: 20 }).map(
      (h) => h.id,
    );
    const pick = plain[5]!;
    const withRecent = searchExercises(catalog, 'row', {
      limit: 20,
      recent: [pick],
    }).map((h) => h.id);
    expect(withRecent.indexOf(pick)).toBeLessThan(5);
    const exact = searchExercises(catalog, 'Butterfly', {
      recent: ['Dumbbell_Flyes'],
    })[0];
    expect(exact?.id).toBe('Butterfly');
  });

  it('empty and punctuation-only queries return nothing', () => {
    expect(searchExercises(catalog, '')).toEqual([]);
    expect(searchExercises(catalog, ' - ')).toEqual([]);
    expect(normalize('C&J')).toBe('c and j');
  });

  it('every alias and benchmark id exists in the catalog', () => {
    const ids = new Set(catalog.map((e) => e.id));
    const missing = [
      ...Object.keys(aliases as Record<string, string[]>),
      ...queries.flatMap((q) => q.expect),
      ...(common as string[]),
    ].filter((id) => !ids.has(id));
    expect(missing).toEqual([]);
  });

  it('the fixture matches the built library when one exists locally', () => {
    // Absent in CI (public/data is built after the tests); present after a local build.
    const built = Object.values(
      import.meta.glob<Row[]>('../../public/data/exercises.json', {
        eager: true,
        import: 'default',
      }),
    )[0];
    if (!built) return;
    expect(built.map((e) => `${e.id}|${e.name}`)).toEqual(
      catalog.map((e) => `${e.id}|${e.name}`),
    );
  });
});

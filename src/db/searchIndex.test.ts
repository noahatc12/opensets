import { describe, it, expect } from 'vitest';
import { expandQuery, makeDocument, searchIds } from './searchIndex';

describe('expandQuery (synonym layer)', () => {
  it('maps muscle slang to the dataset vocabulary', () => {
    expect(expandQuery('abs')).toBe('abdominals');
    expect(expandQuery('Quads')).toBe('quadriceps');
    expect(expandQuery(' delts ')).toBe('shoulders');
    expect(expandQuery('pecs')).toBe('chest');
    expect(expandQuery('hams')).toBe('hamstrings');
  });

  it('passes through non-synonyms and lowercases', () => {
    expect(expandQuery('Incline Bench')).toBe('incline bench');
    expect(expandQuery('')).toBe('');
    expect(expandQuery('   ')).toBe('');
  });

  it('expands per-token in multi-word queries', () => {
    expect(expandQuery('quad press')).toBe('quadriceps press');
  });
});

/** Minimal fixtures shaped like the indexed Exercise fields. */
const FIXTURES = [
  { id: 'crunch', name: 'Cable Crunch', nameNorm: 'cable crunch', primaryMuscles: ['abdominals'], secondaryMuscles: [], equipment: 'cable', category: 'strength' },
  { id: 'bbsquat', name: 'Barbell Squat', nameNorm: 'barbell squat', primaryMuscles: ['quadriceps'], secondaryMuscles: ['glutes'], equipment: 'barbell', category: 'strength' },
  { id: 'bench', name: 'Barbell Bench Press', nameNorm: 'barbell bench press', primaryMuscles: ['chest'], secondaryMuscles: ['triceps'], equipment: 'barbell', category: 'strength' },
  { id: 'curl', name: 'Dumbbell Curl', nameNorm: 'dumbbell curl', primaryMuscles: ['biceps'], secondaryMuscles: ['forearms'], equipment: 'dumbbell', category: 'strength' },
];

function fixtureIndex() {
  const doc = makeDocument();
  // FlexSearch's add() document type is stricter than our minimal fixtures.
  for (const f of FIXTURES) doc.add(f as never);
  return doc;
}

describe('searchIds', () => {
  const doc = fixtureIndex();

  it('resolves a muscle-slang query to its exercises (the headline bug)', () => {
    expect(searchIds(doc, 'abs')).toContain('crunch');
    expect(searchIds(doc, 'quads')).toContain('bbsquat');
  });

  it('matches secondary muscles, not just primary', () => {
    // glutes is a SECONDARY muscle of the squat — only returns if the index
    // covers secondaryMuscles (the field added in this PR).
    expect(searchIds(doc, 'glutes')).toContain('bbsquat');
  });

  it('matches by equipment and by name', () => {
    const barbell = searchIds(doc, 'barbell');
    expect(barbell).toEqual(expect.arrayContaining(['bbsquat', 'bench']));
    expect(searchIds(doc, 'bench')).toContain('bench');
  });

  it('returns [] for an empty query', () => {
    expect(searchIds(doc, '')).toEqual([]);
    expect(searchIds(doc, '   ')).toEqual([]);
  });

  it('de-duplicates ids across fields', () => {
    const ids = searchIds(doc, 'barbell');
    expect(new Set(ids).size).toBe(ids.length);
  });
});

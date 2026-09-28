# OpenSets exercise search: baseline

Measured 2026-09-28 against the current search. 347 benchmark queries, 873 exercises.

**Headline.** The current search puts an acceptable exercise in the top 3 for **40.9%** of what lifters type. **52.2% of queries return nothing at all.** Typing the dataset's own name "Seated Calf Raise" returns zero results. The prototype of the recommended design (field-study.md) reaches **97.1%** top 3 on the same queries.

## What was run, exactly

- **Engine:** the repo's real code. `run-benchmark.mjs` imports `makeDocument` and `searchIds` from `opensets-redesign/src/db/searchIndex.ts` (Node 24 type stripping). It loads the built `public/data/exercises-index.json` with the same `doc.import(key, value)` loop that `loadSearchIndex()` uses, then calls `searchIds(doc, query, 100)`, which is what `LibraryScreen.tsx` and `ExercisePicker.tsx` call. Only the fetch wrapper is reproduced instead of imported, because it needs `import.meta.env` and a browser `fetch`.
- **Provenance:** opensets-redesign checkout at b6aa7d9 (branch `fix/popups-reach`). The five search files have no diff against `main`. Index and catalog files were built 2026-09-28 09:03.
- **Scoring:** a query is a hit at k if any id in its `expect` list appears in the first k results. MRR uses the first acceptable id.
- **Split:** 264 dev and 83 holdout queries (every 4th query per category). The baseline scores the same on both: 40.9% and 41.0% top 3.

## How the current search works (read from the code)

1. **Tokenize:** trim, lowercase, split on whitespace (`expandQuery`). Punctuation stays, so "press-ups" is a single token.
2. **Expand:** each token that appears in a 23-entry `SYNONYMS` map is **replaced**, not added. `lat` becomes `lats`, `calf` becomes `calves`, `shoulder` becomes `shoulders`, `glute` becomes `glutes`, `pec` becomes `chest`.
3. **Match:** FlexSearch `Document` with `tokenize: 'forward'` (prefix matching) over six fields: name, nameNorm, primaryMuscles, secondaryMuscles, equipment, category. Each field is searched separately, and every query word must match **within one field**. There is no cross-field matching, no aliases and no typo tolerance beyond FlexSearch's default encoder, which happens to fold doubled letters (so "dumbell" works and "benhc" does not).
4. **Rank:** results are concatenated field by field (name hits first, then nameNorm, then muscles, and so on), deduplicated, and kept in FlexSearch's internal order within each field. There is no exact-name boost, no recency and no popularity.
5. **Fallback:** while the index loads, `searchCatalog` in `catalog.ts` does an AND substring match on `nameNorm`.

Three consequences explain most of the misses:

- **The rewrite breaks names that contain the word.** "calves" is not a prefix of "calf", so "Seated Calf Raise", "calf raise", "lat pulldown", "glute bridge" and "shoulder press machine" return nothing. This is 13 benchmark misses on its own, and 3.8 points of top 3.
- **No cross-field matching**, so "cable chest" only finds exercises with both words in the name (3 of 12 cable chest exercises).
- **No vocabulary bridge.** "pec fly", "pec deck", "RDL", "OHP", "press-up" and "Hammer Strength" have no path to the dataset's words.

## Results by category (current search)

| Category | n | Top 1 | Top 3 | Top 10 | Zero results | MRR |
|---|---|---|---|---|---|---|
| vernacular | 79 | 24.1% | 26.6% | 26.6% | 67.1% | 0.251 |
| typo | 47 | 27.7% | 31.9% | 31.9% | 68.1% | 0.294 |
| muscle plus equipment | 36 | 13.9% | 13.9% | 13.9% | 75.0% | 0.139 |
| plural or singular | 34 | 52.9% | 67.6% | 67.6% | 20.6% | 0.593 |
| word order | 33 | 69.7% | 72.7% | 72.7% | 21.2% | 0.707 |
| abbreviation | 30 | 20.0% | 23.3% | 26.7% | 70.0% | 0.217 |
| partial word | 30 | 70.0% | 70.0% | 80.0% | 13.3% | 0.724 |
| canonical (control) | 22 | 95.5% | 95.5% | 95.5% | 4.5% | 0.955 |
| brand | 20 | 25.0% | 25.0% | 25.0% | 75.0% | 0.250 |
| British English | 16 | 0.0% | 0.0% | 0.0% | 87.5% | 0.000 |
| **ALL** | **347** | **37.8%** | **40.9%** | **42.1%** | **52.2%** | **0.393** |

Why the 205 misses (outside the top 3) happen: 168 return zero results, 19 return results without the right exercise, 13 are caused by the synonym rewrite, and 5 find it but rank it 4th or lower.

## Worst 30 misses

Ordered by category importance (the dataset's own name first, then the words lifters actually use), at most four per category. "Prototype rank" is where the recommended design puts the first acceptable answer.

| # | Query | Category | Results | First acceptable | Top result shown | Cause | Prototype rank |
|---|---|---|---|---|---|---|---|
| 1 | Seated Calf Raise | canonical | 0 | not found | (nothing) | synonym rewrite broke it | 1 |
| 2 | pec fly | vernacular | 0 | not found | (nothing) | zero results | 1 |
| 3 | pec fly machine | vernacular | 0 | not found | (nothing) | zero results | 1 |
| 4 | pec deck | vernacular | 0 | not found | (nothing) | zero results | 1 |
| 5 | peck deck | vernacular | 0 | not found | (nothing) | zero results | 1 |
| 6 | rdl | abbreviation | 0 | not found | (nothing) | zero results | 1 |
| 7 | sldl | abbreviation | 0 | not found | (nothing) | zero results | 1 |
| 8 | ohp | abbreviation | 0 | not found | (nothing) | zero results | 1 |
| 9 | bss | abbreviation | 0 | not found | (nothing) | zero results | 1 |
| 10 | press ups | British English | 0 | not found | (nothing) | zero results | 1 |
| 11 | press-ups | British English | 0 | not found | (nothing) | zero results | 1 |
| 12 | incline press up | British English | 0 | not found | (nothing) | zero results | 4 |
| 13 | decline press up | British English | 0 | not found | (nothing) | zero results | 3 |
| 14 | hammer strength chest press | brand | 0 | not found | (nothing) | zero results | 1 |
| 15 | hammer strength row | brand | 0 | not found | (nothing) | zero results | 1 |
| 16 | hammer strength high row | brand | 0 | not found | (nothing) | zero results | 2 |
| 17 | hammer strength shoulder press | brand | 0 | not found | (nothing) | zero results | 5 |
| 18 | calf raise | plural or singular | 0 | not found | (nothing) | synonym rewrite broke it | 1 |
| 19 | box jumps | plural or singular | 0 | not found | (nothing) | zero results | 1 |
| 20 | hip thrusts | plural or singular | 0 | not found | (nothing) | zero results | 1 |
| 21 | cable crunches | plural or singular | 0 | not found | (nothing) | zero results | 1 |
| 22 | pulldown lat | word order | 0 | not found | (nothing) | synonym rewrite broke it | 1 |
| 23 | press shoulder dumbbell | word order | 0 | not found | (nothing) | synonym rewrite broke it | 1 |
| 24 | raise calf seated | word order | 0 | not found | (nothing) | synonym rewrite broke it | 1 |
| 25 | lat pulldown (cable) | word order | 0 | not found | (nothing) | zero results | 1 |
| 26 | dumbbell shoulders | muscle plus equipment | 0 | not found | (nothing) | zero results | 1 |
| 27 | machine quads | muscle plus equipment | 0 | not found | (nothing) | zero results | 1 |
| 28 | barbell hamstrings | muscle plus equipment | 0 | not found | (nothing) | zero results | 1 |
| 29 | cable abs | muscle plus equipment | 0 | not found | (nothing) | zero results | 1 |
| 30 | bulga | partial word | 0 | not found | (nothing) | zero results | 1 |

All 13 synonym-rewrite casualties: rear delt fly, lat pulldown, glute bridge, shoulder press machine, rear delt raise, lat pull, calf raise, pulldown lat, press shoulder dumbbell, raise calf seated, shoulder press (dumbbell), smith calf raise, Seated Calf Raise. "lat pulldown" is the most-searched of these and does not appear in the table above only because of the four-per-category cap.

Full per-query results: `_baseline_results.json` (field `rank`: 0-based position of the first acceptable id, -1 if absent).

## What moves the number (top 3)

| Category | n | Current | Rewrite off | Prototype, no aliases | Prototype |
|---|---|---|---|---|---|
| vernacular | 79 | 26.6% | 32.9% | 59.5% | 98.7% |
| typo | 47 | 31.9% | 31.9% | 93.6% | 97.9% |
| muscle plus equipment | 36 | 13.9% | 13.9% | 100.0% | 94.4% |
| plural or singular | 34 | 67.6% | 70.6% | 97.1% | 100.0% |
| word order | 33 | 72.7% | 84.8% | 100.0% | 100.0% |
| abbreviation | 30 | 23.3% | 23.3% | 53.3% | 96.7% |
| partial word | 30 | 70.0% | 73.3% | 90.0% | 100.0% |
| canonical (control) | 22 | 95.5% | 100.0% | 100.0% | 100.0% |
| brand | 20 | 25.0% | 30.0% | 50.0% | 80.0% |
| British English | 16 | 0.0% | 0.0% | 56.3% | 93.8% |
| **ALL** | **347** | **40.9%** | **44.7%** | **79.8%** | **97.1%** |

- **Rewrite off** is the same FlexSearch index with the `SYNONYMS` rewrite removed (`_engine_variants.mjs`, MODE=nosyn). Making it additive gives the same 44.7% while keeping "abs" working.
- **Prototype** is `prototype-engine.mjs`, the design recommended in field-study.md. About 1.4 to 2.0 ms per query in Node on this laptop across the 347 queries. Dev 97.7%, holdout 95.2%. With aliases off it scores 79.8%, so the matching algorithm is worth about 39 points and aliases about 17 more.
- **Aliases slightly hurt muscle-plus-equipment queries** (100% without them, 94.4% with). An alias hit on the word "back" outranks a field hit on the muscle. The design note in field-study.md covers the fix: field matches on a primary muscle need to rank level with a partial alias match.
- **Remaining prototype misses (10):** low to high cable fly (none), db rdl (#40), uprite row (#15), barbell back (#4), dumbbell back (#4), incline press up (#4), hammer strength shoulder press (#5), hammer strength incline press (#7), trx push up (#10), peloton (none).

**How far to trust 97.1%.** I wrote the benchmark, the aliases and the prototype, and I tuned the prototype after seeing misses that included holdout queries. So the holdout is not blind, and 97% is an optimistic ceiling. The regression bar in field-study.md is set below it for that reason, and it asks for a blind query set written by someone else before the number means much.

## Data checks

- **Benchmark ids:** 347 queries carry 1,212 expected-id references (532 distinct). **0 are missing from exercises.json** (`verify.mjs`).
- **Alias ids:** 234 exercise ids carry 760 aliases. **0 are missing from exercises.json.**
- **Alias spot-check:** 20 aliases drawn at random (seeded), each re-fetched from its **live** source (wger API, Wikipedia API, GitHub raw, the web page). **20 of 20 found live.** Judged for meaning: **15 clean, 5 weak, 0 wrong.** In two of the weak ones the evidence describes a neighbouring exercise ("hyperextension" seen in "Reverse Hyperextension", "tricep dips" seen on a parallel-bar page but assigned to Bench Dips). In the other three the word appears only inside a longer or different-equipment name ("dip" in "Chest Dip", "ropes" in "Battle Ropes", "tricep kickbacks" in "Cable Tricep Kickback"). Table: `_spotcheck.md`.
- **A defect the spot-check caught and fixed:** an earlier pass accepted "upright row dumbbell" from Wikipedia text reading "barbell upright row, dumbbell bent-over row". The match ran across a comma. The evidence matcher now treats punctuation as a hard boundary, which dropped 7 aliases whose only evidence crossed one.
- **Evidence strength across all 760 aliases** (field `evidence` in alias-sources.json): 164 are an exact exercise name in an app or database (Hevy, Strong, Liftosaur, wger), 300 are part of a longer exercise name, and 296 are used in running text. The weak spot-check cases all come from the middle group, so review single-word aliases in that group before shipping them (dataset-notes.md lists them).

## Files

| File | What it is |
|---|---|
| `aliases.json` | `{ exerciseId: [alias, ...] }`, 760 aliases on 234 exercises. Only aliases found in a saved source are included. |
| `alias-sources.json` | For every alias: source key, URL, evidence strength, and the text around the match. |
| `token-synonyms.json` | Word and phrase rules (DB, BB, RDL, press up, Hammer Strength, and so on) with sources. Additive by design. |
| `priority-coverage.json` | The 280-exercise priority set (the common commercial-gym lifts): alias count per exercise, plus a reviewed status for the 46 with no alias. |
| `benchmark.json` | 347 queries `{query, expect, category, split}`. |
| `run-benchmark.mjs` | Runs the benchmark against the current search, or against any engine via `--engine`. `--split dev|holdout`. |
| `prototype-engine.mjs` | The recommended design, runnable. Research only; nothing is wired into the app. |
| `build-aliases.mjs`, `build-benchmark.mjs`, `verify.mjs` | Rebuild aliases from candidates plus sources, rebuild the benchmark, re-run the checks. |
| `_sources/` | Saved copies of every cited source (Wikipedia, wger, Liftosaur, Hevy, Strong, glossaries, gym and manufacturer pages). |
| `_alias_candidates.txt`, `_dropped.txt` | Candidate aliases I wrote from coaching knowledge, and the 395 the builder rejected for lack of a source. |

Re-run everything, in order:

```
node build-aliases.mjs
node build-benchmark.mjs
node verify.mjs
node run-benchmark.mjs
node run-benchmark.mjs --engine ./prototype-engine.mjs
```

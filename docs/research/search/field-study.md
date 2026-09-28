# OpenSets exercise search: field study and recommended design

**Question:** how do the strength apps people already use let someone find an exercise by the name they call it, and what should OpenSets do, offline, with 873 exercises and no AI?

**Short answer.** Nobody in the field solves this with one trick. The apps that feel good combine three things: **names that carry their own aliases** (Hevy calls the machine "Butterfly (Pec Deck)"), **forgiving matching** (Strong highlights matched characters, wger uses trigram similarity so "bech press" works), and **your own history first** (Hevy's Recent Exercises, Alpha Progression's "Most recent", Fitbod's "Most Logged"). OpenSets has none of the three today. The prototype in this folder shows all three fit in the browser at about 2 ms per query, and takes the benchmark from 40.9% to 97.1% top 3 (baseline.md).

## Source surfaces

Enumerated before the first search (researcher.md, trap 1), then reported by name.

| # | Surface | Read? |
|---|---|---|
| 1 | Live repo search code (searchIndex.ts, build-exercises.ts, LibraryScreen, ExercisePicker, tests, catalog.ts) | Read in full |
| 2 | Live dataset (exercises.json, exercises-index.json) | Read: all 873 names, plus instructions for 40 ambiguous ones |
| 3 | Upstream free-exercise-db | Pinned SHA noted from build script; upstream issues **not read** |
| 4 | Help centers: Hevy, Strong, Fitbod, JEFIT, Boostcamp, Alpha Progression | Hevy and Fitbod read through their Zendesk JSON API. Strong's category page read (it has no search article). Alpha Progression guide read. Boostcamp features page read. **JEFIT support article not read** (TLS handshake failure from both tools); JEFIT's public exercise database page was read instead |
| 5 | Open source: Liftosaur, wger | Search code read in both |
| 6 | Other apps | GymMane GitHub issue, Stronger app pages, MacroFactor (via Alpha Progression's comparison) |
| 7 | Competitor libraries as naming evidence | Hevy (119 guide names plus a public program), Strong (a public CSV export), Liftosaur (211 names), wger (912 names, 107 aliases), JEFIT (examples) |
| 8 | Vernacular sources | 70 distinct Wikipedia articles (94 titles fetched; some redirect to the same article), 7 lifting-abbreviation glossaries (including thefitness.wiki, the r/Fitness wiki), PureGym (UK), NHS and BHF (UK), Life Fitness Hammer Strength catalog, gym-machine guides, PubMed Central (BSS, CGBP). **ExRx not read** (403). **Reddit not read** (blocked); the r/Fitness wiki was read at its own domain |
| 9 | Client-side search libraries | FlexSearch and MiniSearch READMEs read. uFuzzy, Fuse.js and Orama **not read** |
| 10 | User complaints and reviews | One GitHub issue (GymMane #4). **App store reviews and Reddit threads not read**, so there is no measured complaint frequency |

## How each app handles exercise search

| App | Library | Matching | Names and aliases | History first | Filters | Custom exercises |
|---|---|---|---|---|---|---|
| **Hevy** | 400+ ([help](https://help.hevyapp.com/hc/en-us/articles/35688251991575)) | Search bar, internals undocumented | Aliases live **inside the name**: "Butterfly (Pec Deck)", "Bench Press (Barbell)", "Lat Pulldown (Cable)" ([public program](https://hevy.com/program/a6ee5477-9976-4b1e-af9f-ccb1d65725e3), [guides](https://www.hevyapp.com/exercises/)) | "Recent Exercises" section above the list ([custom exercises page](https://www.hevyapp.com/features/custom-exercises/)) | Equipment, muscle ([help](https://help.hevyapp.com/hc/en-us/articles/35688251991575)) | 7 free, unlimited Pro; duplicate an existing exercise ([help](https://help.hevyapp.com/hc/en-us/articles/35688251991575)) |
| **Strong** | "A comprehensive range" ([App Store](https://apps.apple.com/us/app/strong-workout-tracker-gym-log/id464254577)) | 6.3.0: "Exercise search now highlights individual matched characters" and "Improved exercise search ranking" ([App Store](https://apps.apple.com/us/app/strong-workout-tracker-gym-log/id464254577)). Per-character highlighting suggests subsequence matching, which is my inference | "Exercise (Equipment)": "Bench Press (Barbell)", "Squat (Barbell)" ([export sample](https://github.com/AlexandrosKyriakakis/StrongAppAnalytics/blob/main/Data/strong.csv)) | Not documented | Not documented | Create from the Exercises tab or mid-workout ([help](https://help.strongapp.io/article/97-create-custom-exercises)); rename added in 6.1.0 ([App Store](https://apps.apple.com/us/app/strong-workout-tracker-gym-log/id464254577)) |
| **Fitbod** | 1,500+ ([AP comparison](https://alphaprogression.com/en/blog/best-workout-exercise-database)) | Type in the search box; filters optional ([help](https://help.fitbod.me/hc/en-us/articles/360006335593-Editing-Workouts-in-Fitbod)) | Not documented | "Sort Alphabetically or by Most Logged"; on replace: "Best Replacements, Your Most Logged, Your Least Logged, or Never Logged" ([help](https://help.fitbod.me/hc/en-us/articles/360006335593-Editing-Workouts-in-Fitbod)) | Only your available equipment; By Muscle tab; categories such as Recently Added and Added by Me ([help](https://help.fitbod.me/hc/en-us/articles/360006335593-Editing-Workouts-in-Fitbod)) | **Created straight from a failed search**: "start typing an exercise name. Scroll down to tap + Create New Exercise" ([help](https://help.fitbod.me/hc/en-us/articles/28062570249623-Custom-Exercises)) |
| **JEFIT** | "1294 EXERCISES FOUND" ([database](https://www.jefit.com/exercises)) | Search plus filters; support article unreadable | Equipment first: "Machine Fly", "Cable Tricep Pushdown (Rope)", "Cable Lat Pulldown (Wide Grip)" ([database](https://www.jefit.com/exercises)) | Not verified | 11 muscle groups, 12 equipment types ([database](https://www.jefit.com/exercises)) | Not verified |
| **Boostcamp** | Not stated on the page | Not described | Not described | Not described | Not described | "create custom exercises ... all free with no cap"; mid-workout alternatives that carry weights over ([features](https://www.boostcamp.app/features)) |
| **Alpha Progression** | 795 ([guide](https://alphaprogression.com/en/blog/alpha-progression-guide)) | Search plus filters | Not documented | Four sorts: "Most used", "Most recent", "Most popular" (usage across all AP users), "A-Z"; recency shows time since you last did it ([guide](https://alphaprogression.com/en/blog/alpha-progression-guide)) | Muscle, equipment, type; "Custom exercises are always shown" regardless of the equipment filter ([guide](https://alphaprogression.com/en/blog/alpha-progression-guide)) | Copy an existing exercise as the start ([guide](https://alphaprogression.com/en/blog/alpha-progression-guide)) |
| **Liftosaur** (open source) | 211 names ([exercise.ts](https://github.com/astashov/liftosaur/blob/master/src/models/exercise.ts)) | Per word: exact 1000, prefix 500, substring 200; equipment words 800/400/150; exact full name +10000; name starts with query +300; an older subsequence matcher remains ([exercise.ts](https://github.com/astashov/liftosaur/blob/master/src/models/exercise.ts), [string.ts](https://github.com/astashov/liftosaur/blob/master/src/utils/string.ts)) | **No alias table**; "Pec Deck" is a separate exercise from "Chest Fly" ([exercise.ts](https://github.com/astashov/liftosaur/blob/master/src/models/exercise.ts)) | Not in search | Muscle-group filters in code | Yes (searched with the same scorer) |
| **wger** (open source) | 912 English | Postgres trigram similarity so "bech press" matches, word similarity inside long names, plus alias substring; rank exact 3 > prefix 2 > word similarity, shorter names win ties ([filtersets.py](https://github.com/wger-project/wger/blob/master/wger/exercises/api/filtersets.py)) | **Crowd-sourced alias table**: 107 English aliases on 71 exercises, such as "RDL", "OHP Barbell", "French Press SZ-bar" ([API](https://wger.de/api/v2/exerciseinfo/?format=json)) | Not in search | Category, muscle, equipment | Yes |
| **GymMane** | Not relevant | Not relevant | Issue #4: users "tend to search exercise using name they familiar with in hevy, so they might think the exercise is not available" ([issue](https://github.com/InlitX/GymMane/issues/4)) | Not relevant | Not relevant | Not relevant |

## What the field teaches

1. **Naming is the cheapest alias system, and the leaders use it.** Hevy and Strong put the equipment in parentheses and the common name beside the formal one. Plain substring search then finds "pec deck" because it is literally in the name. JEFIT puts equipment first. OpenSets inherited free-exercise-db names ("Butterfly", "Leverage Iso Row", "Air Bike") that nobody types.
2. **An alias table beats renaming when you do not own the data.** wger keeps names and adds aliases alongside. OpenSets pins free-exercise-db at a SHA, so an alias file joined at build time survives dataset upgrades, while renames would fight the upstream.
3. **But wger's aliases only filter; they do not rank.** An exercise found through an alias gets scored on its name, so an alias hit can land low. Rank alias hits like name hits.
4. **Typo tolerance is table stakes.** wger (trigram) and Strong (per-character matching) both forgive misspellings. OpenSets misses "benhc press" and "tricep pushdwon" outright.
5. **Your own history is the strongest ranking signal once you have one.** Three of six commercial apps surface recent or most-logged first, and Alpha Progression changed its default to aggregate popularity. OpenSets already computes which exercises you have logged (`useBestE1rm`) but does not use it to rank.
6. **The dead end is where you create.** Fitbod turns a failed search into "Create New Exercise" with the typed name pre-filled. OpenSets shows "No exercise matches".
7. **Two gaps nobody documents:** telling the user *why* a result matched (Strong's highlight is the closest), and handling muscle-plus-equipment phrases ("cable chest"), which every app pushes into filters instead.

## Recommended design for OpenSets

Everything below runs in `prototype-engine.mjs` except recency, which needs real history.

### Data

- Join `aliases.json` onto each exercise at build time in `scripts/build-exercises.ts` (an `aliases: string[]` field). Custom exercises get the same field, editable by the user.
- Ship `token-synonyms.json` as code-level rules. **Additive only:** always search the original word as well. The current `SYNONYMS` map replaces words, which is the bug that breaks "lat pulldown" and "Seated Calf Raise".
- Payload: aliases add about 20 KB raw to exercises.json, which is 1.1 MB today.

### Normalization

Lowercase. "&" becomes "and" (so "C&J" works). Apostrophes are removed, and all other punctuation and hyphens become spaces ("press-ups" becomes "press ups"). Light plural stemming (flyes, flies and flye become fly; raises becomes raise; lunges becomes lunge). Spelling folds: tyre to tire, dumbell to dumbbell. Compound joins: "kettle bell" also tries "kettlebell".

### Ranking order

For each exercise, score its name and each alias, and keep the best:

1. **Exact full name** (+1000), then **exact full alias** (+900). Typing "pec deck" or "Butterfly" puts the machine first.
2. **Same words in any order** (+600). Covers "press bench" and Hevy-style "lat pulldown (cable)".
3. **Every query word matches somewhere**, scored per word: exact word 1.0, synonym 0.95, prefix 0.75 (the last word may be a 1-letter prefix while typing), typo 0.6. A word may match the equipment or a muscle instead of the name, at 0.8 for a primary muscle or the equipment and 0.3 for a secondary muscle. This is what makes "cable chest" work.
4. **Tie-breaks**, in order: coverage (how much of the name the query fills, so shorter names win, like wger), words in the typed order, canonical name over alias, **recency** (below), a small bonus for the common-lift set (`_top250.txt`), a small penalty for stretches.
5. **Relaxed fallback:** only if fewer than 3 results come back, allow one word to go unmatched and rank those results below every strict match. This is FlexSearch's `suggest: true` idea ([README](https://github.com/nextapps-de/flexsearch#suggestions)).

Two measured cautions from the prototype:
- **Alias hits must not drown field hits.** "dumbbell back" ranked 4th because an alias containing "back" outranked a primary-muscle match (baseline.md). Give primary-muscle field matches weight equal to a partial alias match.
- **Short fuzzy matches misfire.** "abs" matched the alias "ass to grass" at one edit. I removed that alias, and I recommend fuzzy matching only for words of 5+ letters, or 3 to 4 letters when the first letter agrees.

### Typo tolerance, offline, 873 items

Match typos against the **vocabulary**, not the exercises: about 670 distinct words across names, aliases, muscles and equipment. For each query word, compute Damerau-Levenshtein distance to each vocabulary word with early exit (1 edit from 3 letters, 2 edits from 7). Then score exercises through those word matches. The prototype does this in about 2 ms per query in Node without an index. That leaves room even at 5x slower on a phone, but **measure on a mid-range Android before committing**.

Library option: MiniSearch does prefix, fuzzy (edit distance as a fraction of term length) and field boosts natively ([README](https://github.com/lucaong/minisearch)). FlexSearch, the current dependency, has `suggest` and phonetic encoders but no edit-distance typo tolerance ([README](https://github.com/nextapps-de/flexsearch)). My recommendation is **the hand-rolled scorer**: it is about 150 lines, has no dependency, is fully testable, and the benchmark shows it works. Dropping FlexSearch also deletes the prebuilt 1.9 MB `exercises-index.json` and its "must stay in lockstep" coupling.

### Recency and frequency

- **Empty search box:** show "Recent" (last 8 logged, newest first), then the full list. This is Hevy's pattern, and OpenSets already has the data.
- **While typing:** recency is a **tie-break inside a match tier**, never a jump across tiers. An exercise logged in the last 60 days gets a bonus smaller than the gap between tiers, so "row" puts *your* row first among rows but never above an exact name match. Decay: logged in the last 14 days gets the full bonus, 15 to 60 days gets half.
- **Not measurable offline:** the benchmark has no user history. Add a small test fixture (fake history) that asserts recency reorders within a tier but not across tiers.

### Showing the matched alias

When the best-scoring text was an alias, show it in the row's second line: **"Butterfly" / "matches 'pec deck' · Chest · Machine"**. This answers "is this the thing I meant?" without renaming anything. For a typo match, bold the matched letters as Strong does. For the handful of names that confuse lifters, also change the *display* name (dataset-notes.md), for example "Butterfly (Pec Deck)", following Hevy.

### No results

Replace "No exercise matches" with **"Create '{query}' as a custom exercise"** (Fitbod), plus one "Did you mean" line from the relaxed fallback when it found something.

### Regression bar

Port `run-benchmark.mjs` and `benchmark.json` into the repo as a vitest suite that fails the build when any threshold drops:

| Gate | Threshold | Prototype today |
|---|---|---|
| Canonical names (the dataset's own name) | **100% top 1** | 100% |
| All 347 queries | **≥ 90% top 3** | 97.1% |
| Holdout split (83) | **≥ 88% top 3** | 95.2% |
| Every category | **≥ 75% top 3** | lowest: brand 80% |
| Zero-result rate | **≤ 3%** | 0.6% |
| Latency | **p95 ≤ 16 ms** on a mid-range phone (one frame) | about 2 ms mean in Node; phone not measured |

The bar sits 7 points under the prototype on purpose. I wrote the benchmark, the aliases and the prototype, and saw holdout misses while tuning, so 97% is an optimistic ceiling. **Before the implementation starts, collect a blind set:** 50 queries typed by Noah and two other lifters from memory ("what do you call the machine where...") and never used for tuning. Target at least 85% top 3 there. That number is the real one.

### Counter-case

The strongest argument against this design is maintenance and false confidence. Aliases are hand-curated data that drift. Fuzzy and relaxed matching trade zero-result screens for plausible-looking wrong answers, which can be worse than an honest empty state, because a lifter may log the wrong exercise and not notice. Mitigations: every alias carries a source and an evidence strength (alias-sources.json), the benchmark blocks regressions, relaxed results are labelled as partial matches, and the matched-alias line makes a wrong match visible. **What would make me reverse:** if the blind set scores under 75% top 3 with the prototype, the problem is vocabulary coverage rather than matching, and the next step is harvesting names from real user queries (an opt-in local log of searches that ended in "create custom"), not more tuning.

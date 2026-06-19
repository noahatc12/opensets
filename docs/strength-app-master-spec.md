# Master Spec — Free, Client-Side Strength Training PWA

**Working title:** OpenSets · **Status:** Draft v1.0 · **Owner:** Noah · **Date:** June 2026

A progressive web app that builds your training plan, tracks every set, and tells you exactly when to add weight — 100% free, 100% client-side, deployed on GitHub Pages. No backend, no API keys, no accounts, no paywalls.

> This is the authoritative specification. It is vendored into the repo verbatim from the source-of-truth draft so the spec travels with the code. Decided-after refinements (program-edit snapshots, multi-tab safety, explainable recommendations surfaced + tappable, Strong/Hevy CSV export, in-app crash log, settings discipline, education layer, library curation, i18n string-routing from P1, browser-support matrix) extend the relevant sections and are treated as required.

---

## 1. Problem Statement

Lifters who want algorithm-driven progression face a bad trade: simple loggers (Strong, Hevy) leave progression decisions to the user and cap free tiers (Strong: 3 custom routines; Hevy: 4 routines, 7 custom exercises), while the apps that actually compute your next workout (RP Hypertrophy, Juggernaut AI, Alpha Progression) cost \$25–35/month and mostly require an internet connection — a real problem in concrete-walled gyms. The one free programmable option (Liftosaur) requires learning a scripting DSL and has a rough UI. There is no app that combines polished logging UX, evidence-based automatic progression, and total data ownership for free.

**Why this product wins:** every "AI coaching" feature competitors paywall is actually deterministic math (linear/double progression, 5/3/1, GZCLP, RPE autoregulation, APRE, volume landmarks) that runs perfectly offline in the browser.

### Competitive positioning

| Competitor | What it does well | The gap we exploit |
|---|---|---|
| Strong | Fastest logging, great rest timer | 3-routine free cap, zero progression logic |
| Hevy | Modern UX, generous free tier | Cloud-dependent, manual progression, custom-exercise cap |
| Boostcamp | Free proven programs w/ progression | Limited custom progression authoring |
| RP Hypertrophy (\$35/mo) | Autoregulated volume/mesocycles | Price, online-only, weak strength focus |
| Juggernaut AI (\$35/mo) | Periodized powerlifting AI | Price, online-only |
| Alpha Progression (~\$80/yr) | Plan generator, RIR progression | Generator + recs paywalled |
| Liftosaur (free, OSS) | Fully programmable progression | DSL learning curve, UI polish |

**Target combination:** Liftosaur's programmability + Hevy's UX + RP's volume management — free, offline-first, data-portable.

## 2. Goals & Success Metrics

**User goals**
1. **G1 — Zero-decision training:** every workout opens with a computed prescription (weight × reps per set) and a one-line "why".
2. **G2 — Logging faster than a notebook:** confirming a prescribed set takes ≤ 2 taps; a full session of 20 sets logs in < 60 s of cumulative interaction.
3. **G3 — Data you can never lose:** workout history survives device loss via one-tap JSON export/import and (later) optional sync; no data ever leaves the device otherwise.
4. **G4 — Teach correct form:** every library exercise shows images, instructions, and worked muscles.

**Portfolio/business goals**
5. **G5 — Credible engineering artifact:** typed, tested (progression module at ~100% branch coverage), CI-badged, documented repo with a live demo.

**Success metrics**

| Metric | Target | Stretch |
|---|---|---|
| Time from first visit → first logged workout | < 2 min | < 90 s |
| Taps to log a prescribed set | ≤ 2 | 1 |
| Lighthouse (PWA / Performance, mid-range Android) | ≥ 90 / ≥ 90 | 95+ |
| Initial JS (core route, gzipped) | ≤ 200 KB | ≤ 150 KB |
| Data-loss incidents across dogfood | 0 | 0 |
| Progression engine branch coverage | ≥ 95% | 100% |
| Works fully offline after install | Yes (all P0–P2 features) | — |

## 3. Non-Goals (v1)

| Non-goal | Why |
|---|---|
| Accounts, backend, or required cloud sync | Defeats the free/no-API/Pages constraint; export/import + optional Gist sync covers it |
| Endurance *coaching* — running plans, interval programming, HR-zone/GPS analytics | Prescribed + logged cardio sessions and timed holds ARE in scope (P2); only endurance training science stays out |
| Nutrition/macros | Separate product domain; may add export hooks later |
| Social feed, comments, sharing-to-feed | High effort, low differentiation; program link sharing is enough (P4) |
| Native iOS/Android apps, Apple Watch | PWA-first; wearables need native APIs |
| AI/LLM chat coach | Violates no-API constraint; deterministic engine *is* the coach |
| Velocity-based training hardware | Requires sensors; approximate via RPE |
| Scheduled push reminders | Web Push requires a server; in-app/timer notifications only |
| Localization beyond English | Spanish is the planned first addition in P4 |
| Per-set video form analysis / rep counting via camera | Out of scope |

**Scope rule:** any feature added to a phase must displace one of equal size, or move to the Parking Lot (§18).

## 4. Users & Core Stories

**Persona A — Self-coached intermediate (primary; also the developer).** **Persona B — Novice with a template.** **Persona C — Data refugee** (years of Strong/Hevy history).

Priority-ordered stories:
1. Today's workout shows exact weight × reps per set. *(P1)*
2. The rest timer starts itself when I log a set. *(P1)*
3. The app tells me when to add weight — and when to deload — from my logged performance. *(P1–P2)*
4. Enter height/weight/goal → get a complete structured plan (training, cardio, starting weights). *(P2)*
5. Swap an exercise when equipment is taken, for a substitute hitting the same muscles, without breaking progression. *(P2)*
6. My phone dying mid-session costs nothing — the workout resumes. *(P1)*
7. Import my Strong/Hevy CSV so history and e1RMs carry over. *(P1)*
8. Per-muscle weekly volume vs recommended landmarks. *(P3)*
9. Every exercise shows how to perform it (images, steps, muscles). *(P1)*
10. Readiness check-ins adjust my plan when I'm beat up. *(P3)*

## 5. Requirements by Phase

### Phase 0 — Foundation · ~1 week
- [ ] Vite + React + TypeScript + Tailwind scaffold; ESLint + Prettier + strict TS
- [ ] GitHub Actions: lint → typecheck → test → build on PR; deploy `dist` to Pages on `main`
- [ ] `vite.config` `base: '/<repo>/'`; HashRouter routing
- [ ] vite-plugin-pwa (`registerType: 'autoUpdate'`), manifest, installable on iOS/Android
- [ ] Dexie schema v1 (§8) with migration scaffolding + pre-migration auto-snapshot
- [ ] `free-exercise-db` ingested via build pipeline (§7); images load from jsDelivr
- [ ] `/src/engine` package: pure functions only, zero React/IO imports, Vitest configured
- [ ] JSON export (one tap) + import (file picker) round-trips the entire DB
- [ ] `navigator.storage.persist()` requested post-install; storage status surfaced in Settings

**Exit:** deployed demo URL; export→wipe→import restores everything byte-equal.

### Phase 1 — MVP logger · ~2–3 weeks
- [ ] Routine builder (unlimited routines; per-exercise set scheme, rest durations, notes)
- [ ] Today view (prescribed sets w/ previous-session inline; 1-tap confirm, 2-tap edit)
- [ ] Rest timer (auto-start on completion; warm-up vs working; audio + vibration; wall-clock based; Screen Wake Lock)
- [ ] Session recovery (active session auto-saved ≤ 250 ms after mutation; resume prompt < 12 h)
- [ ] Mid-workout controls (skip, add unplanned, swap to substitute, finish-partial, edit/delete with undo)
- [ ] Progression v1 (linear + double; next prescription at completion; reason banner)
- [ ] PR detection (weight / rep / e1RM PR; celebration; PR history)
- [ ] Calculators (plate, e1RM, warm-up generator)
- [ ] History (calendar + list; per-exercise e1RM sparkline, lazy Recharts route)
- [ ] CSV import (Strong + Hevy) with header sniffing + name-mapping UI; **CSV export too**
- [ ] Units (kg canonical; lb/kg display toggle; plate-aware rounding)
- [ ] Dark mode default; thumb-zone actions; touch targets ≥ 48 px
- [ ] **Program-edit snapshots** (frozen executed-slots per session); **multi-tab safety** (Web Locks / BroadcastChannel); **explainable recommendations** (every reason string tappable to reveal rule + numbers); **i18n string-routing**.

**Exit:** developer dogfoods one full week, zero data loss, logging ≤ 2 taps/set.

### Phase 2 — Programmable progression · ~2–3 weeks
- [ ] Engine completes: 5/3/1, GZCLP, RPE-target, APRE, per-set double progression
- [ ] Program templates as data (Full Body 3×, Upper/Lower, PPL, Reddit PPL, 5/3/1 +BBB/FSL, GZCLP, GreySkull LP, nSuns, Texas Method, PHUL, PHAT — schemes only, original prose)
- [ ] Plan generator wizard v2 (§6.6)
- [ ] Training Max management UI (5/3/1)
- [ ] AMRAP, drop set, rest-pause, superset set types
- [ ] Exercise substitution preserving progression-state policy
- [ ] Bodyweight + weighted/assisted bodyweight
- [ ] Cardio & timed work (duration-based slots; `durationLinear` / goal-linked)
- [ ] **In-app crash log** ("copy diagnostic report", no third party); **education layer** (first-use tooltips + glossary); **library curation** (badge ~150 most-used exercises).

**Exit:** all rule kinds pass table-driven unit tests incl. failure/deload; wizard→first workout < 2 min.

### Phase 3 — Autoregulation & analytics · ~3–4 weeks
- [ ] Mesocycle builder (MEV→MRV +1 set/wk; scheduled deload)
- [ ] Readiness check-in → bounded set/load adjustments, always overridable
- [ ] Plateau detection (EWMA(e1RM) slope ≤ 0 over 3–4 sessions + no PR → suggest deload/variation)
- [ ] Volume heatmap (weekly hard sets/muscle vs MEV/MAV/MRV)
- [ ] Analytics dashboard (e1RM, tonnage, volume, intensity dist., compliance %)
- [ ] Body measurements + progress photos (IndexedDB blobs)
- [ ] Goals (bodyweight/measurement/lift/cardio-min/sets-per-muscle/streak; progress bars; goal-linked suggestions)
- [ ] Optional Gist sync (user-pasted PAT, `gist` scope; last-write-wins w/ timestamp warning)
- [ ] Backup nudge after N sessions without export/sync
- [ ] **Date & week semantics:** session belongs to its start date; program-relative week indexes for mesocycle, rolling 7-day window for MRV/fatigue.

**Exit:** full mesocycle dogfooded start-to-deload; volume heatmap matches hand-counted sets.

### Phase 4 — Polish & community · ongoing
- [ ] Muscle-map browser (react-body-highlighter)
- [ ] Optional per-exercise `youtube-nocookie` click-to-load embeds (online-only badge)
- [ ] Custom exercises with user photos; program share links (URL-encoded JSON)
- [ ] Spanish localization; accessibility pass
- [ ] README as portfolio piece (GIF demo, architecture, live link, CI/coverage badges); CONTRIBUTING
- [ ] PWA "what's new" panel

---

## 6. Progression Engine Specification

**Design law:** the engine is a pure TypeScript module (`/src/engine`) with no React, no Dexie, no `Date.now()`, no I/O. Every function is `(inputs) → outputs`. 100% unit-testable; the centerpiece of the portfolio story.

### 6.1 Core types & entry point

```ts
export type SetType = 'warmup' | 'working' | 'amrap' | 'drop' | 'restPause' | 'timed' | 'cardio';

export interface SetResult {
  weightKg: number;       // external load; 0 = pure bodyweight; negative = assisted
  reps: number;
  durationSec?: number;   // timed holds & cardio
  distanceM?: number;     // optional, cardio
  rpe?: number;           // 6.0–10.0 in 0.5 steps
  type: SetType;
  completed: boolean;
}

export type ProgressionRule =
  | { kind: 'linear';  incrementKg: number; failsBeforeDeload: number; deloadPct: number }
  | { kind: 'double';  repMin: number; repMax: number; incrementKg: number; perSet: boolean } // perSet=true → DDP
  | { kind: 'percent531'; variant: 'base' | 'bbb' | 'fsl'; tmIncrementKg: number }            // week derived from cycle position
  | { kind: 'gzclp';   tier: 1 | 2 | 3 }
  | { kind: 'rpeTarget'; targetRpe: number; targetReps: number; loadStepPct: number }
  | { kind: 'apre';    rm: 3 | 6 | 10 }
  | { kind: 'repsOnly'; repIncrement: number }                                                 // bodyweight progression
  | { kind: 'durationLinear'; incrementSec: number; everyNSessions: number }                   // timed holds, cardio minutes
  | { kind: 'manual' };

export interface ExerciseState {
  workingWeightKg: number;
  trainingMaxKg?: number;        // 5/3/1
  consecutiveFails: number;
  stage: number;                 // GZCLP stage index, wave position, etc.
  cyclePos: number;              // week-in-cycle for percentage schemes
}

export interface Prescription {
  sets: Array<{ type: SetType; targetReps: number; targetWeightKg: number; amrap?: boolean; targetRpe?: number }>;
  reason: string;                // "+2.5 kg — hit 12/12/12 @ 50 kg"
  flags: Array<'deload' | 'stageChange' | 'tmIncrease' | 'plateauSuspected'>;
}

export function nextPrescription(
  rule: ProgressionRule,
  state: ExerciseState,
  lastSession: SetResult[],
  settings: EngineSettings        // plate inventory, bar weight, rounding mode, units
): { prescription: Prescription; nextState: ExerciseState };
```

All output loads pass through `roundToLoadable(targetKg, barKg, plates)` — nearest weight actually loadable from the user's plate inventory (pairs only). Default increments: +2.5 kg upper, +5 kg lower, overridable per exercise (microplates).

### 6.2 Rule logic (normative)

**Linear (novice compounds).** All working sets hit target reps → `weight += increment`. Else `consecutiveFails++`. At `failsBeforeDeload` (default 3) → `weight *= (1 − deloadPct)` (default 10%), fails reset.

**Double progression (default for isolation/hypertrophy).** Rep range [min,max]. All sets at top of range (at/below target RPE if logged) → `weight += increment`, target reps reset to min. Otherwise add reps where possible. `perSet=true` (DDP) progresses each set slot independently.

**5/3/1.** State holds TM (init 90% of tested/estimated 1RM). Waves over `cyclePos`:
- W1: 65/75/85% TM × 5/5/5+ · W2: 70/80/90% × 3/3/3+ · W3: 75/85/95% × 5/3/1+ · W4 (deload): 40/50/60% × 5
- After W4 (or W3 if deload disabled): `TM += tmIncrementKg` (defaults +2.5 upper, +5 lower). AMRAP reps recorded; if W3 top set < 1 rep → TM reset to 90% of current e1RM. Variant adds BBB 5×10 @ 50–60% TM or FSL 5×5 @ first-set weight.

**GZCLP (per tier).**
- T1: stages `5×3+ → 6×2+ → 10×1+`. Complete all reps → `+5 kg lower / +2.5 kg upper`, same stage. Fail → next stage at same weight. Fail stage 3 → retest 5RM, restart stage 1 with TM = 85% of new 5RM.
- T2: stages `3×10 → 3×8 → 3×6`, same weight across a stage; fail → next stage; after 3×6 fails → restart 3×10 at last 3×10 weight + 2.5 kg.
- T3: `3×15+`; AMRAP final set ≥ 25 total reps → +2.5 kg.

**RPE target.** Compare logged RPE on top set vs `targetRpe`: each 1.0 RPE deviation ≈ `loadStepPct` (default 4–5%) load adjustment next session, clamped to ±10%; reps held at `targetReps`. Uses an RIR-based %1RM lookup table (Helms/Zourdos lineage) shipped as data.

**APRE (rm ∈ {3,6,10}).** Four-set protocol; sets 1–2 at 50%/75% of working RM; set 3 = AMRAP at RM weight; set 4 load and **next session's RM** from lookup tables:
- APRE-10: 4–6 → −2.5..5 kg · 7–8 → −0..2.5 · 9–11 → 0 · 12–16 → +2.5..5 · 17+ → +5..7.5
- APRE-6: 0–2 → −2.5..5 · 3–4 → −0..2.5 · 5–7 → 0 · 8–12 → +2.5..5 · 13+ → +5..7.5
- APRE-3: 1–2 → −2.5..5 · 3–4 → 0 · 5–6 → +2.5..5 · 7+ → +5..7.5

**repsOnly (bodyweight).** Progress total/target reps by `repIncrement`; when user attaches external load, slot converts to `double`.

### 6.3 e1RM, trend, plateau, deload

- `e1rmEpley = w·(1 + r/30)`; `e1rmBrzycki = w·36/(37 − r)`. Display the mean; compute only for working/AMRAP sets with `reps ≤ 10`; reps > 10 → "low confidence", exclude from trend.
- Per-exercise trend: `EWMA_t = α·e1rm_t + (1−α)·EWMA_{t−1}` with α = 0.3.
- **Plateau:** EWMA slope ≤ 0 over last 3–4 sessions AND no weight/rep PR in window → flag `plateauSuspected`; suggest single-exercise deload (−10% load, ~50% sets) or rep-range change. Never auto-apply.
- **Systemic deload trigger (P3):** ≥ 2 readiness markers degraded across a week → recommend the program's deload week early.

### 6.4 Volume landmarks (P3)
Weekly hard sets (working + AMRAP, RPE ≥ 7 if logged) per muscle via exercise→muscle map (primary = 1.0, secondary = 0.5). Editable defaults per muscle: MV 4 · MEV 8 · MAV 12–18 · MRV 20. Mesocycles start near MEV, +1 set/muscle/week, deload at MRV proximity or schedule.

### 6.5 Engine test plan
Table-driven Vitest cases per rule kind: success, partial fail, deload trigger, AMRAP branches, stage transitions, TM reset, rounding to plates (incl. microplate absence), negative/assisted loads, reps > 10 e1RM exclusion. Property test: every prescription weight is loadable from the test plate inventory. Target ≥ 95% branch coverage (gated in CI).

### 6.6 Plan generator (deterministic, `/src/engine/generator`)

`generatePlan(profile, preferences) → { program, cardioProtocol, goals[], calibrationWeek }` — pure function over shipped rule tables. A decision tree, not ML.

**Split selection:** 3 d/wk → Full Body · 4 → Upper/Lower · 5 → PPL + Upper · 6 → PPL×2. Goal overrides: get-stronger + novice → GZCLP/linear-LP; get-stronger + intermediate → 5/3/1. Slots filled by movement pattern filtered by equipment, compounds first.

**Progression defaults by experience × goal:** novice compounds → `linear`; hypertrophy → `double` (8–12 / 10–15); strength mains → `percent531`/`gzclp`; isolation/bodyweight/timed per §6.2.

**Starting loads — seed + calibrate:** seed from a bodyweight-relative strength-standards table (plate-rounded), then **Week 1 = calibration** (ramp to a top set of 8–10 → e1RM → engine derives Week 2+).

**Cardio dose by goal:** build muscle → 0–60 min/wk LISS · recomp → 90–150 + active recovery · lose fat → 120–180 + daily steps; +5 min/session stall rule as goal-linked suggestion.

**Goal pacing & auto-goals:** target weight + date → implied rate clamped to safe bands (fat loss 0.25–1.0% BW/wk; gain 0.25–0.5% BW/wk); if too fast, warn + propose nearest safe date. Auto-creates bodyweight/cardio/lift goals. **Pacing only** — no calorie/macro math.

**Safety rails:** extreme BMI or age < 18 → conservative defaults + "consult a professional"; all numbers editable; generator never blocks manual building.

**Tests:** snapshot tests over a profile matrix (sex × experience × goal × days × equipment).

---

## 7. Exercise Library Specification

**Core dataset:** `yuhonas/free-exercise-db` — ~870 exercises, The Unlicense (public domain). Build pipeline (`/scripts/build-exercises.ts`, runs in CI): fetch at a pinned commit; normalize names; map muscles → canonical taxonomy; emit `public/data/exercises.json` + prebuilt FlexSearch index; tag `license`.

**Images:** jsDelivr pinned to the commit (`cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@<sha>/exercises/<id>/0.jpg`). Workbox runtime route: CacheFirst + `CacheableResponsePlugin({statuses:[0,200]})` + Expiration (maxEntries 300, 60 days). Fallback: build-time WebP self-host.

**Browse/search:** FlexSearch + facet filters; `react-virtuoso` list; detail = images, steps, muscle figure, history sparkline, notes. **Custom exercises:** unlimited, free; IndexedDB blob photos. **Never** use ExerciseDB/MuscleWiki media.

---

## 8. Data Model (Dexie / IndexedDB)

Storage rules: **kg canonical**; ISO-8601 dates; ULIDs for ids; soft-delete via `deletedAt`.

```ts
db.version(1).stores({
  exercises:     'id, nameNorm, *primaryMuscles, equipment, category, isCustom',
  programs:      'id, name, isActive',
  templates:     'id, programId, dayIndex',
  sessions:      'id, date, programId, templateId',
  sets:          'id, sessionId, exerciseId, [exerciseId+date]',
  exerciseState: '[programId+exerciseId]',
  measurements:  'id, date, type',
  photos:        'id, date',
  goals:         'id, type, status',
  settings:      'key',
  activeSession: 'key',
  backups:       'id, createdAt'
});
```

Interfaces: see `src/db/types.ts` (kept in sync with this section). **Migration policy:** never delete an old `db.version(n)`; every upgrade wraps `.upgrade(tx)`; before opening a DB whose on-disk version < code version, write a full-DB JSON snapshot into `backups` (retain last 2). Export/import uses a versioned envelope `{ schemaVersion, exportedAt, data }`; import migrates old envelopes forward.

---

## 9. Application Architecture

`/src/engine` (pure), `/src/db` (Dexie + repos + export/import), `/src/features` (log, programs, library, analytics, settings), `/src/components`, `/src/data`, `/scripts`.

- **State:** Dexie is the source of truth (`useLiveQuery`); Zustand only for ephemeral session/UI state.
- **Storage durability ladder:** install prompt (installed PWAs exempt from ITP eviction) → `persist()` → backup nudges/export → optional Gist sync. Handle `QuotaExceededError` on every write.
- **Session recovery:** debounced (250 ms) into `activeSession`; boot checks for `active` < 12 h → resume.
- **PWA:** autoUpdate + in-app "update ready" toast; precache shell + data; CacheFirst exercise images; rest timer from wall-clock on visibilitychange.
- **Error handling:** global boundary with "export my data" escape hatch; corrupt reads skipped, never crash.

## 10. UX Specification

Logging screen (one exercise card; tap row = done-as-prescribed; expand = steppers; previous-session line; rest timer in bottom bar). Onboarding wizard (4 screens → preview → Start; < 2 min to first workout). Design system: dark default, high-contrast accent, thumb-zone actions, touch targets ≥ 48 px, reduced-motion respected, ≥ 16 px body / 24 px+ active numbers. Units = display-only conversion. Designed empty states. Not-medical-advice disclaimer (first-run + About).

## 11. Analytics & Charts (Recharts, lazy route)
e1RM trend (EWMA + PR markers) · weekly tonnage & hard-set volume (stacked by muscle) · intensity distribution · compliance % · calendar heatmap · PR timeline. Max 2 charts per mobile screen.

## 12. Import / Export / Sync

- **Export:** full-DB JSON envelope; File System Access API on Chromium desktop, `<a download>` fallback. Filename `opensets-backup-YYYY-MM-DD.json`.
- **Import:** JSON envelope (any prior schemaVersion) — validated, migrated, merged-or-replace.
- **CSV import (P1):** sniff delimiter + header. Hevy + Strong columns; names matched against `nameNorm`, unmatched → mapping UI; history-only (e1RMs/PRs recompute).
- **Gist sync (P3):** user-pasted fine-grained PAT (`gist` scope); push/pull JSON envelope; newer `exportedAt` wins after warning. PAT never in exports.

## 13. Testing & CI

Engine unit (Vitest, ≥95% branch gate) · DB (Vitest + fake-indexeddb: migrations, export/import round-trip, backup) · Component (Testing Library) · E2E (Playwright, mobile viewport: wizard → log → kill mid-session → resume → finish → next prescription) · Static (TS strict, ESLint zero-warning). CI: PR = lint+typecheck+test+build; main = + deploy to Pages. Badges in README.

## 14. Deployment
GitHub Actions → Pages. `base: '/<repo>/'`; HashRouter. PWA assets in build; jsDelivr URLs pinned per release.

## 15. Performance Budget
Core route JS ≤ 200 KB gz (charts + library detail lazy) · TTI < 2 s mid-range Android/4G · search < 50 ms for 1,000 exercises · 60 fps virtualized scroll · Lighthouse PWA/Perf ≥ 90 (Lighthouse CI, warn-only initially).

## 16. Risks & Mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| iOS evicts IndexedDB (7-day ITP) | Med | Install-first onboarding, persist(), backup nudges, export; escalate Gist sync to P1 if dogfood shows loss |
| Scope creep kills shipping | **High** | Non-goals, phase exit gates, parking lot, "add one = remove one" |
| jsDelivr throttling/outage | Low | WebP self-host fallback |
| Recharts bloats bundle | Med | Lazy chunk; swap to Chart.js if budget broken |
| Novices misuse RPE | Med | RPE optional + off by default for beginner path |
| Migration bug corrupts data | Low | Pre-migration snapshots, round-trip tests, versioned envelope |
| Solo-dev burnout | Med | Dogfood from end of P1 |

## 17. Roadmap & Milestones

| Milestone | Scope | Duration | Exit |
|---|---|---|---|
| M0 Foundation | Phase 0 | ~1 wk | Demo deployed; export→wipe→import lossless |
| M1 Usable logger | Phase 1 | 2–3 wk | 1-week dogfood, 0 data loss, ≤ 2 taps/set |
| M2 Programs | Phase 2 | 2–3 wk | All rules tested; wizard < 2 min |
| M3 Autoregulation | Phase 3 | 3–4 wk | Full mesocycle dogfooded incl. deload |
| M4 Polish/launch | Phase 4 | ongoing | README/demo/badges; beta post |

## 18. Open Decisions & Parking Lot

**Open:** (1) Name (display name "blocking M4 only"; repo slug = `opensets`). (2) Muscle-map figure default — P4. (3) FlexSearch vs Fuse.js — spike P0, FlexSearch default. (4) Per-set weight prefill on swap — P2.

**Parking lot:** endurance coaching, nutrition hooks, Apple Watch, social feed, TF.js rep counting, Web Bluetooth HR, native wrappers, cloud accounts, coach/client mode, Liftoscript-style DSL.

## 19. Licensing, IP & Attribution
- App code: **MIT**. `free-exercise-db`: Unlicense (credit as courtesy). Any CC-BY-SA supplements: per-record attribution + share-alike.
- **Never** use ExerciseDB/RapidAPI GIFs or MuscleWiki media.
- Program templates: schemes/numbers only (uncopyrightable methods); original prose; credit creators by name; program names as descriptive references.
- YouTube: external links/embeds only; never rehost.

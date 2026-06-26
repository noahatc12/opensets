# Master Spec — Free, Client-Side Strength Training PWA
**Working title:** OpenSets · **Status:** v2.0 — Current (incorporates goal-driven generator §6.6, display-only calorie/protein targets, education layer, cardio/HIIT/NEAT dosing; supersedes Draft v1.0) · **Owner:** Noah · **Date:** June 2026

A progressive web app that builds your training plan, tracks every set, and tells you exactly when to add weight — 100% free, 100% client-side, deployed on GitHub Pages. No backend, no API keys, no accounts, no paywalls.

---

## 1. Problem Statement

Lifters who want algorithm-driven progression face a bad trade: simple loggers (Strong, Hevy) leave progression decisions to the user and cap free tiers (Strong: 3 custom routines; Hevy: 4 routines, 7 custom exercises), while the apps that actually compute your next workout (RP Hypertrophy, Juggernaut AI, Alpha Progression) cost $25–35/month and mostly require an internet connection — a real problem in concrete-walled gyms. The one free programmable option (Liftosaur) requires learning a scripting DSL and has a rough UI. There is no app that combines polished logging UX, evidence-based automatic progression, and total data ownership for free.

**Why this product wins:** every "AI coaching" feature competitors paywall is actually deterministic math (linear/double progression, 5/3/1, GZCLP, RPE autoregulation, APRE, volume landmarks) that runs perfectly offline in the browser.

### Competitive positioning

| Competitor | What it does well | The gap we exploit |
|---|---|---|
| Strong | Fastest logging, great rest timer | 3-routine free cap, zero progression logic |
| Hevy | Modern UX, generous free tier | Cloud-dependent, manual progression, custom-exercise cap |
| Boostcamp | Free proven programs w/ progression | Limited custom progression authoring |
| RP Hypertrophy ($35/mo) | Autoregulated volume/mesocycles | Price, online-only, weak strength focus |
| Juggernaut AI ($35/mo) | Periodized powerlifting AI | Price, online-only |
| Alpha Progression (~$80/yr) | Plan generator, RIR progression | Generator + recs paywalled |
| Liftosaur (free, OSS) | Fully programmable progression | DSL learning curve, UI polish |

**Target combination:** Liftosaur's programmability + Hevy's UX + RP's volume management — free, offline-first, data-portable.

## 2. Goals & Success Metrics

**User goals**
1. **G1 — Zero-decision training:** every workout opens with a computed prescription (weight × reps per set) and a one-line "why" (e.g., "+5 lb — you hit 12/12/12 last session").
2. **G2 — Logging faster than a notebook:** confirming a prescribed set takes ≤ 2 taps; a full session of 20 sets logs in < 60 s of cumulative interaction.
3. **G3 — Data you can never lose:** workout history survives device loss via one-tap JSON export/import and (later) optional sync; no data ever leaves the device otherwise.
4. **G4 — Teach correct form:** every library exercise shows images, instructions, and worked muscles.

**Portfolio/business goals**
5. **G5 — Credible engineering artifact:** typed, tested (progression module at ~100% branch coverage), CI-badged, documented repo with a live demo.

**Success metrics (evaluate after a full personal 8-week dogfood + 1 month public)**

| Metric | Target | Stretch |
|---|---|---|
| Time from first visit → first logged workout | < 2 min | < 90 s |
| Taps to log a prescribed set | ≤ 2 | 1 |
| Lighthouse (PWA / Performance, mid-range Android) | ≥ 90 / ≥ 90 | 95+ |
| Initial JS (core route, gzipped) | ≤ 200 KB | ≤ 150 KB |
| Data-loss incidents across dogfood | 0 | 0 |
| Progression engine branch coverage | ≥ 95% | 100% |
| Works fully offline after install | Yes (all P0–P2 features) | — |

## 3. Non-Goals (v1) — the "not doing" list

| Non-goal | Why |
|---|---|
| Accounts, backend, or required cloud sync | Defeats the free/no-API/Pages constraint; export/import + optional Gist sync covers it |
| Endurance *coaching* — running plans, interval programming, HR-zone/GPS analytics | Prescribed + logged cardio sessions and timed holds ARE in scope (P2): real programs (e.g., recomp blueprints) prescribe LISS minutes and plank progressions; only endurance training science stays out |
| Food logging / macro *tracking* / meal diary | The app **shows** calorie + protein **targets** (TDEE estimate, §6.6) so users know what to aim for, but doesn't track intake or log meals — a food diary is a separate product |
| Social feed, comments, sharing-to-feed | High effort, low differentiation; program *link* sharing is enough (P4) |
| Native iOS/Android apps, Apple Watch | PWA-first; wearables need native APIs |
| AI/LLM chat coach | Violates no-API constraint; deterministic engine *is* the coach |
| Velocity-based training hardware | Requires sensors; approximate via RPE instead |
| Scheduled push reminders | Web Push requires a server to send; in-app/timer notifications only — documented limitation |
| Localization beyond English | Spanish is the planned first addition in P4 (self-QA-able), nothing else |
| Per-set video form analysis / rep counting via camera | TF.js experiment at best; out of scope |

**Scope rule:** any feature added to a phase must displace one of equal size, or move to the Parking Lot (§18).

## 4. Users & Core Stories

**Persona A — Self-coached intermediate (primary; also the developer):** trains 4–6 d/wk, runs structured programs, wants prescriptions computed and history charted.
**Persona B — Novice with a template:** picks a beginner program, needs the app to just say what to lift and teach form.
**Persona C — Data refugee:** has years of Strong/Hevy history, wants out of subscription lock-in.

Priority-ordered stories:
1. As a lifter, I want today's workout to show exact weight × reps per set so that I never calculate in my head. *(P1)*
2. As a lifter, I want the rest timer to start itself when I log a set so that rest is consistent without babysitting a stopwatch. *(P1)*
3. As a lifter, I want the app to tell me when to add weight — and when to deload — based on my logged performance so that I progress without guesswork. *(P1–P2)*
4. As a novice, I want to enter my height, weight, and goal and get a complete structured plan — training, cardio, and starting weights — so that I start training in minutes without designing anything. *(P2)*
5. As a lifter mid-workout, I want to swap an exercise when equipment is taken, for a substitute hitting the same muscles, without breaking my progression. *(P2)*
6. As a lifter, I want my phone dying mid-session to cost me nothing — the workout resumes where I left off. *(P1)*
7. As a data refugee, I want to import my Strong/Hevy CSV so that my history and e1RMs carry over. *(P1)*
8. As a lifter, I want per-muscle weekly volume vs. recommended landmarks so that I can see if I'm under- or over-training. *(P3)*
9. As a lifter, I want every exercise to show how to perform it (images, steps, muscles) so that I trust my form. *(P1)*
10. As a self-coached lifter, I want readiness check-ins to adjust my plan when I'm beat up so that fatigue doesn't derail a mesocycle. *(P3)*

## 5. Requirements by Phase

> Acceptance criteria are checklists; each is independently testable. P0 = cannot ship without; later phases gate on earlier exit criteria.

### Phase 0 — Foundation (architecture you won't regret) · ~1 week
- [ ] Vite + React + TypeScript + Tailwind scaffold; ESLint + Prettier + strict TS
- [ ] GitHub Actions: lint → typecheck → test → build on PR; deploy `dist` to Pages on `main`
- [ ] `vite.config` `base: '/<repo>/'`; HashRouter routing (zero-config deep links on Pages)
- [ ] vite-plugin-pwa (`registerType: 'autoUpdate'`), manifest, installable on iOS/Android
- [ ] Dexie schema v1 (§8) with migration scaffolding + pre-migration auto-snapshot
- [ ] `free-exercise-db` ingested via build pipeline (§7); images load from jsDelivr
- [ ] `/src/engine` package: pure functions only, zero React/IO imports, Vitest configured
- [ ] JSON export (one tap) + import (file picker) round-trips the entire DB
- [ ] `navigator.storage.persist()` requested post-install; storage status surfaced in Settings

**Exit:** deployed demo URL; export→wipe→import restores everything byte-equal.

### Phase 1 — MVP logger that beats free tiers · ~2–3 weeks
- [ ] **Routine builder:** unlimited routines; per-exercise set scheme (sets × rep target or range), rest durations (separate warm-up/working), notes
- [ ] **Today view:** prescribed sets w/ previous-session inline ("last: 185 lb × 8,8,7"); 1-tap confirm prescribed set, 2-tap edit weight/reps
- [ ] **Rest timer:** auto-starts on set completion; warm-up vs working durations; audio cue + vibration; survives screen lock where OS allows; Screen Wake Lock during active session (feature-detected)
- [ ] **Session recovery:** active session auto-saved to IndexedDB ≤ 250 ms after every mutation; on relaunch < 12 h, prompt "Resume workout?"
- [ ] **Mid-workout controls:** skip exercise; add unplanned exercise; swap to substitute (same primary muscle + available equipment); finish-partial; edit/delete any past set with undo (soft-delete, 10 s snackbar)
- [ ] **Progression v1:** linear + double progression rules attached per exercise; next-session prescription computed at workout completion; recommendation banner with reason string
- [ ] **PR detection:** weight PR, rep PR (at weight), e1RM PR; celebration toast; PR history list
- [ ] **Calculators:** plate calculator (uses user plate inventory + bar weight), e1RM calculator, warm-up set generator (bar → 40/60/80% ramp, plate-rounded)
- [ ] **History:** calendar + list; per-exercise history with e1RM sparkline (Recharts, lazy-loaded route)
- [ ] **Import:** Strong + Hevy CSV (§12) with header sniffing and exercise-name mapping UI
- [ ] **Units (imperial-first):** lb is the default and canonical unit for load; US plate set (45/35/25/10/5/2.5 + fractional 1.25) on a 45 lb bar; increments in lb, resolved through plate-aware rounding. **Bodyweight in lb; height in feet/inches (entered as a ft + in field, shown like 5'10″); body measurements in inches; cardio distance in miles.** Optional kg toggle converts load for display only and never mutates stored data; metric is used only inside the BMR/protein formulas, never in the UI
- [ ] Dark mode default; thumb-zone primary actions; touch targets ≥ 48 px

**Exit:** developer dogfoods one full week, zero data loss, logging ≤ 2 taps/set.

### Phase 2 — Programmable progression (beats Liftosaur on usability) · ~2–3 weeks
- [ ] Progression engine completes: 5/3/1 (TM-based waves + cycle increments), GZCLP (tier state machines), RPE-target, APRE (3/6/10), per-set double progression (DDP)
- [ ] **Program templates** shipped as data, each meeting the §6.6 quality bar (periodized, cardio-integrated, per-exercise tempo/rest/cues, per-slot alternates — no flat lists): **Recomp Blueprint v1 (10-wk recomp) and v2 (8-wk goal-driven cut) as flagships / structural references**, Full Body 3×, Upper/Lower, PPL, Reddit PPL, 5/3/1 (+BBB, FSL), GZCLP, GreySkull LP, nSuns 4-day, Texas Method, PHUL, PHAT — schemes only, original prose (§19 IP rules)
- [ ] **Plan generator (wizard v2) — goal-driven & personalized:** inputs — height, weight, sex/age, experience, **goal (build muscle / lose fat / recomp / get stronger / physique target like "visible abs / ~X% BF in N weeks")**, optional target weight or date, days/week, session length, equipment → outputs a complete structured plan shaped by the goal: program (split + curated exercises + **per-slot alternates** + progression rules), periodization **sized to the timeframe**, cardio protocol dosed to goal (LISS + HIIT + daily steps where appropriate), warm-up policy, Week-1 calibration, auto-created Goals (§5 P3), and — for body-composition goals — **realistic outcome bands + the diet-is-your-lever note**, not a guarantee. Fully editable; first workout < 2 min (rules in §6.6)
- [ ] **Onboarding plan library:** a broad set of ready, bespoke-feeling goal-based programs (the flagship blueprints + Lose Fat / Build Muscle / Recomp / Get Stronger / Visible Abs Cut / Beginner Foundation), each already periodized, cardio-integrated, and with per-exercise detail + alternates — no generic flat starter routines. "Build my plan" runs the generator for a personalized one.
- [ ] Training Max management UI (5/3/1): set, view, cycle-increment, manual override
- [ ] AMRAP, drop set, rest-pause, superset set types in logger; supersets share one rest timer
- [ ] Exercise substitution by muscle/equipment from library, preserving the slot's progression state policy (reset vs. carry)
- [ ] Bodyweight + weighted/assisted bodyweight exercises (external load may be negative); progression by reps (rep-PR), added-load double progression when weighted
- [ ] **Cardio & timed work:** template slots can prescribe duration-based work — cardio (modality, target minutes, intensity note e.g. "incline walk, HR 120–135") and timed holds (plank, Pallof) — logged as duration + optional distance (miles)/RPE; `durationLinear` progression (+N sec on schedule, e.g. +5 s/2 wks for holds) or goal-linked suggestion for cardio minutes
- [ ] **Self-explaining terms (education layer):** every coached term that appears in a plan or the logger is tappable and explains itself in plain language, in place — no leaving the app to google. Specifically: a **tempo decoder** (tap "3-1-1-0" → "3s lowering · 1s pause at bottom · 1s lifting · 0s at top," with any hold called out, e.g. "hold 2s at the top"), and tappable definitions for RPE, RIR, LISS, HIIT, NEAT/steps, deload, drop set, rest-pause, mechanical drop set, AMRAP, superset, eccentric/concentric, e1RM, Training Max, MEV/MAV/MRV. Plus a searchable **glossary** screen. All definitions are short, original plain-language prose (§19 IP), bundled and available offline; first appearance of a term can surface a one-time hint.

**Exit:** all rule kinds pass table-driven unit tests incl. failure/deload branches; wizard→first workout < 2 min for a new user.

### Phase 3 — Autoregulation & analytics (beats the $35/mo apps) · ~3–4 weeks
- [ ] **Mesocycle builder:** accumulation weeks with +1 set/muscle/week from MEV toward MRV; scheduled deload week (volume −50%, load −10–20%, configurable)
- [ ] **Readiness check-in** (optional, per session): sleep, soreness, motivation, joint pain → bounded set/load adjustments with shown reasoning; always manually overridable
- [ ] **Plateau detection:** per-exercise EWMA(e1RM) slope ≤ 0 across 3–4 sessions AND no load/rep PR in window → suggest single-exercise deload (−10% load, ~50% sets) or rep-range change
- [ ] **Volume heatmap:** weekly hard sets per muscle vs. editable MEV/MAV/MRV bands
- [ ] **Analytics dashboard:** e1RM trends, tonnage, weekly volume, intensity distribution, prescribed-vs-completed compliance %
- [ ] Body measurements (waist, arms, etc., in inches) + progress photos (IndexedDB blobs, side-by-side compare)
- [ ] **Goals:** user-defined targets — bodyweight or waist trend (direction-aware), lift target (rep-at-weight like "bench 1×8 @ 185 lb", or e1RM), weekly cardio minutes, weekly sets per muscle, session streak — dashboard progress bars + goal-linked suggestions (e.g., "weight flat 2 wks vs. fat-loss goal → +5 min per cardio session")
- [ ] **Optional sync:** GitHub Gist via user-pasted PAT (`gist` scope) — push/pull whole-DB JSON, last-write-wins with timestamp warning
- [ ] Backup nudge: after every N sessions (default 10) without export/sync, prompt one-tap export

**Exit:** full mesocycle dogfooded start-to-deload; volume heatmap matches hand-counted sets.

### Phase 4 — Polish & community · ongoing
- [ ] Interactive muscle-map browser (react-body-highlighter) for library + per-exercise muscle visual
- [ ] Optional per-exercise YouTube links/`youtube-nocookie` click-to-load embeds (online-only badge)
- [ ] Custom exercises with user photos (unlimited, free); program share links (URL-encoded JSON)
- [ ] Spanish localization; accessibility pass (contrast, reduced motion, labels, focus order)
- [ ] README as portfolio piece: GIF demo, architecture section, live link, CI/coverage badges; CONTRIBUTING; program/exercise contributions via PR
- [ ] PWA "what's new" panel (streaks/consistency absorbed into Goals, §5 P3)

---

## 6. Progression Engine Specification

**Design law:** the engine is a pure TypeScript module (`/src/engine`) with no React, no Dexie, no Date.now(), no I/O. Every function is `(inputs) → outputs`. This makes it 100% unit-testable and the centerpiece of the portfolio story.

### 6.1 Core types & entry point

```ts
export type SetType = 'warmup' | 'working' | 'amrap' | 'drop' | 'restPause' | 'timed' | 'cardio';

export interface SetResult {
  weightLb: number;       // external load; 0 = pure bodyweight; negative = assisted
  reps: number;
  durationSec?: number;   // timed holds & cardio
  distanceMi?: number;     // optional, cardio
  rpe?: number;           // 6.0–10.0 in 0.5 steps
  type: SetType;
  completed: boolean;
}

export type ProgressionRule =
  | { kind: 'linear';  incrementLb: number; failsBeforeDeload: number; deloadPct: number }
  | { kind: 'double';  repMin: number; repMax: number; incrementLb: number; perSet: boolean } // perSet=true → DDP
  | { kind: 'percent531'; variant: 'base' | 'bbb' | 'fsl';
      tmIncrementLb: number }                       // week derived from cycle position
  | { kind: 'gzclp';   tier: 1 | 2 | 3 }
  | { kind: 'rpeTarget'; targetRpe: number; targetReps: number; loadStepPct: number }
  | { kind: 'apre';    rm: 3 | 6 | 10 }
  | { kind: 'repsOnly'; repIncrement: number }       // bodyweight progression
  | { kind: 'durationLinear'; incrementSec: number; everyNSessions: number } // timed holds, cardio minutes
  | { kind: 'manual' };

export interface ExerciseState {
  workingWeightLb: number;
  trainingMaxLb?: number;        // 5/3/1
  consecutiveFails: number;
  stage: number;                 // GZCLP stage index, wave position, etc.
  cyclePos: number;              // week-in-cycle for percentage schemes
}

export interface Prescription {
  sets: Array<{ type: SetType; targetReps: number; targetWeightLb: number;
                amrap?: boolean; targetRpe?: number }>;
  reason: string;                // human-readable: "+5 lb — hit 12/12/12 @ 185 lb"
  flags: Array<'deload' | 'stageChange' | 'tmIncrease' | 'plateauSuspected'>;
}

export function nextPrescription(
  rule: ProgressionRule,
  state: ExerciseState,
  lastSession: SetResult[],
  settings: EngineSettings        // plate inventory, bar weight, rounding mode, units
): { prescription: Prescription; nextState: ExerciseState };
```

**Units — pounds-first (whole engine).** All loads, increments, plate inventory, and seeds are **pounds**; default US plates 45/35/25/10/5/2.5 lb (+ fractional 1.25 lb) on a 45 lb bar; kg is display-only. The kg figures in the example tables below are illustrative — implement them in lb. All output loads pass through `roundToLoadable(targetLb, barLb, plates)` — nearest weight actually loadable from the user's plate inventory (pairs only). Default increments: compounds **+5 lb upper / +10 lb lower**; isolation **+5 lb** (or fractional); overridable per exercise.

### 6.2 Rule logic (normative)

**Linear (novice compounds).** All working sets hit target reps → `weight += increment`. Else `consecutiveFails++`. At `failsBeforeDeload` (default 3) → `weight *= (1 − deloadPct)` (default 10%), fails reset.

**Double progression (default for isolation/hypertrophy).** Rep range [min,max]. All sets at top of range (at/below target RPE if logged) → `weight += increment`, target reps reset to min. Otherwise add reps where possible. `perSet=true` (DDP) progresses each set slot independently.

**5/3/1.** State holds TM (init 90% of tested/estimated 1RM). Waves over `cyclePos`:
- W1: 65/75/85% TM × 5/5/5+ · W2: 70/80/90% × 3/3/3+ · W3: 75/85/95% × 5/3/1+ · W4 (deload): 40/50/60% × 5
- After W4 (or W3 if deload disabled): `TM += tmIncrementLb` (defaults: +5 lb upper, +10 lb lower). AMRAP reps recorded; if W3 top set < 1 rep → TM reset to 90% of current e1RM. Variant adds BBB 5×10 @ 50–60% TM or FSL 5×5 @ first-set weight.

**GZCLP (per tier).**
- T1: stages `5×3+ → 6×2+ → 10×1+`. Complete all reps → `+10 lb lower / +5 lb upper`, same stage. Fail → next stage at same weight. Fail stage 3 → retest 5RM, restart stage 1 with TM = 85% of new 5RM.
- T2: stages `3×10 → 3×8 → 3×6`, same weight across a stage; fail → next stage; after 3×6 fails → restart 3×10 at last 3×10 weight + 5 lb.
- T3: `3×15+`; AMRAP final set ≥ 25 total reps → +5 lb.

**RPE target.** Compare logged RPE on top set vs `targetRpe`: each 1.0 RPE deviation ≈ `loadStepPct` (default 4–5%) load adjustment next session, clamped to ±10%; reps held at `targetReps`. Uses an RIR-based %1RM lookup table (Helms/Zourdos lineage) shipped as data.

**APRE (rm ∈ {3,6,10}).** Four-set protocol; sets 1–2 at 50%/75% of the working RM for rm-appropriate reps; set 3 = AMRAP at RM weight; set 4 load and **next session's RM** from lookup tables (reps achieved on set 3 → adjustment):
- APRE-10: 4–6 → −5..10 lb · 7–8 → −0..5 · 9–11 → 0 · 12–16 → +5..10 · 17+ → +10..15
- APRE-6: 0–2 → −5..10 · 3–4 → −0..5 · 5–7 → 0 · 8–12 → +5..10 · 13+ → +10..15
- APRE-3: 1–2 → −5..10 · 3–4 → 0 · 5–6 → +5..10 · 7+ → +10..15
(The published APRE tables in lb; scale factor configurable for weaker/stronger lifters.)

**repsOnly (bodyweight).** Progress total/target reps by `repIncrement`; when user attaches external load, slot converts to `double`.

### 6.3 e1RM, trend, plateau, deload

- `e1rmEpley = w·(1 + r/30)`; `e1rmBrzycki = w·36/(37 − r)`. Display the mean; compute only for working/AMRAP sets with `reps ≤ 10`; reps > 10 → show "low confidence", exclude from trend.
- Per-exercise trend: `EWMA_t = α·e1rm_t + (1−α)·EWMA_{t−1}` with α = 0.3 (same smoothing approach as tally's habit strength).
- **Plateau:** EWMA slope ≤ 0 over the last 3–4 sessions AND no weight/rep PR in that window → flag `plateauSuspected`; suggest single-exercise deload (−10% load, ~50% sets for one week) or a rep-range/variation change. Never auto-apply — recommend with reason.
- **Systemic deload trigger (P3):** ≥ 2 readiness markers degraded across a week (performance drop ≥ 2 sessions, soreness persisting to next session for the muscle, sleep/motivation poor) → recommend the program's deload week early.

### 6.4 Volume landmarks (P3)
Weekly hard sets (working + AMRAP, RPE ≥ 7 if logged) per muscle via exercise→muscle map (primary = 1.0, secondary = 0.5). Editable defaults per muscle: MV 4 · MEV 8 · MAV 12–18 · MRV 20 (shipped table, RP-derived; user-tunable). Mesocycles start near MEV, +1 set/muscle/week, deload at MRV proximity or schedule.

### 6.5 Engine test plan
Table-driven Vitest cases per rule kind: success path, partial fail, deload trigger, AMRAP branches, stage transitions, TM reset, rounding to plates (incl. microplate absence), negative/assisted loads, reps > 10 e1RM exclusion. Property test: every prescription weight is loadable from the test plate inventory. Target ≥ 95% branch coverage (gate in CI).

### 6.6 Plan generator (deterministic, `/src/engine/generator`)

`generatePlan(profile, preferences) → { program, cardioProtocol, goals[], calibrationWeek }` — pure function over shipped rule tables. This is the feature competitors paywall at ~$80/yr; it is a decision tree, not ML.

**Program quality bar (non-negotiable — applies to generated *and* built-in programs).** The output is a *coached, periodized program*, not a flat exercise list. The flagship reference is `recomp_blueprint.docx` (shipped as the canonical example/template); every program must match its structural depth:
- **Periodized mesocycle** — named phases with week-by-week changes (e.g. Foundation RPE 7–8 → Intensification add load/sets RPE 8–9 → Deload volume −40% RPE 5–6 → Peak RPE 9–10 + intensifiers). Never one static prescription repeated.
- **Deliberate order + pairing** — compounds first, then isolation; explicit A1/A2, B1/B2 supersets; exercises drawn from a **curated pool per muscle with real variety** (two different profiles must not yield identical-looking plans).
- **Full per-exercise prescription** — sets, rep range, **separate warm-up vs working rest**, **tempo** (4-digit), and a **one-line coaching cue**.
- **Quantified weekly volume per muscle**, surfaced and targeted to landmarks (§6.4), phase-adjusted.
- **Integrated cardio** (see below) — required, not a bolt-on.
- **Optional rotating core/accessory block** with its own progression.
- **Warm-up protocol** (general → activation → 2 specific ramp sets) + cooldown.
- **Phase-gated intensifiers** (drop set, rest-pause, mechanical drop set, slow eccentrics) — Peak phase only, one per session max, mapped to the `drop`/`restPause` set types.

**Split selection:** 3 d/wk → Full Body · 4 → Upper/Lower · 5 → PPL + Upper (or hypertrophy body-part split) · 6 → PPL×2. Goal overrides: get-stronger + novice → GZCLP/linear-LP template; get-stronger + intermediate → 5/3/1. **Exercise selection is curated, not mechanical:** pick from a goal- and equipment-appropriate pool per movement pattern (squat, hinge, horizontal/vertical push & pull, lunge, isolation) with variety and a sensible compounds-first order — *not* a fixed first-match slot-fill (that is the source of the "generic" feel and is explicitly disallowed).

**Progression defaults by experience × goal:** novice compounds → `linear`; hypertrophy work → `double` (8–12 / 10–15); strength mains → `percent531` or `gzclp`; isolation/bodyweight/timed per §6.2; core → rep/tempo progression; cardio/holds → `durationLinear`. Starting weekly volume: novice ~10 hard sets/muscle; intermediate starts near MEV per §6.4 and ramps toward MRV across the accumulation phases.

**Starting loads — seed + calibrate:** seed weights from a bodyweight-relative strength-standards table shipped as data (e.g., novice working seeds as fractions of BW per lift, by sex where provided), plate-rounded — then **Week 1 = calibration**: each main lift ramps to a comfortable top set of 8–10; logged result → e1RM → engine derives Week 2+ working weights. Seeds only prefill plausible numbers so Week 1 isn't blank; calibration is the source of truth. (No seed table entry → empty-bar/lightest-load start with fast linear ramp.)

**Cardio — integrated protocol, dosed by goal** (not an optional afterthought): build muscle → 0–60 min/wk optional LISS · recomp → ~90–150 min/wk LISS post-lifting + an active-recovery day · lose fat / physique cut → ~120–180 min/wk combining LISS post-lift, **HIIT on non-lifting days** (sprint intervals; kept off lifting days to avoid the interference effect), and a **daily step / NEAT target** (e.g. 10–12k). Each plan specifies per-day cardio (modality, duration, intensity/HR target, timing — e.g. post-workout incline-walk HR 120–135; HIIT 85–95% on intervals), a dedicated active-recovery day, a weekly total, and the **stall rule** (+~5 min/session, or +steps, before adjusting anything else), attached as a goal-linked suggestion.

**Goal-driven plans, pacing & honesty:** a goal can be a physique target with a timeframe ("visible abs / ~X% BF in N weeks") as well as build/lose/recomp/strength. The generator sizes the mesocycle to the timeframe, adapts rep ranges/volume/intensity to the goal (e.g. a cut keeps load and trims volume to preserve muscle), and doses cardio/NEAT accordingly. A body-fat target maps to a target weight/waist trend (estimate, clearly flagged). Implied rate is clamped to safe bands (fat loss 0.25–1.0% BW/wk; gain 0.25–0.5% BW/wk); if the deadline implies a faster/unlikely rate, warn and propose the nearest realistic version, and show **conservative / target / best-case outcome bands** rather than a guarantee. **Honesty rule (load-bearing):** fat-loss outcomes are driven by the calorie deficit. The app gives the user a **target to aim for** (below) but does **not** track intake, so it must state plainly that hitting the target depends on the diet they actually run — and tracks the weight/waist/photo trend so they can adjust. Never imply body composition changes from training alone. Generator auto-creates: bodyweight/measurement Goal (direction + rate), weekly-cardio-minutes and daily-steps Goals, and optional starter lift Goals.

**Nutrition targets — display only, never a tracker.** So the user knows how much to eat for the plan to work, the generator computes and **displays** (no food logging):
- **Calories:** BMR via **Mifflin-St Jeor**, × an activity factor derived from training days + step target = TDEE estimate; then goal-adjusted — deficit for fat loss / surplus for gain / maintenance for recomp — with the adjustment tied to the clamped weekly rate. **Cap the deficit well short of extreme (≈≤20–25% of TDEE), never below BMR, and apply a hard kcal floor.**
- **Protein:** a clear daily gram target (~1.6–2.2 g/kg, higher end on a cut) — the most important and safest number to surface.
- **Fat floor + carbs:** a minimum fat target (hormone protection, ~0.6 g/kg or ≥~20–25% kcal) and carbs as the remainder, shown as simple targets.
- **Framing & guardrails:** presented as an **estimate and starting point** ("aim for ~X kcal / Yg protein; adjust if your weekly trend stalls"), not a prescription, alongside the not-medical-advice note. **For age < 18 or low BMI: show maintenance + protein only — no deficit/cut target — with a consult-a-professional note.** Avoid any "lose weight fast" framing; never show a number below the safe floor. Targets appear in the plan and on the dashboard next to the weight-trend chart; there is no meal logging, calorie diary, or food database.

**Safety rails:** extreme BMI inputs or age < 18 → conservative defaults + "consult a professional" note alongside the standing disclaimer; all generated numbers editable; generator never blocks manual program building.

**Tests:** snapshot tests over a profile matrix (sex × experience × goal × days × equipment) asserting valid programs (every slot loadable, volume within MEV–MRV, cardio within dose band, pacing within safe band).

---

## 7. Exercise Library Specification

**Core dataset:** `yuhonas/free-exercise-db` — ~870 exercises, The Unlicense (public domain, no attribution required). Fields: name, force, level, mechanic, equipment, primaryMuscles[], secondaryMuscles[], instructions[], category, images[] (2 start/end JPEGs each).

**Build pipeline (`/scripts/build-exercises.ts`, runs in CI):**
1. Fetch dataset JSON at a pinned commit; normalize names (case/punctuation), drop dupes.
2. Map muscle vocabulary → canonical taxonomy matching `react-body-highlighter` slugs.
3. Emit `public/data/exercises.json` + a prebuilt FlexSearch index (no runtime indexing).
4. Tag each record `license: 'unlicense'`; any future CC-BY-SA supplement (wger/everkinetic) carries `license`+`attribution` and renders credit in the detail view.

**Images:** served from jsDelivr pinned to the commit (`cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@<sha>/exercises/<id>/0.jpg`) — free, no bandwidth caps, permanent caching. Workbox runtime route: CacheFirst + `CacheableResponsePlugin({statuses:[0,200]})` + Expiration (maxEntries 300, 60 days). Pre-cache only images for exercises in the active program. Fallback plan if jsDelivr ever 429s: build-time WebP conversion (~60–80% smaller) self-hosted on Pages.

**Browse/search UX:** the FlexSearch index must cover **name + primary muscles + secondary muscles + equipment + category** (not name alone), with a **synonym/alias layer** so the common terms people actually type resolve to the dataset's vocabulary — abs→abdominals, quads→quadriceps, delts/shoulders, lats→lats/"middle back", glutes, hams→hamstrings, pecs→chest, bis→biceps, tris→triceps, etc. Searching a muscle group returns every exercise for it. Alongside search: multi-select **facet filters** (muscle group, equipment, mechanic, level, category) that combine with the query; a `react-virtuoso` list over the full ~800+ dataset; exercise detail = start/end images, step instructions, a worked-muscles figure (primary/secondary), tags, history sparkline, alternates, and a personal notes/cues field. Verify the whole dataset and prebuilt index actually ship — a muscle query returning nothing usually means the index is name-only or the dataset built as a subset.

**Custom exercises:** unlimited, free; user photo stored as IndexedDB blob; participate fully in search, progression, and analytics. (Direct answer to Hevy's 7-exercise cap.)

**Form-content tiers:** T1 bundled photos+instructions (offline) → T2 user's own notes/cues → T3 optional YouTube link per exercise (click-to-load `youtube-nocookie`, "online only" badge, link-rot tolerated). Never rehost third-party video; never use ExerciseDB/MuscleWiki media (proprietary).

---

## 8. Data Model (Dexie / IndexedDB)

Storage rules: **lb canonical** (pounds-first) for all loads (kg toggle converts for display only); ISO-8601 strings for dates; ULIDs for ids; soft-delete via `deletedAt` where undo applies.

```ts
// db.ts — schema v1
db.version(1).stores({
  exercises:     'id, nameNorm, *primaryMuscles, equipment, category, isCustom',
  programs:      'id, name, isActive',
  templates:     'id, programId, dayIndex',          // WorkoutTemplate
  sessions:      'id, date, programId, templateId',
  sets:          'id, sessionId, exerciseId, [exerciseId+date]',
  exerciseState: '[programId+exerciseId]',
  measurements:  'id, date, type',
  photos:        'id, date',
  goals:         'id, type, status',
  settings:      'key',                              // singleton rows
  activeSession: 'key',                              // crash-recovery singleton
  backups:       'id, createdAt'                     // pre-migration snapshots (keep 2)
});
```

```ts
interface Exercise   { id; name; nameNorm; primaryMuscles: Muscle[]; secondaryMuscles: Muscle[];
                       equipment?: Equipment; mechanic?: 'compound'|'isolation'; level?: string;
                       instructions: string[]; images: string[]; isCustom: boolean;
                       isBodyweight: boolean; trackingMode: 'load'|'reps'|'duration'; license: 'unlicense'|'cc-by-sa'; attribution?: string;
                       youtubeId?: string; youtubeT?: number; userNotes?: string }

interface Program    { id; name; isActive: boolean; createdAt;
                       mesocycle?: { phase: 'accumulation'|'intensification'|'deload';
                                     weekIndex: number; totalWeeks: number;
                                     volumeTargets?: Record<Muscle, {mev:number; mrv:number}> } }

interface WorkoutTemplate { id; programId; dayIndex: number; name: string;
                            slots: ExerciseSlot[] }

interface ExerciseSlot { slotId; exerciseId; order: number;
                         scheme: { sets: number; repTarget?: number; repRange?: [number, number];
                                   percentOfTM?: number[]; amrapLast?: boolean };
                         progressionRule: ProgressionRule;
                         restWarmupSec: number; restWorkSec: number;
                         warmupPolicy: 'auto'|'none'|'custom'; tempo?: string;
                         supersetGroup?: string;
                         substitutionPolicy: 'carryState'|'resetState' }

interface WorkoutSession { id; programId?; templateId?; date; startedAt; endedAt?;
                           readiness?: { sleep: 1|2|3; soreness: 1|2|3; motivation: 1|2|3; jointPain: boolean };
                           status: 'active'|'completed'|'partial'; notes?: string }

interface LoggedSet  { id; sessionId; exerciseId; date; order: number; type: SetType;
                       weightLb: number; reps: number; durationSec?: number; distanceMi?: number;
                       rpe?: number; completed: boolean;
                       supersetGroup?: string; isPR?: ('weight'|'reps'|'e1rm')[];
                       deletedAt?: string }

interface ExerciseStateRow extends ExerciseState { programId; exerciseId; updatedAt }

interface Goal       { id; type: 'bodyweight'|'measurement'|'bodyFatTarget'|'liftTarget'|'weeklyCardioMin'|'dailySteps'|'weeklySetsMuscle'|'streak';
                       target: number; direction: 'increase'|'decrease'; deadline?: string;
                       exerciseId?; repTarget?; muscle?;
                       status: 'active'|'achieved'|'abandoned'; createdAt }

interface UserSettings { units: 'lb'|'kg';      // default 'lb' (US); kg is display-only
                         barLb: number;          // default 45
                         plateInventoryLb: number[];
                         defaultRestWarmupSec: number; defaultRestWorkSec: number;
                         theme: 'dark'|'light'|'system'; soundOn: boolean;
                         backupNudgeEvery: number; lastExportAt?: string;
                         gistSync?: { gistId: string /* PAT kept in memory-only or sessionStorage, never exported */ } }
```

**Migration policy:** never delete old `db.version(n)` declarations; every upgrade wrapped in `.upgrade(tx)`; before opening a DB whose on-disk version < code version, write a full-DB JSON snapshot into `backups` (retain last 2) so a botched migration is always reversible. Export/import operates on a versioned envelope `{ schemaVersion, exportedAt, data: {...tables} }`; import migrates old envelopes forward through the same upgrade functions.

---

## 9. Application Architecture

```
/src
  /engine          pure progression logic (no imports from app code)
  /db              Dexie schema, migrations, repositories, export/import
  /features
    /log           today view, set logger, rest timer, session recovery
    /programs      builder, wizard, templates (shipped as JSON in /data)
    /library       exercise browse/search/detail, custom exercises
    /analytics     charts, volume heatmap, PRs (lazy-loaded route)
    /settings      units, plates, backup, sync, about/licenses
  /components      design-system primitives
  /data            templates.json, rpe-table.json, volume-landmarks.json
/scripts           build-exercises.ts (dataset pipeline)
```

- **State:** Dexie is the source of truth; `dexie-react-hooks` `useLiveQuery` for reads; **Zustand** only for ephemeral session/UI state (running timer, active set index, undo stack). No Redux.
- **Storage durability ladder:** (1) iOS install prompt with explicit instructions — installed home-screen PWAs are exempt from Safari's 7-day ITP eviction; (2) `navigator.storage.persist()` after install, status shown in Settings; (3) backup nudges + one-tap export; (4) optional Gist sync (P3). Handle `QuotaExceededError` on every write path with a non-blocking "storage full — export now" banner.
- **Session recovery:** every logger mutation debounced (250 ms) into the `activeSession` singleton; app boot checks for an `active` session < 12 h old → resume prompt; > 12 h → offer save-as-partial/discard.
- **PWA:** vite-plugin-pwa autoUpdate + in-app "Update ready — reload" toast; precache app shell + data JSON; runtime CacheFirst for exercise images (§7); rest timer recomputed from wall-clock timestamps on visibilitychange (never trust background JS timers on iOS).
- **Error handling:** global error boundary with "export my data" escape hatch; corrupt-record reads are skipped + reported, never crash the session.

## 10. UX Specification

- **Logging screen (the product):** one exercise card at a time; prescribed sets listed with weight × reps; tapping a set row = done-as-prescribed (1 tap); long-press/expand = numeric steppers for weight/reps (+RPE if enabled); previous-session line always visible; rest timer takes over the bottom bar with ±15 s controls.
- **Onboarding wizard:** goal (incl. physique target + timeframe) → stats (height in ft/in, weight in lb, sex) → days/week → equipment → experience → either pick from the **plan library** (many ready, structured, bespoke-feeling programs) or "Build my plan" → personalized generated plan preview (with alternates and, for body-comp goals, realistic outcome bands + the diet note) → "Start". Skippable to blank builder. First logged workout reachable in < 2 min.
- **Design system:** dark default (gym lighting), high-contrast accent for primary actions, all primary actions in bottom 40% thumb zone, touch targets ≥ 48 px, `prefers-reduced-motion` respected, typography legible at arm's length (min 16 px body, 24 px+ for active set numbers).
- **Units:** lb is canonical and the default; kg is a display-only toggle that converts on screen and never mutates stored data. Prescriptions round to loadable lb plates from the user's inventory. **Bodyweight in lb; height entered as feet + inches (e.g. 5 ft 10 in) and shown like 5'10″; body measurements in inches; cardio distance in miles.** Metric appears only inside the BMR/protein calculation, never in the UI.
- **Empty states:** every list ships designed empty state with one CTA (e.g., History → "Log your first workout").
- **Self-explaining UI:** anywhere a coached term or tempo string appears (plan view, logger, exercise detail), it's tappable to a short plain-language explanation — the user never has to look up what "3-1-1-0," "RPE 8," "RIR," "LISS," or "deload" means. A glossary screen collects them all. (See P2 education-layer requirement.)
- **Disclaimer:** first-run footer + About page: educational tool, not medical advice.

## 11. Analytics & Charts (Recharts, lazy route)
e1RM trend per exercise (EWMA overlay, PR markers) · weekly tonnage & hard-set volume (stacked by muscle) · intensity distribution histogram (%TM or RPE buckets) · compliance % (completed vs prescribed sets) · calendar heatmap of sessions · PR timeline. Each chart answers one question; no dashboard soup — max 2 charts per screen on mobile.

## 12. Import / Export / Sync

- **Export:** full-DB JSON envelope (§8), via File System Access API on Chromium desktop, `<a download>` fallback elsewhere (mobile Safari included). Filename `overload-backup-YYYY-MM-DD.json`.
- **Import:** JSON envelope (any prior schemaVersion) — validated, migrated, merged-or-replace (user chooses).
- **CSV import (P1):** sniff delimiter + header row.
  - *Hevy columns:* `title, start_time, end_time, description, exercise_title, superset_id, exercise_notes, set_index, set_type, weight_lbs, reps, distance_miles, duration_seconds, rpe` (one row per set; `duration_seconds`/`distance_miles` map to `durationSec`/`distanceMi`, so cardio history imports losslessly).
  - *Strong columns:* workout name, date, exercise name, set order, weight (kg/lb per file), reps, distance, seconds, RPE (absent in older exports), notes — detect by header.
  - Exercise names matched against `nameNorm`; unmatched names → mapping UI (pick library exercise or create custom). Imported sets are history-only (no progression state inferred); e1RMs/PRs recompute automatically.
- **Gist sync (P3, optional):** user pastes a fine-grained PAT with `gist` scope; app pushes/pulls the JSON envelope to a private gist; conflict = newer `exportedAt` wins after an explicit warning. PAT never included in exports.

## 13. Testing & CI

| Layer | Tool | Scope |
|---|---|---|
| Engine unit | Vitest | every ProgressionRule branch, rounding, e1RM, EWMA, plateau — table-driven; ≥ 95% branch coverage gate |
| DB | Vitest + fake-indexeddb | migrations vN→vN+1, export/import round-trip equality, backup snapshot |
| Component | Testing Library | logger interactions, undo, timer states |
| E2E | Playwright (CI, mobile viewport) | wizard → create program → log full workout → kill page mid-session → resume → finish → next-session prescription visible |
| Static | TS strict, ESLint | zero-warning gate |

CI: PR = lint+typecheck+test+build; main = same + deploy to Pages. Badges (build, coverage) in README.

## 14. Deployment
GitHub Actions → Pages artifact deploy. `base: '/<repo>/'`; HashRouter (zero-config); custom domain optional later (CNAME → switch to BrowserRouter + 404.html copy then). PWA assets generated in build; jsDelivr URLs pinned per release.

## 15. Performance Budget
Core route JS ≤ 200 KB gz (charts + library detail lazy-loaded; Recharts ≈ +140 KB gz on its own chunk) · TTI < 2 s on mid-range Android over 4G · search results < 50 ms for 1,000 exercises (prebuilt index) · 60 fps list scroll (virtualized) · Lighthouse PWA/Perf ≥ 90 enforced in CI via Lighthouse CI (warn-only initially).

## 16. Risks & Mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| iOS evicts IndexedDB (7-day ITP) | Med | Install-first onboarding (exempt), persist(), backup nudges, export; escalate Gist sync to P1 if dogfood shows loss |
| Scope creep kills shipping | **High** | Non-goals table, phase exit gates, parking lot, "add one = remove one" rule |
| jsDelivr throttling/outage | Low | WebP self-host fallback pipeline already scripted |
| Recharts bloats bundle | Med | Lazy chunk; swap to Chart.js if budget broken |
| Novices misuse RPE autoregulation | Med | RPE optional + off by default for 'beginner' wizard path |
| Migration bug corrupts data | Low | Pre-migration snapshots, round-trip tests, versioned envelope |
| Solo-dev burnout | Med | Dogfood from end of P1 (the app trains its developer 5 d/wk — feedback loop is built in) |

## 17. Roadmap & Milestones

| Milestone | Scope | Duration | Exit criteria |
|---|---|---|---|
| M0 Foundation | Phase 0 | ~1 wk | Demo deployed; export→wipe→import lossless |
| M1 Usable logger | Phase 1 | 2–3 wk | 1-week dogfood, 0 data loss, ≤ 2 taps/set |
| M2 Programs | Phase 2 | 2–3 wk | All rules tested; wizard < 2 min |
| M3 Autoregulation | Phase 3 | 3–4 wk | Full mesocycle dogfooded incl. deload |
| M4 Polish/launch | Phase 4 | ongoing | README/demo/badges done; r/weightroom or r/fitness beta post |

Dogfood plan: run your own next training block on M1 the moment it exits; every friction point becomes an issue. Public beta only after M3.

## 18. Open Decisions & Parking Lot

**Open (non-blocking unless noted):**
1. **Name** *(blocking M4 only)* — candidates: Overload, PlateMath, Liftbook, OpenSets. Check GitHub/Pages availability + trademark sniff.
2. Muscle-map figure default (male/female toggle) — decide at P4 integration.
3. FlexSearch vs Fuse.js — spike in P0; FlexSearch default, Fuse if fuzzy matching proves materially better for exercise names.
4. Per-set weight prefill source on swap (substitute's history vs % of original) — decide during P2 with real use.

**Parking lot (explicitly not scheduled):** endurance coaching (running plans, intervals, HR-zone/GPS analytics), nutrition hooks, Apple Watch, social feed, TF.js rep counting, Web Bluetooth HR, native wrappers, cloud accounts, coach/client mode, Liftoscript-style text DSL (only if GUI rule-builder proves limiting).

## 19. Licensing, IP & Attribution
- App code: **MIT**. About screen lists OSS licenses.
- `free-exercise-db`: Unlicense — bundle freely, no attribution required (credit anyway as courtesy).
- Any CC-BY-SA supplements (wger/everkinetic): per-record attribution UI + share-alike on the data — only add if worth the obligation.
- **Never** use ExerciseDB/RapidAPI GIFs or MuscleWiki media (proprietary; offline storage prohibited).
- Program templates: encode **schemes/numbers only** (uncopyrightable methods); write all descriptions in original prose; credit creators by name ("based on Jim Wendler's 5/3/1"); don't imply endorsement; treat program names as descriptive references, not branding.
- YouTube: external links/embeds only; never download/rehost.

---
*Sources: consolidated from the two research reports in this project (competitive analysis & progression science; exercise library & content licensing) — see those documents for citations and evidence.*

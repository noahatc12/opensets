# Generator Research — Evidence Base for a Coach-Grade Program Generator

> **Status:** research input for the Branch-3 generator redesign. Sits beside `strength-app-master-spec.md` and the two `recomp_blueprint*.docx`. Not a build artifact — the design translation in Part 3 feeds the ledger's redesign wave; it is reviewed before any S-phase starts.

---

## READ-ME FIRST — scope, encodability, and boundaries

**1. The PRINCIPLES are the spec; the blueprints are examples.** The two recomp blueprints are *samples of coach-grade output for one persona* (intermediate male, hypertrophy/recomp). They are NOT the generator's target. The generator must produce coach-grade plans across the full onboarding space — every goal (get stronger / build muscle / lose fat / recomp / general fitness / …) × training age (novice / intermediate / advanced) × days × equipment × constraints (injury/avoid, age, sex). **The programming approach DIFFERS by class** and must be encoded as goal-aware logic, not recomp-tuned defaults:
> - Novices need **linear progression and little/no periodization** — the RP-style volume-ramp evolution model is *wrong* for them.
> - Strength needs **direct-set counting, heavier/lower-rep loading, and peaking** — not a volume ramp.
> - Fat-loss / recomp / hypertrophy differ in **volume and cardio balance**, not just rep numbers.

**2. What is encodable vs what must NOT be cloned.** The sports-science principles in Part 1 (per-muscle weekly volume as the master dial, autoregulation, double progression, lengthened-bias selection, RIR targets, deload logic) are **field-standard and freely encodable** — they are the published literature. The pro-app internals in Part 2 (RP Hypertrophy, Juggernaut AI, Fitbod) are **`[Reconstructed]` from public methodology and reviews, not confirmed source code.** Encode the *science*; do **not** clone their proprietary parameter tables or algorithms. This is the **same boundary as the 5/3/1 trademark rule** already in the ledger (we implement the public training-max math, we do not ship Wendler's branded program). Build our own landmark defaults and progression constants from the cited literature.

**3. Confidence tags.** `[Strong]` = well-replicated / adversarially-verified, high confidence. `[Mixed]` = real effect but contested or small-sample. `[Reconstructed]` = app internals inferred from public methodology, directionally accurate, exact constants approximate. Citations are author/year.

**4. RESEARCH GAP — this evidence skews hypertrophy / intermediate / young male.** The verified core (volume, failure, frequency, EMG, selection principles) was researched against the trained-young-male literature and a hypertrophy center of gravity. The following user classes are **under-researched here and must get a dedicated evidence pass before they can be served coach-grade**:
> - **Strength programming specifics** — peaking blocks, intensity progression schemes, %1RM waving, how volume caps lower and intensity carries the load. (We have "strength saturates earlier, lean on load," not the mechanics.)
> - **Novice linear progression** — increment sizing, stall/reset rules, when a novice graduates to intermediate programming.
> - **General-fitness / health goal** — programming for the user who isn't chasing size or a 1RM.
> - **Older lifters (40+/50+)** — volume tolerance, recovery, joint management modifiers.
> - **Female-specific** — volume/recovery differences (commonly observed higher volume tolerance + faster between-session recovery, but less rigorously quantified — `[Mixed]`).
> - **Fat-loss / deficit training** — muscle-retention specifics while in an energy deficit (maintain intensity, manage volume/fatigue).
>
> Until that pass lands, the generator's defaults for those classes are **principled extrapolation, not verified** — label them as such in-product and version them.

---

# PART 1 — THE SCIENCE

## 1. Volume is the master dial — per-muscle, per-week

**[Strong]** Hypertrophy rises with weekly sets *per muscle group* along a **diminishing-returns (square-root) curve** — 100% Bayesian posterior of a positive slope across 67 studies / 2,058 participants (**Pelland, Remmert, Zourdos et al. 2026, Sports Medicine**, PMID 41343037). The master quantity is **fractional sets per muscle per week** — not sets per workout, not tonnage.

Codeable anchors (population averages — expose as adjustable defaults):
- **Minimum effective dose ≈ 4 fractional sets/muscle/week** (Pelland 2026). A competing ~9-set MED threshold was **adversarially refuted (0-3 vote)** and must NOT be coded.
- **Maintenance ≈ 6 sets/muscle/week** when trained ≥2×/week (beginners and advanced).
- **Standard high-yield range: 12–20 sets/muscle/week** for trained young men (**Baz-Valle et al. 2022**). Beyond 20: no significant added quad/biceps growth (p=0.19, 0.59) but **triceps kept responding** (p=0.01) — muscles differ.
- **Efficiency tiers** (Pelland 2026, fractional sets): 5–10 highest return-per-set, 11–18 intermediate, 19–29 lower, 30–42 lowest-but-positive, 43+ unclear.
- Per added set: **+0.023 ES ≈ +0.37% growth** (**Schoenfeld, Ogborn & Krieger 2017**, J Sports Sci).

**[Strong] Fractional set counting.** Indirect/synergist set = **0.5**. Bench = 1.0 chest + 0.5 triceps + 0.5 front-delt. Strongest Bayesian support for predicting hypertrophy (BF=9.48; Pelland 2026). *Goal caveat:* for the **strength** variant, **direct-only counting (indirect = 0)** fit better — the counter's weighting switches by goal.

**MEV/MAV/MRV caveat:** Pelland found **no clear upper plateau** for hypertrophy up to 30–42 sets — in mild tension with a hard MRV ceiling. So MEV/MAV/MRV are **adjustable defaults, not physiological constants**; the ceiling is more fatigue/recovery-bound than growth-bound.

## 2. Intensity & load

**[Strong]** Hypertrophy is similar across **~5–30 reps** *if sets are taken close to failure* (Schoenfeld 2017; Morton 2016). Load is mostly a fatigue/joint-comfort choice within that band.
- **Hypertrophy working zone ~6–20 reps** (heavier on compounds for loadability + strength carryover, lighter on isolations).
- **< ~5 reps:** strength-biased, neural, higher joint/CNS cost per stimulus.
- **> ~30 reps:** growth holds but discomfort hurts adherence.
- **Strength** is load-specific: **~80%+ 1RM, 1–6 reps**, plus *practicing the specific lift* (strength is far more specific than size).

## 3. Proximity to failure — don't mandate it

**[Strong]** Momentary failure gives **no meaningful hypertrophy advantage** over stopping short. **Refalo et al. 2023** (Sports Medicine meta): failure-vs-non-failure ES=0.19 ("trivial"); restricted to true momentary failure ES=0.12, **non-significant** (p=0.34).
- Prescribe a **target RIR/RPE band and autoregulate**. Effective range **0–3 RIR (RPE 7–10)**; most growth lives at **1–3 RIR**.
- Failure costs disproportionate fatigue, worse on big compounds than small isolations.
- **[Strong]** Autoregulated load ≈ fixed load for strength outcomes (MD=2.07 kg, p=0.09, *no* significant difference). Autoregulation's value is **fatigue management + individual fit**, not a magic outcome boost.

## 4. Frequency — a delivery mechanism, not a growth lever

**[Strong]** With weekly volume equated, **frequency has negligible independent effect on hypertrophy** (Pelland 2026 posterior <100%; Schoenfeld frequency metas 2016/2019). It **does** reliably help **strength** (100% posterior).
- **Derive frequency from the volume target** + a per-session quality cap (~6–8 quality sets per muscle per session). Frequency is the *answer* to "how do I fit this volume without junk sessions," not an input dial. Add frequency for the strength variant.

## 5. Exercise selection

**[Strong] Throw out EMG rankings.** Acute surface-EMG amplitude is **not a validated predictor of hypertrophy** (**Vigotsky et al. 2022, Sports Medicine** 52(2):193-199) — "should be met with scrutiny." Most online "best exercise" lists rest on this invalid basis. **Do not rank by EMG.**

Rank instead, in priority order:
1. **Muscle length / resistance profile.** `[Mixed]` Lengthened-position training tends to be superior for hypertrophy and drives **region-specific (distal) growth** (Wolf et al. 2025 review, 8 studies/120 ppl; Havers 2025 RCT: 7.6% vs 4.4% distal elbow-flexor growth, long-length partials). Suggestive, not definitive (small samples, fascicle-length proxies) → **strong tie-breaker, not absolute.** Prefer exercises loading the muscle hard at its **stretched end**.
2. **Stability** — machines/cables → closer to failure, less stabilizer fatigue, lower skill/injury cost; free weights → loadability + sometimes better stretch. Library carries **both roles per muscle.**
3. **Role in session:** heavy compound → stretch-biased accessory → peak-contraction/metabolite finisher.
4. **Longitudinal trials + joint comfort**, not acute EMG.

**Per-muscle shortlist** *(roles derived from the verified principles; per-lift evidence is principle-level, not a separate trial per lift — `[Mixed]`):*

| Muscle | Heavy/loadable | Stretch-biased (lengthened) | Peak/finisher |
|---|---|---|---|
| Chest | Barbell/DB bench, incline press | Deep DB flye, incline DB press, cable flye low→high | Pec-deck, cable crossover |
| Lats | Weighted pull-up, lat pulldown | Straight-arm pulldown, lat-prayer | — |
| Mid-back | Barbell/T-bar row, chest-supported row | Cable row (full protraction) | Reverse pec-deck |
| Front delt | Overhead press | — | — (usually covered by pressing) |
| Side delt | — | (limited stretch options) | DB/cable lateral raise (staple) |
| Rear delt | — | Cable reverse flye | Face pull, reverse pec-deck |
| Biceps | Barbell/EZ curl | Incline DB curl, behind-body cable curl | Spider/preacher, cable curl |
| Triceps | Close-grip bench, weighted dip | Overhead cable/DB extension (long head) | Pushdown |
| Quads | Squat, leg press | Deep squat / deep leg press, ATG split squat | Leg extension |
| Hamstrings | RDL, stiff-leg DL | RDL, seated leg curl | Lying leg curl |
| Glutes | Hip thrust, squat | Deep squat, deficit lunge, RDL | Hip thrust peak, kickback |
| Calves | Standing calf raise (loaded) | Full-stretch bottom on any calf raise | Seated calf (soleus) |
| Abs | Weighted cable crunch | Hanging leg raise, ab-wheel | Crunch variations |

The deep, weighted **stretch** is the recurring selection principle.

## 6. Progression & evolution — the part that makes it "evolve"

Three layers on different timescales. **All three are goal/training-age dependent — see the class table at the end of this section.**

**A. Within-exercise load/rep progression (session→session). [Strong]**
- **Double progression**: work the top of a rep range, then add load and reset to the bottom. **Rep-progression ≈ load-progression for hypertrophy** over 8 weeks (equivalence study, verified). Either works.
- Trigger: top of range for all sets at target RIR → increase load (+2.5–5 lb isolation, +5–10 lb compound), reset to range bottom.

**B. Autoregulated *volume* progression (week→week within a block). [Reconstructed / Strong-principle]** — **for hypertrophy/recomp, NOT novices or strength.**
Start a block near MEV, add sets toward MRV across weeks, then deload. Signals that justify **adding a set** next week (RP "In Defense of Set Increases"): (1) **performance recovery** — strength stable/up; (2) **perceptive recovery** — soreness resolves before next session; (3) **stimulus-proxy decline** — pump/disruption fading despite stable performance. Inverse → **hold or cut** volume. SBS's **"RPE-stop"** is a clean primitive: add sets at a load until a set hits a target RPE.

**C. Plateau detection & response. [Strong-principle]**
- Plateau = no e1RM/load/rep progress across ~2–3 sessions at the same RIR despite adherence.
- Ladder: (1) check recovery/sleep/calories; (2) recovered → deload or **rotate exercise** (stimulus staleness / SFR decay); (3) fatigued → deload.

**D. Deloads. [Strong-principle]**
- **Volume deload** (cut sets ~40–50%, keep load — hypertrophy-preferred) vs **intensity deload** (drop load).
- **Fatigue-driven** beats purely scheduled, but a scheduled deload every **4–8 weeks** is a fine app default; tie it to the end of a volume-ramp block.

**E. Training-age modifiers. [Strong-principle] — THE CLASS ROUTER:**

| Class | Progression model | Volume | Periodization |
|---|---|---|---|
| **Novice** | **Linear** — add load nearly every session (covered by GZCLP/linear) | Low; little need to ramp | Largely **unnecessary** |
| **Intermediate** | Weekly double-progression + **autoregulated volume (B)** | MEV→MRV ramp | Block periodization |
| **Advanced** | Smaller increments, specialization blocks | High tolerance, careful fatigue mgmt | Block + specialization |

> **The single most important correction for OpenSets:** the evolution engine must **route on goal × training-age**. Volume-ramp+RP-signals is correct for hypertrophy intermediates; **linear** for novices; **peaking** (intensity progression toward a 1RM expression, not a volume ramp) for strength. One progression model for all classes is wrong.

## 7. Periodization

**[Strong-principle / Mixed on magnitude]** Hypertrophy mesocycle volume ramp: **accumulation** (volume MEV→MAV/MRV, RPE 7→8) → **intensification/peak** (volume high, RPE 8→9+, sparing intensifiers) → **deload**. Meso **~4–8 weeks**, shorter for advanced. Periodization *style* (linear vs undulating) matters less than **progressive overload + adequate volume + a fatigue reset** all being present. Strength periodization is different — it **peaks** (intensity up, volume down toward a 1RM expression).

> OpenSets' current `mesocycle.ts` already implements the hypertrophy ramp correctly and is **on the right side of the architecture seam — keep it.** The gap is upstream (split/selection/volume *allocation*) and the missing class-routed evolution.

## 8. Surrounding factors a serious program must address

- **Weak-point / lagging-muscle prioritization** — needs a **priority input** + a volume allocator that biases sets toward chosen muscles; ideally **specialization blocks** (one muscle to MRV, others maintain at MEV, rotate).
- **SFR (stimulus-to-fatigue ratio) & rotation** — maximize stimulus per unit systemic fatigue (favors machines/cables/stretch-biased for accessories); **rotate per mesocycle (4–8 wk)**, not weekly, so you can still progressively overload.
- **Individualization** — limb lengths (long femurs → leg press over high-bar squat for quads), injury history (avoid-list), equipment, schedule (days → frequency → volume fit), recovery capacity, **age** (older → more recovery, slightly lower volume), **sex** (`[Mixed]` women often tolerate higher volume / recover faster).
- **Warm-up / ramp** — ramp sets to first working set; joint-specific prep by day (OpenSets S4b).
- **Tempo / TUT** — `[Mixed→weak]` controlled eccentrics reasonable; evidence that *specific tempo* drives more growth is **weak** — don't over-claim.
- **Rest intervals** — `[Strong]` longer rest (~2–3 min compounds, ~60–90 s isolations) **beats short rest** for hypertrophy (Schoenfeld 2016) by preserving per-set volume-load.
- **Recovery** — sleep is the highest-leverage variable; an app should surface readiness and respond to it.
- **Cardio interference** — `[Strong-principle]` worst with high-volume running close to/before lifting and for lower body. Mitigate: cardio **away from leg sessions**, **after lifting**, prefer **cycling/rowing over running**, mostly LISS or short HIIT.
- **Adherence / psychology** — programs fail from too much volume too soon, too much complexity, no autoregulation for bad days, no visible progress. Autoregulation + progress visualization are adherence features.
- **Nutrition (high level)** — protein **~1.6–2.2 g/kg**; energy balance sets bulk/cut/recomp context. Display-only in OpenSets per safety rails.

---

# PART 2 — HOW THE PROS DO IT

*App internals are `[Reconstructed]` from public methodology / reviews — directionally accurate, exact constants approximate. **Encode the science, do not clone these proprietary tables/algorithms** (5/3/1-trademark boundary).*

**Renaissance Periodization (RP Hypertrophy app)** — volume-landmark autoregulation. Engine = **MV/MEV/MAV/MRV per muscle**. A mesocycle **starts each muscle at MEV**, **adds sets week-to-week toward MRV** off logged soreness/performance/pump feedback, hits MRV + peak fatigue → **deload** → restart slightly higher. Within-exercise: double progression + RIR descending across the block (~3 RIR → 0–1). The gold standard for the **hypertrophy-intermediate** class — *not* for novices or strength.

**Juggernaut AI** — RPE-driven *load* autoregulation (strength/powerlifting). Plan an RPE target per set; user logs **actual RPE**; next week's load adjusts (logged > target → smaller bump; logged < target → push harder). Adds a **daily readiness check-in**. Principle: **logged effort moves the load.**

**Fitbod** — `[Reconstructed]` per-muscle **freshness/recovery state** that decays when trained and recovers over days; **selects exercises** each session to hit recovered muscles, rotating movements, respecting equipment. Strong at selection + recovery bookkeeping, weak at long-arc periodization — an "intelligent daily picker," not a "mesocycle coach."

**Dr. Muscle** — autoregulated load + auto-progression, marketed as "more automated than RP."

**Evidence-based coaches** (Israetel/RP, Helms/3DMJ, Nuckols/Stronger By Science, Nippard) converge on the same skeleton: **volume per muscle per week as primary dial → autoregulate volume + load off logged feedback → close to but not at failure → double progression → block periodization with deloads → selection by biomechanics/length not EMG.** They differ on magnitudes (MRV hardness, lengthened-bias size), not architecture.

**What separates an intelligent generator from a template-filler:**
1. Models **per-muscle weekly volume as a tracked quantity** (start/target/ceiling), not a fixed number.
2. **Reads logged feedback** (performance, soreness, RPE, readiness) and **changes next week's prescription** — volume and load.
3. **Selects by role + biomechanics** from a curated library, with rotation, not first-match.
4. **Takes the inputs that drive all of that** — goal, split, frequency, priority, experience, equipment, injury/avoid — and **composes** the program, **routing the whole approach on goal × training-age.**

A template-filler does none of these. That is exactly the current OpenSets gap.

---

# PART 3 — WHAT OPENSETS MUST ENCODE (design translation)

Goal-aware components (detail + sequencing live in the ledger's redesign wave):

**1. Goal-aware preference + state inputs** (onboarding capture, keystone like S1): goal, split-choice, days/week, experience, equipment (some exist) **+ priority/lagging muscles, injury/avoid-list, sex, age.** Per-muscle weekly-volume state on the program `{muscle:{current,MEV,MAV,MRV}}`, seeded from landmark data (the `MUSCLE_VOLUME` table in `mesocycle.ts` is the right data, currently decorative).

**2. Volume allocator** (replaces flat `sets:3`): per-muscle weekly target = MEV at block start ramping toward MRV; **per-muscle, not a uniform multiplier**; priority muscles biased up; **distributed across days** capping ~6–8 quality sets/muscle/session (this creates within-muscle doubling + the set gradient + derives frequency). **Counting method (fractional vs direct) and target bands vary by goal/training-age** (hypertrophy 12–20 priority; strength lower + heavier; novice low).

**3. Selection model** (replaces deterministic argmax): role-based per-muscle library (heavy/stretch/peak from the Part 1 table, **not EMG**); **varied N-picks** per muscle to fill its quota; **lengthened-bias tie-breaker**; **rotation seed** (rotate by mesocycle, not weekly); **avoid-list** filter; **role emphasis shifts by goal**. Keep S2's `score()` as the per-role ranker (return N varied, respect role). **Fix the cue/tempo binding to the EXERCISE, not the movement-pattern slot** (kills the "hip-thrust with a hamstring cue" bug).

**4. Split designer** (replaces `splitForDays` lookup): goal/training-age-appropriate splits + specialization days, composed from split-choice + days + priority — **not one hardcoded model** (novice → full-body/UL; hypertrophy intermediate → PPL+arms / upper-volume; strength → focus-lift days).

**5. Evolution engine (NET-NEW, not in S1–S12):** the **progression model is goal/training-age-routed** — **linear** (novice), **volume-ramp + RP-style signals** (hypertrophy/recomp intermediate), **peaking** (strength) — reading logged performance + readiness to set next week's volume/load. Needs a **post-session readiness/soreness logger input** (one tap). This is the "evolves over time" capability and OpenSets has none of it today.

**Preserve what stands:** S3 periodization + S4 prescription render are on the right side of the seam — **keep them**. S7 (cardio) / S8 (nutrition) / S9 (bands/goals/rails) are architecture-independent — **interleave**.

---

## Sources spine
Pelland/Remmert/Zourdos 2026 (Sports Medicine, dose-response, PMID 41343037); Baz-Valle 2022 (volume ranges, PMC8884877); Schoenfeld/Ogborn/Krieger 2017 (volume, J Sports Sci), 2016 (frequency; rest intervals); Refalo 2023 (failure, PMC9935748); Vigotsky 2022 (EMG-invalid, DOI 10.1007/s40279-021-01619-2); Wolf 2025 / Havers 2025 (lengthened-position, PMC12621570); autoregulation meta (RPE≈fixed for 1RM); RP volume-landmark + set-increase methodology; Juggernaut AI / Fitbod public methodology. Generated via adversarially-verified deep-research pass (24 sources fetched, 25 claims 3-vote verified, 1 refuted) + domain synthesis; 2026-06-28.

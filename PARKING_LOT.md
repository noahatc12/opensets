# Parking Lot

Out-of-phase ideas and deferred work. Per the scope rule, anything valuable that belongs to a later phase lands here instead of getting built now. Adding a feature to a phase means removing one of equal size (spec §3, §5).

## Deferred to a later phase (from the spec's own roadmap)
- **CSV import (Strong/Hevy)** — P1 (§12). Header sniffing + exercise-name mapping UI.
- **CSV export to Strong/Hevy** — P1 refinement (anti-lock-in signal).
- **Progression engine rules beyond linear/double** — P2 (5/3/1, GZCLP, RPE, APRE, durationLinear).
- **Plan generator wizard v2** — P2 (§6.6).
- **Mesocycle builder, readiness check-ins, plateau detection, volume heatmap, analytics, goals, Gist sync** — P3.
- **Muscle-map browser, YouTube embeds, custom-exercise photos, program share links, Spanish i18n, README-as-portfolio** — P4.

## Explicitly not scheduled (spec §18 parking lot)
- Endurance coaching (running plans, intervals, HR-zone/GPS analytics)
- Nutrition/macros hooks
- Apple Watch / wearables, native wrappers
- Social feed, comments, coach/client mode
- TF.js rep counting, Web Bluetooth HR
- Cloud accounts
- Liftoscript-style text DSL (only if the GUI rule-builder proves limiting)

## Open decisions (spec §18 — resolve at the noted phase)
1. **Product display name** — locked to "OpenSets" for the repo slug; spec said name is "blocking M4 only," revisit before launch if desired.
2. Muscle-map figure default (male/female toggle) — P4.
3. FlexSearch vs Fuse.js — spike in P0; FlexSearch default, Fuse only if fuzzy name-matching proves materially better.
4. Per-set weight prefill source on swap (substitute history vs % of original) — P2.

## Phase 0 ideas noticed but deferred
_(none yet)_

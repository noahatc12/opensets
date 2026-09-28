# OpenSets redesign: the port plan and coverage ledger

Started 2026-09-27. Branch `redesign/editorial`, cut from `feat/body-aware-start` (phase 2), so the
new UI is built on the corrected engine and database, not on July's main.

## What this is

Noah designed a full replacement UI in Claude Design on 2026-09-25 ("App redesign planning",
project `3a85f014-dbba-465e-8430-df8c4ef3b600`, file `OpenSets Redesign.dc.html`). His brief to
the design tool: every screen, a bold new visual direction, one fully working clickable prototype,
because the current app "feels really clunky and not high quality". His brief to this port
(2026-09-27): "I actually want to use it", "every single thing thought out", "make it look like a
paid app".

**The prototype is the spec for how the app looks and moves.** The vendored copy lives in
`design/handoff/redesign-2026-09-25/`, and the 70 reference shots in `design/redesign-ref/` are the
bar every ported surface is checked against. We port its markup and CSS values; we do not
re-interpret them. Where the prototype's fake engine disagrees with the real one, the real engine
wins and the copy is adjusted to tell the truth (see "Where the prototype lies").

The spec (`docs/strength-app-master-spec.md` v2.0) still governs what the app does. The redesign
changes how it looks and feels, not the feature list. The Branch 3 scope ledger in
`tasks/projects/opensets.md` (JARVIS) stays the feature backlog.

## The look, committed

```
STYLE: Editorial athletic (Noah's choice in Claude Design). Ink on near-black, one hot accent,
       very large condensed numerals, mono eyebrows, hairline rules, 4px radii.
Because: a logger is read at arm's length between sets with a shaking hand; the numerals ARE
       the interface, everything else is quiet.
Typeface: Archivo (variable, wdth 62..125 + wght) for UI and numerals; JetBrains Mono for
       eyebrows, meta and set lines. Both self-hosted (fontsource, OFL). No Google Fonts call.
Palette (dark): bg #0C0C0B, s1 #161614, s2 #23221F, ink #EFEDE6, mute #9C988E, faint #6A665E,
       danger #EE6A4F, ok #7CC796, pr #FFD24A. Light: bg #EEEBE3, s1 #F9F7F2, s2 #E0DCD1,
       ink #0C0C0B, mute #57534B, faint #8F8A7F.
Accents: Signal #FF5A1F (default), Volt #C6F03A, Teal #1FE0C4, Brass #CDA35F, each with an
       ink-on-accent colour and a text-on-surface variant per mode.
Layout: single column, 20px gutters, sections opened by a 2px ink rule, stat grids as 1px-gap
       tables, five-tab bar (Today, Plan, Library, Trends, You).
Depth: one technique only, tone steps (bg / s1 / s2). No shadows except the toast.
Motion: sheets slide up 280ms on cubic-bezier(.2,.8,.2,1); toast 220ms; PR numeral springs
       600ms on (.34,1.4,.5,1); pulse dot on the live session; buttons scale .985 on press.
       All gated by prefers-reduced-motion in the port (the prototype does not gate).
The one bold thing: the 84px condensed screen title and the 92px set numerals.
Tell-risk accepted: dark by default and uppercase mono labels. Both are the brief; the
       prototype is dark-first and the eyebrow labels are its structure, not decoration.
```

## Where the prototype lies (and the port tells the truth)

| Prototype | Real app | Port decision |
|---|---|---|
| 30 hand-picked lifts | 873-exercise catalog with images and instructions | Full catalog. Library keeps the prototype layout; "best e1RM" column reads from real sets. |
| One rule: double progression, "+inc when every set hits the ceiling" | Nine rules (linear, double, 5/3/1, GZCLP, RPE, APRE, reps-only, duration, manual) with a `reason` string per prescription | The WHY line shows the engine's real `reason`. The Plan footer describes the program's actual rule, not "double progression". |
| Flat starting weights per lift | Body-aware starting weights (phase 2) and a `suggested` flag | Keep phase 2's "Suggested start" copy in the WHY slot when the flag is set. |
| Weight stepper: 2.5 lb under 20, else 5 | Load-type ladders (barbell, dumbbell, stack, bodyweight) from phase 2 | Real ladders. |
| Plates: PLATES const, per-pair toggles | `plateInventoryLb` in settings, `platesForWeight()` in the engine | Real inventory; the You screen toggles edit it. |
| localStorage blob, Export writes one JSON | Dexie, versioned export envelope, pre-import snapshot, confirm sheet | Real export/import. Import confirm is the prototype's confirm sheet. |
| Rest: one default, per-slot rest | Rest tiers (heavy / compound / accessory / isolation / pump) and warm-up rest | Show the slot's real rest; You screen keeps "Default rest" and exposes the tiers under it. |
| No warm-ups, no timed or cardio sets | Warm-up ramp exists but is dead (ledger 1.4); timed sets missing (1.2) | Out of scope for the port; stays on the Branch 3 ledger. The set rows are built so a warm-up row can be added without redesign. |
| Sample data: 8 weeks generated | `seedSampleData()` | Real seed. |
| No profile, protein or mesocycle | Profile (sex, age, height, bodyweight), protein card, mesocycle week/block | Keep all three. Protein card takes the prototype's stat-grid style; the mesocycle week reads in the Plan eyebrow ("Week 3 of 6 · Accumulation"). |
| Goals, measurements, photos absent | Present in Settings today | Move under You → "Body" rows in the prototype's list style. |
| Theme: 1 look, 4 accents, light/dark | 11 themes, custom picker, two skins (Tempo, Readout) | See decision D1. |
| Onboarding: 5 questions | Wizard with profile step, avoid-list, split choice | Prototype's question layout, real steps (goal, experience, days, equipment, body). |

## Decisions needed from Noah

- **D1 Theme engine.** The redesign is one look with four accents. Proposal: retire the 11-theme
  engine, the custom theme picker and both old skins once every screen is ported; until then the
  new skin is `data-ds="editorial"` beside them. Standing rule 3 ("theme engine frozen") and
  rule 1 ("Readout is the single active logger") are superseded by this redesign. Default if he
  says nothing: proposal stands.
- **D2 Phase 2 merge.** The branch is cut from phase 2, so phase 2 lands with the redesign. If he
  wants phase 2 reviewed and merged first, the redesign rebases cleanly. Default: merge phase 2
  first as its own PR when he has looked at the shots.
- **D3 Numerals toggle.** The prototype has a "standard numerals" tweak. Proposal: ship condensed
  only; a toggle is a setting nobody asked for. Default: condensed only.

## Build sequence (one shippable unit per step, screenshot-verified against the reference)

| Step | Scope | Reference shots | Status |
|---|---|---|---|
| R0 | Vendor prototype, capture reference, plan | all | done 2026-09-27 |
| R1 | Tokens (`data-ds="editorial"`), Archivo self-hosted, shell, five-tab bar, You tab route, primitives (Eyebrow, Display, StatGrid, Sheet, Toast, Keypad, ActionBar) | you, today, sheets | in progress |
| R2 | Today: all states (fresh, plan-no-history, resume, in-progress mini bar), week strip, stat grid, recent | today, today-bottom, fresh-today, today-mini-bar | |
| R3 | Active session: header, exercise strip, WHY, set rows, numeral pad, steppers, keypad sheet, plate sheet, RPE, rest bar, log CTA, toast+undo, PR overlay, swap/skip/add picker | session, session-logged-rest, sheet-keypad, sheet-plates, pr-celebration, session-toast-undo, sheet-picker | |
| R4 | Summary (live and past), discard confirm | summary, sheet-confirm | |
| R5 | Plan + routine builder + add-to-routine sheet | plan, builder, sheet-to-routine, fresh-plan | |
| R6 | Library + exercise detail (chart, how-to, history) | library, detail, fresh-library | |
| R7 | Trends (range, lift chips, e1RM chart, volume bars, PR feed) | trends, trends-bottom, fresh-trends | |
| R8 | You: stats, units, appearance (mode + 4 accents), training (rest, bar, plates), body rows, data (export, import confirm, sample, erase) | you, fresh-you | |
| R9 | Onboarding wizard in the prototype's layout, with the real steps | onboarding-1, onboarding-preview, fresh-onboarding-* | |
| R10 | Remove old skins, theme engine, dead routes; DESIGN.md updated; design check green; app-tester pass; em-dash sweep of all UI copy | | |

Each step ends with: tests green, `npm run design:check` on the ported routes, a side-by-side
sheet (reference vs port, dark and light, 390px) published for Noah, and a commit.

## Verification harness

- `scripts/ref-capture.mjs` and `scripts/ref-capture-fresh.mjs` regenerate `design/redesign-ref/`
  from the vendored prototype (serve `design/handoff/redesign-2026-09-25/` on a local port; the
  prototype loads React from unpkg, so the capture needs network).
- `scripts/design-shot.mjs` (the deterministic design check) runs against the port; `DESIGN.md`
  gets the new token prefixes when R1 lands.
- The port's own screenshot script (R1 adds `scripts/redesign-shot.mjs`) captures the same
  screen list at the same size so the two folders diff by filename.

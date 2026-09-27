# OpenSets premium build: the brief for the builder session

Written 2026-09-27 by the PRIMARY JARVIS session for the WORKER session Noah opens as "the
builder for OpenSets". Everything a cold session needs is here or linked. Read it top to bottom
before the first edit.

## The ask, in Noah's words

> I want you to update the whole OpenSets app with the design that you showed me with the notes
> I made. I want you to fix everything and then push all that to the Git page.

"The design" is the premium direction he approved ("so much better than any of the other things
... felt really premium ... whatever you did to get to this design worked really good"). "The Git
page" is the live GitHub Pages deploy, which runs from `main` through `.github/workflows/ci.yml`.

## Where things are

| Thing | Location |
|---|---|
| Worktree and branch | `C:\Users\noah_\Projects\opensets-redesign`, branch `redesign/editorial`, cut from `feat/body-aware-start` (phase 2 fixes: load types, day rotation, body-aware starts). `node_modules` installed. |
| The approved design, rendered | https://claude.ai/artifact/AzZhCnwWbcd1c4motyj91L (14 phones). Source vendored at `design/handoff/premium-2026-09-27/` (`premium.html` is the markup per screen, `premium.css` the values, `rendered.html` the whole page). Open `rendered.html` in a browser to look at any screen. |
| Noah's notes on each screen | In the artifact's `feedback` collection; transcribed as the punch list below. |
| Token layer, already written | `src/styles/editorial.css` (dark and light), imported from `src/index.css`. `data-ds="editorial"` is the skin id; `data-theme="signal"` is the single accent; `data-mode` dark or light. Manrope is self-hosted (`src/styles/fonts.css`). |
| Primitives, already written | `src/ui/Sheet.tsx` (Sheet, SheetHeader, ConfirmSheet), `src/ui/Keypad.tsx` (KeypadSheet), `src/ui/Toast.tsx`, `src/ui/StatGrid.tsx` (StatTiles, ScreenTitle, BackButton, SectionHead). CSS classes in editorial.css: `os-card`, `os-card--lift`, `os-card--hero`, `os-tile`, `os-row`, `os-chev`, `os-btn` (`--pri`, `--ink`, `--sm`, `--danger`), `os-chip` (`--on`, `--acc`), `os-seg`, `os-step`, `os-icon-btn`, `os-search`, `os-press`, `os-tabs`/`os-tab`, `os-scrim`, `os-sheet`, `os-grab`, `os-toast`, `os-num`, `os-t`, `os-h1`, `os-h2`, `os-fade-under`, `os-pulse`, `os-pr-pulse`. |
| Shell, already written | `src/App.tsx` (relative shell, `ErrorBoundary` per route, five tab routes, `/appearance` redirects to `/settings`), `src/components/TabBar.tsx` (floating glass island; the active pill is inset 6px so its 27px radius is concentric with the 33px island: Noah's Today note). |
| Theme registry | `src/theme.ts` (`PREMIUM_THEME`), `src/state/theme.ts` migrates any stored selection to the premium skin. Dark and Light only. |
| Data and engine | Untouched and must stay untouched: `src/engine/**`, `src/db/**`. The screens are presentational shells over `useLogger`, `useActiveWorkout`, the repositories and the live queries already in each screen. |
| Checks | `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, `npm run design:check` (needs `npm run preview` running; see `scripts/design-shot.mjs`). Playwright is installed; `scripts/ref-capture.mjs` shows how a screenshot script is written here. |

## Rules that hold for the whole build

1. **Real engine, real data.** Every number on screen comes from Dexie or the engine. No sample
   constants in components. `seedSampleData()` stays the only sample path.
2. **One look.** No accent picker. You screen offers Dark and Light only. Remove the Appearance
   route's link; `CustomThemePicker.tsx` and `AppearanceScreen.tsx` can be deleted once nothing
   imports them.
3. **Keep the test contracts.** `src/features/log/ActiveSession.test.tsx`,
   `TodayRotation.test.tsx`, `ProteinCard.test.tsx`, `PlatesSteps.test.tsx`,
   `SettingsImport.test.tsx`, `ErrorBoundary.test.tsx` query by role and text. Keep the aria
   labels `increase weight`, `decrease weight`, `increase reps`, `decrease reps`, `Next exercise`,
   `Previous exercise`, buttons named `Finish`, `Skip`, `Replace data`, the RPE buttons named by
   their number, the text `Rest`, `Per hand`, `Suggested start`, `2 to 3 more`, `Block 2 started`,
   the program name on Today. Where the design changes a flow (Finish now opens a summary before
   saving), update the test to the new flow in the same commit and say so.
4. **No em dashes, no ampersands, no injected filler words anywhere in UI copy.** Sweep
   existing copy too: `grep -rnP "\x{2014}|&(?!amp;|#)" src/features src/i18n src/components`.
5. **Commit per screen** with a message that names what the screenshot showed. Never report a
   screen done without having looked at it at 390px in both modes.
6. **Motion is part of the design.** Press scale 0.97 (`os-press`), sheets rise (`os-sheet`),
   toast rises, PR numeral springs then pulses (`os-pr-pulse`), rest ring drains, all gated by
   `prefers-reduced-motion` in editorial.css already. Use these classes; do not invent new
   animations per screen.
7. **Contrast.** Small text uses `--mute` or brighter; `--faint` is for disabled and decorative
   marks only. The design check's contrast rule fails the build otherwise.

## Screen by screen, with Noah's notes folded in

Reference for each is the matching `<article data-screen="…">` in `premium.html`.

1. **Today** (`src/features/log/TodayScreen.tsx`). Title block, hero card "Up next · Day n of N"
   with exercise chips (name and weight, `↑` when the prescription rose) and an ink "Start
   workout" button inside the hero; a ring card for the week (sessions done of templates count,
   day strip Mon..Sun); two tiles (volume 7 days, last record with exercise and days ago); recent
   sessions as rows in a card. Keep the resume banner, the "Block n started" line and the
   `ProteinCard` (restyle it as a tile or a card row). Empty state: the hero becomes "No plan yet"
   with Build my plan, Build manually, Load sample data (see `dark-fresh-today` in
   `design/redesign-ref/` for the tone).
2. **Log a set** (`ActiveSession.tsx`). Top: back (leave), title and elapsed, Finish chip.
   Exercise strip chips. Exercise name, WHY strip (the engine `reason`; keep the expandable
   detail), active-set card: two numerals with steppers, **tap a numeral to open `KeypadSheet`**,
   per-side plates row (see 3), RPE as an `os-seg` 6..10. Done rows above, up-next rows below.
   Swap / Skip / Add. Bottom: CTA "Log set n · w × r". **Noah:** the per-side plate readout must
   follow the draft weight live as the steppers move (compute from `weight`, not from the
   prescription): `platesForWeight(weightLb, settings.barLb, settings.plateInventoryLb)` from
   `src/engine`. Show it only for barbell load types.
3. **Plate math sheet.** Opens from the per-side row. Draws the bar: sleeve, then the plates
   (largest inboard), then the collar OUTSIDE the plates (**Noah: the notch was inside the
   plates; wrong**). Real colours: `--p45 --p35 --p25 --p10 --p5 --p2` map to 45/35/25/10/5/2.5
   lb (kg users: 25 red, 20 blue, 15 yellow, 10 green, 5 white, 2.5 red, 1.25 chrome). Rows: each
   side, bar, your plates. If the weight cannot be loaded exactly, say by how much.
4. **Rest** (in `ActiveSession.tsx`). When `rest` is set, the bottom area becomes a sheet-like
   panel with a draining ring (`restRemain / durationSec`), the staged next set, −15 / +15 /
   Skip. Buzz at zero if `navigator.vibrate` exists. **Noah:** the "Done" and "Next" tags on the
   set rows must right-align to the same edge.
5. **New record** (`PrCelebration.tsx`). Full-bleed gold, "New record", the e1RM numeral with
   `os-pr-pulse` (**Noah: add a pulse on the number**), exercise name, "w × r · previous best",
   one "Keep going" button. Keep the props.
6. **Summary.** New step: Finish opens a summary view over the session (title "Nice work.",
   tiles Time / Sets / Volume / Records, per-exercise rows with their sets and a PR mark) with
   "Save workout" (calls the existing `finish()`), "Keep training" (back), "Discard" (ConfirmSheet
   then: soft-delete the session's sets and complete without advancing, or if that needs new
   repository code, leave Discard out and say so in the commit). Update the Finish test.
7. **Plan** (`PlanScreen.tsx`). Week card (week n of N, block, phase, six-segment bar). Each day
   as a card; **Noah: tapping a day expands it to its exercises and collapses the open one
   (accordion, one open at a time)**; the next day is lifted with an accent ring and a Next chip;
   Edit and Start on the expanded day (Start = `startSessionFromTemplate` then `beginSession`).
   Bottom: New day, Regenerate.
8. **Routine builder** (`RoutineBuilder.tsx`). Keep its logic (it creates a new program with one
   day). Title is an input styled as the 32px title with NO underline (**Noah**). No "Saved" pill
   (**Noah**); save via the primary button at the bottom. Each exercise a card with number, name,
   meta, a drag handle; sets / rep floor / rep ceiling as mini steppers. Reorder: pointer drag if
   it can be done cleanly in a day, otherwise up/down arrows and a note in the commit. Add
   exercise opens the picker sheet.
9. **Add exercise sheet** (`ExercisePicker.tsx`). Becomes a `Sheet` at 78% height: title, Cancel,
   search field, muscle chips, rows (thumb, name, muscle · equipment · best e1RM if logged) with
   a plus chip. Keep Virtuoso and the search index.
10. **Library** (`LibraryScreen.tsx`). Title "873 exercises / Library", search, chips, "Your lifts"
    card (exercises with logged sets, best e1RM right-aligned), then the full list in a card.
    Keep filters and the filter sheet (restyle as `Sheet`).
11. **Exercise detail** (`ExerciseDetailScreen.tsx`). Back, eyebrow (muscle · equipment ·
    mechanic), title, three tiles (best e1RM, last top set, sessions), trend card (area under the
    accent line, PR dots in `--pr`), How to card, History card (per session: date and day name,
    sets, best e1RM), image carousel can stay above the tiles. Bottom: "Add to a day" (ink).
12. **Trends** (`HistoryScreen.tsx`). Delete the Tempo/Readout split; one layout. Range seg (4W /
    12W / All), lift chips (the exercises with the most eligible sets, first selected), e1RM card
    with delta, three tiles (sessions, sets, volume), weekly volume card (keep the by-muscle bars
    the current screen computes, styled as in the reference), records list (sets with `isPR`).
13. **You** (`SettingsScreen.tsx`). Title "Settings and data / You", three tiles (workouts,
    lifted, records), Units seg, Appearance seg (Dark / Light, writes `useThemeStore.update`),
    Training card (Default rest, Bar and plates with colour dots, Rest by lift type), Body card
    (Profile, Bodyweight, Goals, Measurements), Your data card (Export, Import with the existing
    confirm as a ConfirmSheet, Load sample data, Erase all data with ConfirmSheet), storage
    status, privacy card. Remove the Appearance row.
14. **Plates** (`PlatesScreen.tsx`). Same logic; plate rows carry the real colour disc; bar
    weight seg; jumps rows as segs.
15. **Onboarding** (`OnboardingScreen.tsx`). Progress bar with "n of 5", one question per step as
    the 30px title, options as cards with an icon tile and a radio dot. **Noah: icons must mean
    something.** Goals: Build muscle = dumbbell, Get stronger = barbell with plates, Stay fit =
    heart-rate line, Lean out = downward trend line, Recomposition = two arrows crossing. Keep
    every existing input (days, equipment, split, experience, the numbers step, priority
    muscles) in the new styling. **Noah: suggested starting weights from sex and bodyweight to
    fine-tune.** The generator already seeds `startWeightLb` per slot from the profile; show it
    in the preview step next to each exercise, and say "Suggested from your body data, fine-tune
    in your first session."
16. **ProfileScreen, GoalsScreen, MeasurementsScreen, RestDefaultsScreen.** Not in the reference.
    They already inherit the palette and radii through the token bridge. Reskin their headers
    with `BackButton` + `os-h1` and their groups with `os-card` + `os-row`; nothing else.

## Verification before merge

1. `npm run lint && npm run typecheck && npm test && npm run build` all green.
2. `npm run preview` then `npm run design:check`. Fix contrast and target-size findings; other
   findings get a one-line defence in the commit or a fix.
3. A screenshot pass at 390×844, dark and light, of every route above plus the sheets and the
   record overlay, saved to `design/redesign-shots/` (write `scripts/redesign-shot.mjs` after
   `ref-capture.mjs`). Look at every one. Compare against `design/handoff/premium-2026-09-27/`.
4. The em-dash and ampersand sweep returns nothing in `src/`.

## Shipping

`main` deploys to https://noahatc12.github.io/opensets/ through CI. Noah has asked for this to
ship. When the checks above pass:

```
git checkout main && git pull --ff-only
git merge --no-ff redesign/editorial -m "OpenSets premium redesign (2026-09-27)"
git push origin main
gh run watch   # CI: lint, typecheck, coverage, build, Pages deploy
```

Phase 2 (`feat/body-aware-start`) lands with it because the branch is cut from it; say so in the
merge commit. If CI fails, fix on `main` in a follow-up commit; do not force-push.

## Reporting back

The PRIMARY session closes the JARVIS state layer. Leave a handoff at
`C:\Users\noah_\OneDrive\Desktop\JARVIS-v3\handoffs\{YYYY-MM-DD_HHMM}_opensets-premium-build.md`
with: commits made, what shipped, what was left out and why, the shots folder, and anything
Noah should look at on his phone. Do not run wake.py or close.py and do not write JARVIS state
files.

# OpenSets — Engineering Handoff

A privacy-first strength-training tracker. This bundle is the design contract:
the **literal token CSS + theme system + typed React primitives** you port
verbatim, plus the **HTML prototype** that is the source of truth for every
screen's markup, copy, and layout.

> The HTML files in `reference/` are design references built in HTML — they are
> the canonical look/behavior. Recreate them in your React + TS + Tailwind v4
> codebase using the real files in this bundle. They are **hi-fi**: colors,
> type, spacing and interactions are final — match them pixel-for-pixel.

---

## What's in here

| File | What it is | How to use |
|---|---|---|
| `theme.css` | **The entire token contract.** Type/spacing/radius/shadow/motion scales + the full color system (base modes, 10 curated themes, custom-theme rules, 2 design templates). | Port verbatim. Optional Tailwind v4 `@theme` bridge is at the top. |
| `theme.ts` | Theme system in TypeScript: typed axis registries, curated-theme list, color math, and `deriveCustomTheme()` — computes a full coherent palette from a user's base + accent. | Import for the theme editor + custom themes. |
| `primitives.tsx` | Button, Input, NumberStepper, SegmentedControl, Card, ListRow, Chip, ProgressBar, RestTimerBar, Sheet, Toast, EmptyState, TabBar. | Port to your component lib. Every color is a token. |
| `SetRow.tsx` | The **SET-ROW** — all 5 states (prescribed / active / done / failed / amrap) + the rest-timer pairing. | The heart of the logging screen. |
| `icons.tsx` | Inline `currentColor` SVGs (nav + glyphs + logo). | Drop-in. |
| `fonts.css` | `@font-face` for the 3 self-hostable faces + global keyframes. | Vendor the woff2s into `/public/fonts`. |
| `reference/` | The HTML prototype (`OpenSets.dc.html`) + the two design directions + image assets. | **Open in a browser** to read exact markup, copy, and every screen. |

To view the prototype: open `reference/OpenSets.dc.html`. Navigate via the
in-app tab bar and settings → appearance to exercise every theme, mode, and the
two design templates.

---

## The theming model (read this first)

Three **orthogonal** axes, all set as `data-*` attributes on one ancestor
element. Everything downstream reads `var(--token)` — no component hard-codes a
color, so all three axes compose freely.

```html
<div data-mode="dark" data-theme="tempo" data-ds="tempo"> … app … </div>
```

| Attribute | Values | Controls |
|---|---|---|
| `data-mode` | `dark` · `light` | neutral surfaces, 3 text tiers, shared semantics, shadows |
| `data-theme` | `tempo` `teal` `graphite` `steel` `volt` `ember` `clinic` `midnight` `rose` `pine` `custom` | `--accent`, `--accent-hover`, `--accent-ink`, `--pr`. A few (steel/volt/midnight) also retint neutrals. |
| `data-ds` | `tempo` · `readout` | the whole **design language**: font stack, numeral face, radius scale, label treatment, card borders. |

**Two design templates** (`data-ds`) — the Stage-1 directions, both shipped:
- **Tempo** — calm/premium. Hanken Grotesk, soft surfaces, generous radii, the
  numeral breathes. *(default)*
- **Readout** — technical/instrument. Inter UI + JetBrains Mono tabular
  numerals, hairline borders, sharp radii, near-black ground, caps labels.

Use `applyTheme(el, { mode, theme, ds, custom })` from `theme.ts` to set all
three at once.

### Custom themes
The theme editor lets a user pick a **base ground + accent**. Two equivalent
derivations, both in this bundle:
1. **CSS path** (what the prototype uses): set `data-theme="custom"` + three
   seed vars (`--seed-bg`, `--seed-accent`, `--seed-ink`); the
   `[data-theme="custom"]` rules in `theme.css` derive surfaces/borders/text
   tiers with `color-mix(in oklab …)`. `applyTheme()` does this.
2. **JS path** (`deriveCustomTheme()` in `theme.ts`): computes the same full
   palette in JavaScript (oklab mix ported), returns every token — use when you
   need the values outside CSS (charts, canvas, native).

`--accent-ink` (text/icon ON the accent) is computed from the accent's
luminance: light accent → near-black ink, dark accent → white. See `inkFor()`.

---

## Token quick-reference

- **Color:** `--bg --surface --surface-2 --elevated --border --border-strong
  --border-card --text --muted --faint --accent --accent-hover --accent-ink
  --pr --success --warning --danger --chart-1…6`
- **Type:** `--font-sans --font-num --font-label`; sizes `--text-2xs…3xl`;
  scoreboard numerals `--num-sm/md/lg/xl`; weights `--fw-*`; line-heights
  `--lh-*`; tracking `--tracking-*`. Numerals always pair with
  `font-variant-numeric: tabular-nums` and weight `var(--num-weight)`.
- **Space:** `--sp-1…16` (4px base). **Radius:** `--r-xs…2xl`, `--r-pill`.
  **Touch:** `--touch-min: 48px` (never smaller for primary targets — gym
  constraint).
- **Motion:** `--ease-out --ease-in-out --ease-spring`; `--dur-fast/base/slow`.
- **Template knobs** (set per `data-ds`): `--num-weight --label-tt --label-ls
  --border-card`.

---

## SET-ROW states (`SetRow.tsx`)

| state | meaning | treatment |
|---|---|---|
| `prescribed` | not yet attempted | muted weight×reps, target reps shown |
| `active` | performing now | accent-bordered hero card: weight/reps steppers, RPE 7/8/9, Log button |
| `done` | hit ≥ target | solid text + check; PR badge if a record |
| `failed` | below target reps | danger hairline border, value muted, `reps/target` |
| `amrap` | as-many-reps-as-possible | like active, reps open; PR badge on completion |

The component never branches on `data-ds` — the two templates restyle it purely
through tokens.

---

## Screens (markup is literal in `reference/OpenSets.dc.html`)

1. **Active logging session** — header (routine · elapsed), per-set list with
   the SET-ROW hero, "why this weight" rationale, rest-timer bar, log CTA,
   swap-exercise sheet, PR celebration overlay.
2. **Today hub** — scheduled session card → start; week-volume + streak stats;
   recent history list.
3. **Routine builder** — exercise list, set/rep/rest prescriptions, reorder.
4. **Exercise library** + **exercise detail** — search, primary-muscle &
   equipment chips; detail with engagement bars, your cue, history.
5. **History + analytics** — time-range segmented control, e1RM trend chart
   (`--chart-*` + accent area), intensity distribution.
6. **Onboarding / plan generator** — 6-step wizard (progress bar, `obStep`),
   ends at the generated plan; privacy note ("data never leaves your device").
7. **Settings + theme editor** — mode toggle, design-template picker, 10 curated
   themes + custom (grid / spectrum / sliders color pickers), plates, rest
   defaults, measurements, goals, backup.

---

## State model (from the prototype)

- `screen` — current view; `ds` / `mode` / `theme` — the three axes.
- Custom-theme picker: `accentHue / accentSat / accentLight / baseHue`,
  `pickerOpen`, `pickerTab` (`grid|spectrum|sliders`).
- Session: `weight`, `reps`, `rest` (sec) + `resting`, `toast`, `celebrate`
  (PR), `whyOpen`, `sheetOpen`.
- Onboarding: `obStep` (0–5).

PR rule in the prototype: a set logs a PR when `reps ≥ 11 || weight ≥ 86` —
replace with your real e1RM comparison.

---

## Fonts & assets

- **Fonts** (`fonts.css`): Hanken Grotesk, Inter, JetBrains Mono — all OFL,
  self-host the variable woff2 in `/public/fonts`. No CDN. Falls back to
  system stacks if you skip vendoring.
- **Icons** (`icons.tsx`): inline SVG, `currentColor`.
- **Image assets** (`reference/assets/`): `muscle-figure-dark/light.png` is an
  optional anatomical figure for the exercise-detail engagement panel (the
  prototype currently renders the engagement bars without it).

---

## Accessibility

- `prefers-reduced-motion` is honored in `theme.css` (kills animations).
- Primary hit targets ≥ `--touch-min` (48px).
- `--accent-ink` guarantees readable text on every accent (luminance-derived).

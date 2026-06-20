# OpenSets — Design Brief for Claude Design

> Paste this into Claude Design. It asks for direction explorations first, then a full, runnable, App-Store-grade design system for the whole app, with a complete theming system. The target codebase is React + TypeScript + **Tailwind CSS v4** (CSS-first `@theme` tokens), so design tokens expressed as **CSS custom properties** port 1:1.

## What OpenSets is

A free, offline-first **strength-training PWA**. It builds your training plan from your stats and goals, tracks every set, and tells you exactly **when to add weight** — all on-device, no accounts, no subscriptions, fully usable in a gym with no signal. The hook: every "AI coaching" feature competitors charge \$25–80/month for (progression decisions, plan generation, volume management) is deterministic math, given away free. This should look and feel like a **real product someone ships to the App Store** — polished, cohesive, confident.

## The ask (two stages)

1. **First, propose 2–3 distinct visual directions.** Different mood / typography / color / component language. For each, show the **active logging screen** (it's the product) and one secondary screen. Give each a name and a one-line personality.
2. **After I pick one, build it out fully**: a complete design system + the screens below + the full theming system, delivered as a **runnable prototype** (see Deliverables).

## User & context (this drives the logging UI)

- Self-coached lifters training 4–6×/week. Personas: intermediate self-coached lifter (primary), novice on a template, data-refugee from Strong/Hevy.
- **The logging screen is used mid-set** — one-handed, sometimes sweaty, in dim gym lighting, between heavy efforts. **Glanceability and big touch targets win.** A lifter must read the next set's weight×reps in a fraction of a second.

## Non-negotiable UX constraints (behavior, not aesthetics)

- Mobile-first PWA, portrait; installable to home screen (respect iOS safe areas / the home indicator).
- **Dark mode must be exceptional** (gym lighting) — but full theming is required (below).
- **Thumb-zone**: primary actions live in the bottom ~40%. Touch targets ≥ 48px.
- **Big, glanceable numbers** for active weight/reps (≥ 24px), legible at arm's length; tabular figures so values don't jump.
- **kg is canonical; lb is display-only** — show units clearly and unobtrusively.
- Every list/screen ships a **designed empty state** with one clear CTA.
- **"Educational tool — not medical advice"** disclaimer on first run + About.
- **Accessible in every theme**: sufficient contrast, visible keyboard focus, `prefers-reduced-motion` respected, motion purposeful.
- **Offline-first**: nothing core depends on network. Exercise images come from a CDN and may be absent offline — design graceful image-absent states.

## Theming system (required: full system + custom editor)

- **Light + dark** base modes, both first-class.
- **~6–10 curated color themes** — hand-tuned, each with a name and personality (e.g. a stark monochrome, a warm amber, a cool steel, an electric volt, a clean clinical light, etc.). Propose the set.
- A **custom-theme editor**: the user picks a base + accent (and maybe a mood), and the system **derives a full coherent palette** from it. Define the derivation rules (how surfaces, borders, text tiers, and semantic colors are computed from the seed) so it always looks intentional.
- Express everything as **design tokens / CSS custom properties**, grouped per theme. Provide the full **token contract**:
  - Surfaces: `bg`, `surface`, `surface-2`, `elevated`, `border`, `border-strong`
  - Text: `text`, `muted`, `faint`
  - Brand: `accent`, `accent-hover`, `accent-ink` (text/icon on accent)
  - Semantic: `success`, `warning`, `danger`, and a distinct **PR / celebration** color
  - Charts: an ordered categorical palette that works on every theme
  - Scales: typography (sizes/weights/line-heights), spacing, radius, shadow, motion/easing
- The theme picker + custom editor are themselves screens to design (see Settings).

## Screen inventory — design ALL of these (full app, P1–P4)

**Onboarding / first run**
- Welcome: the one-line pitch + not-medical-advice.
- **Plan-generator wizard** (4–6 steps): goal (build muscle / lose fat / recomp / get stronger) → days/week → equipment → experience → optional height/weight/target+date → **recommended program preview** → Start. Skippable to a blank builder. First logged workout reachable in < 2 min.

**Today / Logging — THE product**
- **Today hub**: today's workout card + Start; or resume an in-progress session.
- **Active session**: one exercise card at a time; each **prescribed set** as weight × reps with the **previous-session line** ("last: 84 kg × 8,8,7"); **1-tap to confirm** a set as prescribed, expand to **edit weight/reps** (optional RPE); a **tappable "why this weight" reason** that reveals the rule + numbers (this is the trust moat — make it feel smart, not noisy); **rest timer** that auto-starts on a logged set, owns the bottom bar, big countdown, ±15s, skip; **exercise switcher**; mid-workout actions (skip / add unplanned / swap substitute / finish-partial); edit/delete a set with **undo (snackbar)**.
- **PR celebration** (weight / rep / e1RM PR): a satisfying but quick, non-blocking moment.
- **Set-row component** is the single most important element — design its prescribed / active / done / failed / AMRAP states carefully.

**Programs / Routines**
- Program list; **routine builder** (add exercises, per-slot sets×reps or rep-range, rest, progression rule, reorder, multi-day templates); 5/3/1 **training-max management**; template preview.

**Library**
- Exercise **browse/search** with facet filters (muscle / equipment / mechanic / level); **exercise detail** (start/end images, step instructions, **muscle-map figure**, e1RM history sparkline, personal notes/cues); create **custom exercise** (with photo).

**History / Analytics**
- **Calendar + list** of sessions; **per-exercise history** with an e1RM trend chart + PR markers; **analytics dashboard**: e1RM trends, tonnage, **weekly volume per muscle as a heatmap vs MEV/MAV/MRV bands**, intensity distribution, prescribed-vs-completed **compliance %**; **body measurements + progress photos** (side-by-side compare); **goals** with progress bars.

**Settings / Misc**
- Units; **plate-inventory editor** (which plates you own); rest defaults; **theme picker + custom-theme editor**; backup / export-import; optional sync; about / licenses / **privacy** ("your data never leaves your device"); in-app "update ready" toast.

**Global components** to define: bottom **tab nav**, sheets / modals, **toasts/snackbars with undo**, the **rest-timer bar**, chips/tags, **numeric steppers** (weight/reps), segmented controls, cards, list rows, progress bars, empty states, the not-medical-advice line, PR celebration, charts styling.

## Deliverables (so the port is faithful, not approximate)

- **Stage 1:** 2–3 direction explorations (named), each showing the active-logging screen + one more.
- **Stage 2 (chosen direction):** a **runnable prototype** — a **single canonical CSS file of design tokens + component styles** (the artifact I port verbatim), plus representative **screen markup / components** (HTML or React). Anything runnable so I can render it and adopt its real CSS/markup.
- Tokens as **CSS custom properties grouped per theme**, so light/dark + the curated presets + the custom editor all map to one system.
- Show key screens at **iPhone width (~390px)**; also note tablet/desktop behavior briefly.

## Tech context (keep it portable)

React + TypeScript + **Tailwind CSS v4** (CSS-first `@theme`, tokens are CSS variables) + Recharts for charts. Lucide-style icons preferred. **No custom web fonts unless self-hostable** (offline + bundle budget) — prefer a strong system/variable font stack, or name a specific self-hostable typeface. Keep the core route lean (≤ 200 KB gz); heavy things (charts, library detail) are lazy-loaded.

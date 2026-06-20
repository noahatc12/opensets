# Claude Design prompts for OpenSets

Two-stage. Paste Prompt 1 first; after you pick a direction, paste Prompt 2 (fill in the name).

---

## PROMPT 1 — Stage 1: direction explorations

I'm designing **OpenSets**, a free, offline-first strength-training PWA: it builds your training plan, tracks every set, and tells you exactly when to add weight — all on-device, no accounts, fully usable in a gym with no signal. It should look like a real product shipped to the App Store.

Before building the full system, **propose 3 distinct visual directions**. For each, design two screens at iPhone width (~390px): (1) the **active workout-logging screen**, and (2) the **analytics/history dashboard with an e1RM trend chart**. Give each direction a name and a one-line personality.

**Who uses it & context:** self-coached lifters, 4–6×/week. The logging screen is used **mid-set** — one-handed, sometimes sweaty, in dim gym lighting, between heavy efforts. Glanceability and big touch targets win. A lifter must read the next set's weight×reps in a fraction of a second.

**Non-negotiable UX (behavior, not aesthetics):**
- Mobile-first, portrait. **Dark mode must be exceptional** (gym lighting). Respect iOS safe areas.
- Primary actions in the bottom ~40% (thumb zone); touch targets ≥ 48px.
- Big, glanceable, **tabular** weight/reps numbers (≥ 24px) — never jitter on change.
- kg canonical, lb display-only; show units clearly.
- Accessible: strong contrast, visible focus, reduced-motion respected.

**Aesthetic zone:** aim all three in a **"premium athletic instrument"** feel — a precision tool a serious lifter trusts. Not gym-bro clichés, not sterile-corporate. Pull the three apart on one axis:
- **Technical / instrument** — dark, high-contrast, scoreboard energy, monospace-tinged numerals (Linear × a barbell readout).
- **Calm / premium-data** — soft dark surfaces, restrained accent, generous space, "expensive and quiet" (Oura/Whoop lane).
- **Bold / energetic** — punchy accent, expressive type, celebratory motion on PRs (Apple Fitness athletic energy).

**Craft references:** borrow the precision and type discipline of **Linear**, the premium calm of **Oura**, and the celebration moments of **Apple Fitness**. The bar to **beat** is **Strong** and **Hevy** — match their logging speed but far exceed their plain, dated polish; don't copy their utilitarian gray. _[Edit: add any apps you personally love or hate.]_

**Typography:** confident and clearly designed, never at the cost of glanceability. Strong variable sans for UI; headings may carry personality (a distinctive display or serif is a good way to differentiate a direction). No custom web fonts unless self-hostable — prefer system/variable stacks or name a self-hostable face (Inter, Geist, Hanken Grotesk).

**Hero numbers:** the weight×reps figures are the soul of the app — they should feel like a **scoreboard / barbell readout**: big, heavy, tabular, precise, instantly readable at arm's length in bad light. Weight is the hero; on a PR the number itself celebrates.

**Theming note (full build comes next):** the chosen direction will need a full theming system — light/dark + several curated color themes + a custom-theme editor — so design with **swappable color tokens** in mind. For now just show each direction in its best **dark mode** (one in light too if it suits).

**Deliver:** 3 named directions × 2 screens each at ~390px, dark mode. I'll pick one, then ask you to build the full system.

---

## PROMPT 2 — Stage 2: build the chosen direction (fill in the name)

Build out **[DIRECTION NAME]** into a complete, App-Store-grade design system and **runnable prototype** for OpenSets (the strength PWA from before).

**Target codebase:** React + TypeScript + **Tailwind CSS v4** (CSS-first `@theme`, tokens are CSS custom properties) + Recharts for charts. **Express all design tokens as CSS custom properties** so they port 1:1.

**Deliver a runnable prototype:** a single **canonical CSS file** of design tokens + component styles, plus representative **screen markup/components** (HTML or React) — anything runnable so it can be rendered and its real CSS/markup adopted directly.

**Theming system (full):**
- Light + dark base modes, both first-class.
- **~6–10 curated color themes**, hand-tuned, each named with a personality (propose the set).
- A **custom-theme editor**: user picks a base + accent; **define the derivation rules** so surfaces, borders, text tiers, and semantic colors are computed from the seed and always look intentional.
- **Token contract** (group per theme): surfaces (`bg`, `surface`, `surface-2`, `elevated`, `border`, `border-strong`); text (`text`, `muted`, `faint`); brand (`accent`, `accent-hover`, `accent-ink`); semantic (`success`, `warning`, `danger`, + a distinct **PR/celebration** color); an ordered **categorical chart palette** that works on every theme; scales for type, spacing, radius, shadow, motion/easing.

**Screens to design (full app):**
- **Onboarding:** welcome + not-medical-advice; **plan-generator wizard** (goal → days/week → equipment → experience → optional stats/target → program preview → start).
- **Today / logging:** today hub (start/resume); **active session** (one exercise card at a time; prescribed sets as weight×reps with a "last: 84×8,8,7" previous line; 1-tap confirm, expand to edit weight/reps + optional RPE; a tappable **"why this weight" reason** that reveals the rule + numbers; **rest timer** that auto-starts, owns the bottom bar, big countdown, ±15s; exercise switcher; skip/add/swap/finish-partial; edit/delete with **undo snackbar**); **PR celebration** moment.
- **Programs:** program list; **routine builder** (add exercises, per-slot sets×reps/range, rest, progression rule, reorder, multi-day); 5/3/1 **training-max management**.
- **Library:** browse/search with facet filters; **exercise detail** (images, step instructions, muscle-map figure, e1RM sparkline, notes); custom-exercise create.
- **History / analytics:** calendar + session list; **per-exercise e1RM trend chart** with PR markers; **dashboard** (tonnage, **weekly volume per muscle as a heatmap vs MEV/MAV/MRV bands**, intensity distribution, prescribed-vs-completed **compliance %**); body measurements + progress photos compare; **goals** with progress bars.
- **Settings:** units; **plate-inventory editor**; rest defaults; **theme picker + custom-theme editor**; backup/export-import; about/licenses/**privacy** ("your data never leaves your device").
- **Global components:** bottom tab nav; sheets/modals; **toasts/snackbars with undo**; the **rest-timer bar**; numeric steppers; segmented controls; chips; cards; list rows; progress bars; **empty states** (one per list, with a CTA); the not-medical-advice line.

**Constraints (carry from before):** mobile-first portrait; exceptional dark mode; thumb-zone primary actions; touch targets ≥ 48px; big **tabular** glanceable numbers; kg canonical / lb display-only; accessible in every theme (contrast, focus, reduced-motion); **offline-first** (exercise images may be absent — design graceful image-absent states). Keep the core route lean — charts and library detail are lazy-loaded. Show key screens at ~390px.

**The single most important component is the set-row** — design its **prescribed / active / done / failed / AMRAP** states carefully.

---

## Revising (after the first build)

Point at the specific screen/component and what's off, e.g.: "On the active-logging screen, the rest-timer bar competes with the set-row — make it quieter and move the +15s control into the thumb zone," or "the volt theme's accent fails contrast on `muted` text — bump it." Keep the token names stable so the port stays clean.

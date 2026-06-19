# OpenSets

**Strength training that tells you when to add weight — 100% free, 100% on your device.**

OpenSets builds your training plan from your stats and goals, tracks every set, and
computes your progression (when to add weight, when to deload) as **deterministic,
explainable, unit-tested math** that runs entirely in the browser. No backend, no
accounts, no paid APIs, no subscriptions. Fully usable offline in a gym with no signal.

The bet: every "AI coaching" feature competitors charge \$25–80/month for — progression
decisions, plan generation, volume management — is really just well-understood math
(linear/double progression, 5/3/1, GZCLP, RPE autoregulation, volume landmarks). OpenSets
implements it as a pure, testable engine and gives it away.

> Educational tool — not medical advice.

## Status

🚧 **Phase 0 (Foundation) complete.** Architecture, data layer, exercise-library
pipeline, and a designed offline shell are in place. The progression engine ships its
types and a TDD harness; logic lands in Phase 1+. See [`PARKING_LOT.md`](./PARKING_LOT.md)
for what's scheduled where, and [`docs/strength-app-master-spec.md`](./docs/strength-app-master-spec.md)
for the full specification.

## Architecture

- **`src/engine`** — the progression + plan-generator math. **Pure TypeScript**: no React,
  no Dexie, no DOM, no `Date.now()`, no randomness, no I/O. Time and storage are passed in.
  This is the centerpiece and the reason every rule is 100% unit-testable. The purity law is
  enforced at lint time.
- **`src/db`** — Dexie/IndexedDB schema, repositories, and the versioned export/import
  envelope. Dexie is the single source of truth (read via `useLiveQuery`).
- **`src/features`** — `log`, `programs`, `library`, `analytics`, `settings`.
- **`src/components`** — design-system primitives.
- **`scripts/build-exercises.ts`** — ingests [free-exercise-db](https://github.com/yuhonas/free-exercise-db)
  at a pinned commit → normalized `exercises.json` + a prebuilt FlexSearch index.

### Inviolable constraints

100% client-side · no paid APIs / no shipped keys · no accounts · offline-first ·
engine purity · **kg is canonical** (lb is display-only) · migrations never lose data
(pre-migration snapshots) · privacy is a feature (no event telemetry) · health safety
rails stay in (pacing only, never calories/macros).

## Stack

Vite · React 19 · TypeScript (strict) · Tailwind v4 · Dexie (IndexedDB) · Zustand
(ephemeral UI state) · vite-plugin-pwa (Workbox) · Recharts (lazy) · FlexSearch ·
Vitest + fake-indexeddb · Playwright · GitHub Actions → GitHub Pages.

## Develop

```bash
npm install
npm run build:exercises   # fetch + normalize the exercise library (once)
npm run dev               # http://localhost:5173/opensets/

npm test                  # Vitest (engine + DB)
npm run lint              # ESLint, zero-warning gate
npm run typecheck         # tsc --build
npm run build             # typecheck + prebuild data + vite build
npm run preview           # serve the production build
node scripts/shot.mjs     # screenshot every screen (needs `npm run preview` running)
```

## License

App code: **MIT**. Exercise data: [free-exercise-db](https://github.com/yuhonas/free-exercise-db)
(The Unlicense, public domain). See [`docs/`](./docs) for the full spec and licensing notes.

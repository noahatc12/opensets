import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

// GitHub Pages serves from /<repo>/. base must match the repo name and propagate
// to the PWA manifest scope/start_url, or the installed app 404s offline.
const BASE = '/opensets/';

export default defineConfig({
  base: BASE,
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      // Generate install icons from the source logo (see pwa-assets.config.ts).
      pwaAssets: { config: true, overrideManifestIcons: true },
      manifest: {
        name: 'OpenSets',
        short_name: 'OpenSets',
        description:
          'Free, offline-first strength training. Plans your workouts, tracks every set, and tells you when to add weight — your data never leaves your device.',
        theme_color: '#0a0d12',
        background_color: '#0a0d12',
        display: 'standalone',
        orientation: 'portrait',
        categories: ['health', 'fitness', 'sports'],
      },
      workbox: {
        // Precache the exercise library data (public/data/*.json) with the app
        // shell so Library browse + search work fully offline after a single
        // online load (P1 offline-first decision). Precache (vs runtime cache)
        // caches at SW install, so the data is available offline even if the user
        // never opened Library while online. The dataset is SHA-pinned, so these
        // entries never churn the precache manifest. NOTE: exercises-index.json is
        // ~1.9 MB, close to Workbox's default 2 MiB maximumFileSizeToCacheInBytes
        // cap — if it ever crosses, offline search goes dead (precache silently
        // skips the file); raise the cap then.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2,json}'],
        // Exercise images are served from jsDelivr (spec §7): cache-first, tolerate
        // opaque responses, bounded retention. Never a core-flow dependency.
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/cdn\.jsdelivr\.net\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'jsdelivr-exercise-images',
              cacheableResponse: { statuses: [0, 200] },
              expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 60 },
            },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  test: {
    // Engine (pure) + DB (fake-indexeddb) run in node. Component tests (P1) opt
    // into jsdom per-file via the `// @vitest-environment jsdom` pragma.
    environment: 'node',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reportsDirectory: './coverage',
      include: ['src/engine/**/*.ts'],
      exclude: ['src/engine/**/*.{test,spec}.ts', 'src/engine/**/types.ts'],
      // The engine's quality bar (spec §6.5), enforced in CI now that P1 logic has
      // landed. The pure engine is the centerpiece; it stays test-first and ≥95%.
      thresholds: { branches: 95, functions: 95, lines: 95, statements: 95 },
    },
  },
});

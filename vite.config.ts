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
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        // Exercise library data (public/data/*.json) is large and unused until P1.
        // Its offline strategy (precache vs runtime cache) is decided with the
        // library in P1; keep the P0 install shell lean.
        globIgnores: ['**/data/**'],
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
      // The ≥95% branch gate is the engine's quality bar (spec §6.5). It activates
      // in P1 when progression logic lands; P0 ships only types + a stubbed entry
      // point, so enforcing it now would gate on an empty module. Turn on in P1:
      // thresholds: { branches: 95, functions: 95, lines: 95, statements: 95 },
    },
  },
});

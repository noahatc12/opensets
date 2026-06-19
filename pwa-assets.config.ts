import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config';

// Generates favicon + maskable/apple-touch/PWA icons from a single source mark.
export default defineConfig({
  preset: minimal2023Preset,
  images: ['public/logo.svg'],
});

// Screenshot the built app's screens (live verification vs the Claude Design reference).
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const BASE = process.env.SHOT_BASE ?? 'http://localhost:4173/opensets/';
const routes = (process.env.SHOT_ROUTES ?? 'appearance').split(',');
mkdirSync('.shots', { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
});
// Optionally preset the theme selection (mode/theme/ds) BEFORE the app boots,
// so initTheme() reads it. addInitScript runs before any page script on every load.
const theme = process.env.SHOT_THEME; // e.g. '{"mode":"dark","theme":"tempo","ds":"readout"}'
if (theme) {
  await ctx.addInitScript((t) => {
    try {
      localStorage.setItem('opensets-theme', t);
    } catch {
      /* ignore */
    }
  }, theme);
}

const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));

for (const route of routes) {
  await page.goto(`${BASE}#/${route}`, { waitUntil: 'networkidle' });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(700);
  await page.screenshot({ path: `.shots/app-${route.replace(/\//g, '_')}.png`, fullPage: true });
  console.log('shot:', route);
}
console.log('errors:', errors.length ? errors.join(' | ') : 'none');
await browser.close();

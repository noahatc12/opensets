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
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));

for (const route of routes) {
  await page.goto(`${BASE}#/${route}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(700);
  await page.screenshot({ path: `.shots/app-${route.replace(/\//g, '_')}.png`, fullPage: true });
  console.log('shot:', route);
}
console.log('errors:', errors.length ? errors.join(' | ') : 'none');
await browser.close();

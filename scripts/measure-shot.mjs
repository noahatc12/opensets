// Seed sample data, then screenshot the Measurements screen to confirm inches.
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
const BASE = 'http://localhost:4173/opensets/';
mkdirSync('.shots', { recursive: true });
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
await ctx.addInitScript(() => {
  try {
    localStorage.setItem('opensets-theme', '{"mode":"dark","theme":"teal","ds":"readout"}');
  } catch {
    /* ignore */
  }
});
const p = await ctx.newPage();
const errs = [];
p.on('pageerror', (e) => errs.push(e.message));
await p.goto(`${BASE}#/today`, { waitUntil: 'networkidle' });
await p.waitForTimeout(700);
const seed = p.getByText('Load sample data');
if (await seed.count()) {
  await seed.click();
  await p.waitForTimeout(1000);
}
await p.goto(`${BASE}#/measurements`, { waitUntil: 'networkidle' });
await p.waitForTimeout(700);
// Open the log sheet too, to confirm the input unit reads "in" for a length type.
await p.screenshot({ path: '.shots/measurements-inches.png', fullPage: true });
const waistUnit = await p
  .locator('text=/Waist/')
  .first()
  .isVisible()
  .catch(() => false);
console.log('measurements rendered, waist visible:', waistUnit, '· errors:', errs.length ? errs.join('|') : 'none');
await b.close();

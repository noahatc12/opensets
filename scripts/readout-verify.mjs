// Seed sample data, then screenshot Trends + an active session in the Readout template.
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const BASE = 'http://localhost:4173/opensets/';
mkdirSync('.shots', { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
await ctx.addInitScript(() =>
  localStorage.setItem('opensets-theme', JSON.stringify({ mode: 'dark', theme: "tempo", ds: "tempo" })),
);
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));

// Seed sample data from the Today empty state.
await page.goto(`${BASE}#/today`, { waitUntil: 'networkidle' });
await page.reload({ waitUntil: 'networkidle' });
const seed = page.getByText('Load sample data', { exact: false });
if (await seed.count()) {
  await seed.first().click();
  await page.waitForTimeout(1500);
}

// Today (populated) in Readout.
await page.goto(`${BASE}#/today`, { waitUntil: 'networkidle' });
await page.waitForTimeout(700);
await page.screenshot({ path: '.shots/readout-today.png', fullPage: true });
console.log('shot: readout-today');

// Library in Readout.
await page.goto(`${BASE}#/library`, { waitUntil: 'networkidle' });
await page.waitForTimeout(700);
await page.screenshot({ path: '.shots/readout-library.png', fullPage: true });
console.log('shot: readout-library');

// Trends in Readout.
await page.goto(`${BASE}#/history`, { waitUntil: 'networkidle' });
await page.waitForTimeout(800);
await page.screenshot({ path: '.shots/readout-trends.png', fullPage: true });
console.log('shot: readout-trends');

// Start a workout -> active session in Readout.
await page.goto(`${BASE}#/today`, { waitUntil: 'networkidle' });
await page.waitForTimeout(500);
const start = page.getByText('Start workout', { exact: false });
if (await start.count()) {
  await start.first().click();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: '.shots/tempo-session.png', fullPage: true });
  console.log('shot: readout-session');
} else {
  console.log('no Start workout button found');
}
console.log('errors:', errors.length ? errors.join(' | ') : 'none');
await browser.close();

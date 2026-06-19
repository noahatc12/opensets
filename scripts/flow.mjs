// E2E flow drive + screenshots: build a routine → start → log a set.
// Requires `npm run preview` on :4173. Captures to .shots/.
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const BASE = 'http://localhost:4173/opensets/#';
mkdirSync('.shots', { recursive: true });
const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
});
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

async function shot(name) {
  await page.waitForTimeout(350);
  await page.screenshot({ path: `.shots/flow-${name}.png` });
}

// Clear any prior IndexedDB so the run is deterministic.
await page.goto(BASE + '/today', { waitUntil: 'load' });
await page.evaluate(async () => {
  for (const db of await indexedDB.databases?.())
    indexedDB.deleteDatabase(db.name);
});
await page.reload({ waitUntil: 'load' });
await shot('1-empty');

// Build a routine.
await page.getByRole('button', { name: 'Build a routine' }).click();
await page.getByPlaceholder(/Routine name/).fill('Upper / Lower A');
for (const q of ['barbell squat', 'bench press']) {
  await page.getByRole('button', { name: '+ Add exercise' }).click();
  await page.getByPlaceholder(/Search/).fill(q);
  await page.waitForTimeout(250);
  await page.locator('ul li button').first().click();
}
await shot('2-builder');

await page.getByRole('button', { name: 'Save routine' }).click();
await page.waitForTimeout(500);
await shot('3-ready');

// Start the workout and log the first set.
await page.getByRole('button', { name: 'Start workout' }).click();
await page.waitForTimeout(400);
await shot('4-session');

// Log set 1 (the active row's check button).
await page.locator('.border-accent button').last().click();
await page.waitForTimeout(400);
await shot('5-logged-rest');

console.log(
  'console/page errors: ' + (errors.length ? errors.join(' | ') : 'none'),
);
await browser.close();

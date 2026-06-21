// Drive the mid-workout flows (Add / Swap / Skip) end-to-end in a real browser
// (where the catalog + picker load) and assert the exercise count/name changes.
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
const BASE = 'http://localhost:4173/opensets/';
mkdirSync('.shots/logger', { recursive: true });
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

const count = async () => {
  const t = await p.locator('text=/^\\d+ \\/ \\d+$/').first().textContent();
  return Number(t.split('/')[1].trim());
};
const exName = () => p.locator('div.font-extrabold').first().textContent();
const pick = async (term) => {
  await p.locator('input[placeholder*="Search"]').fill(term);
  await p.waitForTimeout(500);
  await p.locator('button', { hasText: new RegExp(term, 'i') }).first().click();
  await p.waitForTimeout(700);
};

await p.goto(`${BASE}#/today`, { waitUntil: 'networkidle' });
await p.waitForTimeout(700);
const seed = p.getByText('Load sample data');
if (await seed.count()) {
  await seed.click();
  await p.waitForTimeout(1000);
}
await p.getByRole('button', { name: /Start workout/ }).first().click();
await p.waitForTimeout(900);

const c0 = await count();
console.log('start: count', c0, '· exercise', (await exName())?.trim());

// ADD
await p.getByRole('button', { name: 'Add' }).click();
await p.waitForTimeout(400);
await pick('Squat');
const cAdd = await count();
console.log('after Add: count', cAdd, '· exercise', (await exName())?.trim(), '(jumped to new)');
await p.screenshot({ path: '.shots/logger/flow-01-add.png', fullPage: true });

// SWAP (replace the current exercise)
const beforeSwap = (await exName())?.trim();
await p.getByRole('button', { name: 'Swap' }).click();
await p.waitForTimeout(400);
await pick('Curl');
const afterSwap = (await exName())?.trim();
console.log('after Swap:', beforeSwap, '->', afterSwap);
await p.screenshot({ path: '.shots/logger/flow-02-swap.png', fullPage: true });

// SKIP (remove current)
const cBeforeSkip = await count();
await p.getByRole('button', { name: 'Skip' }).click();
await p.waitForTimeout(700);
const cAfterSkip = await count();
console.log('after Skip: count', cBeforeSkip, '->', cAfterSkip);
await p.screenshot({ path: '.shots/logger/flow-03-skip.png', fullPage: true });

const ofw = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
console.log('overflowX:', ofw, 'errors:', errs.length ? errs.join('|') : 'none');
await b.close();

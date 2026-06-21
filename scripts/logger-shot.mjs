// Drive into an active session and screenshot the Readout logger (baseline vs
// post-extraction pixel check). OUT env names the output set.
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
const BASE = 'http://localhost:4173/opensets/';
const OUT = process.env.OUT ?? 'baseline';
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
await p.goto(`${BASE}#/today`, { waitUntil: 'networkidle' });
await p.waitForTimeout(700);
const seed = p.getByText('Load sample data');
if (await seed.count()) {
  await seed.click();
  await p.waitForTimeout(1000);
}
await p.getByRole('button', { name: /Start workout/ }).first().click();
await p.waitForTimeout(1000);
await p.screenshot({ path: `.shots/logger/${OUT}-01-active.png`, fullPage: true });
await p.getByRole('button', { name: /Log Set/ }).first().click();
await p.waitForTimeout(800);
await p.screenshot({ path: `.shots/logger/${OUT}-02-after-log.png`, fullPage: true });
const ofw = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
console.log(OUT, 'overflowX:', ofw, 'errors:', errs.length ? errs.join('|') : 'none');
await b.close();

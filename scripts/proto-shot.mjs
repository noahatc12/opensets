// Render the design-handoff prototype and screenshot it (the reference).
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const URL = 'http://localhost:8137/OpenSets.dc.html';
mkdirSync('.shots', { recursive: true });
const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 440, height: 1600 },
  deviceScaleFactor: 1,
});
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForTimeout(800);
await page.screenshot({ path: '.shots/proto-full.png', fullPage: true });

// Inspect: any fixed/absolute screen containers + their boxes.
const info = await page.evaluate(() => {
  const big = [...document.querySelectorAll('div')]
    .map((el) => {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return { r, pos: cs.position, w: Math.round(r.width), h: Math.round(r.height), top: Math.round(r.top) };
    })
    .filter((x) => x.w >= 360 && x.w <= 440 && x.h > 600)
    .slice(0, 8)
    .map((x) => ({ w: x.w, h: x.h, top: x.top, pos: x.pos }));
  return { docH: document.body.scrollHeight, candidates: big };
});
console.log('doc height:', info.docH);
console.log('screen-sized divs:', JSON.stringify(info.candidates));
console.log('errors:', errors.length ? errors.join(' | ') : 'none');
await browser.close();

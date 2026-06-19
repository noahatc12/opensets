// Visual-verification harness: screenshot every screen at narrow widths and
// assert zero horizontal overflow. Requires `npm run preview` running on :4173.
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const BASE = 'http://localhost:4173/opensets/#';
const ROUTES = [
  ['today', '/today'],
  ['library', '/library'],
  ['history', '/history'],
  ['settings', '/settings'],
];

mkdirSync('.shots', { recursive: true });
const browser = await chromium.launch();
let bad = 0;

for (const width of [390, 360]) {
  const ctx = await browser.newContext({
    viewport: { width, height: 844 },
    deviceScaleFactor: 2,
  });
  const page = await ctx.newPage();
  for (const [name, route] of ROUTES) {
    await page.goto(BASE + route, { waitUntil: 'load' });
    await page.waitForTimeout(300);
    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    );
    await page.screenshot({ path: `.shots/${name}-${width}.png` });
    const flag = overflow > 0 ? ' ⚠ OVERFLOW' : '';
    if (overflow > 0) bad += 1;
    console.log(`${name}@${width}px: overflow=${overflow}${flag}`);
  }
  await ctx.close();
}

await browser.close();
console.log(
  bad === 0 ? 'OK: no horizontal overflow' : `FAIL: ${bad} overflow(s)`,
);
process.exit(bad === 0 ? 0 : 1);

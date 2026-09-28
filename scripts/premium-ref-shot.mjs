// Renders each phone frame of the premium handoff (design/handoff/premium-2026-09-27/rendered.html)
// to a PNG at 390x844, so the port can be checked against the reference and not memory.
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const OUT = process.env.REF_OUT ?? 'design/redesign-shots/ref';
mkdirSync(OUT, { recursive: true });
const file = resolve('design/handoff/premium-2026-09-27/rendered.html');
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 }, deviceScaleFactor: 2 });
await page.goto(pathToFileURL(file).href, { waitUntil: 'networkidle' });
await page.addStyleTag({ content: '.frame{zoom:1 !important}.cell{width:390px}.rail{gap:40px}' });
await page.waitForTimeout(800);
const frames = page.locator('.frame');
const n = await frames.count();
for (let i = 0; i < n; i++) {
  const f = frames.nth(i);
  const label = ((await f.getAttribute('aria-label')) ?? `frame-${i}`).replace(/, open full size$/, '').toLowerCase().replace(/[^a-z0-9]+/g, '-');
  await f.scrollIntoViewIfNeeded();
  await f.screenshot({ path: `${OUT}/${String(i + 1).padStart(2, '0')}-${label}.png` });
}
await browser.close();
console.log(`${n} reference frames -> ${OUT}`);

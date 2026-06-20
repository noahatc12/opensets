import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
const BASE = 'http://localhost:4173/opensets/';
mkdirSync('.shots', { recursive: true });
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const p = await ctx.newPage();
// fresh load -> should default to Readout+teal
await p.goto(`${BASE}#/today`, { waitUntil: 'networkidle' });
await p.reload({ waitUntil: 'networkidle' });
const seed = p.getByText('Load sample data', { exact:false });
if (await seed.count()) { await seed.first().click(); await p.waitForTimeout(1500); }
await p.goto(`${BASE}#/today`, { waitUntil:'networkidle' }); await p.waitForTimeout(700);
await p.screenshot({ path:'.shots/v2-default-today.png', fullPage:true });
await p.goto(`${BASE}#/goals`, { waitUntil:'networkidle' }); await p.waitForTimeout(500);
await p.screenshot({ path:'.shots/v2-goals.png', fullPage:true });
await p.goto(`${BASE}#/measurements`, { waitUntil:'networkidle' }); await p.waitForTimeout(500);
await p.screenshot({ path:'.shots/v2-measurements.png', fullPage:true });
// tempo trends
await p.evaluate(() => localStorage.setItem('opensets-theme', JSON.stringify({ mode:'dark', theme:'tempo', ds:'tempo' })));
await p.goto(`${BASE}#/history`, { waitUntil:'networkidle' }); await p.reload({ waitUntil:'networkidle' }); await p.waitForTimeout(700);
await p.screenshot({ path:'.shots/v2-tempo-trends.png', fullPage:true });
console.log('done'); await b.close();

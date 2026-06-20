import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
const BASE = 'http://localhost:4173/opensets/';
mkdirSync('.shots', { recursive: true });
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
await ctx.addInitScript(() => localStorage.setItem('opensets-theme', JSON.stringify({ mode:'dark', theme:'teal', ds:'readout' })));
const p = await ctx.newPage();
await p.goto(`${BASE}#/today`, { waitUntil: 'networkidle' });
await p.reload({ waitUntil: 'networkidle' });
const seed = p.getByText('Load sample data', { exact:false });
if (await seed.count()) { await seed.first().click(); await p.waitForTimeout(1500); }
// toggle lb via the real UI (Dexie -> reactive)
await p.goto(`${BASE}#/settings`, { waitUntil:'networkidle' });
await p.waitForTimeout(500);
await p.getByRole('button', { name: 'lb', exact: true }).click();
await p.waitForTimeout(500);
await p.goto(`${BASE}#/today`, { waitUntil:'networkidle' });
await p.waitForTimeout(700);
await p.screenshot({ path:'.shots/v-today-lb.png', fullPage:true });
// readout session (1/3 fix + lb)
const start = p.getByText('Start workout', { exact:false });
if (await start.count()) { await start.first().click(); await p.waitForTimeout(900);
  await p.screenshot({ path:'.shots/v-session-lb.png', fullPage:true }); }
// onboarding step 4
await p.goto(`${BASE}#/onboarding`, { waitUntil:'networkidle' });
await p.waitForTimeout(500);
for (let i=0;i<4;i++){ const c=p.getByText(/Get started|Continue/).first(); if(await c.count()){ await c.click(); await p.waitForTimeout(350);} }
await p.screenshot({ path:'.shots/v-onboarding-step4.png', fullPage:true });
console.log('done');
await b.close();

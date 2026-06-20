import { chromium } from '@playwright/test';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const p = await ctx.newPage();
await p.goto('http://localhost:4173/opensets/#/plates', { waitUntil:'networkidle' });
await p.reload({ waitUntil:'networkidle' }); await p.waitForTimeout(700);
await p.screenshot({ path:'.shots/v5-plates-lb.png', fullPage:true });
// switch to kg
await p.goto('http://localhost:4173/opensets/#/settings', { waitUntil:'networkidle' }); await p.waitForTimeout(400);
await p.getByRole('button', { name: 'kg', exact: true }).click(); await p.waitForTimeout(400);
await p.goto('http://localhost:4173/opensets/#/plates', { waitUntil:'networkidle' }); await p.waitForTimeout(500);
await p.screenshot({ path:'.shots/v5-plates-kg.png', fullPage:true });
console.log('done'); await b.close();

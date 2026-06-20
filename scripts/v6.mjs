import { chromium } from '@playwright/test';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const p = await ctx.newPage();
await p.goto('http://localhost:4173/opensets/#/today', { waitUntil:'networkidle' });
await p.reload({ waitUntil:'networkidle' });
const seed = p.getByText('Load sample data', { exact:false });
if (await seed.count()) { await seed.first().click(); await p.waitForTimeout(1500); }
for (const r of ['goals','rest-defaults','measurements']) {
  await p.goto(`http://localhost:4173/opensets/#/${r}`, { waitUntil:'networkidle' }); await p.waitForTimeout(600);
  await p.screenshot({ path:`.shots/v6-${r}.png`, fullPage:true });
}
console.log('done'); await b.close();

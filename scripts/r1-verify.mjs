// R1 live verification: drive the onboarding wizard capturing the new goal-aware
// preference inputs (split + priority), finish, then read IndexedDB to prove the new
// Profile fields + Program.volumeState persisted. Screenshots the new controls.
// Usage: vite preview on :4173, then `node scripts/r1-verify.mjs`.
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const BASE = process.env.SHOT_BASE ?? 'http://localhost:4173/opensets/';
mkdirSync('.shots', { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));

const cta = (name) => page.getByRole('button', { name, exact: true }).last();
const pick = (name) => page.getByRole('button', { name, exact: true }).first().click();
// For buttons whose accessible name includes a sub-label (e.g. experience cards).
const pickContains = (name) => page.getByRole('button', { name, exact: false }).first().click();

// Fresh DB so onboarding builds a brand-new program.
await page.goto(`${BASE}#/today`, { waitUntil: 'networkidle' });
await page.evaluate(() => new Promise((res) => { const r = indexedDB.deleteDatabase('opensets-lb'); r.onsuccess = r.onerror = r.onblocked = () => res(); }));

await page.goto(`${BASE}#/onboarding`, { waitUntil: 'networkidle' });
await page.waitForTimeout(400);
await cta('Get started').click();                 // step 0 → 1
await pick('Recomposition');                       // goal
await cta('Continue').click();                     // → step 2
await pick('5');                                   // days
await pick('Full gym');                            // equipment
await pick('PPL + Arms');                          // NEW: split choice
await page.waitForTimeout(200);
await page.screenshot({ path: '.shots/r1-onb-step2-split.png', fullPage: true });
await cta('Continue').click();                     // → step 3
await pickContains('Intermediate');                // experience (card has a sub-label)
await cta('Continue').click();                     // → step 4
await pick('Chest');                               // NEW: priority muscle
await pick('Biceps');                              // NEW: priority muscle
await page.waitForTimeout(200);
await page.screenshot({ path: '.shots/r1-onb-step4-priority.png', fullPage: true });
await cta('Continue').click();                     // → step 5 (preview)
await page.waitForTimeout(300);
await page.screenshot({ path: '.shots/r1-onb-step5-plan.png', fullPage: true });
await cta('Build my plan').click();                // finish → /today
await page.waitForTimeout(900);

// Read back what was persisted.
const data = await page.evaluate(async () => {
  const getAll = (store) =>
    new Promise((res, rej) => {
      const open = indexedDB.open('opensets-lb');
      open.onsuccess = () => {
        const dbx = open.result;
        const tx = dbx.transaction(store, 'readonly');
        const req = tx.objectStore(store).getAll();
        req.onsuccess = () => res(req.result);
        req.onerror = () => rej(req.error);
      };
      open.onerror = () => rej(open.error);
    });
  const profile = await getAll('profile');
  const programs = await getAll('programs');
  return { profile, programs };
});

const p = data.profile[0] ?? {};
const prog = data.programs.find((x) => x.isActive) ?? data.programs[0] ?? {};
const vs = prog.volumeState ?? {};
const vsMuscles = Object.keys(vs);
const chest = vs.chest;

const checks = {
  'profile.experience == Intermediate': p.experience === 'Intermediate',
  'profile.days == 5': p.days === 5,
  'profile.equipment == Full gym': p.equipment === 'Full gym',
  'profile.splitChoice == pplArms': p.splitChoice === 'pplArms',
  'profile.priorityMuscles == [chest,biceps]': JSON.stringify(p.priorityMuscles) === JSON.stringify(['chest', 'biceps']),
  'program.volumeState has muscles': vsMuscles.length > 0,
  'volumeState.chest.current == mev (seeds at MEV)': chest && chest.current === chest.mev,
  'volumeState.chest has mev<mav<mrv': chest && chest.mev < chest.mav && chest.mav < chest.mrv,
};

// Settings → Profile renders the new editors with the persisted values.
await page.goto(`${BASE}#/profile`, { waitUntil: 'networkidle' });
await page.waitForTimeout(500);
await page.screenshot({ path: '.shots/r1-settings-profile.png', fullPage: true });

console.log('--- R1 persistence checks ---');
let allPass = true;
for (const [k, v] of Object.entries(checks)) {
  console.log(`${v ? 'PASS' : 'FAIL'}  ${k}`);
  if (!v) allPass = false;
}
console.log('volumeState muscles:', vsMuscles.join(', '));
console.log('volumeState.chest:', JSON.stringify(chest));
console.log('pageerrors:', errors.length ? errors.join(' | ') : 'none');
console.log(allPass && errors.length === 0 ? '\nR1 VERIFY: ALL PASS' : '\nR1 VERIFY: FAILURES PRESENT');
await browser.close();
process.exit(allPass && errors.length === 0 ? 0 : 1);

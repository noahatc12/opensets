// Reach check: on every screen and every pop-up, every control a person can see must be
// reachable. For each button, link, input and radio, scroll it as far into view as its
// scrollers allow, then hit-test its centre: it fails if the island, a dock or anything
// else sits on top of it, if it cannot be scrolled clear of the screen edge, or if it
// lands under the status bar or the home indicator. Every sheet must also swipe down.
//
// Noah on 09-28: "something popped up and I wasn't able to click on it because the island
// was covering it, and I couldn't scroll down to actually click on it" and "I wasn't able
// to swipe down the little pop-up thing". This is the instrument that catches both.
//
// It runs as the iPhone 14 Home Screen app: safe areas 47 top and 34 bottom (emulated through
// CDP), display-mode standalone (its CSS rules switched on by hand, since headless Chrome
// cannot emulate it), in two shapes: the full 844 pt viewport and the 810 pt one that the
// iOS 26 container can hand the app (see src/ui/viewport.ts).
//
//   npm run build && npm run preview     (in another terminal)
//   node scripts/reach-check.mjs          REACH_PROFILES=home limits the shapes
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';

const BASE = process.env.SHOT_BASE ?? 'http://localhost:4173/opensets/';
const OUT = process.env.SHOT_OUT ?? 'design/reach';
mkdirSync(OUT, { recursive: true });
// Safe areas per profile. 'iphone14-ios18' is Noah's phone as measured on 09-28 with the
// black-translucent status bar (window 797 of 844, content under the status bar);
// 'iphone14-black' is the same phone with an opaque status bar (window below it).
const PROFILES = [
  {
    name: 'home',
    viewport: { width: 390, height: 844 },
    safe: { top: 47, bottom: 34 },
  },
  {
    name: 'home-short',
    viewport: { width: 390, height: 810 },
    safe: { top: 47, bottom: 34 },
  },
  {
    name: 'iphone14-ios18',
    viewport: { width: 390, height: 797 },
    safe: { top: 47, bottom: 34 },
  },
  {
    name: 'iphone14-black',
    viewport: { width: 390, height: 797 },
    safe: { top: 0, bottom: 34 },
  },
].filter(
  (p) =>
    !process.env.REACH_PROFILES ||
    process.env.REACH_PROFILES.split(',').includes(p.name),
);

const failures = [];
const warnings = [];
const errors = [];
let states = 0;

const browser = await chromium.launch();

async function run(profile) {
  const ctx = await browser.newContext({
    viewport: profile.viewport,
    screen: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    hasTouch: true,
    isMobile: true,
  });
  await ctx.addInitScript(() => {
    try {
      localStorage.setItem(
        'opensets-theme',
        JSON.stringify({ mode: 'dark', theme: 'signal', ds: 'editorial' }),
      );
    } catch {
      /* ignore */
    }
    // The Home Screen app: JS sees display-mode standalone.
    const orig = window.matchMedia.bind(window);
    window.matchMedia = (q) =>
      /display-mode:\s*standalone/.test(q)
        ? {
            matches: true,
            media: q,
            onchange: null,
            addEventListener() {},
            removeEventListener() {},
            addListener() {},
            removeListener() {},
            dispatchEvent: () => false,
          }
        : orig(q);
  });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Emulation.setSafeAreaInsetsOverride', {
    insets: {
      top: profile.safe.top,
      topMax: profile.safe.top,
      bottom: profile.safe.bottom,
      bottomMax: profile.safe.bottom,
      left: 0,
      leftMax: 0,
      right: 0,
      rightMax: 0,
    },
  });
  page.on('pageerror', (e) => errors.push(`${profile.name} ${e.message}`));

  // ...and CSS sees it too: copy every @media (display-mode: standalone) rule out of its
  // media block, once the stylesheets have loaded.
  const forceStandaloneCss = () =>
    page.evaluate(() => {
      if (document.getElementById('reach-standalone')) return;
      const rules = [];
      for (const sheet of document.styleSheets) {
        let list;
        try {
          list = sheet.cssRules;
        } catch {
          continue;
        }
        for (const r of list)
          if (
            r instanceof CSSMediaRule &&
            /display-mode:\s*standalone/.test(r.conditionText)
          )
            for (const inner of r.cssRules) rules.push(inner.cssText);
      }
      const s = document.createElement('style');
      s.id = 'reach-standalone';
      s.textContent = rules.join('\n');
      document.head.appendChild(s);
      window.dispatchEvent(new Event('resize'));
    });

  async function drag(x0, y0, x1, y1, ms = 420, steps = 14) {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x: x0, y: y0 }],
    });
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ x: x0 + (x1 - x0) * t, y: y0 + (y1 - y0) * t }],
      });
      await page.waitForTimeout(ms / steps);
    }
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [],
    });
  }

  /** The check itself, run in the page against the topmost layer. */
  async function reach(state) {
    states++;
    await page.waitForTimeout(350);
    const res = await page.evaluate(
      ({ safe }) => {
        const Q =
          'button, a[href], input:not([type="hidden"]), select, textarea, [role="button"], [role="radio"], [role="switch"], [role="tab"], [role="link"]';
        const dialogs = [
          ...document.querySelectorAll('[role="dialog"], [role="alertdialog"]'),
        ].filter((d) => d.getBoundingClientRect().height > 0);
        const top = dialogs[dialogs.length - 1] ?? null;
        const scope =
          top ?? document.querySelector('.os-shell') ?? document.body;
        const shown = (el) => {
          const r = el.getBoundingClientRect();
          if (r.width < 1 || r.height < 1) return false;
          if (
            el.closest(
              '[inert], [aria-hidden="true"], .os-pushed-parent, .os-feel, .os-feel-pill, .sr-only',
            )
          )
            return false;
          for (let p = el; p; p = p.parentElement) {
            const cs = getComputedStyle(p);
            if (cs.display === 'none' || cs.visibility === 'hidden')
              return false;
            if (parseFloat(cs.opacity) === 0) return false;
          }
          return true;
        };
        const label = (el) =>
          (
            el.getAttribute('aria-label') ||
            el.textContent ||
            el.getAttribute('placeholder') ||
            el.getAttribute('name') ||
            el.tagName
          )
            .trim()
            .replace(/\s+/g, ' ')
            .slice(0, 60);
        const who = (hit) => {
          if (!hit) return 'nothing (outside the page)';
          if (hit.closest('.os-tabs')) return 'the island';
          const d = hit.closest('[role="dialog"], [role="alertdialog"]');
          if (d)
            return `the "${d.getAttribute('aria-label') ?? 'dialog'}" pop-up`;
          const c = hit.closest('[class]');
          return `${hit.tagName.toLowerCase()}.${(c?.className?.toString() ?? '').split(' ').slice(0, 3).join('.')}`;
        };
        const scrollers = new Map();
        const remember = (el) => {
          for (let p = el.parentElement; p; p = p.parentElement) {
            const oy = getComputedStyle(p).overflowY;
            if (/(auto|scroll)/.test(oy) && !scrollers.has(p))
              scrollers.set(p, p.scrollTop);
          }
        };
        const els = [...scope.querySelectorAll(Q)].filter(shown);
        if (!top)
          els.push(
            ...[
              ...document.querySelectorAll('.os-tabs a, .os-tabs button'),
            ].filter((e) => shown(e) && !els.includes(e)),
          );
        const out = {
          fail: [],
          warn: [],
          count: els.length,
          layer: top?.getAttribute('aria-label') ?? 'screen',
        };
        const vh = innerHeight;
        const vw = innerWidth;
        for (const el of els) {
          remember(el);
          el.scrollIntoView({ block: 'center', inline: 'nearest' });
          const r = el.getBoundingClientRect();
          const cx = r.left + r.width / 2;
          const cy = r.top + r.height / 2;
          const name = label(el);
          // Hidden inside a clipping box that is not a scroller (a closed accordion):
          // not on screen, so not a control a person can see.
          let clipped = false;
          for (let a = el.parentElement; a && !clipped; a = a.parentElement) {
            const st = getComputedStyle(a);
            if (/(hidden|clip)/.test(st.overflowY + st.overflowX)) {
              const ar = a.getBoundingClientRect();
              clipped =
                cx < ar.left || cx > ar.right || cy < ar.top || cy > ar.bottom;
            }
          }
          if (clipped) continue;
          const at = `${Math.round(cx)},${Math.round(cy)}`;
          if (cy < 0 || cy >= vh || cx < 0 || cx >= vw) {
            out.fail.push({
              name,
              why: `cannot be scrolled onto the screen (centre ${at})`,
            });
            continue;
          }
          const hit = document.elementFromPoint(cx, cy);
          if (!hit || !(el === hit || el.contains(hit) || hit.contains(el))) {
            out.fail.push({ name, why: `covered by ${who(hit)} at ${at}` });
            continue;
          }
          if (cy < safe.top)
            out.fail.push({
              name,
              why: `under the status bar (centre y ${Math.round(cy)})`,
            });
          else if (cy > vh - safe.bottom)
            out.fail.push({
              name,
              why: `on the home indicator (centre y ${Math.round(cy)}, screen ${vh})`,
            });
          // The tap area, not the drawn box: a control owns the point 21 pt out from its
          // centre in each direction (a 42 to 44 pt target), counting its invisible
          // ::before hit area; a point may fall on a neighbouring control's own box.
          if (el.tagName !== 'INPUT') {
            const probes = [
              [cx - 21, cy],
              [cx + 21, cy],
              [cx, cy - 21],
              [cx, cy + 21],
            ];
            const lost = probes.filter(([x, y]) => {
              const h = document.elementFromPoint(x, y);
              if (h && (h === el || el.contains(h))) return false;
              const other = h?.closest(Q);
              if (other && other !== el) {
                const o = other.getBoundingClientRect();
                if (x >= o.left && x <= o.right && y >= o.top && y <= o.bottom)
                  return false;
              }
              return true;
            }).length;
            if (lost > 0)
              out.warn.push({
                name,
                why: `tap area ${Math.round(r.width)}x${Math.round(r.height)}, ${lost} of 4 edges short of 44 pt`,
              });
          }
        }
        for (const [p, t] of scrollers) p.scrollTop = t;
        return out;
      },
      { safe: profile.safe },
    );
    for (const f of res.fail)
      failures.push({ profile: profile.name, state, ...f });
    for (const w of res.warn)
      warnings.push({ profile: profile.name, state, ...w });
    const tag = res.fail.length ? 'FAIL' : 'PASS';
    console.log(
      `${tag}  ${profile.name} ${state}: ${res.count} controls on the ${res.layer}${res.fail.length ? `, ${res.fail.length} unreachable` : ''}`,
    );
    if (res.fail.length)
      await page.screenshot({ path: `${OUT}/${profile.name}-${state}.png` });
  }

  /** The topmost pop-up must close when dragged down from its top edge. */
  async function swipeDown(state) {
    const box = await page.evaluate(() => {
      const d = [
        ...document.querySelectorAll('[role="dialog"], [role="alertdialog"]'),
      ]
        .filter((x) => x.getBoundingClientRect().height > 0)
        .pop();
      if (!d) return null;
      const r = d.getBoundingClientRect();
      return {
        x: r.left + r.width / 2,
        y: r.top,
        h: r.height,
        label: d.getAttribute('aria-label'),
      };
    });
    if (!box) {
      failures.push({
        profile: profile.name,
        state,
        name: '(pop-up)',
        why: 'no role="dialog" on the pop-up, so it is invisible to assistive tech and to this check',
      });
      console.log(`FAIL  ${profile.name} ${state}: pop-up has no dialog role`);
      await page.keyboard.press('Escape');
      return;
    }
    await drag(
      box.x,
      box.y + 14,
      box.x,
      Math.min(box.y + 14 + box.h * 0.7, 800),
    );
    await page.waitForTimeout(900);
    const still = await page.evaluate(
      (label) =>
        [
          ...document.querySelectorAll('[role="dialog"], [role="alertdialog"]'),
        ].some(
          (x) =>
            x.getAttribute('aria-label') === label &&
            x.getBoundingClientRect().height > 0,
        ),
      box.label,
    );
    if (still) {
      failures.push({
        profile: profile.name,
        state,
        name: box.label ?? '(pop-up)',
        why: 'does not close when dragged down',
      });
      console.log(
        `FAIL  ${profile.name} ${state}: "${box.label}" does not swipe down`,
      );
      await page.keyboard.press('Escape');
      await page.waitForTimeout(400);
    } else
      console.log(`PASS  ${profile.name} ${state}: "${box.label}" swipes down`);
  }

  const go = async (route) => {
    await page.evaluate((r) => {
      location.hash = '#/' + r;
    }, route);
    await page.waitForTimeout(600);
  };
  const click = async (name, opts = {}) => {
    const loc =
      opts.exact === false
        ? page.getByRole('button', { name })
        : page.getByRole('button', { name, exact: true });
    await (opts.last ? loc.last() : loc.first()).click({ timeout: 8000 });
    await page.waitForTimeout(opts.wait ?? 400);
  };
  const step = async (name, fn) => {
    try {
      await fn();
    } catch (e) {
      errors.push(`${profile.name} step ${name}: ${e.message.split('\n')[0]}`);
      console.log(
        `ERR   ${profile.name} step ${name}: ${e.message.split('\n')[0]}`,
      );
      await page.keyboard.press('Escape').catch(() => {});
    }
  };

  await page.goto(BASE + '#/today', { waitUntil: 'networkidle' });
  await page.waitForTimeout(700);
  await forceStandaloneCss();
  await reach('today-empty');
  await click('Load sample data');
  await page
    .getByRole('button', { name: /Start workout/ })
    .waitFor({ timeout: 15000 });
  await page.waitForTimeout(600);
  await forceStandaloneCss();

  await step('today', () => reach('today'));
  await step('plan', async () => {
    await go('plan');
    await reach('plan');
    const cards = page.getByRole('button', { name: /exercises/ });
    if ((await cards.count()) > 1) {
      await cards.nth(1).click();
      await reach('plan-day-open');
    }
  });
  await step('builder', async () => {
    await go('routine/new');
    await reach('builder-empty');
    await page.getByRole('textbox').first().fill('Upper A');
    await click('Add exercise', { exact: false });
    await reach('sheet-picker');
    await page.getByRole('textbox', { name: /Search/ }).fill('bench');
    await page.waitForTimeout(500);
    await page.getByRole('button', { name: /^Add / }).first().click();
    await page.waitForTimeout(400);
    for (const q of ['row', 'squat', 'curl', 'press']) {
      await click('Add exercise', { exact: false });
      await page.getByRole('textbox', { name: /Search/ }).fill(q);
      await page.waitForTimeout(450);
      await page.getByRole('button', { name: /^Add / }).first().click();
      await page.waitForTimeout(350);
    }
    await reach('builder-five-exercises');
    await click('Add exercise', { exact: false });
    await swipeDown('sheet-picker');
  });
  await step('library', async () => {
    await go('library');
    await page.waitForTimeout(700);
    await reach('library');
    await click('Filters', { exact: false });
    await reach('sheet-filters');
    await swipeDown('sheet-filters');
    await page.getByRole('button', { name: /e1RM/ }).first().click();
    await page.waitForTimeout(800);
    await reach('exercise-detail');
  });
  await step('trends', async () => {
    await go('history');
    await reach('trends');
  });
  await step('you', async () => {
    await go('settings');
    await reach('you');
    await click('Erase all data', { exact: false });
    await reach('sheet-confirm-erase');
    await swipeDown('sheet-confirm-erase');
    for (const r of ['plates', 'rest-defaults', 'profile']) {
      await go(r);
      await reach(r);
    }
    await go('goals');
    await reach('goals');
    await click('New goal', { exact: false, last: true });
    await reach('popup-new-goal');
    await swipeDown('popup-new-goal');
    await go('measurements');
    await reach('measurements');
    await click('Log measurement', { exact: false });
    await reach('popup-log-measurement');
    await swipeDown('popup-log-measurement');
  });
  await step('onboarding', async () => {
    await go('onboarding');
    for (let i = 1; i <= 5; i++) {
      await reach(`onboarding-${i}`);
      if (i < 5) await click('Continue');
    }
    await go('today');
  });
  await step('session', async () => {
    await go('today');
    await click('Start workout', { exact: false, wait: 900 });
    await reach('log');
    await click('Type weight');
    await reach('sheet-keypad');
    await swipeDown('sheet-keypad');
    const perSide = page.getByRole('button', { name: /Per side/ });
    if (await perSide.count()) {
      await perSide.first().click();
      await reach('sheet-plates');
      await swipeDown('sheet-plates');
    }
    await click('Log set', { exact: false, wait: 800 });
    const keepGoing = page.getByRole('button', { name: 'Keep going' });
    if (await keepGoing.count()) {
      await reach('record');
      await keepGoing.click();
      await page.waitForTimeout(400);
    }
    await reach('rest');
    await click('Skip rest').catch(() => {});
    await click('Finish', { wait: 800 });
    await reach('summary');
    await click('Discard');
    await reach('sheet-confirm-discard');
    await swipeDown('sheet-confirm-discard');
  });

  await ctx.close();
}

for (const p of PROFILES) await run(p);
await browser.close();

const report = { states, failures, warnings, errors };
writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 2));
console.log(
  `\n${states} states; ${failures.length} unreachable or stuck; ${warnings.length} small targets; ${errors.length} step errors`,
);
const byWhy = new Map();
for (const f of failures) {
  const k = `${f.state}: ${f.name} (${f.why.replace(/ at \d+,\d+/, '').replace(/\(centre.*\)/, '')})`;
  byWhy.set(k, [...(byWhy.get(k) ?? []), f.profile]);
}
for (const [k, ps] of byWhy)
  console.log(`  UNREACHABLE ${k} [${ps.join(', ')}]`);
for (const e of errors) console.log(`  ERR ${e}`);
process.exitCode = failures.length || errors.length ? 1 : 0;

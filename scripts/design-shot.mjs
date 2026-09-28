// Deterministic design check for opensets. Drives one browser over the app's screens in
// both modes and at three widths, and hands each rendered page to ./design-check.mjs, which
// owns the rules and cannot launch a browser itself.
//
//   npm run design:check            checks the running preview, exits non-zero on failure
//   npm run design:check:fixtures   calibration: proves the rules still fire correctly
//
// The preview server must be running: npm run build && npm run preview
//
// Env: SHOT_BASE, DESIGN_ROUTES, DESIGN_THEME (colour theme name, default the app default).
//
// Theme is preset in localStorage before the app boots so initTheme() reads it rather than
// us toggling the UI. The premium skin (editorial, one accent) is the only skin now.

import { chromium } from '@playwright/test'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join, basename } from 'node:path'
import {
  checkSurface,
  parseDesignMd,
  deriveTokensFromPage,
  summarize,
  formatReport,
} from './design-check.mjs'

const BASE = process.env.SHOT_BASE ?? 'http://localhost:4173/opensets/'
const ROUTES = (process.env.DESIGN_ROUTES ?? 'today,plan,library,history,settings,plates,rest-defaults,profile,goals,measurements,onboarding,routine/new').split(',')
const COLOR_THEME = process.env.DESIGN_THEME ?? 'signal'
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

const WIDTHS = [
  { w: 360, h: 800 },
  { w: 768, h: 1024 },
  { w: 1440, h: 900 },
]

const PASSES = [
  { tag: 'dark', mode: 'dark', widths: WIDTHS },
  { tag: 'light', mode: 'light', widths: WIDTHS },
  { tag: 'reduce', mode: 'dark', widths: [{ w: 390, h: 844 }], reducedMotion: true },
]

const NA_REASON = {
  'token-discipline': 'no colors or radii declared',
  'off-scale-type': 'no type scale declared',
  'off-scale-space': 'no spacing scale declared',
  'state-coverage': 'no views declared in DESIGN.md, so the four states cannot be located',
  'reduced-motion': 'no prefers-reduced-motion pass ran',
}

function evaluatedSet(tokens, { ranReducePass }) {
  const set = new Set([
    'token-discipline', 'off-scale-type', 'off-scale-space',
    'depth-mixing', 'nested-radius', 'dead-controls', 'contrast',
    'focus-visible', 'target-size', 'overflow',
  ])
  // The scales and palette resolve from token prefixes at runtime, so their presence is
  // decided in the page rather than here. Anything declared only by prefix stays in the
  // set; a prefix that resolves to nothing simply produces no findings.
  if (!tokens.colorTokenPrefix && !(tokens.colors && tokens.colors.length)) set.delete('token-discipline')
  if (!tokens.typeScaleTokenPrefix && !(tokens.typeScale && tokens.typeScale.length)) set.delete('off-scale-type')
  if (!tokens.spaceScaleTokenPrefix && !(tokens.spaceScale && tokens.spaceScale.length)) set.delete('off-scale-space')
  if (tokens.views && tokens.views.length) set.add('state-coverage')
  if (ranReducePass) set.add('reduced-motion')
  return set
}

async function runPass(browser, pass, tokens) {
  const ctx = await browser.newContext({
    viewport: { width: pass.widths[0].w, height: pass.widths[0].h },
    reducedMotion: pass.reducedMotion ? 'reduce' : 'no-preference',
  })
  await ctx.addInitScript((t) => {
    try {
      localStorage.setItem('opensets-theme', t)
    } catch {
      /* ignore */
    }
  }, JSON.stringify({ mode: pass.mode, theme: COLOR_THEME, ds: 'editorial' }))

  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(pass.tag + ': ' + e.message))

  await page.goto(BASE + '#/today', { waitUntil: 'networkidle' })
  await page.reload({ waitUntil: 'networkidle' }) // initTheme reads localStorage on boot
  await page.waitForTimeout(700)
  // Real data: the app's own sample seed, so every screen renders its populated state.
  const seed = page.getByRole('button', { name: 'Load sample data' })
  if (await seed.count()) {
    await seed.first().click()
    await page.getByRole('button', { name: /Start workout/ }).waitFor({ timeout: 15000 })
    await page.waitForTimeout(500)
  }

  const findings = []
  const labels = []
  for (const route of ROUTES) {
    await page.evaluate((r) => {
      location.hash = '#/' + r
    }, route)
    await page.waitForTimeout(450) // hash router swap + any enter transition
    for (const { w, h } of pass.widths) {
      await page.setViewportSize({ width: w, height: h })
      await page.waitForTimeout(150)
      const label = pass.tag + ':' + route + '@' + w
      labels.push(label)
      findings.push(...(await checkSurface(page, tokens, { label, reducedMotion: !!pass.reducedMotion })))
    }
  }
  await ctx.close()
  return { findings, labels, errors }
}

async function checkFixture(browser, file) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' })
  const page = await ctx.newPage()
  await page.goto(pathToFileURL(file).href, { waitUntil: 'load' })
  const tokens = await page.evaluate(() => JSON.parse(document.getElementById('design-tokens').textContent))
  const findings = await checkSurface(page, tokens, { label: basename(file), reducedMotion: true })
  await ctx.close()
  return { findings, tokens }
}

const EXPECTED_FIXTURE_FAILURES = {
  'clean.html': [],
  'broken.html': ['off-scale-type', 'depth-mixing', 'contrast'],
}

async function runFixtures(browser) {
  const dir = join(ROOT, 'tests', 'fixtures', 'design')
  let bad = 0
  for (const name of ['clean.html', 'broken.html']) {
    const { findings, tokens } = await checkFixture(browser, join(dir, name))
    const summary = summarize(findings, evaluatedSet(tokens, { ranReducePass: true }))
    const failed = summary.filter((r) => r.status === 'FAIL').map((r) => r.key).sort()
    const expected = [...EXPECTED_FIXTURE_FAILURES[name]].sort()
    const match = failed.join(',') === expected.join(',')
    console.log(
      formatReport(summary, {
        repo: 'fixture ' + name,
        tokenSource: 'inline #design-tokens',
        surfaces: [name],
        notes: ['expected failures: ' + (expected.join(', ') || 'none')],
        naReason: NA_REASON,
      }),
    )
    console.log(match ? 'CALIBRATION OK: ' + name : 'CALIBRATION MISMATCH: ' + name + ' got [' + failed.join(', ') + ']')
    if (!match) bad++
  }
  return bad ? 1 : 0
}

async function runApp(browser) {
  const declared = parseDesignMd(join(ROOT, 'DESIGN.md'))
  const tokens = declared || (await (async () => {
    const ctx = await browser.newContext()
    const page = await ctx.newPage()
    await page.goto(BASE, { waitUntil: 'networkidle' })
    const derived = await deriveTokensFromPage(page)
    await ctx.close()
    return derived
  })())

  // Concurrent: the passes share nothing but the browser, and the dominant cost is
  // navigation. Promise.all preserves order so the report stays deterministic.
  const results = await Promise.all(PASSES.map((p) => runPass(browser, p, tokens)))
  const all = results.flatMap((r) => r.findings)
  const labels = results.flatMap((r) => r.labels)
  const errors = results.flatMap((r) => r.errors)

  const summary = summarize(all, evaluatedSet(tokens, { ranReducePass: true }))
  const notes = []
  if (!declared) notes.push('no DESIGN.md found, tokens derived from :root')
  notes.push('theme: ' + COLOR_THEME + ' / editorial, modes dark and light')
  if (errors.length) notes.push('PAGE ERRORS: ' + errors.slice(0, 3).join(' | '))
  console.log(
    formatReport(summary, {
      repo: 'opensets',
      tokenSource: tokens.__source || 'DESIGN.md',
      surfaces: [
        labels.length + ' surfaces = ' + PASSES.map((p) => p.tag).join('/') + ' x ' +
          ROUTES.join(',') + ' x ' + WIDTHS.map((w) => w.w).join('/'),
      ],
      notes,
      naReason: NA_REASON,
    }),
  )
  return summary.some((r) => r.status === 'FAIL') ? 1 : 0
}

const browser = await chromium.launch()
process.exitCode = process.argv.includes('--fixtures') ? await runFixtures(browser) : await runApp(browser)
await browser.close()

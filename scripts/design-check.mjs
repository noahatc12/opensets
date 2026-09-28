// Deterministic design check. Answers "does this build match the system it declared?"
// rather than "does this look like everyone else?" — the first question is falsifiable
// against a declared token set and cannot go out of fashion; the second rots as fashion
// moves. See tasks/projects/design_checker.md in JARVIS-v3 for the full rationale.
//
// This module deliberately does NOT import playwright and cannot launch a browser. It is
// handed an already-navigated `page` by scripts/design-shot.mjs, which owns the single
// browser, the localStorage seeding and the viewport matrix. If this file ever needs its
// own launch, the integration is wrong.
//
// Reports per-rule facts only. No aggregate score, no letter grade, no tier — those invite
// optimising the metric, which designer.md lists as a Known Trap.

import { readFileSync, existsSync } from 'node:fs'

export const RULES = [
  { id: 1, key: 'token-discipline', desc: 'colors and radii resolve to declared tokens' },
  { id: 2, key: 'off-scale-type', desc: 'font sizes are on the declared type scale' },
  { id: 3, key: 'off-scale-space', desc: 'padding and margin are on the declared spacing scale' },
  { id: 4, key: 'depth-mixing', desc: 'one depth technique per element, not two' },
  { id: 5, key: 'nested-radius', desc: 'inner radius equals outer minus padding' },
  { id: 6, key: 'state-coverage', desc: 'each declared view renders loading, empty, error, overflow' },
  { id: 7, key: 'dead-controls', desc: 'every button and form has a bound handler' },
  { id: 8, key: 'contrast', desc: 'text meets 4.5:1 body and 3:1 large' },
  { id: 9, key: 'focus-visible', desc: 'every interactive element shows a visible focus indicator' },
  { id: 10, key: 'target-size', desc: 'interactive targets are at least 24x24' },
  { id: 11, key: 'overflow', desc: 'no horizontal overflow at any declared width' },
  { id: 12, key: 'reduced-motion', desc: 'animations respect prefers-reduced-motion' },
]

// ---------------------------------------------------------------------------
// Token loading. DESIGN.md at repo root wins; the :root custom properties are
// the fallback so a repo with no DESIGN.md still gets a meaningful run.
// ---------------------------------------------------------------------------

export function parseDesignMd(path) {
  if (!existsSync(path)) return null
  const text = readFileSync(path, 'utf8')
  const fence = text.match(/```json\s*([\s\S]*?)```/)
  if (!fence) return null
  try {
    const parsed = JSON.parse(fence[1])
    parsed.__source = 'DESIGN.md'
    return parsed
  } catch (err) {
    throw new Error('DESIGN.md contains a ```json block that does not parse: ' + err.message)
  }
}

// Fallback: read every custom property declared anywhere in the document's stylesheets
// and resolve it against the root element. Cross-origin sheets are skipped silently.
export async function deriveTokensFromPage(page) {
  const vars = await page.evaluate(() => {
    const names = new Set()
    for (const sheet of Array.from(document.styleSheets)) {
      let rules
      try {
        rules = sheet.cssRules
      } catch {
        continue
      }
      for (const rule of Array.from(rules || [])) {
        const style = rule.style
        if (!style) continue
        for (let i = 0; i < style.length; i++) {
          const prop = style[i]
          if (prop.startsWith('--')) names.add(prop)
        }
      }
    }
    const root = getComputedStyle(document.documentElement)
    const out = {}
    for (const name of names) {
      const value = root.getPropertyValue(name).trim()
      if (value) out[name] = value
    }
    return out
  })

  const colors = []
  const radii = []
  const space = []
  for (const [name, value] of Object.entries(vars)) {
    if (/^#|^rgb|^hsl|^oklch/i.test(value)) colors.push(value)
    else if (/radius/.test(name) && /px$/.test(value)) radii.push(parseFloat(value))
    else if (/space|gap|pad/.test(name) && /px$/.test(value)) space.push(parseFloat(value))
  }
  return {
    __source: ':root custom properties (no DESIGN.md found)',
    colors,
    radii: radii.length ? radii : null,
    spaceScale: space.length ? space : null,
    typeScale: null,
    views: null,
  }
}

// ---------------------------------------------------------------------------
// The checks. Everything below runs inside the page.
// ---------------------------------------------------------------------------

export async function checkSurface(page, tokens, context) {
  return page.evaluate(
    ([tokens, context]) => {
      const findings = []
      const MAX_DETAIL = 10

      // -- helpers ----------------------------------------------------------
      const parseColor = (str) => {
        if (!str) return null
        const s = str.trim().toLowerCase()
        if (s === 'transparent' || s === 'none') return null
        let m = s.match(/^rgba?\(([^)]+)\)$/)
        if (m) {
          const p = m[1].split(/[,\s/]+/).filter(Boolean).map(parseFloat)
          return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }
        }
        m = s.match(/^#([0-9a-f]{3,8})$/)
        if (m) {
          let h = m[1]
          if (h.length === 3) h = h.split('').map((c) => c + c).join('')
          return {
            r: parseInt(h.slice(0, 2), 16),
            g: parseInt(h.slice(2, 4), 16),
            b: parseInt(h.slice(4, 6), 16),
            a: h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1,
          }
        }
        return null
      }

      const over = (fg, bg) => {
        if (!fg) return bg
        if (fg.a >= 0.999) return fg
        const a = fg.a
        return {
          r: fg.r * a + bg.r * (1 - a),
          g: fg.g * a + bg.g * (1 - a),
          b: fg.b * a + bg.b * (1 - a),
          a: 1,
        }
      }

      const dist = (a, b) => Math.hypot(a.r - b.r, a.g - b.g, a.b - b.b)

      // A color is "on system" if it matches a token, or lies on the segment between
      // two tokens (which is what color-mix() and translucent overlays produce).
      // Custom properties declared anywhere in the document, resolved against the root for
      // whichever theme is active right now. A themed app is one token system expressed in
      // many palettes; transcribing every palette into DESIGN.md by hand would go stale the
      // moment a theme is added, and opensets ships eight themes across two modes.
      const resolvedByPrefix = (prefix) => {
        if (!prefix) return []
        const names = new Set()
        const walk = (list) => {
          for (const rule of Array.from(list || [])) {
            if (rule.cssRules) walk(rule.cssRules)
            const style = rule.style
            if (!style) continue
            for (let i = 0; i < style.length; i++) {
              if (style[i].startsWith(prefix)) names.add(style[i])
            }
          }
        }
        for (const sheet of Array.from(document.styleSheets)) {
          try {
            walk(sheet.cssRules)
          } catch {
            /* cross-origin sheet */
          }
        }
        const root = getComputedStyle(document.documentElement)
        const out = []
        for (const name of names) {
          const value = root.getPropertyValue(name).trim()
          if (value) out.push(value)
        }
        return out
      }

      const TOL = 6
      const baseTokenColors = (tokens.colors || [])
        .concat(resolvedByPrefix(tokens.colorTokenPrefix))
        .map(parseColor)
        .filter(Boolean)
      const resolvedRadii = resolvedByPrefix(tokens.radiusTokenPrefix)
        .map((v) => parseFloat(v))
        .filter((v) => !Number.isNaN(v))
      // A content-driven color (a user's chosen habit color, a category tint) is not a
      // system violation. DESIGN.md names the custom property that carries it; whatever
      // that property resolves to on a given element is allowed on that element, along
      // with anything mixed from it and a system token.
      const onSystem = (c, extra) => {
        const tokenColors = extra ? baseTokenColors.concat([extra]) : baseTokenColors
        for (const t of tokenColors) if (dist(c, t) <= TOL) return true
        for (let i = 0; i < tokenColors.length; i++) {
          for (let j = i + 1; j < tokenColors.length; j++) {
            const a = tokenColors[i]
            const b = tokenColors[j]
            const vx = b.r - a.r
            const vy = b.g - a.g
            const vz = b.b - a.b
            const len2 = vx * vx + vy * vy + vz * vz
            if (len2 === 0) continue
            let t = ((c.r - a.r) * vx + (c.g - a.g) * vy + (c.b - a.b) * vz) / len2
            t = Math.max(0, Math.min(1, t))
            const px = a.r + vx * t
            const py = a.g + vy * t
            const pz = a.b + vz * t
            if (Math.hypot(c.r - px, c.g - py, c.b - pz) <= TOL) return true
          }
        }
        return false
      }

      const lum = (c) => {
        const f = (v) => {
          v /= 255
          return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
        }
        return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b)
      }
      const ratio = (a, b) => {
        const la = lum(a)
        const lb = lum(b)
        return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
      }

      const selectorFor = (el) => {
        if (!el || el === document.documentElement) return 'html'
        const tag = el.tagName.toLowerCase()
        const cls = (el.getAttribute('class') || '').trim().split(/\s+/).filter(Boolean)[0]
        let base = cls ? tag + '.' + cls : tag
        const parent = el.parentElement
        if (parent) {
          const sibs = Array.from(parent.children).filter(
            (s) => s.tagName === el.tagName && (s.getAttribute('class') || '').includes(cls || ''),
          )
          if (sibs.length > 1) base += ':nth-of-type(' + (sibs.indexOf(el) + 1) + ')'
        }
        return base
      }

      const visible = (el, cs, rect) =>
        rect.width > 0 &&
        rect.height > 0 &&
        cs.visibility !== 'hidden' &&
        cs.display !== 'none' &&
        parseFloat(cs.opacity) > 0.01

      // Memoised: without the cache this restarts the whole ancestor walk for every element
      // in three separate rules, which is quadratic in tree depth and was most of the run
      // time on a real page.
      const bgCache = new Map()
      const effectiveBg = (el) => {
        if (!el) return { r: 255, g: 255, b: 255, a: 1 }
        const hit = bgCache.get(el)
        if (hit) return hit
        const c = parseColor(getComputedStyle(el).backgroundColor)
        let result
        if (c && c.a > 0.01) {
          result = c.a >= 0.999 ? c : over(c, effectiveBg(el.parentElement))
        } else {
          result = el.parentElement ? effectiveBg(el.parentElement) : { r: 255, g: 255, b: 255, a: 1 }
        }
        bgCache.set(el, result)
        return result
      }

      const add = (ruleKey, detail) => findings.push({ rule: ruleKey, detail, surface: context.label })

      const els = Array.from(document.querySelectorAll('body *'))
      const live = []
      for (const el of els) {
        const cs = getComputedStyle(el)
        const rect = el.getBoundingClientRect()
        if (!visible(el, cs, rect)) continue
        live.push({ el, cs, rect })
      }

      // -- rule 11: overflow -------------------------------------------------
      const docX = document.documentElement.scrollWidth - document.documentElement.clientWidth
      if (docX > 0) add('overflow', 'html scrollWidth exceeds clientWidth by ' + docX + 'px')

      // -- rule 12: reduced motion (only meaningful in the reduce pass) -------
      if (context.reducedMotion) {
        let motionHits = 0
        for (const { el, cs } of live) {
          if (cs.animationName && cs.animationName !== 'none') {
            const dur = parseFloat(cs.animationDuration) || 0
            if (dur > 0.01) {
              motionHits++
              if (motionHits <= MAX_DETAIL)
                add(
                  'reduced-motion',
                  selectorFor(el) + ' runs ' + cs.animationName + ' for ' + cs.animationDuration + ' under prefers-reduced-motion: reduce',
                )
            }
          }
        }
        if (motionHits > MAX_DETAIL) add('reduced-motion', '(+' + (motionHits - MAX_DETAIL) + ' more)')
      }

      // The remaining rules are width- and theme-independent in their logic but are
      // evaluated per surface so a failure names the surface it appeared on.

      // -- rule 1: token discipline (colors + radii) -------------------------
      if (baseTokenColors.length) {
        const offColors = new Map()
        for (const { el, cs } of live) {
          const bg = effectiveBg(el)
          const userColor = tokens.userColorProperty
            ? parseColor(cs.getPropertyValue(tokens.userColorProperty).trim())
            : null
          for (const prop of ['color', 'backgroundColor', 'borderTopColor']) {
            if (prop === 'borderTopColor' && parseFloat(cs.borderTopWidth) === 0) continue
            // A colour written straight onto the element by script is content, not a
            // stylesheet decision: theme swatches, chart series, a user's chosen tint. The
            // token system cannot be expected to contain it, and judging it here is how a
            // checker ends up reporting data as a defect.
            if (el.style && (el.style[prop] || (prop === 'backgroundColor' && el.style.background))) continue
            const raw = parseColor(cs[prop])
            if (!raw || raw.a < 0.01) continue
            const composited = over(raw, bg)
            if (onSystem(composited, userColor)) continue
            const key = prop + ' ' + Math.round(composited.r) + ',' + Math.round(composited.g) + ',' + Math.round(composited.b)
            if (!offColors.has(key)) offColors.set(key, selectorFor(el))
          }
        }
        let shown = 0
        for (const [key, sel] of offColors) {
          if (shown++ < MAX_DETAIL) add('token-discipline', sel + '  ' + key + '  not a token and not a blend of two tokens')
        }
        if (offColors.size > MAX_DETAIL) add('token-discipline', '(+' + (offColors.size - MAX_DETAIL) + ' more distinct off-token colors)')
      }
      const declaredRadii = (tokens.radii || []).concat(resolvedRadii)
      if (declaredRadii.length) {
        const allowed = declaredRadii.concat([0])
        const offRadii = new Map()
        for (const { el, cs, rect } of live) {
          const pillRadius = Math.min(rect.width, rect.height) / 2
          for (const prop of ['borderTopLeftRadius', 'borderTopRightRadius', 'borderBottomLeftRadius', 'borderBottomRightRadius']) {
            const v = cs[prop]
            if (v.includes('%')) continue // pills and circles are intentional
            const px = parseFloat(v) || 0
            // A radius at or past half the short side is a pill or circle, which is a shape
            // decision rather than a value off the radius scale.
            if (px >= pillRadius) continue
            if (allowed.some((a) => Math.abs(a - px) <= 0.51)) continue
            const key = px + 'px'
            if (!offRadii.has(key)) offRadii.set(key, selectorFor(el))
          }
        }
        let shown = 0
        for (const [key, sel] of offRadii) {
          if (shown++ < MAX_DETAIL) add('token-discipline', sel + '  radius ' + key + '  off the declared radius set')
        }
        if (offRadii.size > MAX_DETAIL) add('token-discipline', '(+' + (offRadii.size - MAX_DETAIL) + ' more off-token radii)')
      }

      // -- rule 2: off-scale type -------------------------------------------
      const numbersByPrefix = (prefix) =>
        resolvedByPrefix(prefix)
          .map((v) => parseFloat(v))
          .filter((v) => !Number.isNaN(v))
      const declaredType = (tokens.typeScale || []).concat(numbersByPrefix(tokens.typeScaleTokenPrefix))
      if (declaredType.length) {
        const offType = new Map()
        for (const { el, cs } of live) {
          const hasText = Array.from(el.childNodes).some((n) => n.nodeType === 3 && n.textContent.trim())
          if (!hasText) continue
          const size = parseFloat(cs.fontSize)
          if (declaredType.some((s) => Math.abs(s - size) <= 0.51)) continue
          const key = size + 'px'
          if (!offType.has(key)) offType.set(key, selectorFor(el))
        }
        let shown = 0
        for (const [key, sel] of offType) {
          if (shown++ < MAX_DETAIL) add('off-scale-type', sel + '  font-size ' + key + '  off the declared type scale')
        }
        if (offType.size > MAX_DETAIL) add('off-scale-type', '(+' + (offType.size - MAX_DETAIL) + ' more distinct off-scale sizes)')
      }

      // -- rule 3: off-scale space ------------------------------------------
      const declaredSpace = (tokens.spaceScale || []).concat(numbersByPrefix(tokens.spaceScaleTokenPrefix))
      if (declaredSpace.length) {
        const allowed = declaredSpace.concat([0])
        const offSpace = new Map()
        for (const { el, cs, rect } of live) {
          // `margin-inline: auto` resolves to a used pixel value that grows with the
          // viewport, so a centred column reports 496px of margin at 1440px wide. That is
          // centring, not a spacing choice, and it can never be on a spacing scale.
          const ml = parseFloat(cs.marginLeft) || 0
          const mr = parseFloat(cs.marginRight) || 0
          const parentW = el.parentElement ? el.parentElement.clientWidth : 0
          const centred =
            ml > 0 && Math.abs(ml - mr) <= 1 && Math.abs(parentW - (rect.width + ml + mr)) <= 2
          for (const prop of [
            'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
            'marginTop', 'marginRight', 'marginBottom', 'marginLeft',
          ]) {
            if (centred && (prop === 'marginLeft' || prop === 'marginRight')) continue
            const raw = cs[prop]
            if (raw === 'auto' || raw.includes('%')) continue
            const px = parseFloat(raw) || 0
            if (allowed.some((a) => Math.abs(a - Math.abs(px)) <= 0.51)) continue
            const key = prop.replace(/([A-Z])/g, '-$1').toLowerCase() + ' ' + px + 'px'
            if (!offSpace.has(key)) offSpace.set(key, selectorFor(el))
          }
        }
        let shown = 0
        for (const [key, sel] of offSpace) {
          if (shown++ < MAX_DETAIL) add('off-scale-space', sel + '  ' + key + '  off the declared spacing scale')
        }
        if (offSpace.size > MAX_DETAIL) add('off-scale-space', '(+' + (offSpace.size - MAX_DETAIL) + ' more off-scale spacing values)')
      }

      // -- rule 4: depth mixing ---------------------------------------------
      {
        let hits = 0
        for (const { el, cs, rect } of live) {
          if (rect.width < 24 || rect.height < 24) continue
          const techniques = []
          if (cs.boxShadow && cs.boxShadow !== 'none' && !/inset/.test(cs.boxShadow)) techniques.push('shadow')
          const bw = ['borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth']
            .map((p) => parseFloat(cs[p]) || 0)
            .reduce((a, b) => a + b, 0)
          const borderVisible = bw > 0 && cs.borderTopStyle !== 'none' && (parseColor(cs.borderTopColor) || { a: 0 }).a > 0.01
          if (borderVisible) techniques.push('border')
          const own = parseColor(cs.backgroundColor)
          if (own && own.a > 0.01 && el.parentElement) {
            const parentBg = effectiveBg(el.parentElement)
            if (dist(over(own, parentBg), parentBg) > TOL) techniques.push('tone-step')
          }
          if (techniques.length >= 2) {
            hits++
            if (hits <= MAX_DETAIL) add('depth-mixing', selectorFor(el) + '  uses ' + techniques.join(' + '))
          }
        }
        if (hits > MAX_DETAIL) add('depth-mixing', '(+' + (hits - MAX_DETAIL) + ' more elements mixing depth techniques)')
      }

      // -- rule 5: nested radius --------------------------------------------
      {
        let hits = 0
        for (const { el, cs, rect } of live) {
          const inner = parseFloat(cs.borderTopLeftRadius) || 0
          if (inner <= 0 || cs.borderTopLeftRadius.includes('%')) continue
          // A radius at or past half the short side is a pill or a circle. That is a shape
          // decision, not a nested-corner relationship, and the concentric formula says
          // nothing useful about it.
          if (inner >= Math.min(rect.width, rect.height) / 2) continue
          // Only a surface can be a nested surface. A bare span that happens to sit in the
          // corner is not the thing this rule is about.
          const innerBg = parseColor(cs.backgroundColor)
          const innerHasBorder = (parseFloat(cs.borderTopWidth) || 0) > 0 && cs.borderTopStyle !== 'none'
          if (!(innerBg && innerBg.a > 0.01) && !innerHasBorder) continue
          let outerEl = el.parentElement
          while (outerEl && outerEl !== document.body) {
            const ocs = getComputedStyle(outerEl)
            const outer = parseFloat(ocs.borderTopLeftRadius) || 0
            if (outer > 0 && !ocs.borderTopLeftRadius.includes('%')) {
              const pad = parseFloat(ocs.paddingLeft) || 0
              const padTop = parseFloat(ocs.paddingTop) || 0
              const orect = outerEl.getBoundingClientRect()
              const insetLeft = rect.left - orect.left
              const insetTop = rect.top - orect.top
              // The corners are only concentric when the inner element is seated against
              // BOTH the left and top padding edges, and when the padding is smaller than
              // the outer radius. Once padding exceeds the radius the corners are nowhere
              // near each other and any inner radius is defensible.
              const seated = Math.abs(insetLeft - pad) <= 2 && Math.abs(insetTop - padTop) <= 2
              if (seated && pad > 0 && pad < outer) {
                const expected = Math.max(0, outer - pad)
                if (Math.abs(inner - expected) > 1) {
                  hits++
                  if (hits <= MAX_DETAIL)
                    add(
                      'nested-radius',
                      selectorFor(el) + ' radius ' + inner + 'px inside ' + selectorFor(outerEl) +
                        ' radius ' + outer + 'px with ' + pad + 'px padding; expected ' + expected + 'px',
                    )
                }
              }
              break
            }
            outerEl = outerEl.parentElement
          }
        }
        if (hits > MAX_DETAIL) add('nested-radius', '(+' + (hits - MAX_DETAIL) + ' more nested radius mismatches)')
      }

      // -- rule 7: dead controls --------------------------------------------
      {
        let hits = 0
        const controls = live.filter(
          ({ el }) =>
            el.tagName === 'BUTTON' ||
            el.tagName === 'FORM' ||
            (el.tagName === 'INPUT' && ['button', 'submit', 'checkbox', 'radio'].includes(el.type)),
        )
        for (const { el } of controls) {
          if (el.disabled || el.getAttribute('aria-disabled') === 'true') continue
          const reactKey = Object.keys(el).find((k) => k.startsWith('__reactProps$'))
          const props = reactKey ? el[reactKey] : null
          const boundViaReact = props && Object.keys(props).some((k) => /^on[A-Z]/.test(k) && typeof props[k] === 'function')
          const boundViaAttr = Array.from(el.attributes).some((a) => /^on[a-z]+$/.test(a.name))
          const boundViaProp = ['onclick', 'onsubmit', 'onchange'].some((p) => typeof el[p] === 'function')
          const submitInForm = el.type === 'submit' && el.form
          const formHasAction = el.tagName === 'FORM' && (el.getAttribute('action') || boundViaReact)
          if (boundViaReact || boundViaAttr || boundViaProp || submitInForm || formHasAction) continue
          hits++
          if (hits <= MAX_DETAIL) add('dead-controls', selectorFor(el) + '  <' + el.tagName.toLowerCase() + '> has no bound handler')
        }
        if (hits > MAX_DETAIL) add('dead-controls', '(+' + (hits - MAX_DETAIL) + ' more unbound controls)')
      }

      // -- rule 8: contrast --------------------------------------------------
      {
        let hits = 0
        const seen = new Set()
        for (const { el, cs } of live) {
          const hasText = Array.from(el.childNodes).some((n) => n.nodeType === 3 && n.textContent.trim())
          if (!hasText) continue
          const fg = parseColor(cs.color)
          if (!fg) continue
          const bg = effectiveBg(el)
          const composited = over(fg, bg)
          const size = parseFloat(cs.fontSize)
          const weight = parseInt(cs.fontWeight, 10) || 400
          const large = size >= 24 || (size >= 18.66 && weight >= 700)
          const need = large ? 3 : 4.5
          const got = ratio(composited, bg)
          if (got >= need) continue
          const key = selectorFor(el) + got.toFixed(2)
          if (seen.has(key)) continue
          seen.add(key)
          hits++
          if (hits <= MAX_DETAIL)
            add('contrast', selectorFor(el) + '  ' + got.toFixed(2) + ':1 at ' + size + 'px, needs ' + need + ':1')
        }
        if (hits > MAX_DETAIL) add('contrast', '(+' + (hits - MAX_DETAIL) + ' more below threshold)')
      }

      // -- rule 9: focus visible --------------------------------------------
      {
        let hits = 0
        const previouslyFocused = document.activeElement

        // Programmatic focus() does not reliably trigger :focus-visible in Chromium, so
        // comparing computed styles before and after focus() would report a false failure
        // on every app that styles focus correctly through that pseudo-class. Read the
        // stylesheets for a focus rule that actually draws an indicator, and accept that
        // as evidence in addition to the observed style change.
        const focusSelectors = []
        const collect = (ruleList) => {
          for (const rule of Array.from(ruleList || [])) {
            // With CSS nesting every style rule carries a cssRules list, usually empty, so a
            // rule is walked into AND read: skipping it on the presence of the list alone
            // missed every focus rule in the sheet (2026-09-27).
            if (rule.cssRules && rule.cssRules.length) collect(rule.cssRules)
            if (!rule.selectorText || !/:focus(-visible)?\b/.test(rule.selectorText)) continue
            if (!/outline|box-shadow|border/.test(rule.style.cssText)) continue
            for (const part of rule.selectorText.split(',')) {
              const bare = part.replace(/:focus(-visible)?/g, '').trim()
              if (bare) focusSelectors.push(bare)
            }
          }
        }
        for (const sheet of Array.from(document.styleSheets)) {
          try {
            collect(sheet.cssRules)
          } catch {
            /* cross-origin sheet */
          }
        }
        const styledByRule = (el) =>
          focusSelectors.some((s) => {
            try {
              return el.matches(s)
            } catch {
              return false
            }
          })
        const interactive = live.filter(
          ({ el }) =>
            ['BUTTON', 'A', 'INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName) ||
            el.hasAttribute('tabindex'),
        )
        for (const { el } of interactive) {
          if (el.disabled) continue
          if (el.tagName === 'A' && !el.hasAttribute('href')) continue
          const before = getComputedStyle(el)
          const snapshot = [before.outlineWidth, before.outlineColor, before.outlineStyle, before.boxShadow, before.borderColor].join('|')
          try {
            el.focus({ preventScroll: true })
          } catch {
            continue
          }
          const after = getComputedStyle(el)
          const afterSnap = [after.outlineWidth, after.outlineColor, after.outlineStyle, after.boxShadow, after.borderColor].join('|')
          const outlineShown = parseFloat(after.outlineWidth) > 0 && after.outlineStyle !== 'none' && (parseColor(after.outlineColor) || { a: 0 }).a > 0.01
          if (!outlineShown && afterSnap === snapshot && !styledByRule(el)) {
            hits++
            if (hits <= MAX_DETAIL) add('focus-visible', selectorFor(el) + '  no visible change on focus and no :focus rule draws an indicator')
          }
        }
        try {
          if (previouslyFocused && previouslyFocused.focus) previouslyFocused.focus({ preventScroll: true })
          else if (document.activeElement && document.activeElement.blur) document.activeElement.blur()
        } catch {
          /* restoring focus is best-effort */
        }
        if (hits > MAX_DETAIL) add('focus-visible', '(+' + (hits - MAX_DETAIL) + ' more without a focus indicator)')
      }

      // -- rule 10: target size ---------------------------------------------
      {
        let hits = 0
        for (const { el, rect } of live) {
          const interactive =
            ['BUTTON', 'A', 'INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName) || el.hasAttribute('tabindex')
          if (!interactive) continue
          if (el.tagName === 'A' && !el.hasAttribute('href')) continue
          if (el.disabled) continue
          if (rect.width < 24 || rect.height < 24) {
            hits++
            if (hits <= MAX_DETAIL)
              add('target-size', selectorFor(el) + '  ' + Math.round(rect.width) + 'x' + Math.round(rect.height) + ', below 24x24')
          }
        }
        if (hits > MAX_DETAIL) add('target-size', '(+' + (hits - MAX_DETAIL) + ' more undersized targets)')
      }

      // -- rule 6: state coverage -------------------------------------------
      if (tokens.views && tokens.views.length) {
        for (const view of tokens.views) {
          for (const state of ['loading', 'empty', 'error', 'overflow']) {
            const sel = view.states && view.states[state]
            if (!sel) {
              add('state-coverage', view.name + ' declares no ' + state + ' selector')
              continue
            }
            if (!document.querySelector(sel)) {
              add('state-coverage', view.name + ' ' + state + ' state not rendered (' + sel + ')')
            }
          }
        }
      }

      return findings
    },
    [tokens, context],
  )
}

// ---------------------------------------------------------------------------
// Merge + report
// ---------------------------------------------------------------------------

export function summarize(allFindings, evaluated) {
  return RULES.map((rule) => {
    const hits = allFindings.filter((f) => f.rule === rule.key)
    // The same defect shows up on every surface it is visible on. Report it once, and say
    // how many surfaces carried it, rather than printing it seven times.
    const grouped = new Map()
    for (const hit of hits) {
      const existing = grouped.get(hit.detail)
      if (existing) existing.surfaces.push(hit.surface)
      else grouped.set(hit.detail, { detail: hit.detail, surfaces: [hit.surface] })
    }
    const wasEvaluated = evaluated.has(rule.key)
    return {
      ...rule,
      status: !wasEvaluated ? 'n/a' : hits.length ? 'FAIL' : 'PASS',
      detail: Array.from(grouped.values()),
    }
  })
}

export function formatReport(summary, meta) {
  const lines = []
  lines.push('')
  lines.push('DESIGN CHECK  ' + meta.repo)
  lines.push('tokens: ' + meta.tokenSource)
  lines.push('surfaces: ' + meta.surfaces.join(', '))
  if (meta.notes) for (const note of meta.notes) lines.push('note: ' + note)
  lines.push('')
  for (const rule of summary) {
    const id = String(rule.id).padStart(2, ' ')
    lines.push('  ' + id + '  ' + rule.key.padEnd(18) + rule.status.padEnd(6) + rule.desc)
    if (rule.status === 'n/a' && meta.naReason[rule.key]) {
      lines.push('        ' + meta.naReason[rule.key])
    }
    for (const hit of rule.detail) {
      const where =
        hit.surfaces.length === 1
          ? hit.surfaces[0]
          : hit.surfaces[0] + ' +' + (hit.surfaces.length - 1) + ' more surfaces'
      lines.push('        [' + where + '] ' + hit.detail)
    }
  }
  const failed = summary.filter((r) => r.status === 'FAIL')
  const na = summary.filter((r) => r.status === 'n/a')
  lines.push('')
  lines.push(
    failed.length
      ? 'FAIL: ' + failed.length + ' of ' + summary.length + ' rules (' + failed.map((r) => r.key).join(', ') + ')'
      : 'PASS: all evaluated rules clean',
  )
  if (na.length) lines.push('not evaluated: ' + na.map((r) => r.key).join(', '))
  lines.push('')
  return lines.join('\n')
}

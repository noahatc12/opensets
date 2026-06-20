# Design handoff intake

Drop the Claude Design export here (or anywhere — just tell JARVIS the path).

**Most useful, in order:**
1. The canonical **CSS file** — design tokens + component styles.
2. The **component / screen prototype** (React or HTML) — real markup.
3. **Theme definitions** — curated presets + the custom-theme derivation rules.
4. Screenshots (bonus; the files are what matter).

## The port process (render-the-reference, per the Tally lesson)

1. **Render the prototype first** and capture it at ~390px — this screenshot is *the bar*.
2. **Vendor the real artifacts** (adopt the actual CSS as a superset, port the components).
3. Keep `src/engine` + the data layer **frozen**; wire the new UI to them through a thin adapter.
4. **Verify every ported surface against the reference screenshot**, not against my own intent.
5. Revise with Noah as device QA.

Once the files are here, JARVIS captures the reference and begins the faithful port.

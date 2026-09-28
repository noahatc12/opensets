# OpenSets design system, declared

This file is the answer to the only question `npm run design:check` asks: **is the build what
it said it would be?** Not "is it fashionable", not "is it like everyone else" — those
questions rot as fashion moves. This one is falsifiable and stays falsifiable.

The checker reads the fenced `json` block below. Everything outside it is for people.

## Why this file is mostly pointers

Unlike a repo that hardcodes values, opensets already has a real token system:
`src/styles/editorial.css` (the premium skin: surfaces, ink tiers, the one accent, the plate
colours, the type and radius steps) over `src/styles/theme.css` (the Tailwind bridge and the
spacing scale). **The token files are the declaration.** Transcribing them here would create a
second source of truth that goes stale, and the skin renders in two modes.

So the block below mostly names *which prefixes are authoritative*, and the checker resolves
them against `:root` for whichever theme is active at the moment it runs. Add a theme and the
check covers it for free. Rename a token prefix and this file needs updating, which is the
correct place for that cost to land.

The skin has one accent and two modes (2026-09-27). This check only reads it.

## What is deliberately not declared

- **`views` is null**, so rule 6 (state-coverage) reports `n/a`. Declaring each data view and
  the selectors for its loading, empty, error and overflow states is real work, and inventing
  them would defeat the purpose of the rule.
- **No `userColorProperty`.** opensets has no user-chosen per-item colour the way a habit
  tracker does. Plate colours are data and are written as `--p45`, `--p35` and so on, which
  the `--color-` prefix does not cover; the check reports them as off-token and that is the
  accepted reading, since a plate's colour is a fact, not a palette decision.

## Known deviations from the spec, stated rather than hidden

- **Rule 1 checks colours and radii, not type and spacing.** Rules 2 and 3 already own those
  at higher resolution; failing the same element twice adds noise, not information.
- **Rule 12 checks animations, not transitions.** A transition answering a user's action is
  welcome under `prefers-reduced-motion`; an animation running on its own is not.

```json
{
  "name": "OpenSets",
  "colorTokenPrefix": "--color-",
  "radiusTokenPrefix": "--r-",
  "typeScaleTokenPrefix": "--text-",
  "spaceScaleTokenPrefix": "--sp-",
  "views": null
}
```

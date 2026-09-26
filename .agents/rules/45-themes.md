---
description: Party themes are a palette plus a skin that fits the idea
trigger: glob
globs:
  - apps/web/src/theme/**/*.ts
  - apps/web/src/theme/**/*.tsx
  - apps/web/src/theme/**/*.css
---

# Themes

A theme is not a colour swap. It is a palette plus a skin that makes the shared chrome feel like the idea. Phones and the projector choose a theme separately. The choice is not pushed by the room.

Recognise:

- "Add a theme …"
- "New palette for …"
- "Make a theme where …"

Read these before editing:

- `apps/web/src/theme/themes.ts` for colours, roles, categories, and `DEFAULT_THEME_ID`
- `apps/web/src/theme/skins.ts` for families
- `apps/web/src/theme/theme-skin.css` for grounds and corner tokens
- `apps/web/src/theme/wordmark.tsx` for marks
- `apps/web/src/theme/install.ts` for how `data-theme` and `data-skin` are applied

## Palette

Add the palette in `themes.ts`. That file is the only place colour values are written.

- The id is lowercase letters, numbers, and hyphens. The object key matches the id. The display name may keep punctuation.
- Fill every palette role: background, foreground, muted, accent, accentForeground, highlight, highlightForeground, surface, surfaceForeground, line, mark, markQuiet.
- Set `colorScheme` from the ground. Use `light` when the ground is cream, paper, white, or yellow. Otherwise use `dark`.
- Accent and highlight are both text on the page background and fills for buttons. Both pairs need contrast, and so do their foreground colours on those fills. `mark` on `markQuiet` stays strong enough for a join code.
- List the theme in exactly one `themeCategories` group. A missing or repeated id fails the typecheck.
- Leave `DEFAULT_THEME_ID` as `26-basic` unless the user asks to change the party default.
- Do not recolour `apps/web/public/favicon.svg`. It stays the 26 basic mark.

## Skin

`26-basic` is the only plain theme. Every other theme has an entry in `skins.ts`. The map is every theme id except `26-basic`, so a new theme that only has colours fails typecheck.

Choose the skin for the idea, not for whichever family was used last.

1. Join an existing family when that ground, shape, and mark already say the idea. School lines, a nightclub stripe, a terminal grid, a floodlight, and a foil edge are families. Reuse them.
2. Add a ground, shape, or mark only when no family fits. Put the ground in `theme-skin.css`, built from the theme's own variables (`--background`, `--surface`, `--accent`, `--highlight`, `--line`). Add a small original stroke in `wordmark.tsx`. Do not copy an official logo, crest, or album mark.
3. Do not leave the new theme on the plain chrome.

The skin changes the shared frame only:

- **Ground.** A fixed layer behind the page. It never sits on a question, option, score, or answer.
- **Shape.** `--radius-control` and `--radius-panel` on the shared controls.
- **Mark.** The navbar 26, shown from `data-mark`.

Question flow, scoring, and copy stay put. Patterns are static. Do not add a looping animation on a control. Reduced motion already removes the corner transition.

## Check

- `npx tsc -b apps/web`
- `npx vitest run src/theme/skins.test.ts` in `apps/web`
- Preview with `?theme=its-id` and confirm the ground, corners, and mark are visible while the question text stays readable.

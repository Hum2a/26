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

1. Join an existing family when that ground, shape, mark, and finish already say the idea. School lines, a nightclub stripe, a terminal grid, a floodlight, and a foil edge are families. Reuse them.
2. Add a ground, shape, or mark only when no family fits. Put the ground in `theme-skin.css`, built from the theme's own variables (`--background`, `--surface`, `--accent`, `--highlight`, `--line`). Take the mark from the icon packs below. Draw a new stroke in `wordmark.tsx` only when none of those packs has a fitting icon.
3. Do not leave the new theme on the plain chrome.

The skin changes the shared frame only:

- **Ground.** A fixed layer behind the page. It never sits on a question, option, score, or answer.
- **Shape.** `--radius-control` and `--radius-panel` on the shared controls.
- **Mark.** The navbar 26, shown from `data-mark`.
- **Finish.** How solid the frame is: `solid`, `glass`, `cartoon`, `realistic`, `minimal`, or `extravagant`. Pick the one that fits the idea. `26 basic` stays `solid`. Glass keeps a readable plate over the ground, and reduced motion turns its blur off. Cartoon is a thick outline and a hard shadow, with no bounce. Realistic is depth only. A finish never outlines the heading, never covers an option, and never loops.
- **Motif.** An optional static icon on the ground: `none`, `crest`, `scatter`, or `bleed`. Use `none` when the ground pattern is already the picture, including `26 basic`. Company marks come from Simple Icons. Other motifs come from Lucide. The icon stays behind the question.

Question flow, scoring, and copy stay put. Do not add a looping animation on a control or a question. Reduced motion already removes the corner transition.

## Deep layer

A skin family also has a deep layer in `apps/web/src/theme/deep-skins.ts`, drawn by `theme-deep.css`. It goes beyond the surface, so two themes in different families feel like different products, not recolours. Every family except 26 basic's `plain` needs an entry; `deep-skins.test.ts` fails otherwise.

- **Type.** `grotesk`, `serif`, `mono`, `condensed`, `rounded`, `slab` or `italic`: sets `--font-display` and `--font-sans` and the heading case. Use system font stacks; do not load web fonts from the network.
- **Scene.** An illustrated background in the ground (spotlights, stars, falling code, an equaliser, a sunburst, confetti, doodles, lasers, hills, a synthwave grid, palms, a notebook, speed lines, shards, cubes, a road, receipts, a pub, a pitch, a globe). Built from the 24 `.deep-scene i` pieces, which carry `--x`, `--y`, `--s`, `--d` and `--r`. A scene may move slowly; keep anything behind a title faint, and keep bright shapes off the left third where titles sit.
- **Texture.** A faint full-screen layer over the page, like a shader: `grain`, `scanlines`, `crt`, `halftone`, `vignette` or `holo`. It ignores the pointer. Keep it light: the edges of the page carry text, so a vignette darkens corners only.
- **Control and panel.** The shape, edge and lighting of buttons (`neon`, `bevel`, `hard-shadow`, `slant`, `bracket`, `scoreboard`, `stamp`, `pill-glass`) and cards (`glass`, `double`, `taped`, `terminal`, `tilted`, `receipt`, `notebook`, `jagged`, `scoreboard`, `polaroid`).
- **Heading.** How question and page titles are dressed: `shadow-stack`, `glow`, `gradient`, `highlighter`, `prompt`, `ransom`, `stamp`, `marquee` or `underline`. The text must stay as readable as plain.
- **Motion.** The `--ease-party` curve and how a panel arrives, once: `snappy`, `springy`, `floaty`, `glitchy`, `cinematic` or `mechanical`.
- **Align.** Headings `left` or `center`.
- **Phone.** The same control and panel values dress the guest phone: the phone bar and dock, choice tiles and their letter marks, the picked state, the slider thumb and track, and text fields. A new control or panel value needs its phone rules too, and an option's text stays upright and on one layer.

Choose the combination for the idea, not the last family. A new value goes in both `deep-skins.ts` and `theme-deep.css`, built only from the theme's colour variables. Reduced motion stops every scene and texture animation, turns panel arrivals into a short fade, and turns off glass blur.

## Icons

Icon packs are installed in `@26/web`. Search the live set before adding an icon, and import one icon at a time. Do not trace a logo from a brand site or a fan page. If Simple Icons has no slug, say so and use a generic icon.

Render with the offline Iconify component so a missing icon does not call the network:

```tsx
import { Icon } from "@iconify/react/dist/offline";
import car from "@iconify-icons/lucide/car";

<Icon icon={car} />;
```

From the repo root, the pinned installs are:

```
npm install @iconify/react@6.0.2 -w @26/web
npm install @iconify-icons/lucide@2.0.13 -w @26/web
npm install @iconify-icons/simple-icons@2.0.4 -w @26/web
npm install @iconify-icons/game-icons@2.0.0 -w @26/web
npm install @iconify-icons/mdi@2.0.0 -w @26/web
```

The import path is `@iconify-icons/{prefix}/{icon-name}`.

| Category                                                                                                                                            | Pack                                                           | Look for                                                                                  |
| --------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| 26 basic, Personal to 26, Quiz and chaos, Dark and atmospheric, Light and nostalgic, Personal to the night, Everyday, School, Work, Musicians, Cars | [Lucide](https://icon-sets.iconify.design/lucide/)             | circle, user, circle-help, moon, sun, star, coffee, graduation-cap, briefcase, music, car |
| Cars, Work, Musicians, Games, and any named company, bank, platform, or artist                                                                      | [Simple Icons](https://icon-sets.iconify.design/simple-icons/) | nissan, toyota, and the brand slug                                                        |
| Games, and a pictogram that is not a publisher logo                                                                                                 | [Game Icons](https://icon-sets.iconify.design/game-icons/)     | dice, swords, cards                                                                       |
| A shape Lucide does not have                                                                                                                        | [Material Design Icons](https://icon-sets.iconify.design/mdi/) | the closest generic glyph                                                                 |

Persona, Anime, and Crossovers use Lucide for the tab. Use Simple Icons only when that studio, series, or platform has a slug. Game Icons does not include franchise characters.

The favicon stays the 26 basic mark.

## Check

- `npx tsc -b apps/web`
- `npx vitest run src/theme` in `apps/web` (skins and deep skins)
- Preview with `?theme=its-id` and confirm the ground, corners, mark, and finish are visible while the question text stays readable. If the theme has a motif, the icon shows in the margin and a point on the heading still hits the heading.

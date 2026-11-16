---
description: Phone, stage, and admin screens
trigger: glob
globs:
  - apps/web/**/*.ts
  - apps/web/**/*.tsx
---

# Web app

- Use British English, accessible controls, and clear phone states. Support reduced motion. Keep audio optional.
- Keep phones and the projector instant: `.agents/rules/60-perf-web.md`, `63-perf-game-loops.md`, `64-perf-assets.md`. Lazy-load kart/chess, no per-frame React state, terminate workers.
- Follow the design and motion rules. Open the live library docs listed there before copying a component; ease every visible change. Admin (`/admin`) uses the compact operator chrome in `40-design.md`, not the large guest/stage button language.
- Keep secrets and personal diagnostics off the projector and the stage screen.
- Do not import server auth modules into the web app.
- Do not put answer keys, truth nicknames, or scoring secrets in client code.
- A new theme is a palette plus a skin. Follow the theme rule. Do not ship colours alone. Icons for a category or a brand come from the packs named there.

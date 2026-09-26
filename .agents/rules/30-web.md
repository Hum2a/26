---
description: Phone, stage, and admin screens
trigger: glob
globs:
  - apps/web/**/*.ts
  - apps/web/**/*.tsx
---

# Web app

- Use British English, accessible controls, and clear phone states. Support reduced motion. Keep audio optional.
- Follow the design and motion rules. Open the live library docs listed there before copying a component; ease every visible change.
- Keep secrets and personal diagnostics off the projector and the stage screen.
- Do not import server auth modules into the web app.
- Do not put answer keys, truth nicknames, or scoring secrets in client code.
- A new theme is a palette plus a skin. Follow the theme rule. Do not ship colours alone. Icons for a category or a brand come from the packs named there.

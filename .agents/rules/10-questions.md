---
description: Server-side question packs
trigger: glob
globs:
  - apps/api/src/questions/**/*.ts
---

# Questions

- Keep the party script in versioned TypeScript in this folder. There is no CMS and no client-side question pack.
- Public snapshots exclude correct answers, scoring secrets, and future reveals.
- Do not copy answer keys or truth nicknames into `apps/web`.
- The pack a room plays is the one named by its stored version. The illustrative demo stays `demo-2026-09-22` until a birthday version is explicitly released.
- New party questions are files in `apps/api/src/questions/packs/birthday/`, registered on the catalogue and left out of the running order while they are drafts. Do not invent party questions, and do not edit the demo pack to hold them.

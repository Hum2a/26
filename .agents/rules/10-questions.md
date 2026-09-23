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
- The pack that ships is the illustrative demo until Humza replaces it. Do not invent party questions.

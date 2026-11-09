---
description: Bundle size, code-splitting, assets, caching, and startup
trigger: glob
globs:
  - apps/web/src/routes.tsx
  - apps/web/src/main.tsx
  - apps/web/src/play/**/*.ts
  - apps/web/src/play/**/*.tsx
  - apps/web/src/guest/**/*.ts
  - apps/web/src/guest/**/*.tsx
  - apps/web/src/stage/**/*.ts
  - apps/web/src/stage/**/*.tsx
  - apps/web/vite.config.ts
  - apps/web/index.html
  - apps/web/public/**/*
  - packages/shared/src/**/*.ts
---

# Bundle, assets, and startup

Phones join on flaky venue Wi-Fi. The **first** JavaScript they need is: theme, join/play chrome, socket client, and the current ordinary question. Kart, chess, admin, Three, and Stockfish stay out of that graph.

## Code splitting

`apps/web/src/routes.tsx` already `lazy()`s `/play`, `/screen`, `/admin`, `/kart`, `/chess`. Keep it that way. A new round that pulls a heavy engine uses `React.lazy` **inside** the play renderer as well, like `GuestKart` / `GuestChess` in `guest-play.tsx`.

```tsx
// ❌ BAD — Three.js in the guest question module
import { KartCanvas } from "../kart/KartCanvas";

// ✅ GOOD
const GuestKart = lazy(() =>
  import("../kart/GuestKart").then((kart) => ({ default: kart.GuestKart })),
);
```

Do not import `apps/web/src/admin/**` from guest or stage. Do not import `apps/web/src/kart/**` or `apps/web/src/chess/**` from `main.tsx`, `routes.tsx` (except the dedicated `/kart` and `/chess` route factories), or the always-on theme install.

If you add a library, pin it, keep the lockfile, and check `npm run budget:web`. A new always-on import that blows the **entry JS gzip** budget is a failed change, not a warning to ignore.

Shared Zod schemas used on the phone must stay small. Do not re-export Node, Worker, or pack-private answer keys through `packages/shared/src/index.ts`.

## Images, audio, fonts

- Option images: current question only (`questionImages` / `preloadImages`). `decoding="async"`, width/height or aspect-ratio to avoid CLS.
- Do not ship new webfont files for a theme. Themes use system stacks in the deep skin. Existing `@fontsource` on the party chrome is enough; do not add a third family to the critical path without a budget pass.
- Audio is optional and behind a user gesture. Do not autoplay on join. Decode / fetch the sting when the round that needs it is announced.
- Photos go through the media pipeline and R2, not as base64 on the socket.
- Iconify: import **one** icon module at a time from `@iconify-icons/*` and render `@iconify/react/dist/offline`. Do not load the Iconify CDN.

## Caching and public engines

`/chess-engine/` and `/kart-engine/` are static. They must remain cache-friendly (stable filenames hashed or versioned by the build that copies them). Fetch them only when that round is active or warming.

Do not commit generated `apps/web/public/kart-engine/` output; the web `prebuild` rebuilds it.

## Startup / TTI

- `/play` must paint join or the current beat without waiting for kart WASM/GLB or Stockfish.
- Avoid giant JSON in the first module. Question packs stay on the server; the phone receives the projected question in the snapshot.
- Service workers: do not add one unless the owner asked. A stale SW on 80 phones is worse than a cold load.
- Measure with `npm run perf:audit` against a preview when you change the entry graph. Do not add Playwright specs for it.

## Budget gate

`scripts/check-bundle-budget.mjs` (via `npm run build` / `npm run budget:web`) reads `apps/web/dist/client` and fails CI when gzip sizes exceed `scripts/web-bundle-budget.json`. If a genuine feature needs more bytes, **raise the budget in the same PR** and say why in the PR body. Do not delete the check.

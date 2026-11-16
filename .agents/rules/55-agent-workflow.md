---
description: Workflow guardrails and the performance contract for every change
trigger: always_on
---

# Agent workflow and performance contract

This party must feel instant on mid-range phones and the projector with about **80 concurrent guests**. Zero perceptible slowdown is the goal: a tap, a phase change, a reconnect, and a kart frame must not hitch, freeze, or wait on work that belongs off the main thread or off the live room path.

Do not reorganise folders in a performance-rules change. The layout is `.agents/rules/05-structure.md`. Prefer a module's job (`openRoomSocket`, `PartyRoom`, `KartCanvas`) over a brittle deep path when both would do. After a structural move, update this file's globs and `05-structure.md` in the same PR.

Detailed, file-scoped rules live in `.agents/rules/60-perf-*.md` (synced to `.cursor/rules/*.mdc`). Edit `.agents`, then run `npm run agents:sync`. Do not hand-edit generated copies. `CLAUDE.md` only points at `AGENTS.md`.

## Workflow guardrails

- **Small, focused PRs.** One concern per branch. Do not mix a mechanic change with a folder move, a dependency bump, and a visual rewrite.
- **Never push to `master` or `main`.** Open a PR against `master`. Do not merge unless the owner asked.
- **No force-push** to shared branches. No `--force` / `--force-with-lease` on `master`.
- **Do not deploy**, create paid cloud resources, or change staging/production secrets unless the owner asked in this turn.
- **Do not add Playwright or other E2E/browser runners.** The owner has prohibited them. Prove behaviour with typecheck, lint, Vitest (jsdom / workers pool), and existing Node script tests.
- **Before finishing:** `npm run typecheck`, `npm run lint`, and the unit tests that cover what you touched (`npm run test:unit` and/or `npm run test -w @26/api`). Run `npm run build` when the client graph, public assets, or Vite config changed so `budget:web` runs.
- **Do not delete, rewrite, or “clean up” unrelated code** to make a diff look tidy. Do not skip, `.only`, or delete a failing test to get green.
- **Ask (or stop and report) before a large refactor**, a new state store, a second socket client, a new scheduler, or a competing score engine. Work in the existing modules.
- **Do not copy LifeSmart**, pupil-specific rules, or unrelated repos into this tree.
- British English in guest/stage copy. Keep secrets, answer keys, and personal diagnostics off the projector.

## Performance contract (every feature)

1. **Server is authoritative.** Phones send intents. They do not compute scores, timers, or phase changes. Optimistic UI may show _sending_, never _accepted_, until the ack.
2. **Hot paths stay hot.** Guest answers, kart inputs, and broadcasts stay inside the Durable Object. Neon, email, R2 processing, and archives stay off that path.
3. **Eighty phones are the load model.** A message, query, or render that is cheap for one guest is expensive when it runs eighty times. Batch, patch, and reuse.
4. **Main thread stays interactive.** Stockfish, image decode, GLB parse, and heavy JSON do not run on the UI thread during a question. Game loops use `requestAnimationFrame` and refs, not React state every frame.
5. **Join stays thin.** `/play` and `/screen` must not download kart, chess, or admin. Lazy-load per round. Warm during the intro beat, not on first tap of “send”.
6. **Perceived speed.** Instant press feedback, stable layout (no CLS), reconnect with jitter, skeletons that match the final chrome. The dock send button never waits on a bundle.

## Commands

```bash
npm run typecheck
npm run lint            # ESLint plus scripts/check-structure.mjs
npm run check:structure
npm run test:unit
npm run test -w @26/api
npm run build          # includes secrets scan and bundle budget
npm run budget:web     # Vite dist gzip budgets; needs a prior web build
npm run agents:sync    # after editing .agents
```

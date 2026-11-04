---
description: Birthday party game rules for every prompt
trigger: always_on
---

# 26.humza.website

Product requirements: `docs/party-game-plan.md`
Build prompts: `docs/build-prompts.md`
Progress: `docs/build-progress.md`

Every later prompt starts by reading this file.

## Rules that apply to every prompt

# Project: 26.humza.website (birthday quiz)

## Stack

- npm workspaces + Turborepo (npm only, never pnpm/yarn)
- apps/web: React 19 + Vite. Routes: /play (phones), /screen (projector), /host (control panel)
- apps/worker: Hono on Cloudflare Workers + one Durable Object class `Room` (WebSocket Hibernation API, SQLite storage, alarms)
- packages/shared: Zod schemas, pure game logic (reducer, scoring, awards, time sync, rate limiter, troll rules)
- packages/emails: React Email templates, sent via Resend
- Post-game persistence: Neon Postgres + Drizzle, RLS enabled on every table
- Photos: Cloudflare R2
- Tests: Vitest (unit + component via Testing Library + jsdom), @cloudflare/vitest-pool-workers (DO/Worker), Playwright (e2e), Node bot harness (load)

## Architecture rules

- The server is authoritative. Clients send intents and render state. They never compute scores, timers or phase changes.
- All game logic is a pure reducer in packages/shared: `reduce(state, event, now) -> { state, effects }`. The DO is a thin shell that feeds events in and executes effects (broadcast, set alarm, persist). This is what makes everything unit-testable.
- Time is always injected (`now: number`), never `Date.now()` inside logic.
- Browser APIs (wakeLock, vibrate, getUserMedia, Audio) are wrapped in small adapters so tests can mock them.

## Testing rules (non-negotiable)

- Every feature has at least one test file, named in the phase prompt. Write the tests first or alongside the code, never after "it works".
- Never skip, `.only`, or delete a failing test to get green. Fix the code or ask.
- Pure logic → plain Vitest. DO behaviour → vitest-pool-workers. UI → Testing Library. Cross-device flows → Playwright.
- A phase is done only when `npm run test:unit` and `npm run typecheck` pass.

## Scripts

- Naming: `<domain>:<action>` (e.g. `test:unit`, `questions:check`, `email:preview`, `dev:jump`)
- A fresh checkout is prepared with `npm install`, then `npm run setup`. Setup installs dependencies, syncs environment files, generates a missing local client API key, copies agent instructions, generates Worker types, installs Playwright Chromium, and migrates and seeds the local database. It leaves an existing local key unchanged and does not deploy or upload secrets.

- This is a separate birthday project. Never change LifeSmart, use its production resources or copy its pupil-specific rules into this project.
- The plan's agreed decisions take precedence over its suggested defaults. Later explicit user decisions take precedence over both. Record material implementation choices.
- Baseer presents and Humza controls. Guests play individually. No pods, guest accounts, CMS, compulsory scoring floor or automatic score multipliers.
- Keep questions in versioned server-side TypeScript. Public question data is a deliberate projection that excludes correct answers, scoring secrets and future reveals.
- One Worker serves the application and API; one SQLite-backed Durable Object owns each room. Neon and email stay outside the live guest-action path. Image/audio processing also stays outside it.
- Persist accepted actions before success acknowledgements. Make retries idempotent. Memory is a cache. Use one durable scheduler to own all room alarms.
- Identity uses random game-scoped credentials. Device information is separately associated context, never an identity fingerprint or authority for scoring.
- Use React, TypeScript, Vite, Hono, Cloudflare Workers/Durable Objects/R2, Neon, Better Auth and Resend as specified in the plan. Use a small shared validation package and consistent styling primitives. Verify current official documentation when implementing version-sensitive APIs; pin compatible dependencies and retain the lockfile.
- Use domain folders, British English, accessible controls and clear phone states. Include reduced-motion support and optional audio. Keep secrets and personal diagnostics off the projector.
- Do not open, quote, or commit secret files such as `.env`, `.dev.vars`, private keys, or credential files. Example templates may be read.
- `artifacts/` is local check output and is gitignored: Playwright reports, probe logs, screenshots, and Miniflare storage. A path that is already tracked stays in the index until it is removed. After changing `.gitignore`, or when `git status` still lists a tracked ignored path such as a Playwright `.last-run.json`, run `npm run git:drop-ignored`. That command removes those paths from the index and leaves the files on disk. Do not commit that output.
- Work in the existing implementation. Do not create competing state stores, socket clients, auth factories, schedulers, schemas or score engines for each new feature.
- Keep production paths real. Deterministic local fakes are allowed only behind explicit test/development adapters; they must not silently succeed in deployed environments.
- Implement, run relevant checks, fix failures and update documentation. Do not rewrite unrelated work or weaken checks to obtain a pass.
- No deployments, paid resource creation or changes to unrelated remote resources are implied by Prompts 01-18. Missing external credentials should not prevent completing locally testable work; report precisely what remains unverified.
- Agent instructions are edited in `.agents`. Run `npm run agents:sync` afterwards. Do not hand-edit the generated copies.
- At the end of every stage update `docs/build-progress.md`: status, files/interfaces added, decisions/defaults, commands and results, manual verification, unresolved issues and the exact next stage. Never label an unrun check as passed.
- Final response for each stage: what now works, how to run/try it, what was verified and any concrete remaining limitation. Do not automatically begin the next prompt.

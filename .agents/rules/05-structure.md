---
description: Repository layout, naming, and where new rounds go
trigger: always_on
---

# Codebase structure

This tree is **feature-first**. A new round, screen, or message type has one obvious home. Do not add a parallel store, socket client, scheduler, or score engine. Prefer `git mv` for moves. After a layout change, update this file, the perf-rule globs (`60-perf-*.md`), `apps/web/src/admin/features.ts`, and run `npm run agents:sync`.

`scripts/check-structure.mjs` (`npm run check:structure`, also part of `npm run lint`) enforces the top-level allowlists and the import boundaries below.

## Workspaces

| Path              | Role                                                                                                                          |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `apps/api`        | One Cloudflare Worker (Hono) plus Durable Object `PartyRoom`. Server authority.                                               |
| `apps/web`        | React 19 + Vite. Phones `/play` (`/` guest join), projector `/host` (`/screen`), host `/admin`.                               |
| `apps/kart-solo`  | Isolated kart practice engine. Built into `apps/web/public/kart-engine/` on web prebuild. Do not relocate that public output. |
| `packages/shared` | Pure Zod schemas and reducers. No DOM, Worker, Hono, React, or `apps/*` imports.                                              |
| `packages/emails` | React Email templates (Resend). Outside the live guest-action path.                                                           |
| `scripts/`        | Repo tooling. `<domain>:<action>` npm names. Colocate a `*.test.ts` next to a new checker.                                    |
| `docs/`           | Human guides. Agent rules live in `.agents/rules`, not here.                                                                  |

Tests: web and shared-adjacent UI tests are **colocated** (`*.test.ts` next to the module). Worker/room specs stay in `apps/api/test/` until a later colocation pass. Do not add Playwright specs.

## `packages/shared/src`

Public API is `packages/shared/src/index.ts` (`@26/shared`). Feature folders:

- `kart/` — race reducer, physics, tracks, items (filenames keep the `kart-` prefix).
- `chess/` — schemas, clocks, capture scoring.
- `wordle/` — board reducer.

Cross-cutting files stay at `src/` (`rate-limit.ts`, `party-scoring.ts`, `wall.ts`, …). Do not put round UI or Durable Object code here.

Kart canvas may deep-import track geometry (`packages/shared/src/kart/kart-track.ts`, `kart-circuit.json`) so the phone does not pull the whole reducer. New shared **logic** still goes through `@26/shared`.

## `apps/api/src`

Top-level folders are domains: `room`, `questions`, `troll`, `media`, `wall`, `auth`, `credentials`, `archive`, `results`, `stats`, `device`, `security`, `developer`.

- **Room shell:** `room/party-room.ts` is the Durable Object. `room/routes.ts` HTTP. `room/lifecycle.ts` phases. Kart _room_ helpers live in `room/kart/` (ingress, lobby, preview, track compatibility).
- **Mechanics:** `questions/<mechanic>/` for kart, chess, wordle (dictionary under `questions/wordle/dictionary/`). Ordinary quiz scoring (`multiple-choice.ts`, `slider.ts`, `rank.ts`, `vote.ts`, `duel.ts`, …) still sits beside them until a later grouping.
- **Packs:** `questions/packs/birthday/<id>.ts` and `packs/demo/`. No CMS. No client-side pack.
- **Trolls / media / wall:** their own folders. Neon and email stay out of the live tap path.

## `apps/web/src`

| Folder                                                         | What goes here                                                                                                                                    |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `play/`                                                        | Ordinary question phone/stage renderers (`guest-*.tsx`, `stage-play.tsx`), `designs/`, shared question chrome. Round widgets in `play/controls/`. |
| `kart/`                                                        | Three.js canvas, controllers, race HUD. Lazy-loaded from play/stage.                                                                              |
| `chess/`                                                       | Board UI and Stockfish worker wrapper. Lazy-loaded.                                                                                               |
| `troll/`                                                       | Phone gags and picker.                                                                                                                            |
| `guest/` `stage/` `admin/` `join/` `lobby/` `home/` `results/` | Surfaces.                                                                                                                                         |
| `live/`                                                        | The **only** room socket (`room-socket.ts`), room HTTP client, reconnect chrome.                                                                  |
| `theme/` `ui/` `anim/`                                         | Palette/skin, primitives, motion.                                                                                                                 |
| `media/` `photo/` `wall/`                                      | Uploads, capture, photo wall UI.                                                                                                                  |
| `api/`                                                         | Browser `fetch` helpers (not the Worker).                                                                                                         |
| `controller/` `device/` `developer/`                           | Phone chrome, telemetry, rehearsal tools.                                                                                                         |

Do not recreate `src/rounds` or `src/net`. Connection UI belongs in `live/`. Answer widgets belong in `play/controls/`.

## Naming

- Folders: lowercase kebab or a single mechanic word (`kart`, `wordle`).
- Modules: kebab-case (`room-socket.ts`, `submit-state.ts`). React components may be PascalCase (`GuestKart.tsx`).
- Tests: `*.test.ts` / `*.test.tsx` next to web code; `apps/api/test/<topic>.spec.ts` for the Worker.
- British English in guest/stage copy.

## Import boundaries (also ESLint)

- `apps/web` must not import `apps/api` or server auth (`create-auth`, `better-auth/db`).
- `packages/shared` must not import `apps/*`, React, Hono, Three, or Stockfish.
- `kart`, `chess`, and `troll` must not import each other's internals. Shared types go through `@26/shared`. Play/stage may `lazy()` a round renderer.
- `three` only from `apps/web/src/kart`. Stockfish npm package is forbidden; use `apps/web/src/chess/stockfish-worker.ts` and `/chess-engine/`.
- One socket: `openRoomSocket`. One room object: `PartyRoom`.

## How to add a new round

1. **Mechanic** — Reuse `choice` / `typed` / `slider` / `rank` / `vote` / `guess` / `duel` / `finale` / `wordle` / `kart` / `chess` if it fits. Read `docs/question-authoring.md`.
2. **Pack file** — `apps/api/src/questions/packs/birthday/<id>.ts` with the helper in `authoring.ts`. Register on `catalogue` only (not `order` while drafting).
3. **Server runtime** — If it needs new scoring or persistence, add or extend `apps/api/src/questions/<mechanic>/` (or the existing quiz module). Wire `PartyRoom` through the existing plugin/command path. Persist before ack.
4. **Shared contract** — Zod + pure reducer in `packages/shared/src/<mechanic>/` if phones and the Worker share shapes. Export from `index.ts`. Keep secrets off the public snapshot.
5. **Phone + stage** — Ordinary UI in `apps/web/src/play/` (widgets in `play/controls/`). Custom look: `play/designs/<slug>.tsx` + `customPresentationIds`. Heavy engine: `apps/web/src/<mechanic>/` and `React.lazy` from `guest-play.tsx` / `stage-play.tsx`.
6. **Host** — Admin see/manage/rehearse in the same change (`adminFeatures` `owns` the folders). Host-only fields only for `audience === "control"`.
7. **Check** — `npm run content:check`, unit tests, `npm run typecheck`, `npm run lint` (includes structure), `npm run budget:web` if the client graph changed.

Do not start a second WebSocket, a client-side score, or a new question CMS.

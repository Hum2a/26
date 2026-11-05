# Build progress

[Home](../README.md) · [Documentation](README.md) · [Event runbook](event-runbook.md)

Project: 26.humza.website  
Source of stage order: [docs/build-prompts.md](build-prompts.md)

| Stage | Deliverable                                                 | Status   |
| ----- | ----------------------------------------------------------- | -------- |
| 01    | Repository, project rules, UI foundations and local tooling | Complete |
| 02    | Admin authentication and scoped control credentials         | Complete |
| 03    | Durable rooms, guest sessions and reconnecting transport    | Complete |
| 04    | Persistent scheduler and phase lifecycle                    | Complete |
| 05    | Complete multiple-choice game on phones and projector       | Complete |
| 06    | Name-cloud lobby and live host controls                     | Complete |
| 07    | Slider and tap-based ranking rounds                         | Complete |
| 08    | Whole-room voting and guess-the-guest                       | Complete |
| 09    | Simultaneous duels and finale                               | Complete |
| 10    | Troll engine and first visual effects                       | Complete |
| 11    | Reliable R2 photo and voice media pipeline                  | Complete |
| 12    | Live typing, voice playback and recurring theme songs       | Complete |
| 13    | Browser/device contexts and connection summaries            | Complete |
| 14    | Evidence-backed end-game statistics                         | Complete |
| 15    | Retryable Neon game archive                                 | Complete |
| 16    | Results, gallery, personal recaps and optional email        | Complete |
| 17    | Finished party presentation and content-authoring workflow  | Complete |
| 18    | Failure testing, security checks and 75-player load testing | Complete |
| 19    | Staging deployment, operational tools and event runbook     | Complete |

<details>
<summary>On this page</summary>

- [Stage 01](#stage-01)
- [Stage 02](#stage-02)
- [Stage 03](#stage-03)
- [Stage 04](#stage-04)
- [Stage 05](#stage-05)
- [Stage 06](#stage-06)
- [Stage 07](#stage-07)
- [Stage 08](#stage-08)
- [Stage 09](#stage-09)
- [Stage 10](#stage-10)
- [Stage 11](#stage-11)
- [Stage 12](#stage-12)
- [Stage 13](#stage-13)
- [Stage 14](#stage-14)
- [Stage 15](#stage-15)
- [Stage 16](#stage-16)
- [Stage 17](#stage-17)
- [Stage 18](#stage-18)
- [Stage 19](#stage-19)
- [Neon auth database](#neon-auth-database)
- [Client API key protection layer](#client-api-key-protection-layer)
- [Party theme palettes](#party-theme-palettes)
- [Question authoring](#question-authoring)
- [Forty party themes](#forty-party-themes)
- [Personal night themes](#personal-night-themes)
- [Theme picker](#theme-picker)
- [Persona and life themes](#persona-and-life-themes)
- [Phone controller hygiene](#phone-controller-hygiene)
- [Join and reconnect](#join-and-reconnect)
- [Round controls](#round-controls)
- [Projector stage](#projector-stage)
- [Stage sound and operator keys](#stage-sound-and-operator-keys)
- [Phone camera](#phone-camera)
- [Troll picker](#troll-picker)
- [Caution tape and phase transitions](#caution-tape-and-phase-transitions)
- [Theme identity skins](#theme-identity-skins)
- [Skins for the full catalogue](#skins-for-the-full-catalogue)
- [Nissan LEAF and Toyota Prius+](#nissan-leaf-and-toyota-prius)
- [Theme icon packs](#theme-icon-packs)
- [Theme finishes](#theme-finishes)
- [Background motifs](#background-motifs)
- [Phone app shell](#phone-app-shell)
- [First birthday question drafts](#first-birthday-question-drafts)
- [Poll, threshold, and typed-answer mechanics](#poll-threshold-and-typed-answer-mechanics)
- [Birthday answers and long polls](#birthday-answers-and-long-polls)
- [Custom question designs](#custom-question-designs)
- [Admin experience and page redesign — planning](#admin-experience-and-page-redesign--planning)
- [Admin redesign Stage A — front door and access](#admin-redesign-stage-a--front-door-and-access)
- [Admin redesign Stage B — recoverable workspace](#admin-redesign-stage-b--recoverable-workspace)
- [Admin redesign Stage C — live desk and player tools](#admin-redesign-stage-c--live-desk-and-player-tools)
- [Admin redesign Stage D — media, results, content and health](#admin-redesign-stage-d--media-results-content-and-health)
- [Admin experience Stage E — complete locally (19 October 2026)](#admin-experience-stage-e--complete-locally-19-october-2026)
- [Birthday question batch — 19 October 2026](#birthday-question-batch--19-october-2026)
- [Individual question inspection — 19 October 2026](#individual-question-inspection--19-october-2026)
- [Phone rehearsal and full-screen question foundation — 19 October 2026](#phone-rehearsal-and-full-screen-question-foundation--19-october-2026)
- [Glyph / birthday Wordle — 19 October 2026](#glyph--birthday-wordle--19-october-2026)
- [Pokémon pictures and sourced inflation sliders — 20 October 2026](#pokémon-pictures-and-sourced-inflation-sliders--20-october-2026)
- [Three comic inflation additions — 20 October 2026](#three-comic-inflation-additions--20-october-2026)
- [Three escalating trolley polls — 20 October 2026](#three-escalating-trolley-polls--20-october-2026)
- [Two original-name questions — 20 October 2026](#two-original-name-questions--20-october-2026)
- [Who said it: ten quote drafts and A/B presentation — 20 October 2026](#who-said-it-ten-quote-drafts-and-ab-presentation--20-october-2026)
- [Party mini-game concepts — 20 October 2026](#party-mini-game-concepts--20-october-2026)
- [Commit and production deployment — 20 October 2026](#commit-and-production-deployment--20-october-2026)
- [Draft polish, new concepts and kart sprint — 20 October 2026](#draft-polish-new-concepts-and-kart-sprint--20-october-2026)
- [Commit and production deployment: draft polish and kart — 20 October 2026](#commit-and-production-deployment-draft-polish-and-kart--20-october-2026)
- [20 October 2026 — kart enhancement pass paused for email/sign-in work](#20-october-2026--kart-enhancement-pass-paused-for-emailsign-in-work)
- [20 October 2026 — designed emails and alternate email-code sign-in deployed](#20-october-2026--designed-emails-and-alternate-email-code-sign-in-deployed)
- [20 October 2026 — bounded kart enhancement pass](#20-october-2026--bounded-kart-enhancement-pass)
- [20 October 2026 — question catalogue browser](#20-october-2026--question-catalogue-browser)
- [20 October 2026 — phone and big-screen comparison](#20-october-2026--phone-and-big-screen-comparison)
- [20 October 2026 — personal kart driving and a 50-player broadcast](#20-october-2026--personal-kart-driving-and-a-50-player-broadcast)
- [20 October 2026 — playable upstream kart, isolated solo practice](#20-october-2026--playable-upstream-kart-isolated-solo-practice)
- [21 October 2026 — realtime fan-out, reconnects and sign-in start-up](#21-october-2026--realtime-fan-out-reconnects-and-sign-in-start-up)
- [21 October 2026 — kart multiplayer hardening, first stage](#21-october-2026--kart-multiplayer-hardening-first-stage)
- [21 October 2026 — kart hardening pushed and deployed](#21-october-2026--kart-hardening-pushed-and-deployed)
- [21 October 2026 — dedicated admin Kart page](#21-october-2026--dedicated-admin-kart-page)
- [21 October 2026 — admin Kart page pushed and deployed](#21-october-2026--admin-kart-page-pushed-and-deployed)
- [21 October 2026 — arcade driving, solid track scenery and manual recovery](#21-october-2026--arcade-driving-solid-track-scenery-and-manual-recovery)
- [21 October 2026 — kart handling/collisions deployed](#21-october-2026--kart-handlingcollisions-deployed)
- [21 October 2026 — animated kart drift effects](#21-october-2026--animated-kart-drift-effects)
- [21 October 2026 — collectable kart power-ups (local implementation)](#21-october-2026--collectable-kart-power-ups-local-implementation)
- [21 October 2026 — kart drivers with guest photo faces](#21-october-2026--kart-drivers-with-guest-photo-faces)
- [21 October 2026 — drift handling and turbo polish](#21-october-2026--drift-handling-and-turbo-polish)
- [21 October 2026 — photo wall, phase 1 (uploads and posts)](#21-october-2026--photo-wall-phase-1-uploads-and-posts)
- [21 October 2026 — photo wall, phase 2 (queue and timing)](#21-october-2026--photo-wall-phase-2-queue-and-timing)
- [21 October 2026 — end-of-night fun facts](#21-october-2026--end-of-night-fun-facts)
- [22 October 2026 — photo wall, phase 3 (host moderation)](#22-october-2026--photo-wall-phase-3-host-moderation)
- [22 October 2026 — photo wall, phases 4 to 9](#22-october-2026--photo-wall-phases-4-to-9)
- [22 October 2026 — admin coverage for every feature](#22-october-2026--admin-coverage-for-every-feature)
- [22 October 2026 — trolls finished](#22-october-2026--trolls-finished)

- [22 October 2026 — GitHub documentation presentation](#22-october-2026--github-documentation-presentation)

- [22 October 2026 — kart power, turbo tiers and track interactions](#22-october-2026--kart-power-turbo-tiers-and-track-interactions)

</details>

## Stage 01

Status: complete.

The working directory contained only the two source documents. It is not the LifeSmart repository. Those files were copied unchanged to [docs/party-game-plan.md](party-game-plan.md) and [docs/build-prompts.md](build-prompts.md). SHA-256 prefixes `1209C4834D2A` and `32768B5527B0` match the originals.

### Files and interfaces

- npm workspace `26-humza-website` with `@26/web`, `@26/api`, and `@26/shared`.
- `@26/shared` exports `appEnvironmentSchema`, `healthResponseSchema`, `apiErrorSchema`, and a display-only `gameIdSchema`.
- One Hono Worker in `apps/api/src/index.ts`. `GET /api/health` reads `c.env.APP_ENV`. Missing `/api` and `/ws` routes return JSON and do not call `ASSETS.fetch`.
- React shells: `/`, `/host`, `/admin`, `/r/:gameId`, plus a not-found page.
- UI primitives: button, text field, panel, status message, countdown layout, and a native dialog.
- `apps/api/wrangler.jsonc` has local, staging, and production names and `APP_ENV` values. No account id or cloud resource bindings.
- `apps/api/.dev.vars.example` lists later secret names and contains no values.
- `npm run cf-typegen` wrote `apps/api/worker-configuration.d.ts`.

### Decisions and defaults

- TypeScript is pinned at 6.0.3. typescript-eslint 8.70.1 accepts TypeScript below 6.1.0, and the current TypeScript 7 release is outside that range.
- Zod 4 is the shared validator. Tailwind CSS 4 theme tokens define the party colours. Fraunces and Outfit are self-hosted through Fontsource.
- The Cloudflare Vite plugin in `apps/web` loads `apps/api/wrangler.jsonc`. Compatibility date is 2026-09-22. `run_worker_first` is `/api`, `/api/*`, `/ws`, and `/ws/*`, because the wildcard does not match the bare prefix.
- `wrangler types` now generates runtime types, so `@cloudflare/workers-types` is not installed.
- Worker-binding tests use `@cloudflare/vitest-plugin` and override `APP_ENV` to `staging`. Asset routing is tested with Wrangler's `createTestHarness`, because the Vitest `SELF` fetch calls the worker export directly and skips SPA fallback.
- The harness emits `ECONNRESET` when workerd closes. Vitest ignores only that error code. A failed response still fails the test.
- `gameIdSchema` accepts 8 to 32 characters from an alphabet that excludes I, O, 0, and 1. It does not look up a room.
- `game`, `media`, and `stats` folders are intentionally absent.

### Commands and results

Final successful runs, after the fixes noted below:

- `npm run typecheck` passed.
- `npm run lint` passed with no warnings.
- `npm run format:check` passed. The two copied plan files are excluded.
- `npm test` passed: 2 files, 5 tests. Health returned `environment: "staging"` from the binding. A browser navigation to `/api/missing`, a WebSocket upgrade to `/ws`, and `/ws/room` returned JSON and not the fixture SPA shell. A navigation to `/host` returned that shell.
- `npm run build` passed. The output Wrangler config points assets at `../client`, keeps the `run_worker_first` list, and sets `APP_ENV` to `local`. The secret check scanned 29 build files and found none.
- `npm run smoke` passed: 5 Playwright tests against `http://localhost:4173`.
- `npm run dev` printed `http://localhost:5173/`. `GET /api/health` returned `{"ok":true,"service":"26-humza-website","environment":"local"}`. `GET /host` with `Sec-Fetch-Mode: navigate` returned 200 HTML.
- Against the preview, `GET /api/missing` and `GET /ws` returned JSON 404s, not HTML.

Earlier attempts that were fixed before those passes:

- Installing the root lint tools failed while TypeScript 7.0.2 was present. TypeScript was pinned to 6.0.3 and the install completed.
- The first asset test called the worker export directly and received 404 for `/host` instead of the fixture shell. The routing test now goes through `createTestHarness`.
- That harness then failed the process with `read ECONNRESET` after the assertions had passed. Only that shutdown error is ignored.
- The first smoke test waited for `http://127.0.0.1:4173` and timed out. Vite serves `http://localhost:4173`.

`npx playwright install chromium` exited 0 and printed no download log. The later smoke run launched Chromium.

### Manual verification

In the IDE browser against the preview:

- `/` showed the guest shell, a disabled nickname field, and the local API check. The about dialog opened with focus on Close.
- `/host` showed large stage type, "No room is connected.", and the countdown preview.
- `/admin` showed the signed-out state and listed later controls as text. There was no login field.
- `/r/ABCDEFGH` said results for that id are not available.

Playwright also checked the guest shell at 390 by 844 pixels and found no horizontal overflow. The stage heading computed larger than 48px.

### Unresolved issues

- Node is v22.12.0. `eslint-visitor-keys@5.0.1` declares an engine of `^22.13.0` or newer. npm warned during install. Lint still completed on this Node version.
- Dependency output includes a Node `punycode` deprecation warning. It does not come from this project's source.
- No Cloudflare, Neon, or email resources were created, and none were verified remotely.
- Gameplay, authentication, and persistence are not implemented.

### Next stage

Prompt 02: admin authentication and scoped control credentials. Completed in stage 02 below.

## Stage 02

Status: complete.

One administrator can request a magic link, confirm it with an explicit button, and sign out. An authenticated administrator can issue and revoke short-lived room credentials. Guests are rejected. Live room controls are not connected.

### Files and interfaces

- `apps/api/src/auth/`: `createAuth`, `createDatabase`, and `createEmail`, each built from Worker bindings. Generated Better Auth SQL is `apps/api/src/auth/migrations/better-auth.sql`. Extra SQL adds `room_credential` and, for local only, `dev_inbox`.
- `apps/api/src/credentials/`: `verifyRoomCredential` checks a secret hash, role, room id, expiry, and revocation without opening a database. `RoomCredentialDirectory` is `save`, `get`, and `revoke` for Prompt 03.
- Shared schemas in `packages/shared`: room credential roles, the admin session, magic-link acceptance, auth failures, the local inbox, and the command and presentation stubs.
- Web routes `/admin` and `/admin/confirm`. The web app does not import server auth modules.
- Commands `auth:generate`, `auth:migrate`, and `auth:seed` require `local`, `staging`, or `production`.

### Decisions and defaults

- Better Auth 1.7.5 magic link, with public email/password sign-up disabled, `disableSignUp`, and hashed tokens. The admin plugin is not mounted. Only `ADMIN_EMAIL` can be created or receive a link. Other addresses get the same acceptance response and no inbox row.
- The emailed link is `/admin/confirm?token=...`. That page does not call verify. Sign in POSTs the token. Better Auth's GET `/api/auth/magic-link/verify` remains and is not placed in an email.
- Local development without `DATABASE_URL` uses PGlite at `apps/api/.data/local-auth`. Staging and production without `DATABASE_URL` return 503. A configured URL uses the Neon serverless driver. Neon is not migrated on request.
- Local mail without `RESEND_API_KEY` is stored in the local database and listed only when `APP_ENV` is `local`. A Resend key uses Resend. Staging and production without a key fail the send and expose no inbox.
- A missing auth secret is replaced by a development constant only when `APP_ENV` is `local`.
- PGlite's initdb cannot run inside the Worker runtime. `vite dev` and `vite preview` answer `/api/auth`, `/api/admin`, `/api/dev`, and `/api/stage` from Node, using the same factories and the file database. That path is the local development server only.
- Control credentials last 15 minutes and presentation credentials last 8 hours. Cookies are `HttpOnly`, `Secure`, and `SameSite=Strict`, on separate names and paths. The secret is not returned in JSON. Mutating routes require a same-origin `Origin`.
- The SQL directory stores verifier records so issue and revoke can be tested. A live command must pass the room's own record to `verifyRoomCredential`. The command route accepts a valid control credential and reports no game effect.

### Commands and results

- `npm run cf-typegen` passed and regenerated `apps/api/worker-configuration.d.ts`.
- `npm run auth:generate` wrote the Better Auth SQL. It also logged a schema validation message because the empty database had no tables yet. The command exited 0.
- `npm run auth:migrate -- --env local` passed. npm forwarded the environment name without the flag. The script printed the local PGlite path and finished. A schema validation log appeared after the success line and did not change the exit code.
- `npm run auth:seed -- --env local` passed and created the verified administrator named Humza.
- `npm run typecheck` passed.
- `npm run lint` passed with no warnings.
- `npm run format:check` passed.
- `npm test` passed: 4 files, 18 tests. Coverage includes the allowlist, a scanner GET that leaves the token usable, a bad token, an expired token, guests, role separation, expiry, revocation, a missing production database, the local inbox, and the client bundle's isolation from server auth.
- `npm run build` passed. The client bundle does not contain the server auth factory or the local development secret. The Worker bundle is about 1.17 MB and includes PGlite chunks. The build reported PGlite's direct `eval` warnings.
- `npm run smoke` passed: 5 Playwright tests against `http://localhost:4173`, including the administrator request, confirmation, sign-in, and sign-out.

Neon migration against a real project was not run. Resend delivery was not run.

### Manual verification

Playwright completed the administrator flow in Chromium. In the IDE browser, at 390 by 844 pixels, `/admin` showed the email field with no horizontal overflow. Requesting the link listed a confirmation URL. Opening that page did not sign in. The Sign in button then showed "You are signed in as humza@localhost.test." and "Live room controls are not connected." Pause, advance, recover, and score were text, not buttons. Sign out returned to the email field.

### Unresolved issues

- No Neon project was created, and the generated SQL was not applied to Neon.
- No Resend message was sent.
- The Worker bundle still contains PGlite, including its `eval` use, because the factories are part of the Worker source. Local preview does not execute initdb inside the Worker.
- `eslint-visitor-keys@5.0.1` still warns that Node v22.12.0 is older than its declared engine. Lint passed.
- The first auth migration can log a Better Auth schema check before the tables exist. The command still exits 0 once the SQL has been applied.

### Next stage

Prompt 03: Durable rooms, guest sessions, and reconnecting transport. Completed in stage 03 below.

## Stage 03

Status: complete.

An administrator can create a lobby. A guest joins with a code and a nickname, keeps that seat in a cookie, and reconnects. The stage lists public nicknames. Pause, advance, recover, and score remain text. No round is running.

### Files and interfaces

- `apps/api/src/room/`: `PartyRoom` and `RoomCodeRegistry`, SQLite schema, receipts, the credential directory, transfer codes, and hibernating sockets. [apps/api/src/room/README.md](../apps/api/src/room/README.md) records the registry, directory, receipt, snapshot, and socket client.
- Wrangler bindings `PARTY_ROOM` and `ROOM_CODE_REGISTRY`, migration tag `v1` with `new_sqlite_classes`, on the top-level config and on the staging and production environments. `apps/api/worker-configuration.d.ts` was regenerated.
- `apps/web/src/live/room-socket.ts` is the only WebSocket client. `apps/web/src/live/room-api.ts` calls the room HTTP routes.
- Admin, guest, and stage pages show the lobby. Shared lobby schemas live in `packages/shared`.

### Decisions and defaults

- One SQLite object per game id. The code registry is a second SQLite object, addressed only with `getByName("codes")`. A join code is 6 characters and a game id is 12, both from the alphabet that excludes I, O, 0, and 1. A unique index makes a collision fail the insert, and the creator tries another code. The game id is not reused.
- `questionSetVersion` and `scoringVersion` are the constant `unreleased`. No question content is stored.
- Guest cookie `26_guest` is `HttpOnly`, `Secure`, `SameSite=Strict`, and `Path=/`. Control and presentation cookies use `Path=/` as well, so the browser sends them on `/api/rooms` and `/ws`. Guest credentials last 12 hours. The `Secure` attribute is always set. `http://localhost` is a secure context, so Chromium stores the cookie. Node tests assert the `Set-Cookie` header.
- A nickname is trimmed, 1–24 characters, and unique among active players without regard to case. The room holds at most 80 players. Nicknames are rendered as text.
- A transfer code is 8 characters, lasts 120 seconds, and is stored hashed. Redeeming it writes a new guest secret, revokes the previous verifier, and closes that player's open sockets.
- Local room creation and transfer issue forward the caller's cookie to `GET /api/admin/session` only when `APP_ENV` is `local`. Staging and production use the in-Worker session check. A missing session is 401.
- The WebSocket route is `GET /ws/:gameId` only. A second `/ws/*` route is not registered, because a second Hono match drops the upgrade. The client URL uses `ws:` or `wss:`, including the colon.
- This stage does not call `setAlarm`. Inbound text is capped at 4 KB. Joins, transfers, and messages are counted in SQLite. The room does not store an IP.

### Commands and results

- `npm run cf-typegen` passed and regenerated `apps/api/worker-configuration.d.ts`.
- `npm run typecheck` passed.
- `npm run lint` passed with no warnings.
- `npm run format:check` passed.
- `npm test` passed: 5 files, 37 tests. Coverage includes code collision, replay and digest mismatch, concurrent joins, a shared address staying two players, nickname collision, the 80-player cap, a later invocation reading SQLite, a spoofed player id, a cross-room cookie, two tabs, transfer closing the old socket, a stage snapshot without verifiers, HTTP create without a session, the guest secret staying out of JSON, a Worker upgrade, and an unknown socket returning JSON.
- `npm run build` passed. Checked 98 build files for secrets. The Worker bundle is about 1,215.63 kB and includes PGlite chunks. The build reported PGlite's direct `eval` warnings.
- `npm run smoke` passed: 6 Playwright tests against `http://localhost:4173`, including creating a lobby, joining as a guest, showing that nickname on the stage, and leaving pause, advance, and recover as text.

A remote Durable Object deploy was not run. Neon migration was not run. Resend delivery was not run.

### Manual verification

In the IDE browser, an administrator signed in, created a lobby, and the page showed the join code, game id, player count, and "Connected to the lobby." On a 390 by 844 pixel viewport the guest page had no horizontal overflow. Joining as Amina showed "You are Amina in this lobby." and "Connected to the lobby." Reloading the guest page resumed that seat. The stage listed Amina and still showed "Preview only. No round is running." Returning to admin showed "Transfer Amina" and "The lobby is open. Guests join with the code." Pause, advance, recover, and score stayed text.

### Unresolved issues

- No Durable Object was deployed, and no Cloudflare, Neon, or Resend resources were created.
- Question and scoring versions remain `unreleased`. Device-context columns exist and nothing writes them. Join codes are not released for reuse.
- The Worker bundle still contains PGlite, including its `eval` use. Local preview does not execute initdb inside the Worker.
- `eslint-visitor-keys@5.0.1` still warns that Node v22.12.0 is older than its declared engine. Lint passed.
- Control credentials still expire after 15 minutes.

### Next stage

Prompt 04: Persistent scheduler and phase lifecycle. Completed in stage 04 below.

## Stage 04

Status: complete.

The room has one scheduler. It owns the Durable Object alarm, and a small fixture round can move through the phase graph. Pause, resume, and advance are real control-credential commands. The admin screen still shows those controls as text.

### Files and interfaces

- `apps/api/src/room/scheduler.ts`: `commitAndArm` is the only caller of `setAlarm` and `deleteAlarm`.
- `apps/api/src/room/lifecycle.ts`: the phase graph, round plugin, pause, resume, advance, alarm handling, submission gate, and resource teardown.
- `apps/api/src/room/sql-store.ts`: the SQLite store behind that lifecycle. Schema version is 2, with `schedule_job`, `round_resource`, and `fixture_answer`.
- Snapshots now include `paused`, `held`, `deadlineAt`, `remainingMs`, and `serverNow`. The stage countdown uses those locally.

### Decisions and defaults

- Current Cloudflare docs: `transactionSync` accepts only synchronous work, so it cannot await `setAlarm`. Alarm methods follow the storage rules. `commitAndArm` performs the SQL change and `txn.setAlarm` or `txn.deleteAlarm` inside one `storage.transaction`. A thrown alarm write rolls the job back, so a committed deadline is not left without a wakeup. An idle room still wakes from that saved alarm.
- Gameplay jobs store the id, type, due time, remaining duration while paused, scope generation, phase generation, status, and retry count. The alarm points at the earliest pending due time. Background jobs keep running during pause. Retry waits start at 2 seconds and double, up to 60 seconds, for at most 6 failures.
- Phases are lobby, intro, prompt, collect, vote, reveal, scores, final, and podium. A plugin must keep that order and may omit vote. The fixture plugin is the test round. Host commands pause, resume, or advance. They cannot name an arbitrary phase.
- A late alarm closes one phase. The next phase receives its configured duration from the transition time.
- The stored due time rejects a late answer before the alarm handler runs. One answer is kept per player per phase generation.
- If the controller socket is gone when collection ends, the next phase waits. The stage socket being gone does not wait. `endPhase` releases round resources on the deadline, on advance, and when opening the next phase fails.
- Default fixture durations are 30 seconds for intro, prompt, collect, and vote, 20 seconds for reveal and final, and 15 seconds for scores. Podium has no deadline. The stage animates the server deadline locally, including a slower update when reduced motion is requested. It does not create a durable job per tick.
- The admin page does not yet show live pause, advance, or score buttons. Those commands exist for the control credential. Prompt 06 owns the host screen.

### Commands and results

- `npm run typecheck` passed.
- `npm run lint` passed with no warnings.
- `npm run format:check` passed.
- `npm test` passed: 7 files, 53 tests. The deterministic clock covers pause and resume, a manual advance racing the deadline, a repeated alarm, a late alarm that closes one phase, the stored deadline, controller hold versus stage absence, failed phase teardown, and an alarm write that rolls the job back. The Durable Object tests cover an idle room waking after eviction, pause across a restart, the same advance race, a second alarm delivery, a late answer, controller reconnection, and a storage transaction that drops a job when it fails.
- `npm run build` passed. Checked 108 build files for secrets. The Worker bundle is about 1,238.69 kB and includes PGlite chunks. The build reported PGlite's direct `eval` warnings.
- `npm run smoke` passed: 6 Playwright tests against `http://localhost:4173`. The stage still shows "Preview only. No round is running." A lobby can still be created and joined.

A remote Durable Object deploy was not run. Neon migration was not run. Resend delivery was not run.

### Manual verification

Playwright loaded `/host` and showed the countdown preview, with no round running. The lobby join flow still connected the guest and the stage. A fixture round was not started from the browser, because the admin screen does not yet expose that command.

### Unresolved issues

- No Durable Object was deployed, and no Cloudflare, Neon, or Resend resources were created.
- Question and scoring versions remain `unreleased`. The fixture round does not score or show a question.
- Device-context columns exist and nothing writes them. Join codes are not released for reuse.
- The Worker bundle still contains PGlite, including its `eval` use. Local preview does not execute initdb inside the Worker.
- `eslint-visitor-keys@5.0.1` still warns that Node v22.12.0 is older than its declared engine. Lint passed.
- Control credentials still expire after 15 minutes.

### Next stage

Prompt 05: Complete multiple-choice game on phones and projector. Completed in stage 05 below.

## Stage 05

Status: complete.

A room can play the illustrative multiple-choice demo from the lobby to the podium. Guests answer on their own phones. The stage shows the question, the countdown, the number of answers, the reveal, the standings, and the podium. Humza pauses, resumes, advances, skips, and finishes from `/admin`.

### Files and interfaces

- `apps/api/src/questions/demo-set.ts`: illustrative set `demo-2026-09-22`. Correct options stay in this module.
- `apps/api/src/questions/multiple-choice.ts`: public question shape, submission check, phases, and server-only scoring. `choice_answer` stores one option per player per question. `score_ledger` stores one row per player per question.
- Snapshots gain `play`. Before reveal, `reveal` is null. Guests receive their own standing. The stage and the admin snapshot receive the room standings once scores exist.
- `POST /api/rooms/play` accepts `start`, `pause`, `resume`, `advance`, `skip`, and `finish` with the administrator session and the control cookie.
- Phone and stage renderers live in `apps/web/src/play`. They do not score.

### Decisions and defaults

- The lobby is still pinned to `unreleased`. Starting the demo pins question set `demo-2026-09-22` and scoring version `mc-v1` for that room.
- The set has three illustrative questions. Collection windows are 20, 15, and 30 seconds. Intro is 5 seconds, the prompt is 8, the reveal is 12, scores are 10, and the final beat is 8. The podium has no timer. There is no score floor and no round multiplier.
- A correct answer scores that question's points. A speed bonus, when the question sets one, is `floor(maxPoints * max(0, deadlineAt - receivedAt) / collectMs)`. `receivedAt` is the Durable Object clock when the answer row is inserted. `deadlineAt` is the collect job's due time in that same transaction. The phone does not send a timestamp.
- Entering reveal inserts the ledger rows. The primary key is the question and the player, inserted with `INSERT OR IGNORE`, so a later call does not score again.
- Advance moves one phase. Skip leaves the current question for the next intro, or for the final beat on the last question, and does not score a question that has not been revealed. Finish moves to the podium. Skip and finish clear a pause.
- Schema version is 3. Voting, effects, and device context can add records beside `choice_answer` and `score_ledger`. Nothing writes device context yet.
- A local guest cookie omits `Secure` so a phone on the same Wi-Fi can join over HTTP. Control, presentation, and the administrator session stay `Secure`. Staging and production guest cookies stay `Secure`. `npm run dev` listens on the network.
- Recover a player and adjust a score stay as text. Those controls are the next stage.

### Commands and results

- `npm run typecheck` passed.
- `npm run lint` passed with no warnings.
- `npm run format:check` passed.
- `npm test` passed: 9 files, 58 tests. The new checks cover server-receipt scoring, the 15–45 second window, the answer key staying out of `apps/web/src`, the next question after scores, an answer that survives eviction after its acknowledgement, a duplicate submission, and a second reveal that does not change the ledger.
- `npm run build` passed. Checked 116 build files for secrets. The client bundle does not contain `demo-answer-key-v1` or the illustrative prompt. The Worker bundle is about 1,257.10 kB and includes PGlite chunks. The build reported PGlite's direct `eval` warnings. The client script is `index-myyXOYV9.js`.
- `npm run smoke` passed: 7 Playwright tests against `http://localhost:4173`. One test signs in, opens the stage, joins three guests, plays the demo through the reveal and the podium, pauses and resumes, reloads a guest during collection and during the reveal, and checks that guest socket frames omit `correctOptionId` until the reveal. One guest used a 390 by 844 viewport.

A remote Durable Object deploy was not run. Neon migration was not run. Resend delivery was not run. A physical phone was not joined in this session.

### Manual verification

Playwright drove the administrator, the stage, and three guest contexts through a complete illustrative quiz, including a phone-width page. The stage showed the question, the answer count, the reveal, Amina's standing, and the podium. Guest frames did not contain the answer key before the reveal, and they never contained `demo-answer-key-v1`.

### Unresolved issues

- No Durable Object was deployed, and no Cloudflare, Neon, or Resend resources were created.
- The illustrative set is not the party script. Name cloud, attribution, player recovery, and score adjustment are the next stage.
- Device-context columns exist and nothing writes them. Join codes are not released for reuse.
- The Worker bundle still contains PGlite, including its `eval` use. Local preview does not execute initdb inside the Worker.
- `eslint-visitor-keys@5.0.1` still warns that Node v22.12.0 is older than its declared engine. Lint passed.
- Control credentials still expire after 15 minutes.
- A physical phone on the LAN was not used. The dev server listens on the network and the local guest cookie can be stored over HTTP.

### Next stage

Prompt 06: Name cloud and the full host control deck. Do not start it from this stage.

## Stage 06

Status: complete.

The lobby is a name cloud with a QR code and a short join address. Guests see a clear joined confirmation and can like or dislike other names. The host deck can run the quiz that stage 05 already plays: pause, resume, skip, advance, re-reveal, score adjustment, rename, swap, kick, recover, connection counts, hide the stage, and finish after the current question.

### Files and interfaces

- `name_reaction` and `score_adjustment` are new room tables. Room schema version is 4. The room also stores `finish_after`, `opening`, `stage_hidden`, and `reveal_nonce`.
- `POST /api/rooms/play` accepts `start`, `pause`, `resume`, `advance`, `skip`, `finish`, `reveal-names`, `hide`, `show`, `rereveal`, `rename`, `swap`, `kick`, `recover`, and `adjust`.
- Guest sockets accept `{ name: "react", targetId, reaction }`. The caller is the socket attachment. A replay of the same request id does not vote again.
- Snapshots add `cloud`, `namesReveal`, `stageHidden`, `finishAfterRound`, and `revealNonce`. A guest snapshot adds `selfReactions`. A control snapshot adds `connections`, `adjustments`, and `play.hostAnswers`. Stage and guest snapshots omit those host fields.
- `play.question.attribution` is `never`, `after`, or `live`. `liveSample` and `attributions` are null until that mode allows them.
- `/j/:code` opens the guest page with the code filled in. The QR is drawn in the browser with `uqr` 0.1.3 so it matches the page origin.
- `POST /api/rooms/demo-cloud` inserts demo nicknames up to 75 active players. It responds 404 unless `APP_ENV` is `local`.

### Decisions and defaults

- Each guest has 10 name votes. Tapping the same reaction removes it and frees a slot. Tapping the other reaction replaces the row and does not use another slot. Votes attach to the player id, so a rename or a swap keeps them with that person. Self-votes are rejected. Voting closes when the quiz starts.
- Reveal nickname votes is a non-scoring lobby beat. Ties show up to three names. Starting the demo sets the beat to done, including when the host skips the reveal.
- The three illustrative questions are `after` (shape), `never` (colour), and `live` (candles). Live mode publishes a count plus up to 8 recent nicknames, not their options. `after` and `live` attach names at the reveal. `never` does not. The host snapshot still lists who chose which option. Hiding the stage removes the question, the reveal, the sample, and the attributions from the stage payload. Guests still see their own question.
- Finish during a question sets a flag and continues to the final beat after that question's scores. Finish on the final beat still moves to the podium. This replaces the stage 05 immediate jump to the podium.
- A score adjustment is a separate row, from -1000 to 1000 excluding 0, with a reason of 3 to 80 characters. The reason stays on the admin screen. Re-reveal runs the same ledger insert and does not add points.
- Kick sets the player and their guest credentials as revoked, then closes their open sockets with `This phone was removed from the game.` The phone does not reconnect. Recover clears the kick and returns a one-use transfer code. The old secret stays revoked.
- Late joiners enter at zero points. The phase and everyone else's score stay as they were.
- The full name cloud is the lobby. During a quiz the stage keeps the player count and a compact QR so someone can still join. Seventy-five names wrap. The cloud skips the rise animation once there are 24 or more names.
- Media cue and Effect are visible and disabled. They do not send a command.
- Admin shortcuts, only while a lobby exists, and not while a key is held or the cursor is in a field: N reveal names, P pause or resume, Right arrow advance, S skip, F finish after this question, H hide or show during a reveal, R show the reveal again. Space is not a shortcut.

### How to run it

1. `npm run dev`
2. Open `http://localhost:5173/admin`, request a link for `humza@localhost.test`, and sign in.
3. Create a lobby. Open the stage from the admin link. Phones use the Vite network address, for example `http://192.168.x.x:5173/j/CODE`, because a local guest cookie is not `Secure`.
4. Guests enter a nickname. The status reads `You are in. This phone is NAME.` Like and dislike are in the lobby.
5. Reveal nickname votes, then start the illustrative demo. Answers open on `Answers are open`.
6. Pause, resume, advance, skip, hide, and re-reveal from the admin deck or the shortcuts above. Finish after this question waits until the current question's scores, then goes to the final beat.
7. Rename, kick, recover, and adjust a score from the player form. Read a recovery code aloud. The kicked phone cannot reconnect with its old cookie.
8. The control session still expires after 15 minutes. Sound stays off until a phone turns it on.

### Commands and results

- `npm run typecheck` passed.
- `npm run lint` passed with no warnings.
- `npm run format:check` passed.
- `npm test` passed: 10 files, 67 tests. New checks cover the 10-vote cap, a repeated request id, replacement and removal, nickname collision and swap, re-reveal without a new ledger row, a duplicate score adjustment, immediate credential revocation, a late joiner at zero points, public snapshots that omit unrevealed answers, stage hiding, and a local seed of 75 names. Finish during collection stays on that phase. `isLocalApp` is false for staging and production.
- `npm run build` passed. Checked 122 build files for secrets. The client bundle does not contain `demo-answer-key-v1` or the illustrative prompt. The Worker bundle is about 1,280.41 kB. The client script is `index-BeJyDhlT.js` and the stylesheet is `index-zG-8mttJ.css`. The build reported PGlite's direct `eval` warnings.
- `npm run smoke` passed: 8 Playwright tests against `http://localhost:4173`. The quiz test still runs three guests through the podium. The layout test seeds 75 names and checks the stage and the host deck at 1280 by 720 and 390 by 844. Neither page scrolled sideways.

The non-local HTTP 404 for `/api/rooms/demo-cloud` was not fetched from a staging worker. The guard is the `isLocalApp` check, which the node test runs for `staging` and `production`. A remote Durable Object deploy was not run. Neon migration was not run. Resend delivery was not run. A physical phone was not joined.

### Manual verification

The four Playwright screenshots were inspected. At projector size the stage shows a QR code, `http://localhost:4173/j/GABJVY`, and Demo 01 through Demo 75 in wrapped rows. At 390 by 844 the same names wrap under the QR and the address, with vertical scrolling and no sideways overflow. The host deck shows the quiz controls, disabled Media cue and Effect buttons, rename, kick, recover, swap, and score adjustment. On the phone those controls wrap into a single column. The overflow checks in the test passed at both sizes.

### Unresolved issues

- No Durable Object was deployed, and no Cloudflare, Neon, or Resend resources were created.
- The illustrative set is not the party script. The 75 names are a local layout seed, not guests.
- Device-context columns exist and nothing writes them. Join codes are not released for reuse.
- The Worker bundle still contains PGlite, including its `eval` use. Local preview does not execute initdb inside the Worker.
- `eslint-visitor-keys@5.0.1` still warns that Node v22.12.0 is older than its declared engine. Lint passed.
- Control credentials still expire after 15 minutes.
- A physical phone on the LAN was not used. The dev server listens on the network and the local guest cookie can be stored over HTTP.
- The demo-cloud route's 404 outside `local` was not requested against a deployed or staging worker.

### Next stage

Prompt 07: Slider and tap-based ranking rounds. Do not start it from this stage.

## Stage 07

Status: complete.

The illustrative demo now has two more round types after the three multiple-choice questions. A slider asks for an explicit estimate. A ranking is placed by tapping an item and then a position. Existing choice scoring, the choice table, and the first three questions are unchanged.

### Files and interfaces

- Room schema version is 5. Versions 1 to 4 upgrade to 5. `round_response` stores one slider or ranking payload per player per question. `choice_answer` and `score_ledger` stay as they were.
- Public `play.question` is a discriminated union: `choice`, `slider`, or `rank`. `selfAnswer` and `reveal` carry the same `kind`. `selfAward` is the guest's points for the current question after it has been scored, or null before that. Control snapshots add `hostResponses` for slider and ranking. `hostAnswers` remains the choice list.
- Guest sockets accept `{ name: "estimate", value }` and `{ name: "rank", placements }`. Malformed values reach the server validator. The same request id replays the stored acknowledgement.
- Phone renderers are `guest-slider.tsx` and `guest-rank.tsx`. The stage reveal shows a slider's truth, guesses, and points, or a ranking's order and awarded points.
- Starting the demo pins scoring version `demo-rounds-v1`. `mc-v1` is still exported. The question set version is still `demo-2026-09-22`.

### Decisions and defaults

- The new questions are appended. `shape`, `colour`, and `candles` stay at indexes 0, 1, and 2. `letters` is the slider. `lineup` is the ranking. The mixed demo therefore has five questions.
- A slider's truth and bands stay in `demo-set.ts`. The public scale includes bounds, step, unit, and initial value. The phone starts there and stores a number only when the guest sends it. Sending the untouched initial value is an answer. Reconnecting does not send it.
- The narrowest band whose distance includes the guess wins. A distance equal to `within` is included. No matching band scores 0. A missing estimate scores 0. Band points are integers from 0 to that question's own points. `letters` is 0 to 20, step 1, initial 10, truth 8, 100 points exact and 40 points within 2.
- Ranking positions are listed best to worst, and truth groups use that direction. The public item order is Cake, Candles, Song, Friends. The truth is Friends, Cake, Song, Candles. Ties are forbidden and the response must be complete. Shared ties and partial responses are implemented and covered by tests, not by a second demo question.
- Ranking points are `floor(question.points * concordant strict pairs / strict truth pairs)`. A guest tie is not concordant and does not subtract further. A truth tie is not a pair. Partial mode keeps every strict truth pair in the denominator. No comparable truth order awards that question's own points for an accepted submission. A missing or fully reversed ranking scores 0. An identical ranking scores full points. One adjacent swap of the four `lineup` items scores 66 of 80. Awards are not normalised onto a global 0–1000 scale.
- Entering reveal still inserts the ledger with `INSERT OR IGNORE`. Restoring a phase shows the accepted payload and does not change the stored points. Skipping before the reveal writes no ledger row for that question.
- Content-author notes are in [apps/api/src/questions/README.md](../apps/api/src/questions/README.md).

### How to run it

1. `npm run dev`
2. Open `http://localhost:5173/admin`, request a link for `humza@localhost.test`, and sign in.
3. Create a lobby. Open the stage from the admin link. Phones use the Vite network address, for example `http://192.168.x.x:5173/j/CODE`.
4. Start the illustrative demo. The first three questions are still multiple choice.
5. On the letters question, move the slider with the arrow keys or Lower and Higher, then press Send estimate. The reveal reads `The answer is 8 letters.` and names the guess and its points.
6. On the party-order question, tap an item and then its position. Send ranking. The reveal reads `The order is Friends, Cake, Song, Candles.`
7. Advance through the remaining beats to the podium.

### Commands and results

- `npm run typecheck` passed.
- `npm run lint` passed with no warnings.
- `npm run format:check` passed.
- `npm test` passed: 12 files, 74 tests. New checks cover exact and within-2 estimates, a miss just outside a band, the narrowest overlapping band, non-finite and off-step and out-of-range values, zero-width and inverted ranges, identical and fully reversed rankings, one adjacent swap, a shared tie that stays non-negative, a partial ranking that cannot earn full marks, duplicate and missing and unknown items, a mixed game of choice then slider then ranking, duplicate submit, pause and resume, reconnect without a score change, and skip before reveal with no new ledger row.
- `npm run build` passed. Checked 130 build files for secrets. The client bundle does not contain `demo-answer-key-v1` or the illustrative circle prompt. The Worker bundle is about 1,308.17 kB. The client script is `index-ULB6OFW9.js` and the stylesheet is `index-Cjha2KAg.css`. The build reported PGlite's direct `eval` warnings.
- `npm run smoke` passed: 8 Playwright tests against `http://localhost:4173`. The quiz test runs three phones through multiple choice, a slider estimate, a tapped ranking, and the podium.

A remote Durable Object deploy was not run. Neon migration was not run. Resend delivery was not run. A physical phone was not joined.

### Manual verification

Playwright drove the mixed game in Chromium. Amina's phone viewport was 390 by 844. The test moved the slider from 10 to 8 with the arrow keys, then used Higher and Lower, sent the estimate, and reloaded onto the stored 8. It then tapped Friends, Cake, Song, and Candles onto 1st through 4th, sent the ranking, and reloaded onto those placements. The stage showed `The answer is 8 letters.`, `Amina guessed 8 letters and scored 100.`, and `The order is Friends, Cake, Song, Candles.` The phone reported the exact score and the ranking score. Horizontal overflow was false on the choice, slider, and ranking screens. A physical handset was not used.

### Unresolved issues

- No Durable Object was deployed, and no Cloudflare, Neon, or Resend resources were created.
- The illustrative set is not the party script. The slider and ranking are examples for content authors.
- Device-context columns exist and nothing writes them. Join codes are not released for reuse.
- The Worker bundle still contains PGlite, including its `eval` use. Local preview does not execute initdb inside the Worker.
- `eslint-visitor-keys@5.0.1` still warns that Node v22.12.0 is older than its declared engine. Lint passed.
- Control credentials still expire after 15 minutes.
- A physical phone on the LAN was not used. The dev server listens on the network and the local guest cookie can be stored over HTTP.
- The demo-cloud route's 404 outside `local` was not requested against a deployed or staging worker.

### Next stage

Prompt 08: Whole-room voting and guess-the-guest. Do not start it from this stage.

## Stage 08

Status: complete.

Guests now write a line and vote on one room-wide ballot, or guess a player from the room. There are no pods and no voting groups. Choice, slider, and ranking rounds are unchanged and still have no vote phase.

### Files and interfaces

- Room schema version is 6. Versions 1 to 5 upgrade to 6. New tables: `text_response`, `vote_candidate`, `vote_elector`, `vote_order`, `vote_ballot`, `vote_shortlist`, `vote_feature`, and `vote_freeze`. `choice_answer` stays multiple choice. `round_response` stays slider and ranking. `score_ledger` is still the only score record.
- Public `play.question` adds `vote` and `guess`. Every play snapshot now includes `selfBallot` and `ballot`, null on choice, slider, and ranking. `selfAnswer` can be `{ kind: "text", body }`. Reveal adds `vote` and `guess`. Ballot cards carry a stable id, label, own flag, selectable flag, and a nullable author. Control snapshots add `candidateId`, `included`, and `votes` on `hostResponses`.
- Guest sockets accept `{ name: "text", body }` and `{ name: "ballot", candidateId }`. Malformed values reach the server validator. The same request id and payload replays the stored acknowledgement.
- Host play actions `include`, `exclude`, and `feature` edit the shortlist or the stage selection. They do not delete submitted lines and they do not change the tally.
- Phone renderers are `guest-text.tsx` and `guest-ballot.tsx`. The stage shows at most eight cards. A longer ballot keeps the count and leaves the names on the phones.
- Starting the demo pins scoring version `demo-rounds-v2`. `mc-v1` is still exported. The question set version is still `demo-2026-09-22`.

### Decisions and defaults

- The new questions are appended. `shape`, `colour`, `candles`, `letters`, and `lineup` stay at indexes 0 to 4. `toast` is every submitted line, attribution after, 60 points. `picks` is a host shortlist, attribution never, 40 points. `who` is a whole-room guess, named scoring, attribution after, 80 points. The mixed demo therefore has eight questions.
- One ballot per player. The default is no self-voting, one accepted vote, and a shared tie: each tied winner receives that question's full points, not a split. A player who joins after the ballot freezes cannot vote. A missing vote or an empty result scores 0. A kicked author's card stays in the stored order, new ballots for it are rejected, and ballots already stored for it do not count. An unknown candidate id is rejected.
- `all` freezes every line. `shortlist` freezes only authors the host included during collection. An empty shortlist stays empty. Lines are kept for the host. A featured stage list is a separate selection of at most eight included cards. Scores use the full counting tally.
- Each elector gets one shuffled order at the freeze. Reconnecting reads that order. The phone does not sort the cards, and a pending tap is not reordered by a later snapshot.
- Guess options use real player ids. Nicknames are frozen labels. `truthNickname` stays server-side until a named reveal's `truthLabel`. Majority scoring exists and is not the default. The demo guess is named, so a minority correct guess scores and a larger wrong vote does not.
- Attribution `never` hides authors and voter names on public cards and the reveal. `after` shows them only once scored. `live` shows them during collection or voting and again once scored. The host snapshot keeps the association in every mode.
- Content-author notes are in [apps/api/src/questions/README.md](../apps/api/src/questions/README.md).

### How to run it

1. `npm run dev`
2. Open `http://localhost:5173/admin`, request a link for `humza@localhost.test`, and sign in.
3. Create a lobby. Open the stage from the admin link. Phones use the Vite network address, for example `http://192.168.x.x:5173/j/CODE`.
4. Start the illustrative demo. The first five questions are still multiple choice, the letters slider, and the party-order ranking.
5. On the toast, each phone sends a line, then one vote. A tie shares the 60 points. The reveal names the writers.
6. On the spare line, include a player before voting. Lines that are not included stay visible to the host and are absent from the ballot. The reveal does not name the writers.
7. On the playlist guess, search the room and send one player. The reveal reads `The answer is Bilal.`
8. Advance through the remaining beats to the podium.

### Commands and results

- `npm run typecheck` passed.
- `npm run lint` passed and printed no warnings.
- `npm run format:check` passed.
- `npm test` passed: 14 files, 84 tests. New checks cover shared full-point ties, named scoring against a larger wrong vote, optional majority scoring, an unscored question, a 75-card reveal capped at eight, a stable shuffle, a collect-to-vote race, duplicate ballots, guessed candidate ids, card order after the room object is evicted, a kicked candidate, a late joiner, an empty shortlist that keeps the line, pause and resume, skip before reveal with no new ledger row, and a featured stage list that does not change the tally.
- `npm run build` passed. Checked 136 build files for secrets. The client bundle does not contain `demo-answer-key-v1` or the illustrative circle prompt. The Worker bundle is about 1,345.07 kB. The client script is `index-0zKD-vUF.js` and the stylesheet is `index-CsWZPD7I.css`. The build reported PGlite's direct `eval` warnings.
- `npm run smoke` passed on the second full run: 8 Playwright tests against `http://localhost:4173`. The first full run passed the mixed quiz and failed `lobby-layout` because that browser was still on an invalid local sign-in link while other admin tests were signing in. That file passed on its own, and the following full run passed all 8.

A remote Durable Object deploy was not run. Neon migration was not run. Resend delivery was not run. A physical phone was not joined.

### Manual verification

Playwright drove the mixed game in Chromium. Amina's phone viewport was 390 by 844. The test still played multiple choice, moved the slider from 10 to 8, and tapped the party order. It then sent two toast lines, selected one vote, let the other phone vote, checked the card order was unchanged, sent the vote, and reloaded onto `Vote accepted.` The spare-line round included only Bilal; Amina's line was not a ballot button, and the reveal did not say who wrote it. The guess round searched `Bil`, sent Bilal, and the stage read `The answer is Bilal.` The phone reported 60 for the toast and 80 for the guess. Horizontal overflow was false on the text, ballot, and guess screens. A physical handset was not used.

### Unresolved issues

- No Durable Object was deployed, and no Cloudflare, Neon, or Resend resources were created.
- The illustrative set is not the party script. The vote and guess questions are examples for content authors.
- Device-context columns exist and nothing writes them. Join codes are not released for reuse.
- The Worker bundle still contains PGlite, including its `eval` use. Local preview does not execute initdb inside the Worker.
- Control credentials still expire after 15 minutes.
- A physical phone on the LAN was not used. The dev server listens on the network and the local guest cookie can be stored over HTTP.
- The demo-cloud route's 404 outside `local` was not requested against a deployed or staging worker.
- Parallel local sign-in links can collide when several Playwright browsers confirm the same administrator at once. The second full smoke run passed.

### Next stage

Prompt 09: Simultaneous duels and finale. Do not start it from this stage.

## Stage 09

Status: complete.

Simultaneous 1v1 duels and one spectated finale play through the existing round coordinator, question schemas, voting path, and score ledger. Pairings are stored when the question opens. A reconnect does not shuffle them. The odd player faces the configured target and is not dropped. A missing opponent forfeits at the phase boundary. Equal distance shares the question's own points. A finale prediction closes before the contestants submit. A tied-only finale is skipped when one player leads, and finish-after-the-current-round still ends on the question in progress.

### Files and interfaces

- `apps/api/src/questions/duel.ts` freezes pairs, accepts a number or a prediction, scores the ledger, and projects the public duel state.
- Room schema version 7 adds `duel_freeze`, `duel_pair`, `duel_role`, `duel_answer`, and `duel_prediction`. Versions 1 to 6 upgrade to 7.
- The guest command `duel` carries the raw value. A finale ballot is a prediction. The play snapshot requires `duel`, which is null on every other question kind.
- `predict` sits between prompt and collect. `guest-duel.tsx` is the phone control. The stage reveal lists at most eight pair results.
- Illustrative questions `clash` and `finale` are appended after the existing eight. The pinned scoring version is `demo-rounds-v3`.
- The author contract is in [apps/api/src/questions/README.md](../apps/api/src/questions/README.md).

### Decisions and defaults

- `odd` is only `solo`. The last player after a seeded shuffle faces `target` alone. A rule that drops them is rejected.
- `absence` is `forfeit`. The pair resolves when collect ends. The room does not wait for a disconnected opponent. Two missing answers score 0.
- `tie` is `shared`. Equal distance pays the question's full points to both players. Receipt time does not choose a winner. The other player scores 0. There is no universal winner or loser award.
- `lateJoin` is `ineligible`. A player who joins after the freeze cannot submit.
- A finale names two contestants. A missing name is not replaced. Spectators back one present contestant during predict and receive that question's `predictionPoints` only if that contestant scores. A tie pays either correct prediction.
- `tieBreak` `off` always plays. `tied` plays only when at least two active players share the lead. Finish-after-the-current-round still goes to the podium without opening a later tie-break.
- Demo `clash` is target 26, within 2, 50 points, tie-break off. Demo `finale` is 70 contestant points, 30 prediction points, contestants Amina and Bilal, and tie-break `tied`. Both are illustrative.

### How to run it

1. `npm run dev`
2. Open `http://localhost:5173/admin`, request a link for `humza@localhost.test`, and sign in.
3. Create a lobby. Open the stage from the admin link. Phones use the Vite network address, for example `http://192.168.x.x:5173/j/CODE`.
4. Start the illustrative demo and play through multiple choice, the slider, the ranking, the toast, the spare line, and the playlist guess.
5. On the duel, each phone sends a number. A pair sees the opponent. An odd player sees the target 26 on their own. The reveal lists the matches, capped at eight.
6. Advance to the podium. With one clear leader the finale is skipped. It plays only when at least two active players share the lead.

### Commands and results

- `npm run typecheck` passed.
- `npm run lint` passed and printed no warnings.
- `npm run format:check` passed.
- `npm test` passed: 16 files, 92 tests. New checks cover odd and even pairings, a stable seed, a shared tie with different receipt times, a forfeit, a solo window, prediction awards, a 40-pair list capped at eight, rejected drop and split rules, a frozen opponent after eviction and rename, pause and resume, a duplicate number, a late joiner, a disconnected opponent, equal answers, prediction timing, a missing finale contestant, a unique leader skipping the finale, and finish-after-the-current-round.
- `npm run build` passed. Checked 142 build files for secrets. The client bundle does not contain `demo-answer-key-v1` or the illustrative circle prompt. The Worker bundle is about 1,374.76 kB. The client script is `index-CRWBqSnr.js` and the stylesheet is `index-CsWZPD7I.css`. The build reported PGlite's direct `eval` warnings.
- `npm run smoke` passed on the first full run: 8 Playwright tests against `http://localhost:4173`. The mixed quiz passed in 17.9s.

A remote Durable Object deploy was not run. Neon migration was not run. Resend delivery was not run. A physical phone was not joined.

### Manual verification

Playwright drove the mixed game in Chromium. Amina's phone viewport was 390 by 844. The test still played multiple choice, the slider, the ranking, the toast, the spare line, and the playlist guess. It then filled 26 on each phone, sent the numbers, and reached the podium with Amina 1st. The captured frames did not include a finale question, which is the skip for a unique leader. Horizontal overflow was false on the duel number field. A physical handset was not used.

### Unresolved issues

- No Durable Object was deployed, and no Cloudflare, Neon, or Resend resources were created.
- The illustrative set is not the party script. The duel and finale questions are examples for content authors.
- Device-context columns exist and nothing writes them. Join codes are not released for reuse.
- The Worker bundle still contains PGlite, including its `eval` use. Local preview does not execute initdb inside the Worker.
- Control credentials still expire after 15 minutes.
- A physical phone on the LAN was not used. The dev server listens on the network and the local guest cookie can be stored over HTTP.
- The demo-cloud route's 404 outside `local` was not requested against a deployed or staging worker.
- Parallel local sign-in links can collide when several Playwright browsers confirm the same administrator at once. This smoke run passed.

### Next stage

Prompt 10: Troll engine and first visual effects. Do not start it from this stage.

## Stage 10

Status: complete.

Guests have one troll token for the whole game. It unlocks on the second question. Spending it, checking the target and the phase, and storing the effect are one durable action. The same request returns that result. A small engine owns the effects, so each round does not grow its own troll path.

### Files and interfaces

- `apps/api/src/troll/catalogue.ts` defines the implemented effects, the slot rule, the one-time refund rule, and the `double` modifier order.
- `apps/api/src/troll/engine.ts` accepts a troll, an escape, a host cancel, and a cue dismissal. It settles expiry on phase changes and on the existing room scheduler.
- Room schema version is 8. Versions 1 to 7 upgrade to 8. New tables: `troll_token`, `troll_effect`, and `stage_cue`.
- The guest commands are `troll` and `troll-escape`. Host play actions are `cancel-effect` and `dismiss-cue`.
- Every snapshot includes `trolls`. Control snapshots also include `hostEffects`. A guest snapshot hides the stage announcement and, while hidden score is active, that phone's own points.
- `apps/web/src/troll/guest-troll.tsx` is the phone picker and the labelled invasion. The stage shows one caption. The admin screen can cancel a running effect and dismiss the caption.
- The implemented-versus-candidate list is [apps/api/src/troll/README.md](../apps/api/src/troll/README.md).
- Starting the demo pins scoring version `demo-rounds-v4`. The question set version is still `demo-2026-09-22`.

### Decisions and defaults

- The token is `ready` or `spent`. It unlocks when the question index is at least 1, including for a player who joins later. A player cannot target themselves. Round one rejects the spend.
- Each target has one transient slot and one persistent slot. A second effect for a full slot waits. A third is rejected and the token stays ready. A waiting effect that cannot start in its phase expires, and the token is refunded once. An effect that already started is not refunded.
- Pause freezes effect and announcement timers with the other gameplay timers. Skip and advance settle effects whose phase has ended. Reconnecting reads the stored effect and does not start it again. The host cancel of a queued effect refunds the token. Cancelling one that has started does not.
- Effect and announcement jobs use the existing scheduler. Their payloads start with `effect:` or `cue:`, and they do not advance the question phase.
- Announcements wait in one queue of three. A further announcement is dropped. Only one plays at a time. Demo cues are captions with a labelled asset name. They are not audio files.
- Screen invasion, the call from Mum, the cracked screen, the nickname swap, and the hidden score leave the player id and the score ledger unchanged. A swap changes the name on screen only. Hidden score hides that phone's own points. The stage standings stay visible.
- The dodging button lasts at most three seconds, keeps the answer ids, and can be stopped with Answer anyway. A question sets `suppressSpeedBonus` when that disruption should remove speed points. The illustrative candles question does. The illustrative shape question does not, so a disruption flag there still pays the speed bonus.
- `double` is the only score modifier. It runs after the question's own points, only when that question lists `modifiers: ["double"]`, and only while an accepted double is still active. A positive award is doubled. A zero award stays zero. Host adjustments are not doubled. The illustrative colour question allows it. Other catalogue effects are rejected and have no phone button.
- A troll target button is named `Troll` plus the nickname, so it stays distinct from a ballot that uses the same name.

### How to run it

1. `npm run dev`
2. Open `http://localhost:5173/admin`, request a link for `humza@localhost.test`, and sign in.
3. Create a lobby. Open the stage from the admin link. Phones use the Vite network address, for example `http://192.168.x.x:5173/j/CODE`.
4. Start the illustrative demo. The first question has no troll token.
5. From the colour question onward, a phone can send one troll. The cracked screen, the call, and the invasion are labelled dialogs the target can dismiss.
6. On the colour question, Double or nothing doubles that player's award, or leaves a miss at zero. On the candles question, a dodging button removes the speed bonus.
7. The stage shows one caption, such as `Bilal used Cracked screen on Amina.` The admin screen can cancel the effect or dismiss the caption.
8. Advance through the remaining beats to the podium.

### Commands and results

- `npm run typecheck` passed. An earlier run failed because the colour modifier was typed as a one-element tuple and two unused host imports remained in the room socket handler. Both were corrected before this pass.
- `npm run lint` passed and printed no warnings.
- `npm run format:check` passed.
- `npm test` passed: 18 files, 99 tests. New checks cover one spend and a replay of that spend, a second request rejected after the token is spent, two players racing for one target slot, a queued effect refunded once when the phase ends, a later spend staying spent, pause and resume of an effect timer, nickname swap following a rename and returning after cancel, double points only on a question that lists the modifier, a miss staying at zero, and candles paying the base points with no speed bonus while the button is dodging.
- `npm run build` passed. Checked 150 build files for secrets. The client bundle does not contain `demo-answer-key-v1` or the illustrative circle prompt. The Worker bundle is about 1,398.91 kB. The client script is `index-D9JWu591.js` and the stylesheet is `index-3kl7yBic.css`. The build reported PGlite's direct `eval` warnings.
- `npm run smoke` passed on the second full run: 8 Playwright tests against `http://localhost:4173`. The mixed quiz passed in 25.0s. The first full run passed the other seven tests and failed the quiz because the guess ballot and the troll picker both exposed a button named Bilal. Target buttons are now named `Troll` plus the nickname, and the following full run passed all 8.

A remote Durable Object deploy was not run. Neon migration was not run. Resend delivery was not run. A physical phone was not joined.

### Manual verification

Playwright drove the mixed game in Chromium. Amina's phone viewport was 390 by 844. On the letters slider, Bilal sent Cracked screen to Amina. Amina saw the dialog named Demo crack, horizontal overflow was false, and the stage read that Bilal used Cracked screen on Amina. Amina dismissed it, then moved the slider from 10 to 8 and sent the estimate. The later rounds and the podium still completed, with Amina 1st. A physical handset was not used.

### Unresolved issues

- No Durable Object was deployed, and no Cloudflare, Neon, or Resend resources were created.
- The illustrative set is not the party script. The colour and candles flags are examples for content authors.
- Demo troll assets are text labels. No image or audio file is attached. The announcement is a caption.
- Candidate trolls in [apps/api/src/troll/README.md](../apps/api/src/troll/README.md) are not implemented. Asking for one is rejected.
- Device-context columns exist and nothing writes them. Join codes are not released for reuse.
- The Worker bundle still contains PGlite, including its `eval` use. Local preview does not execute initdb inside the Worker.
- Control credentials still expire after 15 minutes.
- A physical phone on the LAN was not used. The dev server listens on the network and the local guest cookie can be stored over HTTP.
- The demo-cloud route's 404 outside `local` was not requested against a deployed or staging worker.
- Parallel local sign-in links can collide when several Playwright browsers confirm the same administrator at once. The second full smoke run passed.

### Next stage

Prompt 11: Reliable R2 photo and voice media pipeline. Do not start it from this stage.

## Stage 11

Status: complete.

A phone can send a photo or a short WAV clip while a question is running. The upload goes to a temporary object. A separate finalisation job checks the bytes and writes a new accepted object. The room records that acceptance once. Hiding it stops later stage and gallery reads.

### Files and interfaces

- Room schema version is 9. Versions 1 to 8 upgrade to 9. The new table is `media_upload`. Fresh rooms open at version 9. No stored version-8 database was migrated in this run.
- `apps/api/src/media/keys.ts` builds `tmp/{gameId}/{uploadId}` and `accepted/{gameId}/{mediaId}`. The media id is a new id, not the upload id.
- `POST /api/rooms/:gameId/media/slots` creates the upload record and returns a short-lived PUT URL. The client sends an upload id back to finalise. It does not choose the object key.
- Local development PUTs to `/api/rooms/:gameId/media/temporary/:uploadId`. That route answers 404 when `APP_ENV` is not `local`.
- `POST /api/rooms/:gameId/media/:uploadId/finalise` runs outside the room's answer and vote handler. `GET /api/rooms/:gameId/media/:mediaId` serves an accepted object to a guest of that game, the control cookie, or the presentation cookie.
- Host play action `hide-media` sets the row hidden. Stage and guest snapshots omit it. The control snapshot keeps `hidden: true`.
- Every snapshot includes `media`.
- `apps/web/src/media/guest-media.tsx` is the phone photo and voice control. The stage renders accepted photos and voice players. The admin screen has a hide button per accepted item.
- `apps/api/r2-cors.json` and `apps/api/r2-lifecycle.json` are the bucket policies to apply later. They were not applied.
- The operational notes are [apps/api/src/media/README.md](../apps/api/src/media/README.md).

### Decisions and defaults

- Temporary and accepted objects are private key spaces. A guest receives a write URL only for the temporary key. The accepted write uses `If-None-Match: *`, so a second write does not replace the bytes.
- The upload link lasts 5 minutes. A finalisation lease lasts 30 seconds. Each player can have 8 records that are not rejected, cancelled, or expired. The room cap is 80. The same request id returns the same slot.
- The accepted image cap is 1,048,576 bytes. A temporary photo may be up to 8,388,608 bytes before that check. The phone resizes the longest edge to about 1280 pixels and encodes JPEG at quality 0.8. HEIC, by type or file name, or a file the browser cannot decode, shows: "Choose a JPEG or PNG, or take a new photo. This phone cannot read HEIC."
- Local photo checks decode and re-encode with `jpeg-js` 0.4.4. Staging and production do not use that decoder. They need an `IMAGES` binding, which is not attached, because it does not simulate locally and uses the Images service when deployed. Without it, photo finalisation returns "Photo processing is not configured for this environment." When the binding is present, the transform is width 1280, fit `scale-down`, metadata `none`, output JPEG quality 80.
- Voice clips are PCM WAV. Duration is calculated from the `data` chunk and the `fmt` byte rate. The file is rewritten with only `fmt` and `data`. The maximum is 3 seconds and 400,000 bytes. A client-supplied duration is not read. The phone records with `AudioContext` and stops at 2.9 seconds. WebM from `MediaRecorder` is not accepted. The Media Transformations binding was not added: it does not simulate locally and expects a video input.
- Presigned PUT URLs are signed with `aws4fetch` only when `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, and `MEDIA_BUCKET_NAME` are set. Those three secrets are blank. No request was sent to `r2.cloudflarestorage.com`. `realBucketReport` stays `networkChecked: false`.
- Bucket names in Wrangler are `26-humza-media-local`, `26-humza-media-staging`, and `26-humza-media`. None was created. The lifecycle file expires the `tmp/` prefix after 1 day. Accepted objects have no automatic deletion. CORS allows `http://localhost:5173` and `http://localhost:4173`, methods PUT, GET, and HEAD, header `Content-Type`, and exposes `ETag`. The deployed origin is not in that file.
- Finalisation is a recoverable job: open, leased, staged, accepted, rejected, cancelled, or expired. A crash after the accepted object is written is recovered from the row. If the question index changed, or the phase is lobby or podium, the object is not published. Repeating finalisation returns the same media id. Replacing the temporary object afterwards does not change the accepted bytes. R2 and SQLite are not one transaction.
- A signed URL remains usable until it expires, so a later PUT can replace the temporary object. It cannot replace the accepted object.
- Accepted responses use `Cache-Control: private, no-store`. Hide does not delete the object. A copy already downloaded is not recalled. A missing microphone does not block the questions.

### How to run it

1. `npm run dev`
2. Sign in at `http://localhost:5173/admin` as `humza@localhost.test`, create a lobby, and open the stage.
3. Join from a phone and start the illustrative demo.
4. Choose a JPEG or PNG. The status moves through preparing, uploading, and checking, then "Photo accepted." The stage shows `Photo from` that nickname.
5. A `.heic` file stays on the phone with the HEIC message. Upload can be tried again.
6. Record a 3 second clip if the microphone is available. Without one, the phone says the microphone is unavailable and the questions stay open.
7. On the admin screen, Hide photo or Hide voice removes it from the stage. A later request for that media address is not found.

### Commands and results

- `npm run cf-typegen` passed. `Env` now includes `MEDIA_BUCKET` and the R2 variable names.
- `npm run typecheck` passed. An earlier run failed because the guest page had two adjacent elements without a parent, and the auth test environment was missing the new bindings. Both were corrected before this pass.
- `npm run lint` passed and printed no warnings.
- `npm run format:check` passed after Prettier wrote the new media files.
- `npm test` passed: 20 files, 108 tests. The media checks cover an invalid photo, an oversized body, another player's upload, a repeated finalisation, a temporary object replaced after acceptance, an ETag change during the read, a crash after the read, after the source tag is saved, after the accepted object is written, after it is staged, and after it is committed, a question change during processing, hide, the player cap, a replayed request id, WAV duration and extra-chunk stripping, the Images transform options, and a presign that does not call the network.
- `npm run build` passed. Checked 170 build files for secrets. The client bundle does not contain `demo-answer-key-v1` or the illustrative circle prompt. The Worker bundle is about 1,496.20 kB. The client script is `index-C9W2mnnw.js` and the stylesheet is `index-CiOBh9PR.css`. The build reported PGlite's direct `eval` warnings.
- `npm run smoke` was run twice with the default 4 workers. The first run, before the phone file control was constrained, passed 5 tests. The quiz failed because Amina's page overflowed at 390 pixels. Media, the admin sign-in, and the dense lobby failed because parallel browsers confirmed the same local sign-in link. After the file control was constrained, a one-worker run of the media and quiz tests passed. Media took 7.0s and the quiz took 15.4s. The following default smoke passed 8 tests, including media in 8.1s and the quiz in 15.9s. The dense lobby again received an expired sign-in link. Run alone, that test passed in 4.6s.

A remote R2 bucket was not created. Lifecycle and CORS were not applied. The Images binding was not attached. No Durable Object was deployed. Neon migration was not run. Resend delivery was not run. A physical phone was not joined.

### Manual verification

Playwright drove Chromium at `http://localhost:4173`. Amina's viewport was 390 by 844. A `.heic` file showed the HEIC message. The record button, with no microphone, showed that the microphone is unavailable. A PNG was resized in the browser, uploaded, and accepted. The stage image `Photo from Amina` loaded with `Cache-Control` containing `no-store`. Hide removed that image, and a later request for the same address returned 404. Horizontal overflow on that phone was false. The illustrative quiz still completed. A physical handset was not used.

### Unresolved issues

- `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, and `R2_SECRET_ACCESS_KEY` are unset. No real bucket was contacted, created, or checked. Local tests and the preview used the Worker binding and an in-memory store.
- The `IMAGES` binding is not in Wrangler. Deployed photo finalisation will fail closed until each environment sets `"images": { "binding": "IMAGES" }`.
- `apps/api/r2-lifecycle.json` and `apps/api/r2-cors.json` are not applied. The CORS file does not include a production origin.
- Voice notes must be PCM WAV. A browser WebM recording is rejected. The Media Transformations binding is not required and is not attached.
- Hide does not erase a copy the browser already has.
- No Durable Object was deployed, and no Cloudflare, Neon, or Resend resources were created.
- A physical phone on the LAN was not used.
- Parallel local sign-in links can still collide when several Playwright browsers confirm the same administrator at once.

### Next stage

Prompt 12: Live typing, voice playback and recurring theme songs. Do not start it from this stage.

## Stage 12

Status: complete.

A phone can show one live draft on the stage, send a checked three-second voice clip for later playback, or assign a short theme sting that returns on score reveals. The stage unlocks sound with a click, and can mute or stop the current cue.

### Files and interfaces

- Room schema version is 10. Versions 1 to 9 upgrade to 10. Fresh rooms open at version 10. `stage_cue` gained `media_id`, `audio_asset`, `media_kind`, and `question_index`. No stored version-9 database was migrated in this run.
- The troll catalogue adds `typing`, `voice`, `theme`, and `sponsor`. Captioned photos use the same cue card. The rest of the candidate catalogue stays rejected.
- Live drafts stay in the room's memory. They are not receipts and they are not stored. Only the stage snapshot includes `draft`. Guest and control snapshots omit it.
- A voice troll holds its cue until that question's reveal or scores phase. A theme sting is queued once per scores phase. The cue id is stored with the cue.
- `entertainmentCueDecision` in `@26/shared` returns play, wait, or drop. The stage screen is `apps/web/src/stage/stage-sound.tsx`.
- The phone records a troll clip in `apps/web/src/media/voice-take.tsx`, then uploads it through the existing media pipeline.
- The demo sting is `apps/web/public/assets/demo-sting.wav`. The catalogue label is `Demo sting`.
- The implemented-effects table is in [apps/api/src/troll/README.md](../apps/api/src/troll/README.md).

### Decisions and defaults

- Live typing is offered only when the question's attribution is `live`. In the illustrative set that is the candles question. One typing effect can be active in the room. A second waits. Updates are coalesced to about five a second, on the phone and in the room, and a held update is still sent. An empty draft, a hidden phone, a disconnect, a phase change, a skip, or a room restart clears the draft. The sent answer still uses the normal stored command.
- A voice troll spends the token only after an accepted clip owned by that phone. Skipping the question drops the held cue. A missing microphone, a denied permission, or a phone that cannot record shows a message and leaves the questions open.
- A theme song uses the persistent slot and continues across questions until the podium, or until four score cues have been queued. Pause and resume keep the same cue id. A sting from an earlier question is dropped when the question index changes, so a reconnect does not start it again.
- An active persistent effect and a waiting persistent effect can share a target. A transient effect still uses the other slot. A fourth open stage cue is dropped. Sponsor breaks and captioned photos are the only extra cards.
- Entertainment audio is not exactly-once if the browser crashes or the stage refreshes. A cue already on screen at load, already played, muted, or left from an earlier question is dropped. A cue that arrives while sound is locked waits for Enable sound. Mute and the played cue ids are remembered in the tab. Unlock is not. Score changes and the troll token stay exactly-once in the room.
- Replace the sting by putting a short PCM WAV at `apps/web/public/assets/demo-sting.wav`. Keep it under about three seconds.
- The admin buttons "Media cue. Not in this build." and "Effect. Not in this build." stay disabled. They are not stage controls.

### How to run it

1. `npm run dev`
2. Sign in at `http://localhost:5173/admin` as `humza@localhost.test`, create a lobby, and open the stage.
3. On the stage, click Enable sound. The notice says sound is on for new cues and that a refresh asks again. Mute stage and Stop cue silence the current cue.
4. Join two phones. On the candles question, send Live typing. The stage shows that nickname typing. The admin screen does not.
5. Send Voice clip from the troll list. Record, listen, and send. The stage plays it at the reveal. If the microphone is refused, the phone says so and the questions stay open.
6. Send Theme song. The short sting is queued when that player's score is revealed. Replace `apps/web/public/assets/demo-sting.wav` before the party.

### Commands and results

- `npm run typecheck` passed. An earlier run failed because a missing-cue host result needed a failure branch before reading `message`. That was corrected before this pass.
- `npm run lint` passed and printed no warnings. An earlier run warned that voice helpers were exported from the photo component file. Those helpers moved to `media-transfer.ts`, `wav.ts`, and `voice-take.tsx`.
- `npm run format:check` passed.
- `npm test` passed: 22 files, 114 tests. The new room tests cover one live draft, attribution, a second typing effect waiting, a stage-only draft, disconnect, an empty draft, a room restart, skip, a theme waiting behind double or nothing, the same cue id across pause and resume, a new cue id on the next scores phase, a voice clip held until the reveal, a skipped voice cue, four sponsor cues with the fourth dropped, and a captioned photo. The cue policy tests cover drop, wait, and play. An earlier voice test failed because the socket handler omitted the media id. That was corrected before this pass.
- `npm run build` passed. Checked 175 build files for secrets. The client bundle does not contain `demo-answer-key-v1` or the illustrative circle prompt. The Worker bundle is about 1,507.05 kB. The client script is `index-CzIS19yD.js` and the stylesheet is `index-vfCqSjRV.css`. The build reported PGlite's direct `eval` warnings.
- `npm run smoke` with the default 4 workers passed 7 tests. Media failed because the caption image name also matched `Photo from Amina`. The quiz failed because a parallel browser confirmed an expired local sign-in link. The caption name was changed to `Stage caption`. After that, a one-worker run of the media and quiz tests passed. Media took 6.4s and the quiz took 15.8s.

A remote R2 bucket was not created. No Durable Object was deployed. Neon migration was not run. Resend delivery was not run. A physical phone was not joined.

### Manual verification

Playwright drove Chromium at `http://localhost:4173`. Amina's viewport was 390 by 844. The microphone-unavailable message still appeared, a PNG was accepted as `Photo from Amina`, hide still returned 404, and the illustrative quiz still completed, including the cracked-screen cue on the stage.

In the browser, a new lobby was started from the admin screen. Enable sound changed the stage notice to sound being on for new cues, and that a refresh asks again. Mute stage changed the button to Unmute stage and said the stage was muted. Stop cue said the current cue was stopped. The stage text did not include `humza@localhost.test`, score adjustments, host effect rows, or the "Not in this build" buttons. While that stage was connected, Pause, Resume, Advance, and Skip question on the admin screen stayed usable. A physical handset was not used. Returning from a backgrounded phone was covered by the draft tests and the visibility handler, and was not tapped on a handset.

### Unresolved issues

- Entertainment audio can be dropped after a refresh or a crash. It is not exactly-once. Score and token rows remain exactly-once.
- The demo sting is a short labelled beep. Humza replaces `apps/web/public/assets/demo-sting.wav`.
- `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, and `R2_SECRET_ACCESS_KEY` are still unset. The `IMAGES` binding is still absent. Lifecycle and CORS were still not applied.
- No Durable Object was deployed, and no Cloudflare, Neon, or Resend resources were created.
- A physical phone on the LAN was not used.
- Parallel local sign-in links can still collide when several Playwright browsers confirm the same administrator at once.

### Next stage

Prompt 13: Browser/device contexts and connection summaries. Do not start it from this stage.

## Stage 13

Status: complete.

A phone can send a bounded browser and screen report after it joins. Accepted answers keep the context that was current at that moment. A missing report does not block the answer. Connection samples, reconnects, and upload retries are stored as capped summaries. Detailed rows are scheduled for removal 30 days after the room was created. Results, scores, and media stay.

### Files and interfaces

- Room schema version is 11. Versions 1 to 10 upgrade to 11. Fresh rooms open at version 11. New tables are `device_context`, `connection_summary`, and `telemetry_aggregate`. `room.telemetry_retention_days` defaults to 30. Accepted answer, vote, duel, prediction, name-reaction, fixture, and troll rows gained a nullable `device_context_id`. No stored version-10 database was migrated in this run.
- `@26/shared` exports collector version 1, `normaliseDeviceReport`, `reportedScreenGroup`, `detailedTelemetryPolicy`, and the screen-group cutoff. The notes are [apps/api/src/device/README.md](../apps/api/src/device/README.md).
- The room mints `deviceContextId`. The phone cannot choose it. `readGameplayContext` and `configureTelemetryRetention` are Durable Object methods used by tests and later statistics. They are not on the stage snapshot.
- The guest join panel explains the statistics. The phone collector is `apps/web/src/device/source.ts`. The connection summary on the phone is `apps/web/src/device/connection-log.ts`.

### Decisions and defaults

- Collector version 1. Each browser field is feature-detected. A missing or throwing API is unknown. The server builds a fresh report and drops a raw user agent, an IP address, and any model string. `physical.size` and `physical.model` stay `unknown`. CSS screen size is not inches.
- `network.quality` may be `4g`. `network.bearer` stays `unknown`. That quality value is not a mobile 4G service. An iPad that presents as a desktop Mac is `ipad` with classification `ambiguous`. A platform that only says iOS is `iphone` with classification `ambiguous`.
- The wider screen group is a short edge of at least 700 CSS pixels. `screenGroupVersion` is 1. The cutoff was chosen before any party results.
- The first context for a player is the participating context. Later contexts, including one after a transfer, are not. Whole-room counts can use the participating row. A question comparison uses the id copied onto the accepted row. If the phone has not reported, that id is null.
- Transfer keeps the same player. It clears the current context pointer. The next report creates a new context. It does not add a player or a vote.
- A material change waits 30 seconds, except one phase-boundary update per phase generation. Screen and viewport edges are bucketed to 20 CSS pixels. A player keeps at most 8 contexts. Device and connection commands do not use the 100-message gameplay cap, do not write receipts, and do not bump the room version.
- The text `ping` is answered with `pong` by the Durable Object auto-response, so a quiet socket can stay hibernated. The phone keeps a few round-trip samples and sends a summary about once a minute or when the phase changes. The room stores at most 16 samples, a count, a median, and an upper estimate from that ring. Guest sockets after the first count as reconnects, up to 40. A second tab that replaces the first counts as a reconnect.
- Detailed contexts and sample lists are removed by the background job `telemetry-retention`, 30 days after `room.created_at`. The interval can be set from 0 to 3650 days. Removal writes `telemetry_aggregate` first. Answers, scores, players, and media stay. `detailedTelemetryPolicy` is the copy Prompt 15 can store with the archive. After removal, an answer may still mention a context id that no longer resolves.

### How to run it

1. `npm run dev`
2. Open `http://localhost:5173/`. The panel "On this phone" explains the statistics before you join.
3. Join a lobby. Play continues if the browser report never arrives. The stage does not show the report.
4. About this build says an unclear iPhone or iPad stays marked that way.

### Commands and results

- `npm run typecheck` passed. An earlier run failed because the shared import used a `.ts` suffix, an unused parse binding remained, and the telemetry read returned a type the Durable Object stub treated as `never`. Those were corrected before this pass.
- `npm run lint` passed and printed no warnings.
- `npm run format:check` passed.
- `npm test` passed: 24 files, 119 tests. The normaliser tests cover a missing report, a thrown reader, a raw user agent and IP that must not be stored, an extreme screen size, an ambiguous iPad, an ambiguous iOS hint, and `4g` with an unknown bearer. The room tests cover a spoofed report stored only for the signed-in player, a shared IP that is not stored, a resize burst that stays one context, an answer before any report, scoring with and without a report, three sockets, capped samples, a transfer that keeps one player and adds a second context, and retention that removes contexts while answers, scores, and a reserved upload remain. A second purge keeps the aggregate. An earlier read failed because SQLite rejected a six-part `UNION`. The reads are now separate. The phase test that expected an empty job table now expects the retention job that is armed when the lobby opens, and it still checks that a failed insert does not keep `job-1`.
- `npm run build` passed. Checked 181 build files for secrets. The client bundle does not contain `demo-answer-key-v1` or the illustrative circle prompt. The Worker bundle is about 1,533.99 kB. The client script is `index-Dde3pQg_.js` and the stylesheet is `index-CeaRn1MQ.css`. The build reported PGlite's direct `eval` warnings.
- `npm run smoke` with the default 4 workers passed 7 tests. Media and the quiz failed because parallel browsers confirmed an expired local sign-in link. A one-worker rerun of those two tests passed. Media took 7.2s and the quiz took 14.9s.

A remote R2 bucket was not created. No Durable Object was deployed. Neon migration was not run. Resend delivery was not run. A physical phone was not joined.

### Manual verification

Playwright drove Chromium at `http://localhost:4173`. The guest shell still joins, the about dialog still opens, and the guest page does not overflow at 390 by 844. Media still accepts a PNG as `Photo from Amina`, and the illustrative quiz still completes.

In the browser, at 390 CSS pixels wide, the guest page showed the statistics sentence in full and `scrollWidth` stayed equal to `clientWidth`. About this build opened and Close was focused. A previously stored guest cookie reconnected as Amina and the same sentence stayed on that screen. A new lobby, join code `5GT9ME`, showed on the stage as "The lobby is on screen." The stage text did not include `humza@localhost.test`, a device report, or the "Not in this build" buttons. The browser already held an HttpOnly guest cookie, so that tab could not start a second fresh join. The Playwright lobby test covered a fresh join. A physical handset was not used.

### Unresolved issues

- After the retention job runs, an answer can still store a context id whose row has been deleted. The aggregate was written first.
- The upper round-trip figure is taken from the latest 16 samples, not from every sample in the game.
- Entertainment audio can still be dropped after a refresh or a crash. Score and token rows remain exactly-once.
- `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, and `R2_SECRET_ACCESS_KEY` are still unset. The `IMAGES` binding is still absent. Lifecycle and CORS were still not applied.
- No Durable Object was deployed, and no Cloudflare, Neon, or Resend resources were created.
- A physical phone on the LAN was not used.
- Parallel local sign-in links can still collide when several Playwright browsers confirm the same administrator at once.

### Next stage

Prompt 14: Evidence-backed end-game statistics. Do not start it from this stage.

## Stage 14

Status: complete.

Accepted actions, the score ledger, troll and media rows, and device contexts now produce fact records before any sentence. The host can preview eligible and suppressed highlights. The stage receives eligible cards only at the podium. A personal recap stays on that guest's phone. The results page still waits for the archive and does not fill the gap with sample numbers.

### Files and interfaces

- Room schema version is 12. Versions 1 to 11 upgrade to 12. Fresh rooms open at version 12. `player.client_class` defaults to `guest`. `player.joined_at` is set when a guest joins. Demo-cloud names are inserted as `synthetic`. No stored version-11 database was migrated in this run.
- `@26/shared` exports `minimumComparisonGroup` (5) and `statCardSchema`. A public snapshot may include `highlights` (at most 8) or `recap` (at most 6). Those keys are omitted when empty, so a stage lobby snapshot keeps its previous keys.
- Facts are built in `apps/api/src/stats/aggregate.ts` from a `StatsSource`. `apps/api/src/stats/source.ts` reads that source from the room. The notes are [apps/api/src/stats/README.md](../apps/api/src/stats/README.md).
- Each fact has an id, a scope, the room's `state_version` as the source revision, a metric, a grouping definition, a numerator, a denominator, an unknown count, display eligibility, labels, and named parts. Cards are a projection of those facts. `factsForWording` returns a copy of the fact fields only.
- The admin lobby shows a Highlights list. The stage shows "From this room" when the snapshot includes highlights. The guest page shows "Your recap". The results page keeps the archive sentences and says it does not use sample numbers.

### Decisions and defaults

- Counts are unique guests or one accepted response per player. Sockets, submission retries, and refunded trolls are not extra counts. A duplicate effect id counts once.
- `guest` counts. `host`, `test`, and `synthetic` do not. An unrecognised class is treated as `test` and excluded.
- Game-wide device counts use the first participating context. Question comparisons use the context on the accepted row. A transfer stays one player. A missing or purged context is unknown, not a guessed family.
- Screen comparisons use the existing cutoff: `screenGroupVersion` 1, a short edge of at least 700 CSS pixels. It was not fitted to these results. It is not inches, a phone model, a nationality, or an internet provider.
- "Most people who chose an answer had joined on iPhones" is a strict majority of the classified people who chose it. "Players who joined on iPhones were more likely to choose it" is that group's rate against the other classified players who answered. Each sentence is emitted only when its own comparison holds.
- A percentage comparison needs at least 5 in each group. Smaller groups stay on the host preview with the counts and no percentage. They are not sent to the stage. Individual awards, including a fastest answer, can still be selected below 5.
- The most divisive question is the smallest gap between the two leading options, divided by the accepted responses. Equal ratios are all shown. A missing answer is not a third option. The fastest correct answer is the most time left on the server receipt. Equal time left is a tie.
- Reconnect survival uses the stored per-player count, and only when the phase is podium or final and the best score is above 0. A player with no summary has 0 recorded reconnects.
- Late joiners who were not eligible are left out of the missing tally. An eligible guest with no accepted response is a missing answer, not an invented device.
- Stage cards are attached only when the phase is podium and the stage is not hidden. The host preview can include a fastest answer before the reveal. A guest's fastest line waits until that question is in the score ledger. Personal facts are not placed on the stage or on another guest's recap.
- Illustrative rooms, question set `demo-2026-09-22`, prefix cards with "Illustrative." A withheld fact produces no card. It is not replaced by a sample such as "31 of the 48".
- There is no model and no paid AI dependency. A future wording pass may only repeat numbers already stored on the permitted facts. The template path is complete.

### How to run it

1. `npm run dev`
2. Open `http://localhost:5173/admin`, create a lobby, and start the illustrative demo.
3. Join two phones and answer the first question. The admin screen shows Highlights. The stage does not show "From this room" until the podium.
4. Each phone may show "Your recap" for its own device. It does not name the other player, and "Your fastest" waits until that question has been scored.
5. `/r/` followed by a game-shaped id still says the results archive is not built yet.

### Commands and results

- `npm run typecheck` passed. An earlier run failed because a card lookup used a field the card type does not have. That lookup was removed before this pass.
- `npm run lint` passed and printed no warnings. An earlier run failed on an unused helper that always returned true. The duplicate-effect check already drops the repeat, so the helper was removed.
- `npm run format:check` passed.
- `npm test` passed: 26 files, 128 tests. The fixture tests cover unequal device groups, an ambiguous classification, unknown devices, a synthetic player, composition against likelihood, a group under 5, tied splits, a transferred device, a late joiner, a duplicate response, tied fastest answers, reconnects that follow the winner rather than the busiest socket, a zero denominator, the 700 CSS pixel cutoff, agreement, tied trolls with a refund excluded, and a check that every integer in a card already sits on its fact. The room test accepts two circle answers and checks that the control snapshot carries an illustrative card, the stage snapshot has no highlights before the podium, and the guest recap does not name the other player or a fastest answer before scores. An earlier fixture run compared a group's rate only with people who had already chosen that option, so no likelihood fact was emitted. The rate is now the group's answers over everyone in that group. An earlier room run opened both sockets before listening, so the first snapshot was missed. The listener is attached before the next socket opens.
- `npm run build` passed. Checked 189 build files for secrets. The client bundle does not contain `demo-answer-key-v1` or the illustrative circle prompt. The Worker bundle is about 1,578.29 kB. The client script is `index-C9lUdM2i.js` and the stylesheet is `index-CeaRn1MQ.css`. The build reported PGlite's direct `eval` warnings.
- `npm run smoke` with the default 4 workers passed 9 tests in 31.9s, including media and the illustrative quiz through the podium. No test was rerun.

A remote R2 bucket was not created. No Durable Object was deployed. Neon migration was not run. Resend delivery was not run. A physical phone was not joined.

### Manual verification

Playwright drove Chromium at `http://localhost:4173`. The guest shell, the dense lobby, media, and the illustrative quiz through the podium still passed. Amina's viewport in that quiz was 390 by 844.

In the browser, at 390 CSS pixels wide, `/r/ABCDEFGH` showed "Results for ABCDEFGH are not available." and "The results archive is not built yet." The statistics panel said the page does not fill the gap with sample numbers. The text did not include "31 of the 48", and `scrollWidth` stayed equal to `clientWidth`. `/r/not-an-id` showed "This address is not a game id." and "Results lookup is not built yet."

A new lobby, join code `NV5UY4`, was opened on the stage. Before any guest joined, the stage did not show "From this room", `humza@localhost.test`, or the "Not in this build" buttons. The same browser already held an HttpOnly guest cookie, so that tab reconnected as Amina in an older room. That phone showed "Your recap", including a desktop device line and a reconnect count. It did not name Bilal, it did not say "Your fastest", and it did not overflow at 390 CSS pixels wide.

A separate Chromium session, lobby `TZ6A4J`, joined Amina and Bilal at 390 by 844, started the illustrative demo, and accepted Circle from Amina and Square from Bilal. The admin screen showed Highlights, the word Illustrative, and Circle. It did not show "31 of the 48". During collection the stage did not show "From this room". Amina's recap did not name Bilal and did not say "Your fastest". Bilal's page did not name Amina. Amina's page did not overflow. The podium card wording was not read in that session. The smoke quiz did reach the Podium heading, so the podium snapshot parsed. A physical handset was not used.

### Unresolved issues

- The results page does not yet load a finished game. Comparison cards are computed in the room. Prompt 16 still owns the archive, the gallery, and email.
- A guest's fastest line is withheld until that question has a score-ledger row.
- After the retention job from stage 13, an answer can still store a context id whose row has been deleted. That answer is counted as an unknown device, not a guessed family.
- Entertainment audio can still be dropped after a refresh or a crash. Score and token rows remain exactly-once.
- `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, and `R2_SECRET_ACCESS_KEY` are still unset. The `IMAGES` binding is still absent. Lifecycle and CORS were still not applied.
- No Durable Object was deployed, and no Cloudflare, Neon, or Resend resources were created.
- A physical phone on the LAN was not used.
- Parallel local sign-in links can still collide when several Playwright browsers confirm the same administrator at once. This smoke run did not hit that collision.

### Next stage

Prompt 15: Retryable Neon game archive. Do not start it from this stage.

## Stage 15

Status: complete.

A finished game records its final revision and a pending export in the room, and the podium is drawn from that room. The export runs afterwards. A database failure retries with a stable key and does not take the podium down. Personal rows stay out of the public projection.

### Files and interfaces

- Room schema version is 13. Versions 1 to 12 upgrade to 13. Fresh rooms open at version 13. `room_archive` stores the final revision, the target revision, the verified revision, the status, the attempt count, and whether the next export is a final or a correction. No stored version-12 database was migrated in this run.
- Archive schema version is 1, in `apps/api/src/archive/schema.ts`. Tables: `archive_publication`, `archive_standing`, `archive_highlight`, `archive_media_ref`, `archive_player_detail`, `archive_stat_fact`, and `archive_device_detail`. The publication primary key is `(game_id, revision)`. Standings, highlights, media, player detail, and facts are keyed by that publication. Device rows also have an index on `retain_until`.
- `postgresArchive` inserts a publication with `ON CONFLICT DO NOTHING`. An empty return means the revision is already stored, so children are not inserted again. A failure inside the transaction rolls the publication back.
- The room scheduler still owns the alarm. Entering the podium queues `archive-export`. The alarm commits gameplay first, then `settleArchive` writes the archive. `archive-retain` deletes device-detail rows whose `retain_until` has passed. Both jobs stay pending until that settler finishes them. Pause does not cancel them.
- `@26/shared` exports `resultsStatusSchema` (`unknown`, `preparing`, `ready`). A control snapshot may include `archive` with status, revision, and attempts. Stage and guest snapshots omit it.
- `GET /api/rooms/:gameId/results` reads the room status only. An unknown id is checked on the code registry before a room object is created. The body is the status object. It does not include standings, recaps, device rows, or object keys.
- `npm run archive:migrate` and `npm run archive:retain` take `--env local`, `staging`, or `production`. They read that environment's vars file and do not read `process.env.DATABASE_URL`. Auth requests do not apply the archive schema.

### Decisions and defaults

- The idempotency key is `game_id` plus the room revision being exported. A write that commits and then loses its acknowledgement is a second call that finds the row and returns `present`.
- The first export is kind `final`. After that revision is verified, hiding accepted media or adjusting a score inserts a new `correction` revision. The earlier rows are not updated.
- Device-detail rows use the room's telemetry retention clock. Purging them leaves standings, highlights, facts, and media references. Aggregates are the retained statistics. Raw device reports are not.
- Local development without `DATABASE_URL` keeps a SQLite mirror inside the room (`dev_archive_*`). Staging and production without `DATABASE_URL` fail the export and retry. They do not use that mirror.
- The export allows 8 attempts. The delay starts at 5 seconds and doubles, capped at 15 minutes. The stored error is the word `unavailable`. The driver message is not stored.
- The podium, answers, and scores do not call Neon. The public results page says "Preparing results." while the export is pending or failed, and it does not invent standings. When the export is recorded, the page says the archive is stored and the results view is not open yet.
- Verified completion is `room_archive.verified_revision`. The room is not deleted in this stage. The durable copy stays until that verification is recorded.
- The admin screen shows pending, failed, or completed. **Retry archive export** appears only after the bounded retries have failed.

### How to run it

1. `npm run archive:migrate -- --env local` then `npm run dev`.
2. Open `http://localhost:5173/admin`, create a lobby, start the illustrative demo, and finish after the question.
3. Advance to the podium. The admin screen shows the archive export. The stage shows the podium and does not show the export status.
4. `/r/` plus the game id says the archive is stored once the export has completed, or "Preparing results." while it is still pending. `/r/ABCDEFGH` still says the results archive is not built yet.
5. `npm run archive:retain -- --env local` deletes archived device-detail rows whose retain-until has passed.

### Commands and results

- `npm run typecheck` passed.
- `npm run lint` passed and printed no warnings.
- `npm run format:check` passed.
- `npm test` passed: 28 files, 143 tests. The database contract covers a repeated key, a commit whose acknowledgement is then lost, a rollback before commit, a public read that omits a planted recap token and a planted device token, a correction that leaves the first revision's points and hidden flag unchanged, a purge that removes expired device rows and keeps standings and facts, and an unavailable writer that throws. The room tests cover a throwing export that leaves the stage on the podium, eight failures then an admin retry, a lost acknowledgement that does not append a second publication, a second alarm that does not add a mirror row, a hidden-media correction, a score correction, and the public status sequence unknown, preparing, ready.
- `npm run build` passed. Checked 205 build files for secrets. The Worker bundle is about 1,603.41 kB. The client script is `index-CFIAFjuI.js` and the stylesheet is `index-DAyJYYYt.css`. The build reported PGlite's direct `eval` warnings.
- `npm run smoke` with the default 4 workers passed 9 tests in 31.5s before the final results-status wording. After that wording, the same command passed 8 tests and the media test failed because a parallel sign-in link was reported as invalid or expired. `npx playwright test apps/web/e2e/media.spec.ts --workers=1` then passed that test in 10.3s. The quiz reached the podium in both smoke runs. The results shell still distinguishes a shaped id from other text.
- `npm run archive:migrate -- --env local` finished against local PGlite at `apps/api/.data/local-auth`. `npm run archive:retain -- --env local` removed 0 archived device detail rows. `apps/api/.dev.vars` is not present, so no remote database host was contacted.

A remote Neon database was not configured and was not created. No Durable Object was deployed. Resend delivery was not run. A physical phone was not joined.

### Manual verification

Playwright drove Chromium at `http://localhost:4173`. The guest shell, the dense lobby, media, and the illustrative quiz through the podium still passed. Amina's viewport in that quiz was 390 by 844.

In the browser, at 390 CSS pixels wide, `/r/ABCDEFGH` showed "Results for ABCDEFGH are not available." and "The results archive is not built yet." The fetch returned `{ "state": "unknown" }`. The page did not say "Preparing results." and did not include "31 of the 48". `scrollWidth` stayed equal to `clientWidth`. `/r/not-an-id` showed "This address is not a game id." and "Results lookup is not built yet."

A new lobby, join code `HS9CMR`, game id `FJMZTF2TWQBB`, was started and finished after the first question. The admin screen then showed "The archive export is complete." It did not show a retry button, a database host, or "31 of the 48". The stage for that code showed the Podium heading and did not show the archive export. At 390 CSS pixels wide, `/r/FJMZTF2TWQBB` first rendered the unknown-id sentences, then the status became "The archive for this game is stored." The archive panel said the results view is not open yet. The page did not overflow and did not include "31 of the 48". An earlier lobby in the same session, `UVM7RT` / `G2632X92RFUG`, showed the same complete export and the same stored sentence before the status line was aligned with that panel. A physical handset was not used.

### Unresolved issues

- Remote Neon verification is pending. There is no `apps/api/.dev.vars`, so migrate and retain ran on local PGlite only. Staging and production were not contacted.
- The results page does not yet show standings, the gallery, or a personal recap from the archive. Prompt 16 still owns that view and optional email.
- The retry button was exercised by the room test after eight failures. The browser session completed the local export, so that button was not clicked by hand.
- After the retention job from stage 13, an answer can still store a context id whose row has been deleted. Archived device detail uses the same retention clock. Aggregates remain.
- Entertainment audio can still be dropped after a refresh or a crash. Score and token rows remain exactly-once.
- `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, and `R2_SECRET_ACCESS_KEY` are still unset. The `IMAGES` binding is still absent. Lifecycle and CORS were still not applied.
- No Durable Object was deployed, and no Cloudflare, Neon, or Resend resources were created.
- A physical phone on the LAN was not used.
- Parallel local sign-in links can still collide when several Playwright browsers confirm the same administrator at once. The second smoke run hit that collision. The one-worker media rerun passed.

### Next stage

Prompt 16: Results, gallery, personal recaps and optional email. Do not start it from this stage.

## Stage 16

Status: complete.

`/r/:gameId` now shows the published archive: final standings, eligible comparison cards, and a shared gallery. A recovered guest session, or a personal link, adds that player's own position, scored answers, troll counts, and recap. Optional email is collected only after play, and only for that session.

### Files and interfaces

- Archive schema is version 2. A database already on version 1 receives `archive_email_grant` and `archive_delivery_job`, then is marked version 2. Frozen publications are not rewritten. Fresh databases still create the version 1 tables first and then take the same upgrade.
- `@26/shared` exports `publicResultsSchema`, `personalResultsSchema`, `resultsEmailSchema`, `galleryAttribution`, `publicResultRetention`, `emailVerifyTtlMs` (1 hour), `recapLinkTtlMs` (14 days), and `galleryCacheSeconds` (60).
- `GET /api/rooms/:gameId/results` returns the public projection once the room export is ready. Preparing and unknown stay status-only. An unknown id is still checked on the code registry before a room object is created.
- `GET /api/rooms/:gameId/results/mine` reads the guest cookie, or a `token` query for a personal link. A `playerId` on the query or body is ignored. `POST /api/rooms/:gameId/results/email` sends a verification message for the signed-in guest. `POST /api/rooms/:gameId/results/verify` confirms that token and sends the personal result.
- `GET /api/rooms/:gameId/gallery/:mediaId` serves a photo only when the published gallery lists it and the room still marks it as shared. A visible response uses `public, max-age=60, must-revalidate`. A hidden or missing photo is 404 with `no-store`. The authenticated media route stays `private, no-store`.
- `GET /api/rooms/:gameId/results/outbox` is local only and requires the control credential. It is the preview of messages that were not sent to Resend.
- Delivery lives in `apps/api/src/results/delivery.ts`. Jobs use a stable id. Resend receives that id as an idempotency key when `DATABASE_URL` is set. A lost response is stored as `uncertain` and the next request sends the same body with the same key. That is not a claim that network delivery is exactly once.

### Decisions and defaults

- Named standings, shared photos, and comparison cards stay with the archive. Detailed device rows still expire 30 days after the room was created. Those periods are the selected defaults. A later host decision can shorten them.
- Explicit photo tags are not implemented. The gallery says the photos were shared with the room, and the name is the person who sent the photo.
- The personal link is a random token stored as a hash. It is not the guest session secret. A claimed player id does not open another person's recap.
- Local play, and tests, write the room outbox or an injected sender. They do not call Resend. Staging and production without a configured sender record the job as failed.
- A replacement message after an expired verification link uses a new key. An earlier uncertain send can still arrive. The provider keeps an idempotency key for a limited time.
- Empty highlight and gallery lists are shown as empty. The page does not invent sample numbers. The first paint of a shaped id still says the archive is not built yet, until the fetch returns a ready game.

### How to run it

1. `npm run archive:migrate -- --env local` then `npm run dev`.
2. Finish a game through to the podium. Open `/r/` plus the game id.
3. The phone that played can enter an email. Locally, the message is in the room outbox. The control screen's local outbox route lists it. Confirming the link sends the personal result. The personal link opens that result without a guest account.
4. `/r/ABCDEFGH` still says the results archive is not built yet. `/r/nope` still says the address is not a game id.

### Commands and results

- `npm run typecheck` passed.
- `npm run lint` passed and printed no warnings.
- `npm run format:check` passed.
- `npm test` passed: 30 files, 153 tests. The database contract covers a public projection that omits a player id and a hidden photo, an uncertain send retried with the same key, a second request that does not add a job, an expired verification link, a guessed token, and one Postgres job row for a repeated id. The room tests cover public standings without credential or device text, a guessed player id without a cookie, the signed-in recap, gallery cache then a hide that returns `no-store`, an uncertain email retry, an expired personal link, and one local outbox row for a repeated address.
- `npm run build` passed. Checked 219 build files for secrets. The Worker bundle is about 1,636.63 kB. The client script is `index-CBDPqr8H.js` and the stylesheet is `index-DAyJYYYt.css`. The build reported PGlite's direct `eval` warnings.
- `npm run smoke` with the default 4 workers passed 8 tests and the quiz failed because a parallel sign-in link was reported as invalid or expired. `npx playwright test apps/web/e2e/quiz.spec.ts --workers=1` then passed that test in 28.5s. The results shell still distinguishes a shaped id from other text. The media smoke passed in the first run.
- `npm run archive:migrate -- --env local` finished against local PGlite at `apps/api/.data/local-auth`. The schema version is 2, and `archive_delivery_job` and `archive_email_grant` are present. `apps/api/.dev.vars` is not present, so no remote database host was contacted and Resend was not called.

A remote Neon database was not configured and was not created. No Durable Object was deployed. Remote Resend delivery was not run. A physical phone was not joined.

### Manual verification

Playwright drove Chromium at `http://localhost:4173`. The guest shell, the dense lobby, media, and the illustrative quiz through the podium still passed. The quiz needed a one-worker rerun after the parallel sign-in collision.

In the browser, at 390 CSS pixels wide, `/r/ABCDEFGH` showed "Results for ABCDEFGH are not available." and "The results archive is not built yet." It did not overflow. `/r/nope` showed "This address is not a game id." and "Results lookup is not built yet."

A new lobby, join code `RZ4M2F`, game id `23PT8AJXDMB3`, joined Amina. The illustrative demo was started, Circle was sent, and the quiz was finished. The admin screen showed "The archive export is complete." and "Amina: Circle". The stage showed the Podium heading and "From this room". It did not show email, the archive export, or "31 of the 48".

`/r/23PT8AJXDMB3` first rendered the unknown-id sentences, then standings "1. Amina, 120 points", comparison cards, the shared-gallery sentence, "No shared photos were kept.", and Amina's own result with 0 trolls given and 0 received. The page did not overflow. The recovered session showed "Email my result". Submitting `amina@example.test` twice left one local outbox message. Confirming that link added "Your party result". Neither message contained the guest cookie. Opening the personal link showed the same result and hid the email form. A request that omitted the session cookie and passed a player id returned 401. A physical handset was not used.

### Unresolved issues

- Remote Neon and Resend verification are pending. There is no `apps/api/.dev.vars`, so migrate ran on local PGlite only. Staging and production were not contacted, and no email left the machine.
- An uncertain provider response can still deliver after a retry. A replacement message after an expired link uses a new key. Network delivery is not exactly once.
- A gallery copy that was already downloaded cannot be recalled. Hiding a photo stops later requests.
- Explicit photo tags are not implemented. The gallery is described as shared.
- After the retention job from stage 13, an answer can still store a context id whose row has been deleted. Archived device detail uses the same retention clock. Aggregates remain.
- Entertainment audio can still be dropped after a refresh or a crash. Score and token rows remain exactly-once.
- `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, and `R2_SECRET_ACCESS_KEY` are still unset. The `IMAGES` binding is still absent. Lifecycle and CORS were still not applied.
- No Durable Object was deployed, and no Cloudflare, Neon, or Resend resources were created.
- A physical phone on the LAN was not used.
- Parallel local sign-in links can still collide when several Playwright browsers confirm the same administrator at once. This smoke run hit that collision on the quiz. The one-worker rerun passed.

### Next stage

Prompt 17: Finished party presentation and content-authoring workflow. Do not start it from this stage.

## Stage 17

Status: complete.

The guest, stage, scoreboard, duel, podium, and results surfaces use one type scale and the existing tokens. Questions stay versioned TypeScript. The illustrative pack is labelled as a fixture. There is no CMS.

### Files and interfaces

- Stage type classes in `apps/web/src/index.css`: `.stage-prompt`, `.stage-option`, `.stage-score`, `.stage-answer`, and `.phone-prompt`. A short landscape phone shrinks the question. Reduced motion removes the press transition as well as the existing rise and dodge motion.
- The stage shell title stays above 48px and smaller than the question. Scoreboard, final, and podium phases lead with the standings. A connected lobby shows the join code at stage size and larger nicknames. The sample `0:30` countdown appears only before a room is connected. After that, a lobby with no deadline says "No round is running."
- A second tap while a send is in flight is ignored. Leaving during a live question asks the browser to confirm. Lobby and podium do not. A missing photo or cue leaves a sentence and the round continues.
- A held reveal or scoreboard still explains the result on the phone. Other held phases say the phone is waiting for the host.
- `apps/api/src/questions/preflight.ts` checks ids, durations, answers, scoring, phase compatibility, attribution and troll compatibility, the implemented round kinds, and required assets. `npm run content:check` runs it. `npm run build` runs it after the secret scan. `npm run content:export` writes [docs/content/illustrative-answer-key.md](content/illustrative-answer-key.md) and [docs/content/illustrative-running-order.md](content/illustrative-running-order.md), then formats them. Both files say they are illustrative fixtures.
- [docs/content-guide.md](content-guide.md) is the authoring guide. `apps/web/public/assets/demo-sting.wav` is a short placeholder tone, not a party sting.
- `apps/api/test/content-preflight.spec.ts` covers the real pack, a missing choice answer, an unlabelled prompt, and a missing sting.

### Decisions and defaults

- The demo pack stays the live question set until Humza supplies the party script. Prompts keep the "Illustrative demo:" prefix. Amina and Bilal are fixture names so the demo can score. They are not claims about guests.
- The fake countdown is not shown once a room is connected. The shell test now expects "No round is running." on a connected lobby, and still expects "Preview only. No round is running." before a room is connected.
- Build-time preflight fails on a missing sting or an unsupported selected effect. A missing file at runtime does not stop the round.
- No CMS, no new score engine, and no second room store.

### How to run it

1. `npm run content:check` and `npm run content:export`.
2. `npm run dev`, then open `/`, `/host`, and `/admin`.
3. Replace the questions in `apps/api/src/questions/demo-set.ts` when the real script exists, bump `demoQuestionSetVersion`, and run the two content commands again. The checklist of missing party assets is in [docs/content-guide.md](content-guide.md).

### Commands and results

- `npm run typecheck` passed.
- `npm run lint` passed and printed no warnings.
- `npm run format:check` passed.
- `npm test` passed: 31 files, 157 tests.
- `npm run content:check` passed for the illustrative demo pack. `npm run content:export` wrote both fallback documents.
- `npm run build` passed. Checked 223 build files for secrets. The Worker bundle is about 1,636.63 kB. The client script is `index-BMsU_KPZ.js` and the stylesheet is `index-BGtPbWpf.css`. Content preflight passed as part of the build. The build reported PGlite's direct `eval` warnings.
- The first `npm run smoke` passed 8 tests and failed `shells.spec.ts` because a connected lobby no longer shows "Preview only. No round is running." That assertion now expects "No round is running." `npx playwright test apps/web/e2e/shells.spec.ts apps/web/e2e/quiz.spec.ts --workers=1` then passed 7 tests in 32.7s, including the quiz through the podium. That quiz run was before the held-reveal status sentence. The sentence does not change an open answer, and it was not given its own browser rerun.

### Manual verification

In the IDE browser against `http://localhost:4173`, on the stylesheet `index-BGtPbWpf.css`:

- 390×844: the join screen and a resumed phone did not overflow. The question used a 28px prompt. Answer buttons were 48px tall. A finished phone showed "The quiz has ended. You finished 1st with 120 points." and the revealed choice "Circle — the answer".
- 844×390 landscape: the prompt dropped to 24px and the card did not overflow.
- 1280 wide: a connected lobby showed "The lobby is on screen.", "No round is running.", and the name Amina. The stage heading computed at 128px on that earlier title size, with no horizontal overflow and no Pause or Advance control.
- 1920×1080 after the title was reduced: the stage heading computed at 60px. The join code `HRWRU5` computed at 68px. The nickname computed at 44px. The live prompt "Illustrative demo: which of these is a circle?" and question 2 computed at 99.84px, larger than the shell title. The stage did not show Pause or Advance, and it did not overflow. The sample `0:30` was gone once the room was connected.
- The phone reached "Choose an answer." on question 3, with 16, 21, 26, and 30 enabled and Send answer disabled until a selection. The following click arrived after that window had closed. With the admin socket disconnected, the room then held and the phone said "Waiting for the host." The quiz browser test, which keeps the host connected, still completed an answer through the podium.
- `prefers-reduced-motion: reduce` was emulated. The button transition and the main-page animation were both `none`.
- A physical rotation, a physical phone, and a projector or HDMI output were not used. `/r/23PT8AJXDMB3` on this preview process showed the archive-not-built sentences, so the larger results type was not seen on a filled podium in this pass.

### Unresolved issues

- Humza has not supplied the party questions, durations, which rounds allow double, shortlist versus the full room, the party sting, face or caption art, or question media. The checklist is in [docs/content-guide.md](content-guide.md). The current questions and `demo-sting.wav` are illustrative.
- A physical phone, a real rotation, and a projector or HDMI output were not checked.
- Remote Neon and Resend remain unset. `apps/api/.dev.vars` is not present. Nothing was deployed.
- A click on an open answer in the IDE browser missed the collect window. The Playwright quiz still answered through the podium with the host connected.
- The held-reveal status sentence was not screenshotted after the final script hash.
- Downloaded gallery copies still cannot be recalled. Entertainment audio can still drop after a refresh. Parallel local sign-in links can still collide when several Playwright browsers confirm the same administrator at once. This stage's quiz rerun used one worker and passed.

### Next stage

Prompt 18: Failure testing, security checks, and 75-player load testing. Do not start it from this stage.

## Stage 18

Status: complete.

Failure, access, and load checks run in the existing room harness. The printed 75-guest figures are from the local Durable Object emulator. The evidence is in [docs/verification-report.md](verification-report.md).

### Files and interfaces

- `apps/api/test/hardening.spec.ts` covers a lost answer, a changed payload, one score adjustment, one finish flag, one guess ballot, a paused or idle alarm, one advance racing one alarm, a foreign origin, a guest used as host, a reused transfer, and a broken device report.
- `apps/api/test/load.spec.ts` joins a synthetic room. `LOAD_GUESTS` defaults to 75 and `LOAD_UPLOADS` defaults to 8. It bursts choice answers and guess ballots, sends one live-typing draft on the candles question, reconnects eight phones, finalises concurrent photos, and walks the demo to the podium.
- `apps/api/test/media.spec.ts` covers two finalisations of one upload, and deletion of a temporary object after the upload window expires.
- Accepted answers, estimates, rankings, text, ballots, and duels update the stage and the host. The sending phone receives its own snapshot and acknowledgement. Troll effects, reactions, and phase changes still reach every connected phone.
- An expired upload's temporary object is deleted when finalisation runs. `MediaFailure` may carry `tempKey` for that cleanup. The HTTP result stays the error and message.
- `scripts/check-artifacts.mjs` rejects `truthNickname` in a client JavaScript bundle, along with the existing answer-key marker.
- `.github/workflows/check.yml` runs typecheck, lint, format, the API tests, the build, and Playwright with one worker. It was not executed on GitHub.

### Decisions and defaults

- Seventy-five full browsers were not run. The load scenario uses lightweight WebSocket clients on the room stub, plus one stage socket for the live count. Playwright remains the UI check: one host, one stage, and three phones.
- The load test records acknowledgement percentiles, errors, reconnects, timer lateness, SQL counts, and stage snapshot time. It does not fail on a latency ceiling. A missed answer, a missed ballot, or a missing alarm observation still fails it.
- Workerd can run an overdue alarm by itself, so the paused-alarm check asserts the phase and the paused flag. A false return from `runDurableObjectAlarm` after that auto-run is an emulator signal, not a second advance.
- Local archive and email tests keep their injected adapters. No Neon project was created and no Resend message was sent.

### Commands and results

- `npm run typecheck` passed.
- `npm run lint` passed and printed no warnings.
- `npm run format:check` passed.
- `npm test` passed: 33 files, 166 tests, in 203.32 s. Before the broadcast fix, the 75-guest answer burst rejected 28 answers as too late. After it, the printed load run accepted 75 answers and 75 ballots.
- Printed load sample, from `npx vitest run test/load.spec.ts --disableConsoleIntercept` in `apps/api`, one run, Node v22.12.0: answer acknowledgements p50 506 ms, p95 981 ms, p99 1,025 ms; ballot acknowledgements p50 959 ms, p95 1,863 ms, p99 1,945 ms; 0 errors; 8 reconnects; stage snapshot 6 ms; shape timer lateness 482 ms; 75 players, 75 choice answers, 75 ballots, 280 receipts, 8 accepted media, 58 jobs. The full suite passed the same scenario afterwards and did not reprint the line.
- `npm run build` passed. Checked 227 build files for secrets. The Worker bundle is about 1,637.17 kB. The client script is `index-BMsU_KPZ.js` and the stylesheet is `index-BGtPbWpf.css`. Content preflight passed. The build reported PGlite's direct `eval` warnings.
- `npx playwright test --workers=1` passed 9 tests in 44.9 s, including the illustrative quiz for the host, the stage, and three phones.

### Manual verification

Playwright drove Chromium at `http://localhost:4173` through the shells, the dense lobby, a photo upload and hide, and the three-phone quiz. No separate IDE-browser pass was added for the server broadcast change. A physical phone, a projector, and HDMI were not used.

### Unresolved issues

- The load figures are local emulator results. Workerd logged overdue alarms during the load run and the full suite, including about 2.9 s and about 5.4 s. Staging still needs its own 75-guest measurement.
- Remote Neon and Resend remain unset. `apps/api/.dev.vars` is not present. GitHub Actions was not run. Nothing was deployed, and no email left the machine.
- A physical phone, venue Wi-Fi, and a projector or HDMI output were not checked.
- The party script is still the illustrative pack.
- Parallel local sign-in links can still collide when several Playwright browsers confirm the same administrator at once. This run used one worker and passed.

### Next stage

Prompt 19: Staging deployment, operational tools, and the event runbook. Completed in stage 19 below.

## Stage 19

Status: complete for the local deployable artifacts. Staging was not deployed. There is no staging URL.

The birthday project has no Cloudflare account id, no `.dev.vars.staging`, no `.dev.vars.production`, and no configured test recipient. Nothing was deployed, no remote bucket or database was created, no DNS record was changed, and no email was sent.

### Files and interfaces

- [docs/deployment.md](deployment.md) has the per-environment build, migrate, secret, R2, and rollback commands, and the missing external setup.
- [docs/event-runbook.md](event-runbook.md) is the presenter and operator runbook, the same-room recovery drill, and the checklist of questions, media, and venue checks that did not happen here.
- Staging and production in `apps/api/wrangler.jsonc` keep `APP_ENV` and `MEDIA_BUCKET_NAME` as vars. Secret names are `secrets.required`. Each of those environments declares `images.binding` `IMAGES`. The local config does not. Migration tag `v1` stays inherited and additive.
- `GET /api/rooms/:gameId/diagnostics` and `GET /api/rooms/:gameId/summary` require the control cookie. Diagnostics redact database URLs and email addresses and omit job payloads, device rows, and the test recipient address. A same-origin GET may omit `Origin`. A foreign `Origin` is still rejected.
- Host actions `release-stuck-media` and `retry-delivery`. An expired upload lease returns to open. A live lease stays leased. Delivery retry reuses the stored idempotency key and does not send again for the same host request.
- `restrictResultsEmail` wraps results delivery. Staging without `EMAIL_TEST_RECIPIENT` throws. Any other address throws. Admin sign-in is not limited by it.
- The admin lobby shows room health, the two recovery actions, and a score-summary download. The stage page does not.
- `apps/api/test/operations.spec.ts` covers redaction, one lease release, one email retry, the score summary, and the same-cookie recovery drill.

### Decisions and defaults

- Empty secret vars were removed from staging and production so a later `wrangler secret put` is not wiped by the next deploy. Local vars still include empty placeholders, including `EMAIL_TEST_RECIPIENT`.
- The Vite output directory remains `apps/web/dist/26_humza_website_local` when `CLOUDFLARE_ENV=staging`. The generated file's `name` was `26-humza-website-staging` and `targetEnvironment` was `staging`. Deploy that file only after checking the name. Do not deploy a file whose name is still `26-humza-website-local`.
- The current Images binding types accept `transform({ width: 1280, fit: "scale-down" })` and `output({ format: "image/jpeg", quality: 80 })`. They do not accept `metadata: "none"` on that transform. That option remains on the URL transform API. Images has not been called.
- Room SQLite stays on schema version 13. Archive schema stays on version 2. The question pack stays `demo-2026-09-22`. No wipe command was added.
- A same-origin diagnostics GET from the browser omitted `Origin` and received 403 until the read check allowed a missing `Origin`. The control cookie stays host-only and `SameSite=Strict`.

### Commands and results

- `npm run cf-typegen` passed. `EMAIL_TEST_RECIPIENT` and an optional `IMAGES` binding are on the generated Env. Staging and production Env types require `IMAGES`.
- `npm run typecheck` passed.
- `npm run lint` passed with no warnings.
- `npm run format:check` passed.
- `npm test` passed after the same-origin GET allowance: 34 files, 171 tests, in 212.24 s. Workerd again logged overdue alarms during the suite. Those alarms did not fail a test.
- `$env:CLOUDFLARE_ENV="staging"; npm run build` passed after that same change and did not deploy. Wrangler warned that the secret names are absent from `env.staging.vars`, and that those secrets are missing locally. Both warnings are expected. The generated file's `name` was `26-humza-website-staging`, `targetEnvironment` was `staging`, `APP_ENV` was `staging`, the bucket was `26-humza-media-staging`, the Images binding was `IMAGES`, migration tag `v1` was present, and 10 secrets were required. Checked 233 build files for secrets. Content preflight passed. The Worker bundle was about 1,651.29 kB. PGlite's direct `eval` warnings appeared.
- A following local `npm run build`, with `CLOUDFLARE_ENV` unset, passed. The generated name was `26-humza-website-local` and `APP_ENV` was `local`. The Worker bundle is about 1,651.29 kB. The client script is `index-CM-qHc5z.js` (510.74 kB) and the stylesheet is `index-BGtPbWpf.css` (16.78 kB). Checked 233 build files.
- `npx playwright test --workers=1` passed 9 tests in 38.2 s on that local build.
- `npm run auth:migrate`, `archive:migrate`, and `wrangler deploy` were not run for staging or production. R2 lifecycle and CORS were not applied. No Neon project was contacted.

### Manual verification

In the IDE browser at `http://localhost:4173`, an existing local administrator session was used. A new lobby was created. Refresh room health showed phase lobby, 0 players, 1 control connection, 1 pending scheduler job, 0 failed jobs, and zero media and email counts. Release stuck media and Retry email jobs showed their notices. The stage page did not show room health. This was the local preview, not a deployed environment.

Playwright also drove the existing shells, a photo upload, and the three-phone quiz on the local preview.

Not done: a physical phone, venue Wi-Fi, a projector or HDMI output, a deployed staging game, a real photo or voice upload to R2, a remote archive export, and any email, including a test-recipient message.

### Unresolved issues

- No birthday Cloudflare account, R2 bucket, Images attachment, Neon database, or Resend key is configured. The exact list is in [docs/deployment.md](deployment.md).
- `apps/api/r2-cors.json` still allows only the local preview origins. The deployed origin is not known, so it was not added.
- The question pack is still the illustrative demo. [docs/event-runbook.md](event-runbook.md) lists what Humza still has to supply and which venue checks remain.
- The 75-guest figures remain the local emulator sample from stage 18. Staging was not measured.
- `eslint-visitor-keys@5.0.1` still wants Node `^22.13.0`. This machine is v22.12.0. Lint passed.
- GitHub Actions was not run.

### Next stage

The numbered prompt sequence is complete. Do not start another prompt from this stage. Event preparation is the external list in [docs/deployment.md](deployment.md) and [docs/event-runbook.md](event-runbook.md).

## Neon auth database

Status: complete for schema and seed. Worker secrets were not uploaded. Nothing was deployed.

### Files and interfaces

No application code changed. The gitignored vars files hold `ADMIN_EMAIL`, a pooled `DATABASE_URL`, and a `BETTER_AUTH_SECRET` for local, staging, and production. Existing Resend and R2 values were left in place.

### Decisions and defaults

- The existing Better Auth server stays. Managed Neon Auth stays off.
- Neon project `26` (`frosty-lake-18240662`, `aws-eu-west-2`). Local uses the `development` branch, staging uses `staging`, and production uses `production`.
- Each branch endpoint has the transaction pooler enabled. The vars files store the pooled URL.
- The only administrator is `humzab1711@hotmail.com`, named Humza, with email already verified. One user per branch.
- `dev_inbox` is on the development branch only.
- `BETTER_AUTH_URL` and `RESEND_FROM` were left blank.

### Commands and results

- `npm run auth:migrate -- --env local` passed against `ep-wandering-wave-zar9md91-pooler.c-2.eu-west-2.aws.neon.tech` and applied the local inbox table.
- `npm run auth:migrate -- --env staging` passed against `ep-snowy-fog-zay1otcu-pooler.c-2.eu-west-2.aws.neon.tech`. Better Auth logged a schema mismatch before the tables existed. The command exited 0, and the tables were present afterwards.
- `npm run auth:migrate -- --env production` passed against `ep-cold-tooth-zawp7sm3-pooler.c-2.eu-west-2.aws.neon.tech`, with the same schema-check log and a successful exit.
- `npm run auth:seed` passed for local, staging, and production.
- Each branch has one verified user named Humza at `humzab1711@hotmail.com`. Staging and production have no `dev_inbox` table.

### Manual verification

Not run in a browser. Schema and seed were checked with SQL.

### Unresolved issues

- `BETTER_AUTH_URL` is unset, so staging and production auth returns 503 until it matches the public origin.
- `RESEND_FROM` is unset. Local already has a Resend key, so the local inbox is not used until that key is removed or a from-address is set.
- Worker secrets were not uploaded. No deploy.

### Next stage

The numbered prompt sequence stays complete. Remaining setup is the Resend from-address, `BETTER_AUTH_URL`, and Cloudflare Worker secrets in [docs/deployment.md](deployment.md).

## Client API key protection layer

Status: complete.

### Files and interfaces

- `packages/shared/src/client-api-key.ts` exports `clientApiKeyHeader` (`x-26-client-key`) and `clientApiKeyQueryParam` (`clientKey`).
- `apps/api/src/security/client-api-key.ts` provides path matching, header/query reading, and constant-time rejection via `rejectUnlessClientApiKey`.
- Global Hono middleware in `apps/api/src/index.ts` enforces the key on `/api/*` except `/api/health` and `/api/auth/*`, and on all `/ws/*`.
- `apps/api/src/room/party-room.ts` repeats the check on direct Durable Object WebSocket upgrades.
- `apps/web/src/api/client-key.ts` supplies `clientApiHeaders()` and `withClientApiKey()` for fetch, WebSocket, and media URLs.
- `scripts/client-api-key-rotate.ts` and `npm run client-api-key:rotate` write the same value to `CLIENT_API_KEY` and `VITE_CLIENT_API_KEY`.
- Test helpers: `apps/api/test/api-fetch.ts`, `client-api-key.ts`, `client-api-key-values.ts`, `apps/api/test/client-api-key.spec.ts`, and `scripts/e2e-client-api-key.ts`.

### Decisions and defaults

- Local development skips the check when `CLIENT_API_KEY` is blank. Staging and production require the secret.
- The Vite value is embedded in the client bundle at build time. It blocks casual direct API access; it is not a hidden server secret.
- Vite `envDir` points at the repo root so `env:sync` files are read during dev and build.

### Commands and results

- `npm run cf-typegen` passed. `CLIENT_API_KEY` is on the generated Env.
- `npm run typecheck` passed.
- `npm run build` passed. Checked 243 build files for secrets.
- `npm run test -w @26/api -- test/client-api-key.spec.ts test/routing.spec.ts test/room.spec.ts test/hardening.spec.ts` passed: 4 files, 32 tests.
- `room.spec.ts` guest WebSocket tests now use a relative join timestamp so guest credentials stay inside the 12-hour TTL when `identify()` uses real time.
- `npm run build` injects `VITE_CLIENT_API_KEY` from `.env.local` (or `.env.staging` / `.env.production` when `CLOUDFLARE_ENV` is set), because Vite's default production mode would otherwise prefer an empty `.env.production` value over `.env.local`.
- `npm run smoke` passed 5/9 tests with a rotated local `CLIENT_API_KEY`. Admin sign-in passed. Lobby creation in preview still fails when the key is set, because the Worker cannot reach Vite's Node auth middleware over an in-isolate fetch. Use `npm run dev` for manual checks after rotation, or leave `CLIENT_API_KEY` blank for preview smoke.
- Full `npm test` was not re-run to completion in this session. Earlier runs still showed unrelated `auth.spec.ts` database-schema and `results-room.spec.ts` Durable Object I/O failures when a Neon `DATABASE_URL` is present in `.dev.vars`.

### Manual verification

Not run in the IDE browser for this layer. After `npm run client-api-key:rotate -- --env local`, restart dev or rebuild so the SPA picks up `VITE_CLIENT_API_KEY`.

### Unresolved issues

- Remote `CLIENT_API_KEY` secrets are not uploaded automatically on rotate. Use `npx wrangler secret put CLIENT_API_KEY --env staging` (or production) after rotation, then rebuild with the matching `.env.{env}` file.

### Next stage

The numbered prompt sequence stays complete. No further build prompt is queued for this layer.

## Party theme palettes

Status: complete.

The current look is registered as **26 basic**. Every screen colour is written in one typed palette. Tailwind utilities, the browser chrome, and the join code read that palette.

### Files and interfaces

- `apps/web/src/theme/themes.ts` exports `themes`, `DEFAULT_THEME_ID` (`"26-basic"`), `paletteRoles`, and `themeDocumentHead()`.
- `apps/web/src/theme/install.ts` sets `data-theme` and `color-scheme` before React renders. `?theme=` selects a known id. Anything else stays on the default.
- `apps/web/vite.config.ts` injects a blocking style for every palette and the `theme-color` meta from the default background.
- `apps/web/src/index.css` maps Tailwind colour utilities with `@theme inline`. It no longer contains hex values.
- The join code uses `var(--mark)` and `var(--mark-quiet)`. The dialog scrim mixes the theme background at 72% opacity.
- [.agents/rules/40-design.md](../.agents/rules/40-design.md) says screen colours come from the theme file. `npm run agents:sync` copied that rule.

### Decisions and defaults

- Themes are client palettes. The room does not sync a theme between phones and the projector.
- Adding a theme is one object in `themes.ts`. Preview it with `?theme=its-id`. Changing the party default is changing `DEFAULT_THEME_ID`. There is no settings screen and no saved override.
- Fonts stay Fraunces and Outfit. This pass is colour only.
- `public/favicon.svg` stays a static mark painted with the 26 basic accent and background.
- Each theme must set every palette role: background, foreground, muted, accent, accent foreground, highlight, highlight foreground, surface, surface foreground, line, mark, and mark quiet zone. It also sets `colorScheme` to `dark` or `light`.

### Commands and results

- `npm run agents:sync` updated the design rule copies.
- `npm run typecheck` passed.
- `npx eslint` on the theme, install, main, join-code, and Vite config files passed.

### Manual verification

In the IDE browser against `http://localhost:5173`:

- Guest, stage, and admin rendered with `data-theme="26-basic"`. Background `#14110e`, foreground `#fff6e8`, accent `#ff4d3a`, highlight `#ffc43a`, and surface `#2c241c`.
- `theme-color` was `#14110e`. `color-scheme` was `dark`.
- The about dialog scrim computed to the background colour at 72% opacity.
- `?theme=not-a-theme` stayed on `26-basic`.

### Unresolved issues

- The favicon does not follow a theme change until its two fills are updated with the 26 basic accent and background.
- A new palette is not applied on the projector and phones together. That would be a later host control.

### Next stage

The numbered prompt sequence stays complete. The next design change is a new palette object and, when wanted, a new `DEFAULT_THEME_ID`.

## Question authoring

Status: complete for the authoring structure. The full API suite and the Playwright quiz were not re-run.

A question is one TypeScript file. The birthday catalogue can hold drafts. A room still plays the pack named by its stored version, which for a new game is `demo-2026-09-22`.

### Files and interfaces

- `apps/api/src/questions/definition.ts` holds the question types. A private answer is `{ known }` or `{ missing: { code, name, detail } }`.
- `defaults.ts` is the only list of ordinary defaults. `authoring.ts` has one helper for each existing mechanic.
- `registry.ts` resolves `demo-2026-09-22` to the demo pack, `unreleased` to the lobby, and `birthday-draft` or any unknown id to unavailable. It does not substitute another pack.
- `validate.ts` checks packs. Illustrative rules stay on the demo pack. Incomplete drafts are reported and do not fail `content:check` while they are outside the running order.
- `packs/demo/` has one file per current question. The manifest order is the previous order. `packs/birthday/manifest.ts` has an empty catalogue and an empty order.
- `demo-set.ts` re-exports that demo pack. Gameplay, scoring, trolls, diagnostics, and statistics read the room's version.
- Public questions use a boolean `illustrative`, points from 0, question ids up to 40 characters, `presentation`, and optional phone `instructions`. `explanation` is on the play snapshot only after scoring. Presenter notes are added only for the control audience.
- `apps/web/src/play/presentation.ts` exports `resolvePresentation`. `standard` returns nothing, so the existing phone and stage components render the question.
- [docs/question-authoring.md](question-authoring.md) is the workflow. [.agents/rules/15-question-authoring.md](../.agents/rules/15-question-authoring.md) points agents at it. `npm run agents:sync` copied that rule.

### Decisions and defaults

- Adding a birthday file does not change `startDemo`, an existing room, or a deployment.
- Ready means the mechanic and the required facts validate. It does not mean a custom visual. Custom design is a later `presentation` id.
- A released pack is not edited in place. A content change needs a new version id. Rooms keep the version they stored.
- Defaults, when a setting is omitted: 20 seconds, attribution `after`, presentation `standard`, no modifier, no speed bonus. Choice 100, slider 100, rank 80, vote 60 with a 20 second vote, guess 80, duel 50, finale 70 and 30.
- No party questions were invented. The childhood-photo shape exists only as a test fixture.

### How to run it

1. `npm run content:check` and `npm run content:export`.
2. `npm run dev`, then start the illustrative demo as before.
3. For a real question, say: `Next question idea: show everyone a childhood photo and ask them to guess who it is.`

### Commands and results

- `npm run agents:sync` updated `AGENTS.md` and the question-authoring rule copies.
- `npm run content:check` passed for `demo` (`demo-2026-09-22`) and `birthday` (`birthday-draft`).
- `npm run content:export` wrote the illustrative key and running order unchanged, and wrote [docs/content/birthday-answer-key.md](content/birthday-answer-key.md) and [docs/content/birthday-running-order.md](content/birthday-running-order.md). Both birthday files say the catalogue has no playable questions.
- `npx tsc -b packages/shared apps/api apps/web/tsconfig.app.json` passed.
- `npm run lint` passed.
- `npm run format:check` failed on 15 files outside this change, including theme, lobby, and script files that were already unformatted. The question-authoring files were formatted with Prettier.
- `npx vitest run test/content-preflight.spec.ts test/question-authoring.spec.ts` in `apps/api` passed: 2 files, 14 tests.
- `npm test` was not run. The Playwright quiz was not run. Nothing was deployed.

### Manual verification

Not run in the browser. The demo pack's prompts and running order are unchanged, and the public snapshot still goes through the existing phone and stage components for `standard`.

### Unresolved issues

- The full API suite and the three-phone Playwright quiz were not re-run after the public snapshot gained `presentation` and `explanation`.
- `npm run format:check` still fails on files that this change did not own.
- Humza has not supplied party questions. The birthday catalogue is empty. `startDemo` still pins `demo-2026-09-22`.

### Next stage

No further build stage. The next step is Humza's first real question, phrased as `Next question idea: …`.

## Forty party themes

Status: complete.

Forty topical palettes now sit beside **26 basic**. The default is still `26-basic`. Preview any theme with `?theme=its-id`.

### Files and interfaces

- `apps/web/src/theme/themes.ts` holds the catalogue. Each theme sets every palette role and `colorScheme`.
- No switcher was added. The room still does not choose a theme.

### Decisions and defaults

- `DEFAULT_THEME_ID` stays `"26-basic"`.
- Supporting colours (surface, line, muted, button ink, join-code pair) are mixed from each theme's ground, ink, accent, and highlight so text stays readable and the QR stays dark on a light quiet zone.
- Mixtape 26 is dark. Confetti Department is light.
- The favicon stays the 26 basic mark.

### Catalogue

Personal to 26: `version-26`, `humza-after-hours`, `humza-os`, `main-character`, `baseer-live`, `26-karat`, `november-nights`, `birthday-exe`, `the-humza-show`, `quarter-life-deluxe`.

Quiz, competition and chaos: `friendly-sabotage`, `final-answer`, `big-red-button`, `high-score-club`, `plot-twist`, `the-hot-seat`, `bragging-rights`, `steal-the-spotlight`, `confetti-department`, `absolutely-rigged`.

Polished, dark and atmospheric: `cobalt-club`, `velvet-rope`, `midnight-matcha`, `black-cherry`, `petrol-and-peach`, `ultraviolet`, `ember-room`, `moonlit-chrome`, `electric-orchid`, `deep-sea-disco`.

Light, nostalgic and unexpected: `soft-launch-hard-questions`, `pistachio-party`, `peach-please`, `blue-hour`, `retro-future`, `poolside-2000`, `mixtape-26`, `paper-party`, `sorbet-social`, `lavender-menace`.

### Commands and results

- `npm run typecheck` passed.

### Manual verification

In the IDE browser against `http://localhost:5173`:

- No query stayed on `26-basic`: background `#14110e`, accent `#ff4d3a`, highlight `#ffc43a`, quiet zone `#fff6e8`.
- `version-26`: ink `#07090f`, electric blue `#3d74ff` on the mark and the join button, acid lime headings, quiet zone `#f4f7ff`.
- `friendly-sabotage`: ink purple `#1a0e28`, acid yellow `#e6ff3a`, coral headings, quiet zone `#f6f4ef`.
- `cobalt-club`: near-black `#07080c`, cobalt `#6b93ff`, sharp lime headings, quiet zone `#f4f6fb`.
- `soft-launch-hard-questions`: butter `#ffe9a3`, ink blue `#163a8a`, tomato headings, light scheme, quiet zone `#fffaf2`.

### Unresolved issues

- The favicon does not follow a theme change.
- Phones and the projector still choose a theme separately, with `?theme=`.

### Next stage

The numbered prompt sequence stays complete. Changing the party default is a new `DEFAULT_THEME_ID`.

## Personal night themes

Status: complete.

Twelve more palettes sit in the same registry. The default is still `26-basic`.

### Files and interfaces

- `apps/web/src/theme/themes.ts` gained the twelve themes below. Preview with `?theme=its-id`.

### Decisions and defaults

- Display names keep punctuation (`Localhost:26`, `26.humza.website`, `Humza's Control Room`, `Commit: Twenty-Six`). Ids stay lowercase letters, numbers, and hyphens.
- Humza Studio and Humza, According to Everyone are light. The other ten are dark.
- `DEFAULT_THEME_ID` is unchanged.

### Catalogue

`overengineered-birthday`, `humza-studio`, `one-more-tweak`, `localhost-26`, `26-humza-website`, `humzas-control-room`, `baseer-has-the-mic`, `commit-twenty-six`, `humza-according-to-everyone`, `the-humza-archives`, `21-november`, `made-by-humza`.

### Commands and results

- `npm run typecheck` passed.

### Manual verification

In the IDE browser against `http://localhost:5173`:

- `overengineered-birthday`: blueprint navy `#0a1830`, electric blue `#5b93ff`, warning orange headings, quiet zone `#f7f9fc`.
- `humza-studio`: warm ivory `#f4efe6`, signature coral `#c23b2c`, light scheme, quiet zone `#fffaf4`.
- `21-november`: oxblood `#3a0c14`, copper `#e09058`, candlelight headings, quiet zone `#f8edd8`.

### Unresolved issues

- The favicon does not follow a theme change.
- Phones and the projector still choose a theme separately, with `?theme=`.

### Next stage

The numbered prompt sequence stays complete. Changing the party default is a new `DEFAULT_THEME_ID`.

## Theme picker

Status: complete.

Theme sits in the navbar on every shell. It opens a small panel. Category tabs swipe sideways, and the themes for that category are listed inside.

### Files and interfaces

- `apps/web/src/theme/theme-picker.tsx` is the navbar control.
- `themeCategories` in `apps/web/src/theme/themes.ts` groups every palette.
- `applyTheme` in `apps/web/src/theme/install.ts` paints the choice immediately and remembers it for the browser tab.
- `motion` 13.4.4 eases the panel open and closed.

### Decisions and defaults

- A `?theme=` link still wins over the remembered choice. Otherwise the tab keeps the last pick, including after a refresh. A new tab starts on `26-basic`.
- Categories: 26 basic, Personal to 26, Quiz and chaos, Dark and atmospheric, Light and nostalgic, Personal to the night.

### Commands and results

- `npx tsc -b apps/web` passed.
- `npx eslint` on the picker, installer, and surface frame passed.

### Manual verification

In the IDE browser against `http://localhost:5173`:

- Theme is in the navbar. Opening it shows the category tabs and 26 basic inside the first tab.
- Swiping the panel selects Personal to 26. Choosing Version 26 paints ink `#07090f` and electric blue `#3d74ff`, and the button reads “Theme, Version 26”.
- Loading `/host` in the same tab keeps Version 26.

### Unresolved issues

- The room still does not push one theme to every phone and the projector.

### Next stage

The numbered prompt sequence stays complete. Changing the party default is a new `DEFAULT_THEME_ID`.

## Persona and life themes

Status: complete.

Eight new tabs sit in the theme picker: Persona, Games, Anime, Everyday, School, Work, Musicians, and Crossovers. They hold 58 inspired palettes. The default stays `26-basic`.

### Files and interfaces

- `themeCategories` and `themes` in `apps/web/src/theme/themes.ts` gained the eight tabs and the palettes below. Preview with `?theme=its-id`.

### Decisions and defaults

- Colours are inspired readings of each idea. They are not official brand, school, club, or publisher palettes.
- Display names keep punctuation, including `bbno$`, `Café`, and `Keijo!!!!!!!!`. Ids stay lowercase letters, numbers, and hyphens, so the Pitbull title is shortened only in `pitbull-mr-worldwide`.
- Light grounds: Persona 4, Chocobo Crossing, Pallet Town, Crystal Prelude, Platinum Trophy, Capsule Corp, Hidden Leaf, Chinese Takeaway, One More Plate, Tea Obviously, Amazon, McHumza, and Queen’s. The rest are dark, including Café Leblanc, PS2, GTA VI, Rum & Coke, Spoon World, and the three school themes.
- `DEFAULT_THEME_ID` is unchanged.

### Catalogue

Persona: `persona-1-origins`, `persona-2-innocent-birthday`, `persona-3-midnight-hour`, `persona-3-portable-pink-route`, `persona-4-golden-hour`, `persona-5-take-your-time`, `the-velvet-room`, `cafe-leblanc`.

Games: `final-fantasy-crystal-prelude`, `final-fantasy-vii-mako`, `chocobo-crossing`, `pokemon-pallet-town`, `pokemon-gengar-hours`, `smash-final-destination`, `scarlet-nexus-brain-drive`, `gta-vi-vice-birthday`, `ps2-memory-card`, `playstation-platinum-trophy`.

Anime: `dragon-ball-birthday-saiyan`, `dragon-ball-capsule-corp`, `my-hero-academia-plus-ultra`, `naruto-hidden-leaf`, `naruto-akatsuki`, `bunny-girl-senpai-after-school`, `tsukigakirei-moonlit-walk`, `your-name-twilight-thread`, `fullmetal-alchemist-equivalent-exchange`, `keijo-absolutely-necessary`.

Everyday: `chinese-takeaway-at-humzas`, `one-more-plate`, `tea-obviously`, `rum-and-coke`, `usual-table-laptop-open`, `just-one-more-game`.

School: `wallington-grammar-school-arc`, `greenshaw-next-chapter`, `portsmouth-student-save-file`.

Work: `amazon-out-for-delivery`, `mchumza-birthday-meal`, `spoon-world-portsmouth-edition`, `restaurant-shift-last-orders`, `fratton-park-matchday-shift`, `stamford-bridge-on-the-clock`, `goodwood-all-access`, `queens-centre-court`, `twickenham-under-the-floodlights`, `corestream-risk-accepted`, `501-fun-maximum-fun`.

Musicians: `pitbull-mr-worldwide`, `dj-khaled-another-one`, `bbno-birthday-budget`, `yung-gravy-gravy-boat`, `rick-astley-never-gonna-log-you-out`.

Crossovers: `phantom-thieves-of-portsmouth`, `cafe-leblanc-but-make-it-tea`, `super-saiyan-closing-shift`, `gta-vi-made-me-late`, `risk-assessment-keijo`.

### Commands and results

- A contrast check of every text pair and the join code passed for all 111 themes.
- `npx tsc -b apps/web` passed.
- `npx prettier --write apps/web/src/theme/themes.ts` left the file unchanged.

### Manual verification

In the IDE browser against `http://localhost:5173/host`:

- Theme opens on the remembered category. The new tabs are Persona, Games, Anime, Everyday, School, Work, Musicians, and Crossovers.
- Choosing Persona selects that tab. Persona 5 paints ink `#0c0c0e`, signal red `#ff3b30`, and steel headings `#d5dae2`.
- Café Leblanc paints coffee `#1c120e`, burgundy `#e05060`, and amber headings `#e8a040`.
- PS2 — Memory Card paints abyss `#070c18` and cobalt `#3d74ff`.
- Your Name paints twilight `#1a1030` and thread-red headings `#ff5a4a`.
- Café Leblanc, but Make It Tea paints tea brown `#1c140e` and brass `#c47a3a`, and the button reads that name.
- Categories sit in a two-column grid of small icon pills. Themes sit in a recessed tray as two-column cards, each with a colour chip and a short title. The full name stays on the control.

### Unresolved issues

- The favicon does not follow a theme change.
- Phones and the projector still choose a theme separately.

### Next stage

The numbered prompt sequence stays complete. Changing the party default is a new `DEFAULT_THEME_ID`.

## Phone controller hygiene

Status: complete.

The guest phone at `/` keeps the screen awake after joining, buzzes when a question opens and when a troll lands on that phone, and asks for portrait on a short landscape screen. The stage and admin screens are unchanged.

### Files and interfaces

- `apps/web/src/controller/ControllerRoot.tsx` and `controller.css` wrap only the guest page. The root is `100dvh`, scrolls inside itself, pads for `env(safe-area-inset-*)`, and sets `overscroll-behavior: none` and `touch-action: manipulation`. Buttons, options, and range inputs inside it are at least 48px and cannot be selected as text.
- `apps/web/src/controller/RotateHint.tsx` listens for landscape screens shorter than 32rem.
- `apps/web/src/device/wakeLock.ts` exports `useWakeLock(active)`. The guest page holds a screen lock while a session exists, asks again when the page becomes visible, and releases on cleanup.
- `apps/web/src/device/haptics.ts` exports `buzz(pattern)`. A missing Vibration API, including iOS Safari, does nothing.
- `apps/web/src/controller/haptic-triggers.ts` buzzes for a phase change into `prompt` and for a newly active troll whose role is `target`. The first snapshot is a baseline. There is no new socket message and no new troll kind.
- Web unit tests run with Vitest, jsdom, and Testing Library. `npm run test:unit` runs them.

### Decisions and defaults

- Wire phases stay lowercase. `PROMPT` in the tests is the existing `prompt` phase.
- A self-targeted troll is an existing guest snapshot row with `role: "target"` and `status: "active"`.
- `buzz` is the function a later haptic troll can call. The server catalogue is unchanged.

### Commands and results

- `npm run test:unit` passed: 5 files, 14 tests.
- `npm run typecheck` passed.
- `npx eslint` on the guest page, device adapters, controller, test setup, and Vitest config passed.

### Manual verification

In the IDE browser against `http://localhost:5173`:

- `/` has `.controller-root`. Computed height was the viewport (`780px` from `100dvh`), `overscroll-behavior` was `none` on the root and the document, `touch-action` was `manipulation`, and the Join button’s minimum size was `48px` with `user-select: none`. The rotate hint was hidden.
- A short landscape viewport (`844×390`) showed “Rotate your phone”.
- `/host` and `/admin` have no `.controller-root`, and the document overscroll style set by the guest page was cleared after leaving it.

### Unresolved issues

- Safe-area padding computed to `0px` on this desktop browser, which has no inset. A phone with a notch was not checked.
- The wake lock and vibration call were not exercised on a physical iPhone or Android. The unit tests cover the missing-API path.

### Next stage

The numbered prompt sequence stays complete. Further phone behaviour is a new request.

## Join and reconnect

Status: complete.

A guest who opens `/?room=` skips typing the room code. The nickname field remembers the last name, counts characters, and shows a taken name in the field. After the phone has been connected, a drop of 1.5 seconds shows a reconnect banner and blocks inputs until the next snapshot.

### Files and interfaces

- `apps/web/src/join/JoinRoomCode.tsx` reads `?room=` and `/j/:code`. A complete code hides the field. Typed codes are uppercased and limited to `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`.
- The room QR in `apps/web/src/lobby/join-mark.tsx` now points at `/?room=`.
- `apps/web/src/join/Nickname.tsx` prefills `26-nickname` from localStorage, shows `n/24`, and focuses the field when the join error mentions the nickname.
- `apps/web/src/net/ReconnectBanner.tsx` shows “Reconnecting…” after 1.5 seconds disconnected, disables inputs, then clears that banner and shows “Back in ✓” when a snapshot arrives.
- `apps/web/src/net/ConnectionDot.tsx` sits with the existing connection sentence.

### Decisions and defaults

- O, 0, I, and 1 are dropped as the guest types. The code is still six characters.
- A nickname collision is the existing join error whose message mentions “nickname”. No message or payload was added.
- The reconnect banner starts only after this phone has been open once, so the first connection does not show “Back in”.

### Commands and results

- `npm run test:unit` passed: 8 files, 21 tests.
- `npm run typecheck` passed.
- `npx eslint` on the guest page, join fields, reconnect banner, and join mark passed.

### Manual verification

In the IDE browser against `http://localhost:5173`:

- `/?room=k7m2qp` showed “Room code K7M2QP” and the nickname field, with no join-code box.
- Typing `ab0oI1z` into the join code left `ABZ`.
- Typing `Bo` changed the counter to 2/24.
- After storing `Amina`, a fresh load of `/` filled the nickname and showed 5/24.

### Unresolved issues

- The reconnect banner and “Back in” toast were not watched on a dropped socket in the browser. The unit test covers the 1.5 second delay, disabled inputs, and the snapshot.
- A taken nickname was not submitted against a live room. The field focuses and shows whatever nickname error the existing join response already returns.

### Next stage

Round controls on the phone: slider readout and tick, rank assign, submit states, and wrapping options.

## Round controls

Status: complete.

The phone slider shows a large value with its unit and ticks on each step. Ranking highlights the selected item, lets a second tap clear it, undoes the last placement, and shows a count on each tier. Every send button goes idle, then sending, then “Locked in ✓”. Long options wrap, and drop one font step when they run past three lines.

### Files and interfaces

- `apps/web/src/rounds/Slider.tsx` is the estimate control: a display readout, a large thumb, and a haptic tick at most once every 50ms. `GuestSlider` uses it.
- `apps/web/src/rounds/TierAssign.tsx` is tap-to-assign. The selected item uses `tier-selected`. “Undo last” restores the previous placements. Each tier button keeps its name and shows a `tier-count` badge.
- `apps/web/src/rounds/SubmitButton.tsx` is idle, sending (spinner, disabled), or “Locked in ✓”. A second tap does not call `onClick` again. Choice, slider, rank, text, ballot, guess, duel, and finale send through it.
- `apps/web/src/rounds/OptionText.tsx` wraps option labels. More than three measured lines adds `option-text-small`.

### Decisions and defaults

- The tick calls the existing `buzz([8])`. The value still updates on every step; only the vibration is throttled.
- Locked means the phone already has `selfAnswer` or `selfBallot`. No new socket message.
- The tier badge is hidden from the accessible name, so the button stays “1st”.
- Undo keeps a stack of placement lists, so a replacement can be restored.

### Commands and results

- `npm run test:unit` passed: 12 files, 25 tests.
- `npm run typecheck` passed.
- `npx eslint` on `apps/web/src/rounds` and the guest round components passed.

### Manual verification

In the IDE browser, a signed-in admin opened lobby `LJPEGL` and a phone joined as Amina:

- On the candle question, choosing 26 enabled “Send answer”. The click changed it to “Sending”, disabled, with `aria-busy`. The round then closed and the server returned “That answer is too late”, so “Locked in ✓” was not seen on that question.
- Option text used `white-space: normal`, `overflow: visible`, and `text-overflow: clip`.
- The letters slider showed the readout “10 letters” before answers opened. The thumb and the tick were not measured on that screen; the round had moved on.
- On the ranking question, Friends gained `tier-selected` and a gold outline, a second tap cleared it, assigning it to 1st showed the badge `1` and “Friends · 1st”, and the tier button’s name stayed “1st”. “Undo last” was enabled after that assignment and disabled once the round closed, before the undo click landed.

### Unresolved issues

- “Locked in ✓” was confirmed by the unit test, not by a live accepted answer. The candle send was rejected as late.
- The slider tick was not felt on this desktop. Vibration is missing here; the unit test checks the throttled `navigator.vibrate` call.
- Undo-last was not clicked in the browser before the ranking round closed. The unit test covers the undo.

### Next stage

Projector type, overscan inset, fullscreen, the final-five countdown, and a waiting line.

## Projector stage

Status: complete.

The stage at `/host` uses projector type, keeps every text and background pair at 7:1, and sits inside a 5% inset. Full screen is a button and the F key. The cursor hides after two seconds still. The last five seconds of a live countdown pulse in the accent colour. While answers are open, “Waiting on N” and a bar come from the existing submission count and the player list.

### Files and interfaces

- `apps/web/src/stage/tokens.ts` and `tokens.css` set body 40px, question 72px, and timer 120px, and list the stage colour pairs.
- `apps/web/src/stage/SafeArea.tsx` pads the stage by 5%. O toggles `stage-safe-outline` only when the build is dev.
- `apps/web/src/stage/fullscreen.tsx` and `apps/web/src/device/fullscreen.ts` request fullscreen. The cursor class is `stage-cursor-hidden` after 2 seconds idle.
- `apps/web/src/stage/Countdown.tsx` adds `stage-countdown-pulse` and the accent colour when the existing remaining time is inside the final 5 seconds. `remainingUntil` is unchanged.
- `apps/web/src/stage/waiting.ts` exports `waitingSummary(count, players)`. `WaitingLine` renders it from `play.submissionCount` and `players.length`.

### Decisions and defaults

- The stage pins its own pairs inside `.stage-safe`, including a lighter accent (`#ffa08a`), so a theme accent that is under 7:1 does not land on the projector.
- The pulse runs while remaining time is greater than 0 and at most 5000ms. Paused and held clocks do not pulse.
- “Waiting on N” is the players who have not submitted. Zero players yields waiting 0 and 0%. Everyone submitted yields waiting 0 and 100%.
- The line shows during collect, vote, and predict.

### Commands and results

- `npm run test:unit` passed: 17 files, 32 tests.
- `npm run typecheck` passed.
- `npx eslint` on `apps/web/src/stage`, `apps/web/src/device/fullscreen.ts`, and `apps/web/src/ui/surface-frame.tsx` passed.

### Manual verification

In the IDE browser at `http://localhost:5173/host`:

- The safe area padding computed to about 5% of the width (50.5px), body text was 40px, and the preview timer was 120px in the question yellow on the dark background.
- O added `stage-safe-outline`. After two seconds still, the stage root gained `stage-cursor-hidden`.
- Connecting lobby `LJPEGL` showed the podium. The question was 72px. There was no live countdown and no waiting line, because that phase does not collect answers.
- The Full screen button was on the page. This embedded browser did not enter fullscreen.

### Unresolved issues

- The final-five pulse and “Waiting on N” were not watched on a live collect phase. The unit tests cover the pulse boundary and the waiting maths.
- Fullscreen was refused by the embedded browser. The unit test checks that F calls `requestFullscreen`.

### Next stage

Stage sound, host shortcuts, and the operator count.

## Stage sound and operator keys

Status: complete.

Sound for the show is on `/host` only. Start show unlocks the AudioContext once. M mutes it and the small icon shows that state. Space, P, and H send the existing advance, pause, and hide play actions. ? lists those shortcuts. D shows a small corner count, the phase, and this screen’s socket. The phone no longer plays an accept beep.

### Files and interfaces

- `apps/web/src/stage/audio.ts` exports `createStageShow()`. `play()` does nothing until `unlock()`, and nothing again while muted.
- `apps/web/src/stage/StageShow.tsx` and `use-stage-show.ts` are the Start show button, the mute icon, and the M key.
- `apps/web/src/stage/stage-sound.tsx` plays a cue through that same context after the existing cue decision says play.
- `apps/web/src/stage/shortcuts.tsx` maps Space to `advance`, P to `pause`, and H to `hide`. Those are the play actions the admin buttons already send.
- `apps/web/src/stage/presence.ts` exports `connectedCount` for `PLAYER_JOINED` and `PLAYER_LEFT`. The stage shows `snapshot.players.length`, which is that list.
- `apps/web/src/stage/OperatorHud.tsx` is hidden until D. It shows the count, the phase, and the stage socket state.

### Decisions and defaults

- There is no `HOST_ADVANCE`, `HOST_PAUSE`, `HOST_HIDE_PHOTO`, `PLAYER_JOINED`, or `PLAYER_LEFT` message. The keys call `playRoom` with `advance`, `pause`, and `hide`. H is the existing “Hide stage content” action. Hiding one photo still needs that photo’s id on the admin screen.
- P sends pause, the same action as the Pause button. Resume stays the separate admin button.
- Shortcuts do nothing while an input, textarea, select, or contenteditable is focused, and nothing until a room is connected.
- The operator panel is 16px so it stays a corner tool. Show text on the stage stays at the 40px minimum.
- Mute is remembered for the tab. Unlock is not. A refresh asks for Start show again.
- The phone’s Sound on/off control and accept beep are gone. Guest voice clips still play on the stage.

### Commands and results

- `npm run test:unit` passed: 21 files, 36 tests.
- `npm run typecheck` passed.
- `npx eslint` on the stage files, `apps/web/src/controller/noAudio.test.ts`, and `apps/web/src/guest/guest-page.tsx` passed.

### Manual verification

In the IDE browser at `http://localhost:5173/host`:

- Start show replaced the button with “The show audio is unlocked on this screen.”
- M changed the control to “Muted” with `aria-pressed`. The icon was 24px.
- ? showed “Space advances.”, “P pauses.”, and “H hides the stage.”
- D showed “Connected 0”, “Phase none”, and “Socket idle” at 16px, fixed in the corner. That panel was absent before D.
- With the join code focused, D and ? left the panel and the shortcut list as they were.
- The guest page had no Sound on/off control. The about text says sound plays on the stage.

### Unresolved issues

- Space, P, and H were not sent to a live room. No room was connected, and those actions also need the admin sign-in cookie in the same browser.
- A cue file was not heard. The unit test checks that a mocked AudioContext does not start before unlock and does not start while muted.
- The connected count was 0 because no players were on this screen. The unit test checks joins and leaves.

### Next stage

Phone camera capture in front of the existing photo upload.

## Phone camera

Status: complete.

The phone takes a photo with the camera, shows a preview, and uploads only when Send is pressed. That upload is still the existing downscale, presigned PUT, and finalise path.

### Files and interfaces

- `apps/web/src/device/camera.ts` exports `useCamera()`. It opens `getUserMedia` with `facingMode` `environment`, then `user` when toggled. A rejection sets `fallback`. Tracks stop on unmount, on a facing change, and when `release()` runs.
- `apps/web/src/photo/CaptureFlow.tsx` is the camera, the preview, Retake, and Send. The fallback is `<input type="file" accept="image/*" capture>`.
- `apps/web/src/photo/capture-frame.ts` copies the current video frame into a JPEG blob. Send passes that file to `sendPhoto` in `guest-media.tsx`.
- `sendPhoto` still downsizes the longest edge to about 1280 pixels, requests a slot, PUTs the JPEG, and finalises. It now returns whether that finished.

### Decisions and defaults

- The rear camera is the default. Front camera is the toggle.
- Nothing is uploaded on capture or when a file is chosen. Send is the upload.
- The button reads Sending, then Sent ✓. A failed upload reads Failed and the button becomes Retry, which calls the same upload.
- The camera stays open through the preview so Retake can return to it. Send stops every track.
- HEIC is still rejected by the existing check, with the same sentence.

### Commands and results

- `npm run test:unit` passed: 23 files, 38 tests.
- `npm run typecheck` passed.
- `npx eslint` on `apps/web/src/device/camera.ts`, `apps/web/src/photo/CaptureFlow.tsx`, `apps/web/src/photo/capture-frame.ts`, and `apps/web/src/media/guest-media.tsx` passed.
- `apps/web/e2e/media.spec.ts` was updated to press Send, then Retake, before the second file. That Playwright spec was not run.

### Manual verification

In the IDE browser, a new lobby `SM5WPR` was started and the phone joined as Amina. The quiz had already reached the last questions, so a photo could not be accepted.

- The camera opened. Capture showed the preview with Retake and Send. Retake returned to a live camera, 640 pixels wide, with a live track.
- Front camera changed the control to Rear camera. The previous track ended and a new track was live.
- Send changed the button to Sending and the status to “Preparing the photo.” The camera track then ended.
- The server answered “Media uploads open once a question is running.” The button became Retry and the page showed Failed.

### Unresolved issues

- A photo was not accepted, because no question was still collecting media. The unit test checks that Send calls the upload once and that Retry calls it again.
- The file-input fallback was not shown in this browser, because `getUserMedia` succeeded. The unit test checks the fallback flag when `getUserMedia` rejects.
- The updated Playwright media spec was not run.

### Next stage

A searchable troll picker, a confirm step, and a victim toast.

## Troll picker

Status: complete.

The phone lists other players in alphabetical order, with a search box, and keeps the token line on screen. Firing still uses the existing troll command, after a confirm step. The server rules are unchanged.

### Files and interfaces

- `apps/web/src/troll/players.ts` exports `trollChoices`, `trollPickerLocked`, and `trollTokenLabel`. Round one is public question index 1. The picker locks when that index is below 2, or the token is spent.
- `apps/web/src/troll/Picker.tsx` is the search box and the player list. This phone's own player id is left out.
- `apps/web/src/troll/Confirm.tsx` asks "Troll Sam with Fake Call?" before `onSend`. Cancel does not send. Confirm sends once.
- `apps/web/src/troll/applied.ts` exports `newSelfTroll`. `VictimToast` shows "🎯 You've been trolled" and dismisses after 4 seconds.
- [docs/qol-map.md](qol-map.md) marks a named toast BLOCKED.

### Decisions and defaults

- "1 troll left" stays visible before round two and while the token is ready. "Troll used" replaces it after the token is spent. The list and the search box are disabled in both locked cases.
- The public question index comes from `play.question.index`. No play counts as before round two.
- Confirm calls the existing socket command `name: "troll"`. There is no `USE_TROLL` message.
- The guest effect does not include the sender. The toast stays anonymous. The admin `hostEffects` list has the sender, and the phone does not receive that list.

### Commands and results

- `npm run test:unit` passed: 26 files, 41 tests.
- `npm run typecheck` passed.
- `npx eslint` on `apps/web/src/troll` passed.
- `apps/web/e2e/quiz.spec.ts` now presses Confirm after Send troll. That Playwright spec was not run.

### Manual verification

In the IDE browser the phone was still Amina in lobby `SM5WPR`, after the quiz had finished:

- The token line read "1 troll left".
- Find a player was enabled. Amina was not in the list, and nobody else was in the room, so the list was empty.
- The troll kinds were disabled, so the confirm step was not opened on that screen.

### Unresolved issues

- Confirm, search filtering, and the toast were not watched with two phones on a live round. The unit tests cover the filter, the excluded name, the lock, cancel, one confirm send, and the toast dismiss.
- A named toast is BLOCKED in [docs/qol-map.md](qol-map.md) until a guest payload already includes the sender.

### Next stage

Caution tape between rounds, on pause, and on the phone waiting screen, plus a shared phase transition.

## Caution tape and phase transitions

Status: complete.

The coming-soon tape is the portable black-and-yellow marquee. It sits on the stage between rounds, on the paused overlay, and on the phone when the round copy is “Waiting for the next question.” Stage and phone content re-mount when the phase changes. Reduced motion keeps the tape still and the phase change instant.

### Files and interfaces

- `apps/web/src/anim/CautionTape.tsx` and `caution-tape.css` are the tape. Class names, copy, colours, and the 9 second marquee match the portable contract.
- `apps/web/src/anim/PhaseTransition.tsx` keys its child on the phase. Duration is 0 when `prefers-reduced-motion: reduce` matches.
- `apps/web/src/stage/BetweenRounds.tsx` shows the tape during `intro` and `scores`.
- `apps/web/src/stage/Paused.tsx` is the paused overlay.
- `apps/web/src/play/WaitingNext.tsx` is the phone waiting screen.

### Decisions and defaults

- The tape markup and CSS values are unchanged from the contract, including `aria-hidden` on the tape. The screen’s own sentence sits outside the tape.
- Between rounds is the `intro` and `scores` phases. The question panel stays in the page; the tape is in its own clipped host.
- The phone waiting card appears only when `guestRoundCopy` is “Waiting for the next question.”
- Reduced motion sets `data-force-reduced-motion="true"` and `animation: none` on the track. The phase wrapper uses `data-phase-motion="instant"`.

### Commands and results

- `npm run test:unit` passed: 29 files, 44 tests.
- `npm run typecheck` passed.
- `npx eslint` on the new animation, stage, and guest files passed.

### Manual verification

The stage at `/host` had no room connected. Admin was signed in, and lobby `SM5WPR` reported “The lobby connection is closed,” so the demo did not start. The between-rounds tape, the pause overlay, and the phone waiting screen were not seen on a live round.

### Unresolved issues

- Those three screens were not watched in a running quiz. The unit tests cover the marquee, reduced motion, the phase re-key, and the tape on the paused overlay.

### Next stage

The numbered prompt sequence stays complete. Further phone or stage behaviour is a new request.

## Theme identity skins

Status: complete.

Six themes now change more than the palette. A skin sets the page ground, the corner radius of the shared controls, and the mark beside the 26. Every other theme stays on the plain chrome. `26 basic` is unchanged.

### Files and interfaces

- `apps/web/src/theme/skins.ts` exports `skinFor`, `plainSkin`, and `skinnedThemeIds`.
- `applyTheme` in `apps/web/src/theme/install.ts` sets `data-skin`, `data-ground`, `data-shape`, and `data-mark` on the document.
- `apps/web/src/theme/theme-skin.css` paints the ground and the radius tokens from the existing palette variables.
- `apps/web/src/theme/wordmark.tsx` is the navbar 26. `SurfaceFrame` mounts it, plus a decorative ground layer.
- `Button`, `TextField`, `Panel`, `StatusMessage`, and `CountdownLayout` use the radius tokens.

### Decisions and defaults

- Colours stay in `themes.ts`. Grounds are mixes of those variables. Marks are original drawings, not official logos.
- A theme with no skin entry is `plain`: flat ground, round controls, numeral only.
- The six trials: Persona 5 is a sharp slash and a mask. PS2 is a chunky grid and a memory card. Café Leblanc, but Make It Tea is a warm split, soft corners, and a cup. Pitbull keeps round controls, with nightclub stripes and shades. Spoon World is a dotted ground, ticket-stub panels, and a spoon. GTA VI is a sunset split, cut corners, and a skyline.
- The ground sits behind the page. It does not cover a question card. Patterns are static, including under reduced motion. Corner changes ease over 200ms, and that ease is removed when reduced motion is on.
- Phone and stage share the skin because the theme is already chosen per device.

### Ideas not built

Later themes can join a family instead of growing a new system.

- Slash and stencil: Phantom Thieves of Portsmouth, Akatsuki, Fullmetal.
- CRT and terminal: HumzaOS, Birthday.exe, Localhost:26, Commit: Twenty-Six, Just One More Game, Scarlet Nexus.
- Paper and steam: Café Leblanc, Tea Obviously, Paper Party, Chinese Takeaway, One More Plate.
- Club and neon: DJ Khaled, bbno$, Yung Gravy, Velvet Rope, Ultraviolet, Electric Orchid, Deep Sea Disco, Cobalt Club.
- Shift and service: McHumza, Restaurant Shift, Amazon, CoreStream, 501 Fun.
- Floodlights: Fratton Park, Stamford Bridge, Twickenham, Queen’s, Goodwood. A band of light, not a club badge.
- Exercise book: Wallington, Greenshaw, Portsmouth Student Save File.
- Daylight: Persona 4, Your Name, Tsukigakirei, Hidden Leaf, Pallet Town, Chocobo Crossing.
- Foil: 26 Karat, PlayStation Platinum, Confetti Department.
- Velvet: The Velvet Room, Persona 3, Moonlit Chrome, November Nights.
- Chaos tape: Absolutely Rigged, Big Red Button, Keijo, Risk Assessment: Keijo. Frame only.

Rick Astley stays a colour theme.

### Commands and results

- `npx vitest run src/theme/skins.test.ts` in `apps/web` passed: 3 tests.
- `npx tsc -b apps/web` passed.

### Manual verification

In the IDE browser on `http://localhost:5173`:

- Persona 5 shows the mask, sharp Guest control, and a red slash that stays off the question card.
- PS2 shows the memory-card mark, a screen grid, and chunkier corners.
- Café Leblanc, but Make It Tea shows the cup and soft corners. On `/host` the same skin paints a warm split above the stage title, and the title stays readable.
- Pitbull shows the shades, round controls, and diagonal stripes behind the page.
- Spoon World shows the spoon, a dotted ground, and ticket notches beside the question heading.
- GTA VI shows the skyline, cut corners, and a sunset toward the bottom of the screen. The question text stays on the card.

### Unresolved issues

- The favicon does not follow a theme change. Phones and the projector still choose a theme separately.

### Next stage

The numbered prompt sequence stays complete. Changing the party default is a new `DEFAULT_THEME_ID`. A later skin can join one of the families above.

## Skins for the full catalogue

Status: complete.

Every theme except `26 basic` now has a skin. Themes in one family share the ground, the corner radius, and the mark. The palette still changes per theme. `26 basic` stays flat.

### Files and interfaces

- `skinGrounds` and `skinMarks` in `apps/web/src/theme/skins.ts` gained glow, horizon, ruled, floodlight, foil, and tape, plus terminal, note, sun, beam, ring, stamp, star, and mic.
- The skin map is `Record<Exclude<ThemeId, "26-basic">, ThemeSkin>`, so a missing theme fails typecheck.
- `apps/web/src/theme/theme-skin.css` paints the new grounds from the existing palette variables. Foil is a highlight edge on panels. Tape is a static strip along the top.
- `apps/web/src/theme/wordmark.tsx` draws the new marks.

### Decisions and defaults

- The six trials keep their ids and look. PS2 still adds scanlines on top of the grid.
- Smash joins the slash family with a star. Rick Astley joins the club stripes with a note, and nothing moves.
- Ruled and tape keep the numeral, so the lines and the strip are the identity.
- Show themes (Version 26, Main Character, The Humza Show, Humza According to Everyone, 21 November) use stripes and a star. Baseer Live and Baseer Has the Mic use a glow and a mic.
- Grounds stay behind the question card. Nothing loops.

### Commands and results

- `npx vitest run src/theme/skins.test.ts` in `apps/web` passed: 4 tests.
- `npx tsc -b apps/web` passed.

### Manual verification

In the IDE browser on `http://localhost:5173`:

- The Velvet Room shows a highlight wash, soft corners, and the mask. The question text stays on the card.
- Your Name shows a sun and a twilight band across the top.
- Wallington shows exercise-book lines and a margin. A point on the question hits the card, not the ground.
- Fratton Park shows a floodlight band and a beam beside the 26.
- 26 Karat shows a star and a highlight edge on the question card.
- Absolutely Rigged shows a static caution strip along the top and sharp controls. The strip does not cover the question.

### Unresolved issues

- The favicon does not follow a theme change. Phones and the projector still choose a theme separately.

### Next stage

The numbered prompt sequence stays complete. Changing the party default is a new `DEFAULT_THEME_ID`.

## Nissan LEAF and Toyota Prius+

Status: complete.

Two car themes sit in a Cars category. Each has a light cabin palette and its own skin. The marks are original drawings.

### Files and interfaces

- `nissan-leaf` and `toyota-prius-plus` in `apps/web/src/theme/themes.ts`, listed once under Cars.
- `apps/web/src/theme/skins.ts`: LEAF uses a charge glow, soft corners, and a leaf. Prius+ uses a daylight band, soft corners, and a plus.
- `charge` is a new ground in `apps/web/src/theme/theme-skin.css`. The leaf and plus marks are in `apps/web/src/theme/wordmark.tsx`.

### Decisions and defaults

- Colours are inspired readings of the cars, not official badges or brand palettes.
- Both grounds are light, so both themes use `colorScheme: "light"`.
- `DEFAULT_THEME_ID` stays `26-basic`. The favicon is unchanged.

### Commands and results

- Contrast pairs for both palettes passed the text and mark checks.
- `npx vitest run src/theme/skins.test.ts` in `apps/web` passed: 4 tests.
- `npx tsc -b apps/web` passed.

### Manual verification

In the IDE browser on `http://127.0.0.1:5173`:

- `?theme=nissan-leaf` shows a pale leaf page, a green charge glow at the bottom, soft controls, and a leaf beside the 26. The Guest heading is the page text, not the ground.
- `?theme=toyota-prius-plus` shows an aqua cabin, a blue band across the top, soft controls, and a plus beside the 26. The heading stays readable.
- The theme picker has a Cars tab. Nissan LEAF and Toyota Prius+ are listed there, and no longer under Everyday.

### Unresolved issues

- The favicon does not follow a theme change. Phones and the projector still choose a theme separately.

### Next stage

The numbered prompt sequence stays complete. Changing the party default is a new `DEFAULT_THEME_ID`.

## Theme icon packs

Status: complete.

`@26/web` depends on Iconify's offline renderer and four per-icon packs. The theme rule tells later agents which pack covers which category.

### Files and interfaces

- Dependencies in `apps/web/package.json`: `@iconify/react@6.0.2`, `@iconify-icons/lucide@2.0.13`, `@iconify-icons/simple-icons@2.0.4`, `@iconify-icons/game-icons@2.0.0`, `@iconify-icons/mdi@2.0.0`.
- [.agents/rules/45-themes.md](../.agents/rules/45-themes.md) lists the install commands, the offline import, and which pack to search for each category. [.agents/rules/40-design.md](../.agents/rules/40-design.md) and [.agents/rules/30-web.md](../.agents/rules/30-web.md) point at that rule.

### Decisions and defaults

- Import one icon from `@iconify-icons/{prefix}/{name}` and render it with `@iconify/react/dist/offline`.
- Lucide covers the everyday category glyphs. Simple Icons covers a named company, bank, car brand, platform, or artist. Game Icons covers a game pictogram that is not a publisher logo. Material Design Icons is the fallback when Lucide has no shape.
- A navbar mark comes from those packs. A new hand-drawn stroke is only for an idea none of the packs has. The favicon stays 26 basic.

### Commands and results

- `npm install @iconify/react@6.0.2 @iconify-icons/lucide@2.0.13 @iconify-icons/simple-icons@2.0.4 @iconify-icons/game-icons@2.0.0 @iconify-icons/mdi@2.0.0 -w @26/web` added 6 packages. npm reported 0 vulnerabilities. It also warned that `eslint-visitor-keys@5.0.1` wants Node `^22.13.0` and this machine is `v22.12.0`.
- `npm run agents:sync` updated the generated copies of the theme, design, and web rules.

### Unresolved issues

- The favicon does not follow a theme change. Phones and the projector still choose a theme separately.

### Next stage

The numbered prompt sequence stays complete. Changing the party default is a new `DEFAULT_THEME_ID`.

## Theme finishes

Status: complete.

Every skin now has a finish. The shared frame can be solid, glass, cartoon, realistic, minimal, or extravagant. Question text, scoring, and copy stay put.

### Files and interfaces

- `finish` on `ThemeSkin` in `apps/web/src/theme/skins.ts`. `applyTheme` writes `data-finish`.
- `apps/web/src/theme/theme-skin.css` paints the six treatments from the existing palette variables.
- [.agents/rules/45-themes.md](../.agents/rules/45-themes.md) tells a new theme to pick a finish. `npm run agents:sync` updated the generated copies.

### Decisions and defaults

- `26 basic` stays solid. School lines, service tickets, and the two cars are solid. Glow and horizon are glass. Slash, tape, and Spoon World are cartoon. Paper, Leblanc tea, the floodlights, and PS2 are realistic. The terminal grid is minimal. Club, show, mic, foil, and Vice are extravagant.
- Glass is a translucent plate with a light blur. Reduced motion removes the blur and raises the plate. Cartoon is a thick outline and a hard offset shadow. Realistic is a soft shadow and an inner highlight. Extravagant adds a highlight edge, a deeper shadow, and a larger mark.
- A finish does not outline the heading. Panels stay opaque except for glass, which stays readable over the ground.

### Commands and results

- `npx vitest run src/theme/skins.test.ts` in `apps/web` passed: 4 tests.
- `npx tsc -b apps/web` passed.
- `npm run agents:sync` updated the theme rule copies.

### Manual verification

In the IDE browser on `http://127.0.0.1:5173`:

- `?theme=26-basic` is solid: the question card has no extra shadow, and a point on Guest hits the heading.
- `?theme=the-velvet-room` is glass: the card is 82% surface with a 16px blur. A point on Guest hits the heading.
- `?theme=persona-5-take-your-time` is cartoon: controls and the card have a thick outline and a hard offset shadow. The heading itself has no shadow.
- `?theme=fratton-park-matchday-shift` is realistic: the card is opaque, with an inner highlight and a soft shadow.
- `?theme=humza-os` is minimal: the card has a hairline border and no shadow. A point on the card heading hits the heading, and the panel background is opaque over the grid.
- `?theme=26-karat` is extravagant: the card has a highlight edge and a deep shadow, and the navbar mark is larger.

### Unresolved issues

- The favicon does not follow a theme change. Phones and the projector still choose a theme separately.

### Next stage

The numbered prompt sequence stays complete. Changing the party default is a new `DEFAULT_THEME_ID`.

## Background motifs

Status: complete.

Some themes now draw a static icon on the ground. The icon stays behind the question. Themes whose ground is already a pattern stay clear, and so does 26 basic.

### Files and interfaces

- `motif` and `icon` on `ThemeSkin` in `apps/web/src/theme/skins.ts`. `applyTheme` writes `data-motif` and, when there is an icon, `data-motif-icon`.
- `apps/web/src/theme/skin-motif.tsx` renders the icons inside `.skin-ground`. Crest, scatter, and bleed are positioned in `apps/web/src/theme/theme-skin.css`.
- [.agents/rules/45-themes.md](../.agents/rules/45-themes.md) tells a new theme when to add a motif. `npm run agents:sync` updated the generated copies.

### Decisions and defaults

- Crest: Nissan on LEAF, Toyota on Prius+, a sun on the horizon family, a card on PS2, a mic on Baseer.
- Scatter: stars on the foil family, utensils on Spoon World.
- Bleed: a mask on the slash family, cropped off the left edge.
- None: 26 basic, the terminal grid, school lines, tape, club stripes, service tiles, paper, floodlights, and the Velvet Room glow.
- Company marks come from Simple Icons. The other motifs come from Lucide. Nothing moves.

### Commands and results

- `npx vitest run src/theme/skins.test.ts` in `apps/web` passed: 4 tests.
- `npx tsc -b apps/web` passed.
- `npm run agents:sync` updated the theme rule copies.

### Manual verification

In the IDE browser on `http://127.0.0.1:5173`:

- `?theme=nissan-leaf` shows the Nissan mark in the corner, partly behind the card. A point on Guest hits the heading.
- `?theme=26-karat` shows six stars in the margins. A point on Guest hits the heading.
- `?theme=persona-5-take-your-time` shows one large mask cropped off the left. A point on Guest hits the heading.
- `?theme=humza-os` stays the grid. No motif is displayed.

### Unresolved issues

- The favicon does not follow a theme change. Phones and the projector still choose a theme separately.

### Next stage

The numbered prompt sequence stays complete. Changing the party default is a new `DEFAULT_THEME_ID`.

## Phone app shell

Status: complete for the guest phone. A physical handset was not used.

Guest routes `/` and `/j/:code` use a full-screen phone shell. Stage, admin, and results keep the shared surface frame. There is no service worker and no install prompt.

### Files and interfaces

- `apps/web/src/guest/phone-shell.tsx` is the phone frame: top bar, scrolling middle, and a bottom dock. It locks the document while it is mounted and sets `--keyboard-inset` from `visualViewport`.
- `apps/web/src/controller/phone-dock.tsx` portals Join and every send control into that dock. A reconnect disables those controls.
- `apps/web/index.html` uses `viewport-fit=cover` and `interactive-widget=resizes-content`, and links `apps/web/public/manifest.webmanifest` with `display: standalone`.
- `.motion-press` scales slightly on press. Reduced motion keeps a colour fade and drops the scale.
- Phase changes wait for the outgoing question to leave before the next one enters. Under reduced motion that wait has no duration.

### Decisions and defaults

- The development surface nav is not on the guest phone. Transfer stays behind “Changed phones?”. The device-statistics sentence stays on the join screen.
- Pinch zoom stays available. Inputs stay at 18px so focusing one does not zoom the page.
- On a narrow screen, results and admin scroll inside the dynamic viewport. The stage stays a projector layout.

### Commands and results

- `npm run test:unit -w @26/web` passed: 30 files, 49 tests.
- `npx tsc -b --pretty false` passed.

### Manual verification

In the IDE browser against `http://127.0.0.1:5173` and `http://localhost:5173`, at 390×844:

- The join screen has no surface nav. Join sits in the bottom dock, 48px tall and the width of the dock. The nickname field is 18px. The page does not scroll sideways.
- A resumed game kept “Send number” in the dock while the question body scrolled.
- A 700×320 viewport showed “Rotate your phone”.

### Unresolved issues

- A physical phone, the on-screen keyboard, and Add to Home Screen were not checked. The keyboard inset is covered by the unit test.
- The party script is still the illustrative pack.

## First birthday question drafts

Status: drafts saved. The running order is still empty, and no room, demo pack or deployment changed.

### Files and interfaces

Ten files in `apps/api/src/questions/packs/birthday/`, registered in `catalogue` in `manifest.ts`. Each file opens with a short design brief for the later custom presentation step.

| Id                         | Helper           | Status               | Still needs                            |
| -------------------------- | ---------------- | -------------------- | -------------------------------------- |
| `favourite-genre`          | choice           | draft                | correct option                         |
| `leviticus-18-7`           | choice           | ready (not in order) | nothing                                |
| `car-name`                 | choice           | draft                | correct option                         |
| `ignorance-triggers`       | rank             | draft                | correct order                          |
| `mock-election`            | choice, 0 points | draft                | unscored poll mechanic; 6-option limit |
| `red-pill-blue-pill`       | choice           | draft                | majority-rule scoring mechanic         |
| `trolley-problem`          | choice, 0 points | draft                | unscored poll mechanic                 |
| `real-name-count-binface`  | choice           | draft                | typed-answer mechanic                  |
| `real-name-zack-polanski`  | choice           | draft                | typed-answer mechanic                  |
| `real-name-tommy-robinson` | choice           | draft                | typed-answer mechanic                  |

### Decisions and defaults

- Leviticus uses neutral option ids (`a` to `d`). The wrong options are the real KJV verses 18:8, 18:13 and 18:16. The labels are opening words because a label is at most 80 characters. The full verse is the explanation.
- Three interactions are not one of the seven mechanics: an unscored poll, a majority-conditional score, and a typed answer. Those drafts use the choice helper only to hold their content, and carry an explicit requirement that names the gap. No scoring was changed.
- The real names are Jon Harvey, David Paulden and Stephen Yaxley-Lennon. They are kept server-side in the explanation and the file comment.
- The mock election lists the six largest British parties. The rest are named in the requirement.

### Commands and results

- `npm run content:check` passed. Demo passed. Birthday passed with incomplete drafts reported.

### Unresolved issues

- Humza still has to supply the answers for genre, car name, and the ranking order.
- Poll, majority-rule and typed-answer mechanics do not exist yet.
- Every presentation is still `standard`.

### Next stage

Pick the next step: supply the missing answers, add the missing mechanics to the shared reducer, or customise a question's design.

## Poll, threshold, and typed-answer mechanics

Status: complete. Eight of the ten birthday questions are ready. None is in the running order, and no room, demo pack or deployment changed.

### Files and interfaces

- `ChoiceOutcome` on `ChoiceBody` in `apps/api/src/questions/definition.ts`: `correct`, `poll`, or `threshold`. A playable choice's `correctOptionId` is null for poll and threshold.
- `apps/api/src/questions/choice-outcome.ts`: pure `settleChoice`, `choiceWins`, `choiceTally`. `pointsFor` takes the settlement as an optional fourth argument.
- New kind `typed`: `typedQuestion` in `authoring.ts`, `TypedQuestion` in `definition.ts`, `apps/api/src/questions/typed.ts` (accept, score, reveal, host rows), and the pure matcher in `apps/api/src/questions/typed-match.ts`. Answers use `round_response` with kind `typed`; no migration.
- The guest `text` command routes to the typed question when one is open, so there is no new message type.
- `packages/shared`: public choice `outcome`, public `typed` question, choice reveal `tally`/`winners`/`everyone`/`met`, typed reveal, `contentLimits.typedMax`.
- Web: `GuestText` takes a label, action and length; the phone shows counts and who scored; the stage shows a poll leader, threshold winners, and typed results. `choiceNote` and `outcomeLine` are exported for tests.
- [.agents/rules/15-question-authoring.md](../.agents/rules/15-question-authoring.md) and [docs/question-authoring.md](question-authoring.md) list the new mechanics. `npm run agents:sync` updated the copies.

### Decisions and defaults

- Ordinary choice reveals keep their one-field shape, so existing rooms and tests see no change.
- A poll's points default to 0 in `defaults.ts`, and validation rejects a scored poll or a poll with a speed bonus.
- Threshold share is measured over answers received, strictly greater than `above`. With no answers, the threshold is not met.
- A typed answer is matched at the reveal, not when it arrives. The stage shows the right answer, how many got it, and their names when attribution allows. Wrong answers stay off the stage; the host panel sees each one.
- Birthday answers: genre `white-girl`, car `hagakure`. Tommy Robinson accepts Stephen Yaxley-Lennon, Stephen Lennon and Stephen Yaxley. Count Binface accepts Jon Harvey and Jonathan Harvey.
- An assertion in `question-authoring.spec.ts` that required an empty birthday catalogue now checks only that its fixture question is not in it.

### Commands and results

- `npm run typecheck` passed.
- `npx vitest run --maxWorkers=2` in `apps/web` passed: 31 files, 54 tests. `npm run test:unit` at default parallelism timed out starting 15 jsdom workers on a loaded machine; 16 files that started all passed.
- `npx vitest run --project auth` in `apps/api`: 113 passed, 1 failed. The failure is `auth.spec.ts` "does not offer public registration or a production inbox" (403, expected 404). It fails the same way with these changes stashed.
- `npx vitest run --project room test/quiz.spec.ts test/rounds.spec.ts test/troll.spec.ts` in `apps/api` passed: 6 tests.
- `npm run content:check` passed. Birthday reports two incomplete drafts.

### Manual verification

None. No playable pack contains a poll, threshold or typed question yet, so no room has played one end to end.

### Unresolved issues

- `ignorance-triggers` needs the full order. Only the first (conspiracy theories) was supplied.
- `mock-election` lists six parties; the rest do not fit the 6-option limit.
- The new reveal lines use the standard components and are not yet eased; the bespoke designs come next.
- The pre-existing `auth.spec.ts` failure.

### Next stage

Settle the two open questions, then customise each question's design one at a time.

## Birthday answers and long polls

Status: complete. All ten birthday questions validate as ready. None is in the running order, and no room, demo pack or deployment changed.

### Files and interfaces

- `contentLimits.pollOptionMax` (16) in `packages/shared`. Public choice options, attributions, tally and winners allow up to 16; `checkPlayable` keeps an ordinary choice at 6 and lets a poll reach 16.
- `.stage-option-grid` in `apps/web/src/index.css`: the stage shows more than six options in columns, keeping the 40px projector minimum.
- `mock-election` lists 16 parties. `ignorance-triggers` has its order.

### Decisions and defaults

- Humza's trigger order, fastest first: Apple, Palm Beach Pete, politics, conspiracy theories. This replaces the earlier reading of "Conspiracy" as the fastest.
- The higher limit applies to polls only, as Humza asked to raise it for the election.

### Commands and results

- `npm run typecheck` passed.
- `npm run test:unit` passed: 31 files, 54 tests.
- `npx vitest run --project auth test/question-authoring.spec.ts test/quiz-score.spec.ts test/typed-score.spec.ts test/content-preflight.spec.ts` in `apps/api` passed: 31 tests.
- `npx vitest run --project room test/quiz.spec.ts test/rounds.spec.ts test/social.spec.ts` in `apps/api` passed: 10 tests.
- `npm run content:check` passed with no incomplete birthday questions.

### Manual verification

None. The stage grid has not been seen on a projector, because no playable pack contains the election yet.

### Unresolved issues

- The pre-existing `auth.spec.ts` production-inbox failure.
- Every question still uses the standard presentation.

### Next stage

Customise each question's design one at a time, then choose the running order and release a birthday version.

## Custom question designs

Status: complete. All ten birthday questions have their own phone and projector design. None is in the running order, and no room or deployment changed.

### Designs

| Question                   | Presentation    | Phone                                                                        | Projector                                                                      |
| -------------------------- | --------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `favourite-genre`          | `now-playing`   | A playlist; picking a track kicks its equaliser                              | A spinning turntable; the label flips to the winner                            |
| `leviticus-18-7`           | `scripture`     | An illuminated page; a ribbon bookmark follows the pick                      | An open bible swings open; the verse is haloed and the full KJV printed        |
| `car-name`                 | `number-plate`  | UK plates screwed on when picked; "Registered" stamp                         | The back of a car; the right plate flies into the holder and the lights flash  |
| `ignorance-triggers`       | `rage-meter`    | A heat tube; tap a trigger then its heat; true order glides in at the reveal | A rage gauge; triggers drop in from coolest to hottest, the top one boils over |
| `mock-election`            | `ballot-paper`  | A ballot paper with a drawn pen cross                                        | A ballot box filling with papers, then election-night bars and a winner banner |
| `red-pill-blue-pill`       | `red-blue-pill` | Two pills in open palms on a Matrix ground                                   | Code rain; a red/blue split races to the 50% line; the losing side flatlines   |
| `trolley-problem`          | `trolley-lever` | A junction whose points switch with the pick                                 | The room's majority throws the points and the tram rolls up to the junction    |
| `real-name-count-binface`  | `bin-unmasked`  | A nomination paper under a bin-headed candidate                              | The bin is yanked off to unmask the name in a spotlight                        |
| `real-name-zack-polanski`  | `deed-poll`     | A change-of-name deed; "Witnessed" stamp                                     | "Renounced" stamp and the former name typed out                                |
| `real-name-tommy-robinson` | `redacted-file` | A case file; the answer is typed into a redaction bar                        | The redaction bar peels away to declassify the name                            |

### Files and interfaces

- `customPresentationIds` in `packages/shared` is the single list. `apps/api/src/questions/presentation.ts` accepts `standard` plus those ids; `apps/web/src/play/designs/registry.ts` must map every id.
- `apps/web/src/play/presentation.ts`: a phone design receives `phase` and `controls` (open, pending, selectedId, dodge, onSelect, onSubmit, onRank, onText). The stage keeps the standard scoreboard for scores, final, and podium.
- `apps/web/src/play/designs/kit.tsx`: `useDesignMotion`, `choiceView`, `typedView`, `useTypedDraft`, `ChoiceSend`, `TypedSend`, `TypedField`, `StagePrompt`, `QuestionTag`, `Count`, `LiveCount`.
- `assignTier` is exported from `rounds/TierAssign.tsx` for the rage meter.
- `contentColours` in `apps/web/src/theme/themes.ts`: pill red and blue, the Matrix scene, and redaction ink. These are the only colour values outside palettes.
- `@number-flow/react@0.6.2` pinned for rolling counts.
- Development-only bench at `/design` (`designs/preview/`), registered behind `import.meta.env.DEV`. It drives the real `GuestPlay` and `StagePlay` with public fields and a stand-in reveal. `&still=1` sets Motion's `skipAnimations`.
- `.claude/launch.json` starts the web dev server for previews.

### Decisions and defaults

- Every visible change uses Motion springs or eased tweens from `useDesignMotion`. Reduced motion keeps a 0.2s fade and drops movement; CSS loops (equaliser, code rain) run only without reduced motion, and only on the stage.
- Phone controls never loop. Stage decoration may loop.
- Long stage prompts step down a size (`StagePrompt`). Each projector design fits about 1,030px at 1920×1080.
- Stamps and overlays never cover an option or the answer.
- The bench's fixture repeats public prompts and options only; its reveal is a stand-in, so no answer key reaches `apps/web`.

### Commands and results

- `npm run typecheck` passed.
- `npm run test:unit` passed: 32 files, 72 tests, including `designs/designs.test.tsx` (every design on both surfaces at prompt, collect and reveal; choice, typed and ranking interactions; fallback to standard).
- `npx vitest run --project auth test/question-authoring.spec.ts test/content-preflight.spec.ts test/quiz-score.spec.ts test/typed-score.spec.ts` in `apps/api` passed: 31 tests.
- `npm run content:check` passed.

### Manual verification

- Headless Chromium (Playwright) screenshots of every design at 1920×1080 (stage) and 390×844 (phone), collect and reveal, settled with `still=1`: no page errors, no sideways overflow. Phones also checked on the light `pistachio-party` theme.
- The in-app browser pane was hidden, so it ran no animation frames; motion timing itself was not watched live.

### Unresolved issues

- The production build was not run, because it writes to `dist/`. The bench route relies on Vite replacing `import.meta.env.DEV` with `false`.
- No room has played these questions end to end; the birthday pack is still a draft with an empty running order.
- The pre-existing `auth.spec.ts` production-inbox failure.

### Next stage

Choose the running order, then release a birthday version.

## Admin experience and page redesign — planning

Status: planning complete; implementation has not started. User requested a full plan for easier admin access and more thoughtful page layouts.

### Files and interfaces

- Added [docs/admin-experience-plan.md](admin-experience-plan.md): observed issues, public/admin journeys, proposed routes, page compositions, required server interfaces, design constraints, five implementation stages and acceptance criteria.
- No runtime interfaces, application code, dependencies or deployment changed.

### Decisions and defaults

- Proposed home with Join the party and Admin sign in; separate joining and login screens.
- Proposed wide admin workspace with server-backed room discovery/resume, contextual live/player/media/results/health sections and a read-only content overview.
- Preserve email-link authentication, explicit email confirmation, existing credentials/transport/reducer, independent themes and custom question designs.
- Preserve direct QR joins, legacy root room queries and `/host` projector links during route migration.
- Default to one selected control room per browser pending cookie-scope verification. No CMS, auth-method change or remote projector pairing is included by default.

### Commands and results

- Read project instructions, relevant source and existing progress. Reviewed room routes/registry and current auth/credential integration.
- `git status --short` returned no existing tracked changes before writing the plan.
- Application tests and typecheck were not run: this stage changes documentation only. No implementation check is claimed as passed.

### Manual verification

- Chrome: inspected live home and signed-out admin at 1920px wide, including settled session-check state; inspected LifeSmart's public home as a navigation reference.
- Observed stretched guest form, narrow admin frame, development navigation and stale session-check copy after the form became enabled.
- Did not request a login email, authenticate, create a room or change a live game. Signed-in findings are source-based; mobile and projector behaviour were not manually verified.

### Unresolved issues

- Live admin email prefill differs from current source; verify deployed build provenance during implementation without exposing configuration.
- Room discovery/resume needs real server support; tab storage alone cannot provide reliable recovery.
- Existing reported production-inbox auth-test failure has not been re-run or resolved in this planning stage.
- Proposed layouts remain unimplemented and have no visual/browser acceptance yet.

### Exact next stage

Stage A in [docs/admin-experience-plan.md](admin-experience-plan.md): implement the home, dedicated join/login routes, compatibility links and reliable authentication UI states. Stop after its checks and review; do not automatically begin Stage B.

## Admin redesign Stage A — front door and access

Status: complete and locally verified on 19 October 2026; ready for review. Not deployed.

### Files and interfaces

- Public home in `apps/web/src/home`; focused entry frame and theme-aware styling in `apps/web/src/ui/entry-frame.tsx` and `entry.css`.
- Dedicated `/join`, `/play` and `/admin/login` routes; root `?room=` compatibility; direct `/j/:code` preserved. `/screen` aliases the existing projector without changing `/host`.
- Login/session hook, bounded validated auth requests, safe navigation return preference, explicit confirmation recovery, and honest sign-out feedback under `apps/web/src/admin`.
- Existing guest component and room transport retained. Joining now uses the entry frame; the joined guest retains the phone controller. Recovery checks are bounded and uncertain join retries reuse their request id.
- Added home, route, auth UI, auth client and guest-session tests; added `e2e/admin-entry.spec.ts`. Updated existing guest e2e entry URLs for the new home route.
- Added `playwright.dev.config.ts` for browser checks directly against source without a production build.
- Vitest disables Node's native web storage so the browser tests use jsdom's Storage; the shared test setup supplies jsdom's missing `scrollTo` for Motion layout measurements.

### Decisions and defaults

- Keep email-link authentication and existing session expiry, cookies and server policies. Remove the prefilled admin email from public UI.
- Store only an allowlisted admin destination, without queries or tokens, as an optional browser navigation preference. This supports email confirmation opened in another tab; blocked storage falls back to `/admin`.
- Keep existing `AdminLobby` controls for this stage, with a wider frame. Nested workspace navigation and authoritative room discovery remain Stage B.
- Login remains usable while a background session check runs. Auth and guest recovery requests have a bounded wait; failures offer a retry.
- No new dependencies, theme palettes, game logic, question packs, deployments or remote resources. Browser checks use the existing explicit local adapters and local test rooms.

### Commands and results

- Initial `npm run typecheck` could not start because the compiler was not installed.
- Dependency installation on E: was unusually slow (100 small files took about 49 seconds versus 61 milliseconds on C:). Created a temporary verification copy at `C:/Users/Humza/AppData/Local/Temp/26-admin-entry-94b544a3`, excluding secrets and generated directories. `npm ci --ignore-scripts --prefer-offline --no-audit --no-fund` and `npm rebuild esbuild workerd` passed there. The lockfile is unchanged.
- Final source synchronisation checked all 34 changed/new files plus the selected manifests/lockfile: zero hash mismatches. Checks below ran against that matching temporary copy; they are not claimed as runs in the original E: checkout.
- `npm run typecheck` passed.
- `npm run test:unit` passed: 37 files, 106 tests, no skipped tests.
- `npx playwright test --config playwright.dev.config.ts apps/web/e2e/admin-entry.spec.ts apps/web/e2e/shells.spec.ts` passed: 11 browser checks. Covers home choices, compatibility joins, email confirmation in another tab, existing-session reuse, sign-out, local room creation/join, and existing shell routes.
- `git diff --check` passed. No production build or deployment ran.

### Manual verification

- Chrome reviewed the local home, admin login and join pages. Login has an empty email field and an obvious route home; public pages have clear join/admin navigation.
- Browser checks covered widths 320, 390, 768, 1280 and 1920 pixels, with no sideways overflow and bounded form widths. Reduced-motion behaviour checked.
- Saved home, join and login screenshots at 390 and 1920 pixels under `.codex/previews/admin-redesign/` (local ignored previews).
- Local preview is available at `http://localhost:4173/`, served from the matching temporary copy. It does not watch edits in the E: checkout. Normal development remains `npm run dev` after the checkout's dependencies finish installing.

### Unresolved issues

- Dependency installation in the original E: checkout remained slow at completion; the verified temporary copy supplies the running preview.
- Production email delivery and deployed build provenance are outside local verification.
- The pre-existing reported production-inbox `auth.spec.ts` failure was not rerun or resolved. This stage's browser checks exercise the explicit local inbox only.

### Exact next stage

Review Stage A. The exact next implementation stage is Stage B in [docs/admin-experience-plan.md](admin-experience-plan.md): recoverable admin workspace, authoritative room discovery/resume and contextual sidebar navigation. Do not begin it automatically.

## Admin redesign Stage B — recoverable workspace

Status: complete and locally verified on 19 October 2026; ready for review. Not deployed.

### Files and interfaces

- Wide shared shell and responsive contextual navigation in `apps/web/src/ui/admin-shell.tsx` and `admin.css`. Distinct overview (`/admin`), full saved-room list (`/admin/rooms`), room overview (`/admin/rooms/:gameId`), existing live controls (`/live`) and account/appearance (`/admin/settings`). Protected deep links preserve their destination and pages identify their location in the title/navigation.
- `rooms-page.tsx` provides server-backed room discovery, current selection, creation, older pages, real room state/connections, guest link/QR and stage link. The home overview limits recent entries; Rooms provides full pagination. Empty, missing, expired, stale-tab and network states have recovery routes.
- One `room-provider.tsx` owns the snapshot, socket lifecycle, command pending state and feedback across nested room sections. `AdminLobby` now consumes that provider; its individual copies of snapshot fields and separate socket/storage restore were removed. Its existing controls remain available for Stage C's layout work.
- Shared `adminRoomListSchema`; authenticated `GET /api/admin/rooms` (`cursor`, `limit` 1–50), `GET /api/admin/rooms/current`, `GET /api/admin/rooms/:gameId` and idempotent `POST /api/admin/rooms/:gameId/resume` (`requestId`). The existing registry supplies stable keyset pages. The room DO supplies current snapshots and persisted renewed credentials.
- `admin-routes.ts` reuses existing authentication, credential preparation, validation and receipt/storage mechanisms. Existing creation records a selected-room hint and releases the browser's previous scoped access. No new database schema, room directory, scheduler, socket client or game engine.
- New UI tests `admin-shell.test.tsx` and `rooms.test.tsx`; Worker tests `admin-rooms.spec.ts`; authentication-boundary tests `admin-rooms-auth.spec.ts`; browser flow `e2e/admin-room-recovery.spec.ts`. Existing entry/shell/quiz/media/dense-lobby checks navigate the new room routes. Dense-lobby setup uses the verified room URL instead of removed tab storage.

### Decisions and defaults

- A registry list contains identity, join code and creation time only. Phase and player/connection counts are fetched authoritatively on opening a room; listing does not fan out to every game object. Dashboard selection details explicitly describe a last check; the room overview updates through the live socket.
- Browser-wide root-scoped control/presentation cookies mean one selected control room per browser. Switching is explicit, preserves game data/other operators/guest access, revokes only the previously presented browser credentials, and closes matching sockets. Expired/revoked sockets cannot receive later snapshots. Stage access in that browser may need reconnecting after a switch.
- `26_admin_room` is an HttpOnly location hint checked against actual scoped control credentials. It grants no access. Optional tab notifications improve stale-tab feedback; server verification/revocation remains authoritative. `26-lobby` tab storage is no longer used to recover admin rooms.
- Resume retries reuse a persisted request receipt and return the same still-valid credentials; the snapshot/time remains current. A revoked/expired receipt requires a fresh explicit opening. No game phase, score, player, content version or bootstrap is reset during recovery.
- Canonical guest links/QR now use `/j/:code`; old root query links remain supported. Reused the existing QR renderer and shared dialog.
- Local Vite auth middleware excludes `/api/admin/rooms` so those requests reach the real Worker/DO. Browser checks explicitly set `LOCAL_DATABASE_ID` to use the existing ephemeral local auth adapter, avoiding a damaged development database without reading/resetting its data. Production auth paths are unchanged.
- No dependencies/lockfile, question content, themes, remote resources or deployments changed. Remaining section navigation appears when those sections are implemented; no placeholder metrics or unsupported page actions were added.

### Commands and results

- `npm run typecheck` passed in the original E: checkout. `npm run test:unit` passed there: 39 files, 114 tests, no skips.
- After the final canonical QR-link change, both commands also passed against the matching C: verification copy used in Stage A (39 files, 114 tests). Source was synchronised with zero hash mismatches before validation.
- In `apps/api`: `npx vitest run --project room test/admin-rooms.spec.ts test/room.spec.ts test/phase.spec.ts test/operations.spec.ts --project auth test/admin-rooms-auth.spec.ts test/credentials.spec.ts` passed: 6 files, 39 tests. Covers registry paging/empty state, saved credentials, current state, missing room, expiry/revocation, old socket replacement, authentication and origin boundaries, plus existing lifecycle/operations.
- Browser regression command: `npx playwright test --config playwright.dev.config.ts apps/web/e2e/admin-room-recovery.spec.ts apps/web/e2e/admin-entry.spec.ts apps/web/e2e/shells.spec.ts apps/web/e2e/quiz.spec.ts apps/web/e2e/media.spec.ts apps/web/e2e/lobby-layout.spec.ts --workers=1`. The latest combined run passed 16 of 17 cases. The full quiz needed further selector updates, then `npx playwright test --config playwright.dev.config.ts apps/web/e2e/quiz.spec.ts --workers=1` passed (38.9 seconds). All 17 distinct flows have now passed across those runs; no claim of a single all-green 17-case run. Recovery/responsive cases also passed again after the final navigation transition change.
- Updated older browser selectors to distinguish the account/main phone status from toast messages, the phase animation wrapper from a hidden phase marker, photo Send from Send troll, and ballot search from troll search. Ballot-order equality after reload now waits for the animated controls to mount and still checks the full saved order. No assertions/cases were removed or skipped. The quiz verifies scoring, phase controls, reload recovery, voting, player guesses, duels, final podium and public/private separation across three phones.
- `git diff --check` passed; lockfile unchanged. No production build or deployment.

### Manual verification

- Reviewed saved 390px and 1920px screenshots. Corrected join-code contrast to use the theme foreground and compacted phone navigation/account chrome. Responsive browser checks cover 320, 390, 768, 1280 and 1920px with reduced motion and no horizontal overflow.
- Saved room list and connected room-overview screenshots at 390px and 1920px under `.codex/previews/admin-redesign/`. The browser checks wait for the live connection before capturing the overview. The shared guest QR uses the direct join link and its dialog was checked in the recovery flow.
- The review preview is served from the matching temporary source copy at `http://localhost:4173/admin`. It uses an explicit ephemeral local auth database and does not watch edits to the E: checkout. Use the local captured sign-in confirmation to enter; normal project development remains `npm run dev`. The source changes are saved in the original project.

### Unresolved issues

- Production email delivery, deployed build provenance and remote existing-room recovery are not verified by local tests. The previously reported production-inbox `auth.spec.ts` failure was not rerun or resolved.
- Full live/player page composition and command confirmation/retry improvements belong to Stage C. Media/results/content/health navigation and their tailored layouts remain Stage D. Projector presentation work remains Stage E.

### Exact next stage

Review Stage B after its final checks. The next implementation is Stage C in [docs/admin-experience-plan.md](admin-experience-plan.md): live desk and player tools, with deliberate command confirmations and scoped feedback. Do not start it automatically.

## Admin redesign Stage C — live desk and player tools

Status: complete and locally verified on 19 October 2026; ready for review. Not deployed.

### Files and interfaces

- `apps/web/src/admin/live-console.tsx` replaces the long host deck with the current question/phase, server-based countdown and submissions, contextual moderation, room context and persistent main action. Phase-specific controls, deliberate Skip/Finish confirmations, private presenter notes and guarded shortcuts use existing actions. `admin-lobby.tsx` is a compatibility re-export.
- `players-page.tsx` adds `/admin/rooms/:gameId/players`: searchable stable-ID rows with connected/removed/score/available answer state, and an adjacent individual workspace. Nickname, Phones, Score and Remove buttons show one task at a time: rename/swap, transfer, signed score changes with reason/history, kick and removed-player recovery. One-use codes are private, hideable and tied to the selected record.
- `room-provider.tsx` remains the single room state/socket owner, now centralising command intents, scoped feedback, uncertain retries and private code display. `command-feedback.tsx`, `command-notices.ts` and `room-extras.tsx` preserve messages and occasional health/download/archive/email/media recovery. Unsupported placeholder media/effect buttons were removed.
- `apps/api/src/room/admin-players.ts` and the existing control snapshot add optional shared `adminPlayers`: stable identity, stored nickname, ledger-plus-adjustment total, live connected state, removed state and nullable answer state. Guests/projector omit it. No database migration or new score engine.
- `live/room-api.ts` bounds play/transfer requests and decoding at twelve seconds. `live/use-phase-countdown.ts` extracts the existing server-deadline display from Stage, without calculating phases. Routes, navigation/title, `ui/admin.css` and shared `ConfirmDialog`/`Disclosure` provide responsive composition, focus restoration and reduced-motion transitions.
- New tests: `admin/live-console.test.tsx`, `admin/players-page.test.tsx`, `live/room-api.test.ts`, `controls.test-support.tsx`, `e2e/admin-live-controls.spec.ts`; private projection regression added to `apps/api/test/admin-rooms.spec.ts`. Existing shell/quiz tests use focused player tasks and confirmed final action. Admin, room and UI READMEs updated.

### Decisions and defaults

- HTTP receipts provide feedback; authoritative snapshots update phase, score and player data. One in-flight intent blocks duplicate clicks. Network failures, invalid successful responses and server failures retain the exact intent/request ID for explicit Retry; replacement commands remain blocked. Pending/uncertain feedback follows navigation across the mounted room provider. Refresh reads current server state and never automatically replays commands. Private intents/codes are not persisted in browser storage.
- Skip/Finish confirmations recheck question/phase. Player confirmations recheck stable ID, nickname, removed state and swap target. Changed context disables confirmation. Final Finish uses the same review; ordinary Finish preserves finish-after-question semantics.
- Shortcuts ignore repeat/modifier events, typing/contenteditable targets, open dialogs, disconnected state and pending/uncertain commands. Right arrow resumes a paused game and reviews Finish on the final screen. Player pages register no live shortcuts.
- Scores read existing accepted ledger/adjustment records. Older snapshots label unavailable details accurately. Public projections exclude removed records, private reasons, codes and host fields. The Worker test verifies persistence after eviction and that idempotent score retries do not duplicate the adjustment.
- Active effects, announcement dismissal and urgent accepted-media Hide stay on Live. Occasional records/recovery remain reachable under a disclosure until Stage D. No new dependency, theme, question content, auth policy, remote resource or deployment.

### Commands and results

- `npm run typecheck` passed in the original E: checkout after the final provider loading-state cleanup.
- `npm run test:unit` passed in the original checkout: 42 files, 131 tests, no skips. New tests cover transport timeouts/ambiguous responses, authoritative reconnect state, same-ID retry, phase actions, stale confirmations, private codes and validated score changes. A harness race was fixed by awaiting socket subscription before simulating connection.
- In the matching C: verification copy: `npx vitest run --project room test/admin-rooms.spec.ts test/room.spec.ts test/phase.spec.ts test/operations.spec.ts --project auth test/admin-rooms-auth.spec.ts test/credentials.spec.ts` passed: 6 files, 40 tests. Includes existing host actions/auth boundaries and new private player projection regression.
- `npx playwright test --config playwright.dev.config.ts apps/web/e2e/admin-live-controls.spec.ts apps/web/e2e/admin-room-recovery.spec.ts apps/web/e2e/admin-entry.spec.ts apps/web/e2e/shells.spec.ts apps/web/e2e/quiz.spec.ts apps/web/e2e/media.spec.ts apps/web/e2e/lobby-layout.spec.ts --workers=1` passed all 18 cases in one run (1.8 minutes): entry, dense lobby, full quiz with three phones, media, discovery/recovery, rename/score/transfer/kick/recover, pause/reload/resume, finish/podium and projector frame exclusion.
- After the final provider loading-state cleanup, `npx playwright test --config playwright.dev.config.ts apps/web/e2e/admin-live-controls.spec.ts apps/web/e2e/admin-room-recovery.spec.ts --workers=1` passed again: all 4 cases, 37 seconds.
- Targeted ESLint across ten changed production modules passed with zero errors and one existing Fast Refresh organisation warning for the provider's exported hook. Synchronous loading updates were moved out of the initial effect; no rule was weakened.
- Public changed source was copied to the C: verification checkout with zero hash mismatches before the combined browser run. Final provider/test support changes were copied before their targeted checks. Screenshots are ignored local previews. `git diff --check` passed. No production build/deployment.

### Manual verification

- Reviewed Live at 1280px and Players at 390px/1920px. Replaced the initially long player detail form with task buttons and reviewed the improved captures.
- Browser checks cover 320, 390, 768, 1280 and 1920px with reduced motion and no sideways scrolling. At laptop/desktop widths the main live action is in the viewport and the current question starts above 650px. Cancelling a confirmation restores trigger focus.
- Chrome reviewed local sign-in/resume and selected player Nickname/Score panels. Populated Live/Players captures at 390, 1280 and 1920px are under `.codex/previews/admin-redesign/`.
- Try `npm run dev`, sign in through the explicit local inbox, open a room, and select Live controls or Players. Local browser verification uses the existing explicit ephemeral auth adapter; normal development retains its configured database. The review preview at `http://localhost:4173/admin` uses the matching C: copy and does not watch the E: checkout.

### Unresolved issues

- Production email delivery, deployed build provenance and real venue/device behaviour remain unverified. The pre-existing production-inbox auth test issue was outside this stage. Local startup logs the existing development database schema diagnostic before the explicit isolated auth adapter is used; no private database files were opened or reset.
- Dedicated Media, Results, Content and Health layouts/interfaces remain Stage D. Projector setup/presentation polish remains Stage E.

### Exact next stage

Review Stage C. Next is Stage D in [docs/admin-experience-plan.md](admin-experience-plan.md): dedicated Media, Results, Content and Health pages, their backing interfaces, and public results composition. Do not begin automatically.

## Admin redesign Stage D — media, results, content and health

Status: complete and locally verified on 19 October 2026; ready for review. Not deployed.

### Files and interfaces

- Dedicated room `/media`, `/results` and `/health` pages, plus global `/admin/content` (Question packs), are registered in `routes.tsx` and contextual navigation/title handling. All room pages retain the existing provider/socket. Live keeps urgent media/effect controls and links to occasional tools; the former records disclosure is replaced by those destinations.
- `admin/media-page.tsx` provides an accepted-photo grid and labelled opt-in voice controls, owner/status, hidden filter, failed-preview retry and real Hide commands. Metadata pages contain up to 50 records with an Older/Newest cursor. Filters apply to that page. `ui/media-preview.tsx`/CSS is shared with public results; hidden items create no preview element and audio never autoplays.
- New authenticated `GET /api/admin/rooms/:gameId/media?cursor=…` and `GET /api/admin/rooms/:gameId/media/:mediaId` use the current admin session and verified scoped control credential. `room/admin-media.ts` reads existing accepted SQLite records; `PartyRoom.adminMediaPage` enforces scope. Previews reuse the existing media reader/R2 adapter and no-store headers. A stale guest cookie does not override operator access. Hidden media stays unavailable, including to the operator. No object keys/credentials are projected.
- `admin/health-page.tsx` gives live connection state and a timestamped diagnostics report for scheduler, processing, archive and delivery. Unavailable counts stay unavailable; failed refreshes retain a clearly stale last check and disable recovery. Existing release/retry commands require review and use shared pending/error/same-ID retry feedback.
- `admin/results-page.tsx` composes live totals or authoritative final standings, highlights, archive status/retry, public report link and bounded score-summary download. Delivery links to Health; personal results stay separate. No browser score/rank calculation is added.
- `room/admin-content.ts` supplies authenticated read-only `GET /api/admin/content`. Shared strict schemas live in `packages/shared/src/admin.ts`. The explicit projection contains pack identity/release state and question title/prompt/mechanic/presentation/status/order/recorded missing requirements. It excludes answer/truth, presenter notes and reveal fields. `content-page.tsx` shows the catalogue and on-page authoring workflow without edit, reorder, start or release controls.
- Public `/r/:gameId` now uses the entry frame and report composition: podium, broad standings/highlights, shared moments, retention information and separately labelled private result/email form. `results-report.tsx` and `results.css` retain server positions, including equal visual treatment of ties. Invalid IDs, unknown/preparing archives, read failures and retries have useful copy instead of old scaffold claims.
- `api/read-data.ts` and `api/use-resource.ts` provide bounded validated reads and ignore stale/out-of-order responses. They hold section resources only; no new room store/socket. Command scopes now cover Media, Results and Health. `vite.config.ts` routes the new content endpoint to the real Worker rather than the local auth middleware.
- Tests added alongside work: `admin/media-page.test.tsx`, `health-page.test.tsx`, `content-page.test.tsx`, `results-page.test.tsx`, public `results/results-page.test.tsx`, transport/resource lifecycle tests and `e2e/admin-sections.spec.ts`. Existing API auth/room/results tests cover new projection boundaries, pagination, hidden bytes and unavailable archive reads. Existing shell expectations now check actual results states.

### Decisions and defaults

- Reuse existing authentication, command receipts, diagnostics, accepted-media checks, archive projection, RLS and delivery semantics. No database migration, new scoring engine, dependency, resource creation, question edit/release or deployment.
- The media list refreshes on relevant live projection/command changes and offers explicit Refresh for all newer records beyond the 20-item live projection. Rejected/stuck processing belongs to Health. No unsupported restore/unhide control is offered.
- Health counts describe the last successful read. Connection counts remain socket-owned. Retry explanations distinguish expired media leases, archive export and uncertain provider delivery; no invented recipient list or success count.
- Readiness means recorded authoring requirements, not a claim that every deployment asset is available. The existing birthday pack remains draft with its unchanged running order and catalogue; rooms still keep stored versions.
- A verified archive whose publication cannot be read now returns preparing instead of an empty ready result. The public page offers another check without exposing database failures. This is covered for both a failed read and a missing publication. Optional email requests preserve entered values and never claim delivery from a failed HTTP response. Changing the game/recap identity clears old private results. Verification cleanup preserves an independent recap query.

### Commands and results

- `npm run typecheck` passed in the original E: checkout.
- `npm run test:unit` passed: 49 files, 151 tests, no skips. Covers all required Stage D UI files, public/private composition, archive preparing/failure/retry, no autoplay, hidden/failed previews, unavailable counts, same shared mutation path, bounded reads and stale-response exclusion. The pre-existing stale-tab shell test now waits for its socket subscription before emitting the simulated storage event, fixing a harness race without weakening its assertions.
- In the matching C: verification copy, `npx vitest run --project room test/admin-rooms.spec.ts test/media.spec.ts test/operations.spec.ts test/results-room.spec.ts --project auth test/admin-rooms-auth.spec.ts test/results.spec.ts` passed: 6 files, 33 tests. Runtime output included workerd/Vitest shutdown `EnvironmentTeardownError` diagnostics after test execution; exit status was zero and all assertions passed. No error filter or test was weakened.
- Targeted ESLint across the eleven new/changed production modules passed with zero errors/warnings. The resource lifecycle was corrected to perform effect-triggered updates in asynchronous response callbacks rather than disabling the React rule.
- `npx playwright test --config playwright.dev.config.ts apps/web/e2e/admin-sections.spec.ts apps/web/e2e/admin-live-controls.spec.ts apps/web/e2e/admin-room-recovery.spec.ts apps/web/e2e/admin-entry.spec.ts apps/web/e2e/shells.spec.ts apps/web/e2e/quiz.spec.ts apps/web/e2e/media.spec.ts apps/web/e2e/lobby-layout.spec.ts --workers=1` passed all 19 cases in one run (2.3 minutes). Includes a real upload/protected preview/hide/denied later read, three guests, finish/archive/public report, recognised personal result, draft restrictions and prior entry/live/recovery/full-quiz/media regressions.
- Final copy adjustments clarify archive read unavailability and remove technical question IDs from displayed best-answer text; unit/type checks rerun afterwards. Public source synchronised to the C: copy with zero hash mismatches. `git diff --check` passed. No production build or deployment.

### Manual verification

- Checked loaded Media, Health, admin Results, Question packs and public Results layouts at 320, 390, 768, 1280 and 1920px with reduced motion and no horizontal overflow. Screenshot checks wait for the correct page heading, completed resource check and full entry-frame opacity; initial transitional captures were replaced.
- Reviewed Health at phone width, the full desktop catalogue and the public report. Corrected tied podium styling so equal positions share treatment. The public page has no admin navigation; private personal results remain in a distinct section.
- Chrome reviewed local sign-in and the real read-only birthday catalogue, showing draft status, unchanged order and authoring workflow. Left the catalogue open for review.
- Loaded screenshots at 390 and 1920px are saved under `.codex/previews/admin-redesign/`: `media-*`, `health-*`, `content-*`, `admin-results-*`, `public-results-*`. These are ignored previews.
- Try `npm run dev`, use the local sign-in confirmation, open a room and choose Media, Results or Health; Question packs is global. The running review preview is `http://localhost:4173/admin`, served from the matching C: copy with the existing explicit ephemeral local auth adapter. It does not watch E: checkout edits.

### Unresolved issues

- Production mail/provider delivery, deployed build provenance and real venue/device behaviour remain unverified. The existing local database startup schema diagnostic and earlier production-inbox auth-test issue are unchanged; no private database files were opened/reset. Cloudflare test-runtime shutdown diagnostics are recorded above.
- The catalogue is deliberately read-only and no birthday version was released. Interface readiness does not certify remote assets or live venue connectivity.

### Exact next stage

Review Stage D. Next is Stage E in [docs/admin-experience-plan.md](admin-experience-plan.md): separate projector setup/presentation, whole-site responsive polish and the controller/presenter rehearsal. Do not begin automatically.

## Admin experience Stage E — complete locally (19 October 2026)

### What now works

- `/screen` and the compatible `/host` have focused setup: connect, optionally enable local sound/full screen, then explicitly present. Present requires an open scoped stage socket. It does not start the quiz or force full screen. Failed lookups preserve the entered code and stop after twelve seconds.
- Presentation separates lobby invitation/names from the live question, compact timer, options, public media, standings and room footer. It uses the existing theme palette/skin. Site navigation, forms, internal audio/connection diagnostics, operator HUD and host-command shortcuts are absent. F, M and Escape act locally on display/sound only.
- Disconnect/replacement hides stale questions behind a public reconnect state. Private recovery guidance stays in setup; reconnecting the same room opens a fresh scoped socket after renewed access. A guest identity or join code does not confer presentation authority. Host hiding removes question/media/cues and mutes local audio.
- Escape, the setup control and leaving browser full screen return to setup with keyboard focus restoration. Presentation receives focus without projecting a browser focus box. The operator return control retains ordinary-sized text and no longer covers answer options.
- Admin breakpoints respond to available workspace width, including 200% zoom. Home columns fit naturally and its ticket mark is readable. Setup stacks on narrow/zoomed displays. Standard stage options use columns; the custom question kit wraps/stacks its existing compositions on narrow screens while retaining each design's identity.
- Stage phase changes show the current server snapshot immediately with a short, almost-opaque fade. An outgoing animation cannot retain the old phase heading. Reduced-motion phone transitions also retain a brief fade without movement.

### Files and interfaces

- Added `apps/web/src/stage/stage-presentation.tsx`, `projector.css`, `stage-page.test.tsx` and `apps/web/e2e/admin-stage-flow.spec.ts`.
- Updated the existing stage page, countdown (`compact`), fullscreen wrapper (`controls`/`onExit`), fullscreen adapter (`exitStageFullscreen`), local audio hook/captions, shared phase transition (`stage`), safe-area palette/type tokens, standard option layout and bounded stage lookup. Reused the socket, credentials, countdown and sound adapters; no new state store or server mutation interface.
- Updated shared entry/admin CSS, the question design kit and development-only stage preview, projector README, phase/safe-area/lookup tests and existing browser expectations for Connect then Present. The quiz test explicitly waits for the phone slider to become enabled before keyboard input: keyboard events do not wait for readiness like clicks/fills do.
- No dependencies, question content, running order, pack versions or scoring rules changed in Stage E. Prior A–D work remains intact and uncommitted.

### Decisions and defaults

- Same-browser projector access retains the existing scoped presentation cookie. A separate presenter computer needs a deliberate pairing feature; this stage does not make a join code authoritative.
- Full screen is optional and separate from Present. Browser refusal never blocks presentation. Audio stays local/optional, stops outside presentation or on disconnect/hide, and does not catch up past cues. Audio unlocking is not a promise of venue audibility.
- Colours come from `theme/themes.ts`. Guest-facing stage body text remains at least 40px, standard prompts 72px and the timer 120px; custom designs retain their existing readable hierarchy. The inset is 5vh vertically and 5vw horizontally, at least 1rem. Long reveals/narrow previews may scroll vertically rather than clip content or shrink readable type.
- No deployment, paid resource creation, content release or unrelated remote change.

### Commands and results

- `npm run typecheck` passed in the original E: checkout.
- `npm run test:unit` passed in E: 50 files, 159 tests, no skips. Includes scoped connection/preflight, failure/retry, stale-content exclusion, hiding/audio, replacement/reconnect, display-only keys, focus/fullscreen return, bounded lookup, safe-area/contrast and immediate readable phase changes.
- Targeted ESLint across fifteen Stage E production/test modules passed with zero errors/warnings. The separately checked `play/stage-play.tsx` retains its existing fast-refresh warning for the exported `outcomeLine` helper; no lint rule was disabled. Targeted Prettier checks and `git diff --check` passed.
- Safe changed source files matched the C: verification copy with zero hash mismatches before the final browser run.
- From `apps/api` in that copy: `npx vitest run --project room test/phase.spec.ts test/stage-effects.spec.ts test/admin-rooms.spec.ts --project auth test/credentials.spec.ts test/admin-rooms-auth.spec.ts` passed 5 files / 26 tests. An existing dependency sourcemap warning was printed; no shutdown error occurred in this run.
- Final browser run: `npx playwright test --config playwright.dev.config.ts apps/web/e2e/admin-stage-flow.spec.ts apps/web/e2e/admin-sections.spec.ts apps/web/e2e/admin-live-controls.spec.ts apps/web/e2e/admin-room-recovery.spec.ts apps/web/e2e/admin-entry.spec.ts apps/web/e2e/shells.spec.ts apps/web/e2e/quiz.spec.ts apps/web/e2e/media.spec.ts apps/web/e2e/lobby-layout.spec.ts --workers=1` passed all 21 cases together (2.8 minutes).
- Early runs caught zoom overflow, an oversized return control, narrow ballot/name reveals, delayed phase headings and an early keyboard interaction with a disabled phone slider. These were fixed. No assertion, test or error filter was removed to obtain the final pass. Making full screen deliberate also prevents native full-screen window resizing from interfering with responsive browser checks.

### Manual and browser verification

- Checked 320×800, 390×844, 768×900, 1280×800, 1440×900 and 1920×1080 across home, join, room discovery/overview, live, players, content, media, results, health and projector setup/presentation, plus 200% CSS zoom at 1440×900 and reduced motion. No sideways scrolling. Standard projector prompts/options are fully in view at laptop/desktop sizes. Long pages retain vertical scrolling.
- All ten real question designs checked in collect/reveal: phones at 320/390 and stage previews at 320/768/1280/1920, covering 120 combinations. Readable prompt type, visible content, full-opacity resting state and overflow checks passed. The development-only preview uses stand-in reveals and the shared stage frame; it publishes no questions or real answers.
- The real Worker/DO rehearsal covers admin sign-in/create, guest join, restricted projector access, display-only keys, setup/presentation focus, optional full screen, pause/resume, guest reload, admin reload, stage hiding, finish/archive and public results. The existing three-phone quiz reaches the podium with its answer/reveal/recovery checks intact.
- Chrome inspected home and the real design preview. Reviewed saved setup, laptop question, zoomed home, narrow phone and custom reveal screenshots. Removed duplicate pause display and corrected oversized return text after visual review.
- Screenshots are in the ignored `.codex/previews/admin-redesign/` folder: `projector-setup-*`, `projector-lobby-*`, `projector-question-*`, `projector-zoom-*`, `polish-*`, `zoom-*` and `design-<id>-<surface>-<phase>-<width>.png`. They contain local demo/preview data.
- Review preview: `http://localhost:4173/`, served from the matching C: copy with the explicit ephemeral local auth adapter (`LOCAL_DATABASE_ID=browser-checks`). Open Admin, use the local sign-in confirmation, create/resume a room, then Open projector → Connect room → Present on this screen. F/M/Escape work while presenting. The preview does not watch E: edits; normal project development remains `npm run dev`.

### Unresolved verification and continuation

- Venue projector/speaker checks remain: physical readability, brightness, overscan, audible cues, real-device browser audio/fullscreen policy, native browser zoom/OS scaling and room Wi-Fi. Automated 200% checks use CSS zoom and narrow viewport reflow; they do not certify physical checks.
- Production mail/provider delivery and deployed provenance remain unverified. Existing local Better Auth schema-startup diagnostics and design-route hydration/reduced-motion development notices remain; the explicit local adapter and functional assertions passed. No private database files were opened or reset.
- The user-requested conditional continuation heartbeat `resume-stage-e-after-usage-reset` was created for 18:38 London, shortly after the reported reset. Work finished without exhausting usage; it is now PAUSED so it cannot duplicate completed work or start another stage. No credits were bought or reset credits spent.

### Exact next stage

Review Stage E, then rehearse on the actual venue projector, speakers and phones. Stages A–E of the admin plan are implemented locally. There is no automatic next implementation stage or deployment; await the user's next instruction.

## Birthday question batch — 19 October 2026

The completed admin redesign was committed separately as `4ebe630` (`Redesign admin workspace and projector experience`). This batch adds seven server-side question files and registers them in the existing birthday catalogue, preserving the demo, empty running order, pack version and room state.

### Catalogue entries

| Id                      | Mechanic/status                          | Recorded facts or remaining work                                                                                                                                                                                             |
| ----------------------- | ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `favourite-pokemon`     | Choice / ready                           | Supplied options preserved; Mudkip is correct.                                                                                                                                                                               |
| `how-italian-is-humza`  | Choice / ready                           | Supplied options preserved; 0.5% is correct.                                                                                                                                                                                 |
| `inflation-freddo`      | Slider / draft                           | Confirmed: show 2012 price and guess 2026. Needs actual prices/dates, Freddo size/location/units and slider bounds.                                                                                                          |
| `inflation-petrol`      | Slider / draft                           | Same confirmed direction. Needs fuel grade/location/units, actual prices/dates and slider bounds.                                                                                                                            |
| `christianity-branches` | Multiple-selection requested / draft     | User confirmed ARE, with Muggletonians, the Jumpers and Ranters selected. Current single-correct-choice schema cannot represent that set; the answer set is preserved in private notes and an explicit mechanic requirement. |
| `common-password`       | Room-frequency ranking requested / draft | User confirmed matching other guests' made-up passwords. Needs matching/tie rules, points schedule and an authoritative ranking mechanic. No real-password or third-party popularity dataset is used.                        |
| `complete-a-wordle`     | Wordle requested / draft                 | Encore located beside 26. Needs a repeated-guess mechanic, target word and attempt/time/scoring rules.                                                                                                                       |

The password/Wordle files use blocked typed authoring placeholders, and Christianity uses a blocked choice placeholder. These do not claim to implement the requested mechanics: explicit requirements and missing answer representations prevent them from becoming playable accidentally. This follows [docs/question-authoring.md](question-authoring.md): unsupported interactions are saved as drafts rather than forced into unrelated mechanics or a new score engine. No missing prices, Wordle target or scoring rules were invented.

Encore was read only at `../Encore`: `packages/game-glyph/src/mark.ts`, `play.ts`, `glyph-game-module.ts`, dictionary licence, tests and `apps/web/src/games/glyph-board.tsx`. Its root licence is MIT, copyright 2026 Encore contributors; copied substantial code must preserve its notice and dictionary attribution. No code has been copied yet. The draft records the useful source locations and the need to keep its answer-bearing puzzle/play state server-side when porting. Encore was not modified.

### Verification

- `npm run content:check` passed after the confirmed rules were applied. Both packs validate; the five incomplete entries are deliberately reported as drafts.
- `npm run typecheck` passed in E: and in the verification copy.
- `npx vitest run --project auth test/question-authoring.spec.ts` passed in E: and the matching C: copy: 24 tests. Covers supplied options/answers/defaults, blocked unsupported mechanics, confirmed direction/answer set, public answer-key exclusion, catalogue registration and unchanged release/running order/demo.
- Earlier combined authoring/admin access checks passed 3 files / 34 tests in the C: copy before the latest wording clarifications. The final authoring-only run above covers those clarifications.
- Targeted ESLint passed for the eight question/manifest modules and authoring tests. `git diff --check` passed.
- Final web unit runs passed: 50 files / 159 tests in the verification copy, and 50 files / 161 tests in E:. The E: run completed successfully between polls (144 seconds); it was not interrupted. Its extra read-helper tests belong to concurrent work excluded from this content commit. The owned question files and authoring tests were synchronised to the copy before verification. E: content, type and authoring checks above also completed successfully.

### Scope and next work

Only the new question files, birthday manifest, authoring tests and this progress entry belong to the content commit. Other concurrent auth/API/read-helper changes are left untouched. Nothing was pushed, deployed, released or inserted into an active game. Ready means content-ready in the catalogue, not live.

Next: supply/source the specified prices and define/build the Wordle, room-frequency ranking and multiple-selection support within the existing authoritative architecture. Then validate ready questions, explicitly include them in the running order and release a new birthday version separately. Do not silently repoint existing rooms or the illustrative demo.

## Individual question inspection — 19 October 2026

Status: implemented. Admin → Question packs now links each question title to its own read-only page at `/admin/content/:version/:questionId`. The page shows wording, instructions, options or ranking items, settings, readiness gaps and media requirements. Answer rules, reveal explanations and author notes are in a deliberately closed disclosure. Back returns to the selected pack; refresh and direct links work, including returning to a question after sign-in.

### Interfaces and decisions

- Added `adminQuestionDetailSchema` / `AdminQuestionDetail` in shared validation, the server-only `admin-question.ts` projection, and authenticated `GET /api/admin/content/:version/questions/:questionId`. Authentication precedes lookup; responses are uncached. Unknown questions return JSON 404. The existing pack-list projection remains answer/notes/reveal-free. Raw authored objects and media paths are never serialised by this endpoint.
- Added `question-page.tsx`, inspector styles and a bounded `readQuestion` helper using the existing read lifecycle. Pending, failed and superseded requests cannot show the previous question's private details. Navigating resets the answer disclosure. The existing admin shell retains active navigation and the inspector owns its document title and heading focus.
- Extended the strict post-login destination whitelist for question links, and kept the local auth middleware from intercepting content subroutes, matching the existing content-list behaviour. Questions remain versioned server-side files; this adds no editor, release action, live-game change or new question mechanic.
- Coverage: API authorisation/cross-origin/guest exclusion, uncached responses, missing questions and draft targets, projections across all eight catalogue mechanics; UI loading/error/retry, response races, disclosure reset, focus, content links and safe return paths; browser inspection and responsive checks.

### Verification

- Final `npm run typecheck` passed in E: and the matching C: verification copy, including the local-middleware adjustment.
- E: `npm run test:unit -w @26/web -- --maxWorkers=2` passed: 51 files / 169 tests. The initial unrestricted E: run hit 15 worker-start timeouts and an existing phase-animation timing failure under load; checks were retained and the complete suite passed with bounded concurrency.
- Final C: `npm run test:unit` passed 51 files / 169 tests; `npm run test -w @26/api -- test/admin-rooms-auth.spec.ts` passed 10 tests, including all catalogue mechanics. All changed source files matched E: by hash. The copy was fully refreshed after discovering its unchanged read-error helper lagged behind the committed source.
- Targeted ESLint passed with zero errors; the existing routes-module fast-refresh warning remains. Targeted Prettier checks and `git diff --check` passed.
- Final `npx playwright test --config playwright.dev.config.ts apps/web/e2e/admin-question-details.spec.ts apps/web/e2e/admin-entry.spec.ts --workers=1` passed all 6 cases. Covers sign-in return, direct reload/title, deliberately closed answers, keyboard entry from the list, all 17 birthday questions, missing-question JSON and visible error, anonymous denial, selected-pack return, six viewport sizes and 200% CSS zoom. Early runs caught assertions made before focus/list updates, reuse of a consumed mock response and the stale verification helper; no checks were removed or weakened.
- Chrome confirmed direct-link sign-in returns to the requested question, renders its actual options/settings, and returns to the selected birthday pack. Browser screenshots cover 320, 390, 768, 1280, 1440 and 1920px, reduced motion and 200% CSS zoom. The birthday catalogue remains draft, with no running-order or release changes.
- Existing local Better Auth schema-startup and Motion reduced-motion diagnostics still appear in development; the explicit local auth adapter and functional assertions pass. Deployed authentication and production routes were not tested. Media inspection shows supplied/missing metadata, not playback or image previews.

### Scope and next work

No deployment, push or commit was performed for this request. Normal development: `npm run dev`, then Admin → Question packs → a question title. Editing questions and supplying the outstanding content/mechanics remain separate work. Next stage: the user's next requested change; do not automatically release the birthday pack or begin another redesign stage.

## Phone rehearsal and full-screen question foundation — 19 October 2026

Status: implemented. The agreed direction is a hosted Kahoot/Jackbox-style show: clear question beats, bespoke designs within shared controls, generous phone layouts and fluid motion.

### What changed

- Question packs has a question selector and an interactive phone frame, with 320/390/430px maximum widths, get-ready/answering states, reset and an open-at-full-size link. Each individual question page has the same preview; each catalogue row can select its phone preview.
- Added the authenticated, uncached `/api/admin/content/:version/questions/:questionId/preview` projection and shared `AdminQuestionPreview` validation. It sends only renderable public fields. Missing scales/prompts/options remain unavailable; unsupported Wordle, room-frequency ranking and multiple-selection drafts are labelled and non-interactive. No answers, notes or future reveal keys enter this payload.
- `/admin/phone-preview/:version/:questionId` uses the actual `GuestPlay`, `PhoneShell`, phone dock and bespoke presentation registry. Rehearsal input is local component state only: no room, WebSocket, scoring or persistence. Names in roster/duel rehearsals are explicit stand-ins. The route supports sign-in returns when opened on another device.
- `QuestionExperience` gives phone questions a screen-filling frame, progress and mechanic/role/phase-specific action cue. Standard choices use large labelled tiles with eased staggered entrances; existing bespoke compositions remain registered under their own presentation ids. Selection and accepted answers remain distinct. Sending/locked labels animate while their accessible name changes immediately.
- The existing dock keeps the send action accessible. Photo/sound tools and troll selection are collapsed. Incoming troll notices/escape controls remain visible. Phase exits disable outgoing controls, including the portalled dock button; normal stage headings still update immediately with authoritative server state.
- Added [.agents/rules/35-question-experience.md](../.agents/rules/35-question-experience.md), updated the authoring rule and guide, and regenerated agent copies with `npm run agents:sync`. Future question work must use full-screen compositions, explicit next actions, eased transitions, reduced-motion fades and the real admin phone rehearsal.

### Verification for the question experience

- Final C: `npm run typecheck` passed. `npm run test:unit` passed 54 files / 195 tests, including all eight preview mechanics, role-aware cues, draft/error handling, sign-in return safety and outgoing portalled-control locking. E: typecheck and the bounded-concurrency full unit run also passed (54 files / 192 tests, before the three extra phone-preview return-path cases).
- `npm run test -w @26/api -- test/admin-rooms-auth.spec.ts` passed 12 tests. Checks include authenticated/no-store previews, cross-origin/anonymous denial, public-field projection of every catalogue entry, unsupported mechanic labelling and missing scales without invented values.
- `npm run build` passed in the matching C: copy, including the generated-secret and 342-file artifact checks and content preflight. The birthday's documented incomplete drafts are still reported. Existing PGlite eval and bundle-size warnings remain; no deployed resources were touched.
- Targeted ESLint passed with zero errors. Existing fast-refresh warnings for `choiceNote` and the routes module remain. Targeted Prettier checks and `git diff --check` passed. All changed source files matched the verification copy by hash. `npm run agents:sync` completed, and its final rerun made no changes.
- Browser screenshots in `.codex/previews/question-experience/` show the real standard phone layout at 320/390/430px and its admin frame. Choice controls fit the frame, remain at least 48px tall, and cause no horizontal overflow. Existing admin detail checks also cover six viewport widths, reduced motion and 200% CSS zoom. Screenshots were reviewed and the initial stretched pill shapes were replaced with the theme's panel corners.
- Final `npx playwright test --config playwright.dev.config.ts apps/web/e2e/question-phone-preview.spec.ts apps/web/e2e/quiz.spec.ts apps/web/e2e/media.spec.ts apps/web/e2e/admin-sections.spec.ts apps/web/e2e/admin-question-details.spec.ts apps/web/e2e/admin-entry.spec.ts --workers=1` passed all 11 cases together (1.8 minutes). Includes separate-device sign-in return, real bespoke/standard phone rendering, selection/send/lock/reset/pause, no game sockets from previews, anonymous denial, honest drafts, full quiz, media/troll/reload/reconnect, results and responsive admin journeys.
- Chrome manually confirmed local sign-in, the new pack selector and “Preview on phone” shortcut, automatic scroll to the chosen question's loaded phone frame and the real Pokémon option layout. The local pack preview is left open for review; the existing production tab was left untouched.
- Tests caught and fixed duplicate accessible send labels during an exit, unstable portal-child keys during disabling, and the distinction between accepted guesses and accepted text/choice answers. One admin browser run raced an automatic final-phase transition; its click now has a bounded timeout and accepts the alternate path only after the completed game is visibly verified. No assertion or error filter was removed.

### Scope and limitations

This is the shared presentation foundation, not a claim that each party question has received its final bespoke design. The preview covers prompt/collect, selected/accepted and pause states. Real reveal answers/scores are not simulated; the existing development design bench retains labelled stand-in reveals. Vote rounds preview writing and duel/finale rounds preview the contestant number entry; room-specific ballots/prediction assignments still require a real rehearsal. Long ballots, long text, keyboard entry and enlarged text may scroll vertically.

No question facts, answer keys, running order, released versions, live rooms or deployments were changed. The Wordle, frequency-ranking and multiple-selection mechanics, and the inflation prices/scales, remain separate unfinished content work. Next: customise the questions one at a time using this preview and the full-screen standard; do not automatically release the birthday pack.

Development still prints the existing local Better Auth schema-startup and Motion reduced-motion notices; the explicit local adapter and functional assertions pass. Deployed authentication, physical phone keyboards/OS zoom and venue projector/audio checks remain unverified. Preview review: `http://localhost:4173/admin/content` in the matching C: copy with `LOCAL_DATABASE_ID=browser-checks`; normal development from the project is `npm run dev`. The C: preview does not watch E: edits. No commit, push or deployment was performed for this request.

## Glyph / birthday Wordle — 19 October 2026

Status: implemented. `complete-a-wordle` is now a ready native `wordle` question with the supplied target **VULGY**: six guesses, two minutes and 100 points for solving. It remains outside the birthday running order; `birthday-draft` is unreleased and the illustrative demo is unchanged.

### Implementation and decisions

- Inspected the sibling Encore source (`game-glyph` marking, play state, word lists and letter-guess board/keyboard). Adapted its two-pass duplicate-letter marking and copied its frozen five-letter validity list server-side. Preserved Encore's MIT licence and original dictionary credits, plus the full SCOWL upstream copyright notice in `wordle-dictionary/`. The supplied target is always allowed even if outside that list. No hard mode, daily puzzles, multi-board variants or catalogue generator were copied.
- Shared `wordle.ts` adds a pure reducer with injected time, board/mark validation and explicit playing/won/lost states. Invalid, repeated, finished-board and late guesses are rejected without consuming an attempt. Authoring/validation/private inspection/content export now recognise the native kind. Only Wordle permits the longer collection window (up to three minutes); other mechanics retain their existing limits. Defaults live in `defaults.ts`.
- The existing text command and durable receipt transaction accept subsequent Wordle guesses. Each player's board updates the existing `round_response` row before acknowledgement. Snapshots restore that board after reconnect/eviction. The score ledger gives the configured points only for a solved board and remains idempotent at reveal. Stage/control receive aggregate finished-board progress; individual guesses are guest-only. The target enters the public reveal only in revealed phases.
- Registered `glyph` in the existing bespoke presentation registry. The phone has a six-by-five board, touch keyboard, physical typing, remembered key feedback, labelled symbols as well as colour, eased letter reveals and reduced-motion fades. It keeps rejected drafts and clears accepted ones. Pending state follows the command acknowledgement rather than treating the first Wordle guess as a completed round. The stage presents a large mystery word, instructions, progress and the eventual reveal. Projector spacing was tightened after screenshot review to keep all content visible.
- The real admin phone preview uses authenticated, same-origin `POST /api/admin/content/:version/questions/:questionId/preview/wordle`. It replays a bounded history on the server and returns feedback only; it does not persist, open a game socket, enforce a rehearsal timer or award points. JSON input is stream-limited to 1 KiB. The public preview GET omits the target. `/design?q=glyph` has an explicitly labelled development stand-in word, WORDS, for layout/reveal checks.
- Updated [docs/question-authoring.md](question-authoring.md) and [.agents/rules/15-question-authoring.md](../.agents/rules/15-question-authoring.md), then regenerated agent copies with `npm run agents:sync`. A wider auth check exposed an older production test fixture omitting the required client key; that fixture now supplies a test key/header so the original authentication assertions run unchanged. No production auth behaviour changed.

### Verification

- `npm run typecheck` passed in E: and in the matching C: verification copy.
- `npm run test:unit -w @26/web -- --maxWorkers=2` passed: **55 files / 199 tests**. Covers touch/physical input, server-feedback-only marking, pending/rejected/accepted drafts, continued guesses, prompt/pause/finished locking, directions and safe stage reveal. An early assertion was corrected to wait for its intentional exit/entry animation.
- `npm run test -w @26/api -- --project auth` passed: **20 files / 143 tests**. Includes duplicate-letter allocation, invalid/repeated words, supplied-target override, six-guess exhaustion, exact deadline, public answer exclusion, authoring status, preview history validation, bounded bodies and admin/origin protection.
- `npm run test -w @26/api -- --project room test/quiz.spec.ts test/rounds.spec.ts test/wordle-room.spec.ts` passed: **3 files / 4 tests**. Uses real Durable Object SQLite to verify independent boards, per-guess persistence, eviction/recovery, pause/hold/deadline gates, private projections and one-time scoring. The Wordle storage test injects the ready question explicitly; it does not release a test pack or alter a production running order.
- Browser regressions passed together: `npx playwright test --config playwright.dev.config.ts apps/web/e2e/wordle-preview.spec.ts apps/web/e2e/question-phone-preview.spec.ts apps/web/e2e/quiz.spec.ts --workers=1` (**4 cases**, before the extra projector case). Final Wordle-only run passed **2 cases**, including the projector check. Real phone rehearsal covers dictionary rejection without spending a guess, subsequent guesses, pause/resume, solved lock, reduced motion, anonymous denial and no game sockets. At 320/390/430px, the keyboard fits the viewport with no horizontal overflow. Projector collect/reveal uses a labelled stand-in and keeps the actual target absent.
- `npm run build` and `npm run content:check` passed. Preflight still honestly reports the unrelated unfinished password, inflation and multi-selection questions. `npm run content:export` passed; the offline ordered answer keys remain unchanged because the birthday running order is empty.
- Targeted ESLint passed with zero errors (two existing fast-refresh helper-export warnings). Prettier and `git diff --check` passed. Screenshots in `.codex/previews/wordle/` were reviewed for the phone and projector.

### Trying it and remaining scope

Run `npm run dev`, then Admin → Question packs → Complete a Wordle → Phone preview, or `/admin/phone-preview/birthday-draft/complete-a-wordle`. The local verification preview uses port 4173 in the C: copy; that server does not watch E: edits.

No commit, push, deployment, pack release, running-order change or live room change was performed. The new round's live socket integration uses the existing receipt path, while full browser play-through of an actual birthday room remains for the explicit pack release/rehearsal. Physical phone/OS keyboard and venue projector checks remain unverified. Next: review this question's feel, then customise the next supplied question; release and running-order inclusion remain separate explicit steps.

## Pokémon pictures and sourced inflation sliders — 20 October 2026

Status: implemented. The four supplied pictures appear in the existing Pokémon option cards on phones, the stage and the actual admin phone rehearsal. The Freddo and petrol questions are now ready slider questions with dated sources. All three question ids and the Pokémon answer are unchanged. The birthday version remains unreleased with an empty running order.

### Implementation and decisions

- Added `image?: string` to the existing choice option shape and its deliberately public projection. `questionOptionImageSchema` accepts local question PNG URLs only. Live choice snapshots and the admin rehearsal carry those URLs; answers, notes and future reveals remain private. The ordinary card grid, padding, type, selection and submit behaviour are unchanged.
- Added `QuestionOptionImage` and its shared phone/stage styles. The image uses `object-fit: contain` inside an absolutely positioned area, so its intrinsic dimensions cannot resize a card. Existing option text remains the accessible name; decorative images do not intercept taps. Images fade in after loading, and a missing image leaves the labelled control usable. No palette, theme or additional presentation registry was introduced.
- Stored four genuine PNGs in `apps/web/public/assets/questions/favourite-pokemon/`. Turtwig, Mudkip and Tepig were copied byte-for-byte. The supplied WebP portrait was decoded and saved losslessly as `osama-bin-laden.png`; its 250×302 dimensions and decoded RGB pixels are unchanged. The original transparency and dimensions of the other PNGs were retained. Conversion used the bundled Pillow runtime and did not change the supplied artwork.
- Added option-image path validation and missing-file checks to existing content preflight. No new media service, processing in the live path, asset fetcher, socket or scoring system was added.
- Researched the price references and recorded full links, dates, definitions and limitations in [docs/content/inflation-price-sources.md](content/inflation-price-sources.md). Freddo compares a typical UK 20p single-bar baseline in 2012 (inferred from StepChange's 2011–2014 timeline, with a contemporaneous petition as corroboration) against a Tesco 18g single at 35p checked on 20 October 2026. It does not claim identical historical pack-size/retailer records or one universal UK retail price.
- Petrol uses official DESNZ UK weekly ULSP pump averages: 138.35p/litre on 15 October 2012 and 175.28p/litre on 12 October 2026. The guest is explicitly asked for the 2026 value rounded to the nearest penny: the scoring answer is 175p, with the exact 175.28p in the reveal. Neither figure is described as an annual average. Both sliders retain ordinary 20-second/100-point exact-answer defaults; bounds and initial values are recorded in the source note.
- Updated ready-state assertions while retaining explicit incomplete-slider fixtures for missing-scale/answer coverage. Fixed the existing Wordle authoring example's replacement character.

### Verification

- `npm run content:check` passed in E: and as part of the matching C: build, including all four option files. Only the unrelated password and multiple-selection questions remain incomplete.
- `npm run typecheck` passed in E: and the matching C: copy. `npm run test:unit -w @26/web -- --maxWorkers=2` passed **56 files / 201 tests**, including pictured phone/stage options, accessible names, load/error states and unchanged submission callbacks.
- `npm run test -w @26/api -- --project auth test/birthday-assets-prices.spec.ts test/admin-rooms-auth.spec.ts test/question-authoring.spec.ts test/rounds-score.spec.ts` passed **4 files / 42 tests**. Checks include PNG signatures, option mapping, unchanged answer, allowed image paths, safe projections, frozen prices, reachable targets, authoring status, exact scoring and unreleased/unscheduled content.
- The combined browser run passed admin question details and both existing phone-preview cases. Its new picture/price case initially caught sub-pixel floating-point noise (less than 0.0001px) when comparing transformed card rectangles. The final dedicated run, `npx playwright test --config playwright.dev.config.ts apps/web/e2e/birthday-assets-prices.spec.ts --workers=1`, passed. It verifies real PNG MIME/signatures, all images loading, containment and readable labels at 320/390/430px, no horizontal overflow, and the same card dimensions with pictures removed (within 0.1px). It also covers selection/send/lock under reduced motion, a short landscape viewport, both dated slider previews and absence of truth/reveal fields from their payloads.
- `npm run build` passed, including generated-secret checks, 358-file artifact verification and content preflight. Existing PGlite eval and large-chunk warnings remain. Targeted ESLint passed with zero errors and the two existing helper-export fast-refresh warnings. `git diff --check` passed.
- Manual image checks confirm the original three PNG hashes match their supplied files and the decoded portrait PNG pixels match the WebP exactly. Reviewed browser screenshots in `.codex/previews/pokemon/`; the supplied pictures fit without changing the cards or removing any labels.

### Try it and next stage

Run `npm run dev`, then Admin → Question packs → Favourite Pokémon / Inflation: Freddo / Inflation: petrol → Phone preview. The C: review copy uses port 4173 and does not watch E: edits. No commit, push, deployment, pack release, running-order change or live-room mutation was performed. Actual birthday-room playback and physical-phone/projector checks remain for the explicit party rehearsal. Next: review these cards and slider wording, then continue customising the next supplied question; do not automatically release or start another mechanic.

## Three comic inflation additions — 20 October 2026

Status: implemented. Added three ready slider questions to the birthday catalogue: `inflation-meal-deal` (Tesco, “The student tasting menu”), `inflation-sausage-roll` (Greggs, “The Greggs gold standard”) and `inflation-cheeseburger` (Maccies, “The 99p nostalgia tax”). The user explicitly requested new comic indicator ideas. The unreleased `birthday-draft` keeps its empty running order, and the demo is unchanged.

Each question has its own TypeScript file in `apps/api/src/questions/packs/birthday/`, registered in `manifest.ts`, using the existing slider helper, renderer, public preview and scoring. No new interface, presentation registry, socket, score engine or live-room path was needed. Defaults remain 20 seconds and 100 points for the exact answer. All values are in pence, step 1, with historical-price initial values and reachable scoring targets.

The comparison is explicitly dated rather than presented as a full-year national average: Tesco £3 in 2012 to £3.85 with a Clubcard checked 20 October 2026; Greggs reported 66p to the £1.35 price reported for most shops on 8 January 2026; cheeseburger 99p to the £1.39 quote in an independent September 2026 menu guide. The last quote is not official restaurant verification: that limitation is stated in phone wording, reveal and private notes. Tesco's current price has a primary retailer source; the historic Tesco statement and Greggs prices use news reporting. Sources, inference boundaries and price scope are recorded in [docs/content/inflation-price-sources.md](content/inflation-price-sources.md). A pint was rejected because the accessible ONS observations stopped in January 2025.

Verification:

- `npm run content:check` passed in E:, with only the existing password and multiple-selection gaps reported.
- `npm run typecheck` passed in E:.
- `npm run test:unit -w @26/web -- --maxWorkers=2` passed in the matching C: verification copy: **56 files / 201 tests**.
- `npm run test -w @26/api -- --project auth test/inflation-additions.spec.ts test/birthday-assets-prices.spec.ts test/question-authoring.spec.ts test/rounds-score.spec.ts` passed in C:: **4 files / 33 tests**. Covers ready registration, reachable/exact scoring, out-of-range rejection, validation, frozen reference wording, unreleased order and exclusion of targets/notes/future reveals from previews. The new file is registered in the existing auth test project.
- `npx playwright test --config playwright.dev.config.ts apps/web/e2e/inflation-additions.spec.ts --workers=1` passed in C:: **1 case**, covering all three actual authenticated phone rehearsals at 320/390/430px, readable baselines, no horizontal overflow, visible slider/send controls, pause/resume, reduced motion, send/locked state and private-field exclusion. The first run passed the interactions but its final no-socket assertion counted Vite HMR reconnections during full-page navigation. The assertion now excludes only Vite's root token connection; every other socket remains prohibited, including game `/ws/` connections. The final run passed. Existing development auth-schema-startup and reduced-motion notices remain; local sign-in and functional checks passed.
- Targeted ESLint passed. `git diff --check` passed. Hash checks confirmed the changed implementation/test files match the C: copy. No production bundle build or deployment was run for this content-only addition, and no manual physical-phone/projector check is claimed.

Try with `npm run dev`, then Admin → Question packs → Birthday → any of the three new inflation questions → Phone preview. No commit, push, deployment, release or live-room mutation was performed. Concrete limitations: retailer/local prices vary; the cheeseburger round deliberately uses a named independent guide; the questions have standard slider presentation rather than bespoke art. Exact next stage: review these three prompts and previews with the user, then customise the chosen next question. Inclusion in a released running order and an actual birthday-room rehearsal remain separate explicit work.

## Three escalating trolley polls — 20 October 2026

Status: implemented. Three ready questions are registered immediately after the original trolley question in the birthday catalogue: `trolley-your-mum` (your mum versus 1,000 random people), `trolley-mamdani-africa` (Mayor Zohran Mamdani versus everyone in Africa), and `trolley-freddo-multiverse` (one Freddo versus all life in every universe). The user authorised inventing the third, increasingly absurd scenario. All three use `choiceQuestion` with `outcome: { kind: "poll" }`, 20 seconds and zero points, matching the existing trolley mechanic. No moral answer key is invented. Nothing is missing for these authored questions.

### Decisions and files

- Added the three corresponding files under `apps/api/src/questions/packs/birthday/`, registered in `manifest.ts`. `derail` consistently means pulling the lever to sacrifice the single person/item; `leave` sacrifices the larger group. Options explicitly say both what is saved and what is lost. Interpreted the user's “Mamadani” as Zohran Mamdani; verified his name/title on the [official NYC mayor page](https://www.nyc.gov/mayors-office). Africa is described as a continent's people, without inventing a population figure. These are fictional dilemmas, not statements about events.
- Reused `trolley-lever` and the existing phone dock, handlers, state frame, motion kit, stage tally and server poll scoring. No new shared data interface, presentation id, socket, game reducer or score engine. Removed the diagram's hard-coded five/one stick figures and corresponding accessibility claim; it now identifies the straight/leave and diverted/pull tracks and works at any stated scale. Stage choices show the actual public option consequences alongside counts, percentages and majority/tie verdicts.
- Kept phone type and controls large. Browser checks exposed clipping on a 320px phone. Shortened prompts/options without changing their dilemmas, removed the repeated question-number/design badge from the phone (the shared frame already gives the number), reduced decorative scene height to 12dvh and tightened its spacing. Both full answer controls now fit above the dock at 320/390/430px. Short landscape and enlarged text retain normal vertical scrolling. Stage illustration is 26vh with more compact gaps, leaving room for longer option labels without reducing essential stage type.
- The development fixture in `designs/preview/fixtures.ts` now uses explicitly imaginary planets/moon with long labels, checking the shared composition at comparable text lengths without copying another party question or its private fields into the client. The actual original `trolley-problem.ts`, its poll and its options are unchanged. `birthday-draft` is unreleased; `order` stays empty; the demo and live rooms are unchanged.

### Verification

- `npm run content:check` passed through the final C: build and directly in E: after final changes. Only the pre-existing password and multiple-selection content gaps remain.
- `npm run typecheck` passed in E: after final implementation edits.
- `npm run test -w @26/api -- --project auth test/trolley-additions.spec.ts test/question-authoring.spec.ts test/quiz-score.spec.ts` passed in the matching C: copy: **3 files / 31 tests**. The new test file is included in `apps/api/vitest.config.ts`. Tests verify registration, validation, 20-second defaults, ready states, zero points for either choice, actual tallies, public preview privacy and no running-order inclusion.
- `npm run test:unit -w @26/web -- --maxWorkers=2` passed in C:: **57 files / 209 tests** after final changes. The new `trolley-lever.test.tsx` covers selection/send callbacks, pending versus accepted, prompt/pause locks, neutral diagram labelling, and stage consequences/tallies for both majorities and ties.
- `npx playwright test --config playwright.dev.config.ts apps/web/e2e/trolley-additions.spec.ts --workers=1` passed in C:: **2 cases**. Real authenticated phone previews cover all three questions, 320/390/430px widths, full buttons above the dock, short landscape without horizontal overflow, get-ready, pause/resume, reduced motion, selection, commit and accepted lock. The stage bench checks long stand-in copy and reveal at 1920×1080. The first draft of the test incorrectly looked for the parent panel's phase buttons on the full-size preview; corrected it to navigate the preview's existing phase URL. Subsequent geometry failures were fixed in the layout/copy, while retaining and strengthening the full-button/dock assertions.
- `npm run build` passed after final changes, including content preflight and 358-file secret checks. Existing PGlite/build-chunk warnings remain. Targeted ESLint passed. Hashes confirmed the E: implementation and test files match the C: verification copy. Reviewed final screenshots for the 320px phone, accepted Freddo state and long-copy stage reveal in the C: copy's `.codex/previews/trolley/`.

### Try it and next stage

Run `npm run dev`, then Admin → Question packs → Birthday → any of the three new trolley questions → Phone preview. Stand-in reveal: `/design?q=trolley-lever&surface=stage&phase=reveal&still=1` in development. No commit, push, deployment, release, running-order change or live-room mutation was performed. Physical-device/OS zoom and the actual venue projector remain unverified; preview inputs remain isolated from live games. Exact next stage: review these three dilemmas and their feel, then take the user's next question/design request. Explicit running-order inclusion, release and an actual birthday-room rehearsal remain separate work.

## Two original-name questions — 20 October 2026

Status: implemented. Added ready typed questions `real-name-vin-diesel` and `real-name-jamie-foxx` to the birthday catalogue beside the existing original-name questions. The user authorised choosing two famous people whose earlier names are less obvious. Selected Vin Diesel and Jamie Foxx as an editorial judgement about surprise/recognisability, rather than a factual claim about audience knowledge. Both use the existing `redacted-file` animated phone/stage presentation with ordinary 20-second/100-point typed defaults. No answer, photograph or mechanic is missing.

### Decisions and files

- Added the two corresponding server-side TypeScript files under `apps/api/src/questions/packs/birthday/` and imported them into `manifest.ts`. No new interface, client question pack, presentation id, renderer, matching engine or socket. No existing question was edited. `birthday-draft` remains unreleased, with its empty running order; demo and room versions are unchanged.
- Vin Diesel's canonical answer is Mark Sinclair, supported by CUNY's own commencement announcement. Mark Sinclair Vincent and Mark Vincent are also accepted because a direct Industria interview and TIME's original reporting use those earlier forms. Jamie Foxx's canonical answer is Eric Marlon Bishop, corroborated by Biography.com, with Eric Bishop also accepted as used in his direct Irish Times interview. The existing typo matcher accepts the Marlin spelling found in the Ferriss transcript. First name plus surname is enough; no middle-name trivia is compulsory. Stage names and single-name guesses do not score.
- Prompts ask for an “original name”, avoiding an unsupported claim about present legal names or deed-poll paperwork. Humorous reveal copy is original. Full source links and answer-scope decisions are recorded in [docs/content/original-name-sources.md](content/original-name-sources.md); concise private notes stay on each question. Accepted names and explanations remain server-side, absent from phone preview payloads.

### Verification

- `npm run content:check` passed in E:; only the existing password and multiple-selection gaps are reported.
- `npm run typecheck` passed in E:.
- `npm run test:unit -w @26/web -- --maxWorkers=2` passed in the matching C: verification copy: **57 files / 209 tests**.
- `npm run test -w @26/api -- --project auth test/original-name-additions.spec.ts test/question-authoring.spec.ts test/typed-score.spec.ts` passed in C:: **3 files / 32 tests**. The new test file is registered in `apps/api/vitest.config.ts`. It verifies accepted full/short names and real source variants, normalisation/typos, rejecting incomplete and stage names, 100-point scoring, ready registration, validation, private-field exclusion and no release/order inclusion.
- `npx playwright test --config playwright.dev.config.ts apps/web/e2e/original-name-additions.spec.ts --workers=1` passed in C:: **1 case** covering both actual authenticated rehearsals. Checks public actor subjects, private-field exclusion, 320/390/430px layouts without horizontal overflow, editable typed fields, get-ready/pause locks, reduced motion, submission and accepted lock. The submitted “Sample Person” is a labelled stand-in input; rehearsals neither grade it nor expose the answer. No game sockets opened. Existing local Better Auth schema-startup and Motion reduced-motion notices remain; functional authentication and assertions pass.
- Targeted ESLint, Prettier and `git diff --check` passed. Hashes confirmed source/test files in E: match the C: verification copy. Reviewed both accepted-state screenshots under the C: copy's `.codex/previews/original-names/`. No production build was run for this content-only addition, and no physical-phone/venue-projector verification is claimed.

### Try it and next stage

Run `npm run dev`, then Admin → Question packs → Birthday → Original name: Vin Diesel / Original name: Jamie Foxx → Phone preview. The questions reuse the existing case-file reveal; admin rehearsals keep reveal answers private and do not simulate scoring. No commit, push, deployment, release, running-order change or live-room mutation was performed. Exact next stage: review these two choices, then take the user's next question or visual-customisation request. Explicit pack release/order inclusion and a full birthday-room rehearsal remain separate work.

## Who said it: ten quote drafts and A/B presentation — 20 October 2026

Status: the ten supplied rounds are saved and their presentation is implemented; **all ten remain factual-attribution drafts**. The exact quoted passages could not be verified. Preserving supplied answer letters does not establish that an anonymous social post or game character said the precise text. An asynchronous preference question offered sourced drafts versus explicitly labelled parody; no reply had arrived during implementation, so the exact supplied material remains in drafts. No invented replacement speakers or quotations were substituted.

### Content and decisions

- Added ten `choiceQuestion` files under `apps/api/src/questions/packs/birthday/`, in supplied order in the birthday catalogue: `who-said-it-empathy`, `who-said-it-freedom`, `who-said-it-sleep`, `who-said-it-salvation`, `who-said-it-crying-ceo`, `who-said-it-nihilism`, `who-said-it-technology`, `who-said-it-performance-review`, `who-said-it-absolute-force`, and `who-said-it-grief-pipeline`. The initial “True equality…” example is not an eleventh round. Quote wording and both option labels are preserved; all fit existing prompt/label limits, so no schema expansion or silent abridgement was needed.
- The user's proposed answer letters and explanations are preserved in private notes. Each question has a `quote-source` requirement and a missing `verified-attribution` answer, so it cannot become playable or score accidentally. These are correct-answer choice drafts, not unscored polls standing in for the requested quiz. Ordinary defaults remain 20 seconds/100 points when a sourced question is ready. `birthday-draft` stays unreleased; the running order is empty and demo/live rooms are unchanged.
- Exact-phrase searches did not authenticate the precise Persona/Shin Megami Tensei/LinkedIn/manifesto wording. This is an unresolved verification gap, not proof that no occurrence exists. The crying-CEO incident is real, but contemporary reporting concerns two employees and does not authenticate the supplied wording/15% figure. Do not attribute that supplied paragraph to Braden Wallake as established fact. The identifiable original LinkedIn post could not be retrieved by the browsing tool. Full audit, ids, source limitations and the proposed A/B answers are in [docs/content/who-said-it-sources.md](content/who-said-it-sources.md).
- Updated [docs/question-authoring.md](question-authoring.md) with the existing-field quotation workflow, source gap, parody framing and rehearsal labelling. No generated agent copies were edited.

### Interface and presentation

- Added `who-said-it` to shared presentation ids and the web design registry, with `apps/web/src/play/designs/who-said-it.tsx` and CSS. It uses the existing public prompt as the quote, large A/B source controls, selection state and the phone dock's Send choice action. Tapping selects, then send commits; no unrequested swipe gesture or automatic submission path was added. The shared QuestionExperience frame retains get-ready, sending, accepted and paused instructions.
- Stage shows the quote and both possibilities, then only server-provided reveal fields identify the correct source and tally. No client answer key, theme palette, socket, timer, score engine or state store was introduced. Motion uses the existing kit, eased colour changes, short entrances and reduced-motion opacity fallbacks. No decorative loops or audio.
- `question-preview.ts` labels `quote-source` drafts clearly: quote and attribution unverified, options proposed. The actual renderer remains interactive for isolated layout/submission rehearsal; it never grades against a made-up key. Private proposed answers, notes, source gaps and future reveal fields stay out of its public payload. Unsupported mechanics retain their existing disabled/placeholder behaviour.
- Added an explicitly fictional quotation and imaginary speakers to the existing development bench fixture. Reveal data there remains a stand-in, not any supplied answer. It tests longer quote/option combinations without putting a server question pack into client code.

### Verification

- `npm run content:check` passed in E: and through the final C: build. It honestly reports all ten source/attribution gaps plus the existing password/multiple-selection gaps.
- `npm run typecheck` passed in E: and the matching C: verification copy.
- `npm run test:unit -w @26/web -- --maxWorkers=2` passed in C:: **58 files / 216 tests**. New `who-said-it.test.tsx` covers quote rendering, two choices, existing select/send callbacks, selected state, prompt/pause/pending/accepted locks and no attribution before server reveal. Existing design registry tests also exercise the new phone/stage design across phases.
- `npm run test -w @26/api -- --project auth test/who-said-it.spec.ts test/question-authoring.spec.ts test/admin-rooms-auth.spec.ts test/quiz-score.spec.ts` passed in C:: **4 files / 51 tests**. Verifies all ten draft ids, preserved proposal letters, missing facts, inability to become playable, safe interactive projections, explicit unverified warning, no private key/reveal leakage, exact longer wording, catalogue validation and unchanged release/order. The new test is registered in the existing auth project.
- `npx playwright test --config playwright.dev.config.ts apps/web/e2e/who-said-it.spec.ts --workers=1` passed in C:: **2 cases**. Exercises every actual draft rehearsal at 320/390/430px without horizontal overflow, visible choices, warning label, source-key exclusion, pause/resume, reduced motion, selection/send/accepted states; stage bench checks a large quote and long options at 1920×1080 plus stand-in reveal. Long quotes/labels and enlarged text retain vertical scrolling. Physical phones, OS zoom and venue projector remain unverified. Existing local auth-schema-startup/reduced-motion notices remain; functional assertions pass.
- `npm run build` passed, including content preflight and build secret checks; existing PGlite eval/large-chunk warnings remain. Final build was repeated after adding the option-colour easing. Targeted ESLint, Prettier and `git diff --check` passed. Hashes confirmed E: source/tests match the C: copy. Reviewed phone and stage screenshots in the C: copy's `.codex/previews/who-said-it/`.

### Try it and remaining work

Run `npm run dev`, then Admin → Question packs → Birthday → any Who said it entry → Phone preview. `/design?q=who-said-it&surface=stage&phase=reveal&still=1` shows a fictional stand-in reveal. No commit, push, deployment, pack release, running-order inclusion or live-room mutation was performed.

Exact next stage: resolve the pending sourced-quote/parody preference, then replace source gaps with exact primary references and verified answers, or explicitly rewrite the material as labelled fiction without false real-person attributions. The current ten questions are reviewable drafts, not ready party content. Do not auto-release them or silently promote the supplied answers as verified facts.

## Party mini-game concepts — 20 October 2026

Status: saved fifteen new catalogue entries: **four ready Real/Made up choices and eleven explicit drafts**. These concepts do not yet supply all the facts or interactions needed for playable mini-games. Full ids, status, source links and gaps are in [docs/content/party-concepts.md](content/party-concepts.md). The ten existing Who said it drafts were not duplicated or promoted. The birthday pack remains unreleased with an empty running order; the demo and live rooms are unchanged.

### Files and decisions

- Added one file per stable slug in `apps/api/src/questions/packs/birthday/` and registered them in `manifest.ts`: four `guess-tab-*` drafts; `ai-turing-test`; `heathrow-search-query`; `rank-driving-sins`; four `subculture-*` choices; `dating-exit-excuse`; and three `dial-*` drafts. No new client question pack, answer key, interface, live reducer, score engine, socket or scheduler.
- The subculture questions use ordinary 20-second/100-point choice defaults. Real: cheese rolling, gurning, and the historical Ranters/Muggletonians names; Made up: the user-supplied Puddle-Stompers contest. Checked the event organisers and historical references. “The Rollers” is explicitly shorthand for the activity, and religious wording avoids presenting a disputed coherent Ranter sect or degree of heresy as established fact.
- Guess the Tab preserves closest-without-going-over as a missing scoring requirement. Slider definitions are authoring placeholders only, with no invented price or input range. The four reference prices need dated, comparable bases; no generic insurance average, unspecified pub menu or assumed electricity tariff was supplied as a factual answer. Ties and all-guesses-over behaviour also need implementation.
- The AI choice preserves all three supplied example options without asserting that any is a genuine Humza take. Heathrow records the missing blind 1v1 tournament rather than substituting the existing all-submissions ballot. Driving sins preserves the list without treating its supplied order as the answer; fixed target versus consensus and the requested accessible drag list remain gaps. Dating records the explicit 30-second writing window and missing three-award voting flow. The dials retain their supplied 0–100 endpoints and neutral initial control position of 50, without claiming a personal target or using exact-price scoring.
- `question-preview.ts` labels unsupported interactions as disabled draft layouts. The AI preview explicitly labels example choices. Missing numeric ranges remain unavailable, with no placeholder bounds. Public projections continue to exclude truth, notes, requirements and future reveals.
- Fixed isolated previews for catalogues exceeding forty entries: unordered questions now show `1 / 1`, while ordered questions retain their actual running-order position. Previously the catalogue count entered a public field limited to forty live questions, making otherwise valid previews unavailable. The live-order limit stays forty. Documented the distinction in [docs/question-authoring.md](question-authoring.md).

### Verification

- `npm run content:check` passed in E: and through the C: build. It reports the eleven new draft gaps plus the existing password, multiple-selection and ten quote-attribution gaps; it does not promote incomplete content.
- `npm run typecheck` passed in E: after the implementation and new tests were present.
- `npm run test:unit -w @26/web -- --maxWorkers=2` passed in the matching C: verification copy: **58 files / 216 tests**. This is the web suite delegated to by the root `test:unit` script.
- `npm run test -w @26/api -- --project auth test/party-concepts.spec.ts test/question-authoring.spec.ts test/admin-rooms-auth.spec.ts test/who-said-it.spec.ts` passed in C:: **4 files / 62 tests**. The new test is registered in `apps/api/vitest.config.ts`. Covers four real scoring keys, draft blocking, supplied endpoints/timing, public-field privacy, previews beyond forty catalogue entries, ordered positions, retained live limit and unchanged release/order/quote count.
- `npx playwright test --config playwright.dev.config.ts apps/web/e2e/party-concepts.spec.ts --workers=1` passed in C:: **1 case**. Actual authenticated phone rehearsals check all four ready choices at 320/390/430px, no horizontal overflow, selection/send/accepted lock, single-question progress, AI example warning, disabled subjective slider, unsupported Heathrow label, unavailable price scale and the existing Pokémon preview after catalogue growth. Existing local auth-schema-startup notices remain; sign-in and functional assertions passed. No physical-device, OS zoom or venue-projector check is claimed.
- `npm run build` passed in C:, including content preflight and artifact checks; existing PGlite eval/large-chunk warnings remain. Targeted ESLint and Prettier passed. `git diff --check` passed. Implementation and test hashes were compared with the C: verification copy.

### Try it and next stage

Run `npm run dev`, then Admin → Question packs → Birthday → a new entry → Phone preview. The four subculture questions can be rehearsed; the remaining concepts expose honest missing requirements. No commit, push, deployment, pack release, running-order inclusion or live-room mutation was performed.

Exact next stage: choose which missing interaction to implement first and resolve its listed factual/target decisions. The AI round needs real Humza material; Guess the Tab needs agreed dated references; driving/dial rounds need target-versus-consensus decisions. The pre-existing quote-source/parody preference also remains unresolved. Do not begin a release or silently treat a placeholder as the finished mechanic.

## Commit and production deployment — 20 October 2026

Status: committed and deployed successfully following the user's explicit request. Implementation commit **`b98fd04`** contains 83 files covering the accumulated question/content/presentation changes. Published through the existing `deploy:prod` script to `26-humza-website` at `https://26.humza.website`, pinned to Humza's personal Cloudflare account. This publishes the catalogue and application; it does not release `birthday-draft` or change its empty running order. No database migration, secret rotation, staging release or unrelated resource change was performed.

Pre-deployment verification: all 83 pending source/test/asset/document files matched the previously tested C: verification copy. The expanded focused API run passed **11 files / 95 tests**, covering images/prices, inflation, original names, trolleys, quotation drafts, new concepts, authoring, authenticated inspection and scoring. Targeted ESLint passed with existing Fast Refresh warnings and no errors. Prior final web suite/typecheck/browser checks are recorded above; no implementation changes occurred after those checks. `git diff --check` passed.

`npm run deploy:prod -- --dry-run` passed from E:, including the production build, content preflight, removal of the generated secret file, artifact checks and Wrangler packaging. The package targets `26-humza-website`, `APP_ENV=production`, the existing room classes and `26-humza-media`. Existing PGlite/chunk-size and non-inherited-local-var warnings remain. Existing remote secrets are retained by the code-only deploy.

`npm run deploy:prod` then passed from E:. Cloudflare uploaded seven changed assets and deployed the custom-domain trigger, version **`372e3127-db06-4939-9a49-f4c688701b98`**, Worker startup 57 ms. Both builds passed content preflight and the 436-file artifact check. No secret file was committed or uploaded as a public asset.

Post-deployment verification: `/`, `/join`, `/admin` and `/api/health` returned 200; health reports `production`. The live page now references `/assets/index-DrQV5mlQ.js`, replacing the previous `/assets/index-DIbvPGhf.js`. All four question images return `image/png`, have real PNG signatures, and SHA-256 hashes match their committed source assets. A live 390px browser check passed home Join/Admin links, navigation to “Join the room”, and administrator email/sign-in controls, with no page errors or failed requests. The initial browser attempt timed out waiting for network-idle; the final check waits for DOM readiness and asserts usable controls directly. No sign-in email was sent, private production catalogue session was not opened, and no live game actions were performed.

Try `https://26.humza.website`, then Admin → Question packs after signing in. Commits are local; no Git push was requested or performed. Exact next stage: user review of the deployed catalogue, followed by the chosen outstanding mechanic/factual decisions listed above. Incomplete drafts remain excluded from live running orders.

## Draft polish, new concepts and kart sprint — 20 October 2026

Status: complete locally and verified. All **23 former drafts** are now ready, completing the original fifty-question catalogue. The next eight concepts are saved as twelve entries: five ready and seven explicit drafts. The additional `kart-sprint` is ready. Total birthday catalogue: **56 ready / 7 draft**. `birthday-draft` remains unreleased, its running order remains empty, and the released demo and existing rooms are unchanged. No commit, push or deployment was performed in this pass.

### Completed former drafts

- Added real common-password crowd-frequency scoring, exact-set multiple choice, decimal closest-under bids, consensus sliders, accessible ordered ranking, repeated award ballots and a persisted anonymous knockout bracket. Pure crowd helpers live in `packages/shared/src/party-scoring.ts`; UI uses the actual guest renderer and existing phone dock. Readiness no longer hides missing mechanics behind ordinary placeholders.
- Commonness ignores case and whitespace variations; unique answers score zero, matching groups scale by `(count − 1) / (largest − 1)`, with dense frequency ranks. Christianity requires exactly the three user-confirmed branches and no distractors. All-over price bids score zero; tied closest-under bids share the prize. Subjective dials use the room median; driving uses mean-position room consensus, preserving ties. These consensus choices were stated after optional clarification received no answer.
- Heathrow uses the frozen seeded tournament with byes, no self-votes, epoch-bound ballots and 15-second matches. Dating has the supplied three awards and 60 points per category. Tied award authors share the category; no votes gives no prize. Ballot generations, selections and frozen results survive eviction. Stage/phone tournament order matches.
- Replaced the ten unverified Who said it passages with verified short game/primary-author quotations while retaining stable ids and the original A/B pattern. Game quotations use exact original script messages hosted on a third-party mirror, not a publisher-hosted archive. No invented LinkedIn anecdotes or real-person quotation claims remain. The AI round now uses an actual earlier Humza message from this chat, with two generated decoys and an accurately named design-planning context. See [docs/content/who-said-it-sources.md](content/who-said-it-sources.md) and [docs/content/party-polish-sources.md](content/party-polish-sources.md).
- The four price questions have dated, explicit scopes: default-route Sutton/Oxford Circus adult peak PAYG £8.80, The Roxy standard Camden Hells pint £7.30, ideal 62 kWh charging at Ofgem's Jan–Mar 2026 average rate £17.17, and Go.Compare's June 2026 median for newly qualified **25+** drivers £1,002. The insurance question explicitly changes the unsupported exact-age-25/first-policy average to the measured cohort. No current live quote is implied by a frozen reference price.
- Added the durable `round_state` table and upgraded additive room metadata **13 → 14**. Settlements and vote flow use this extension; existing intents, score ledger, socket client and single scheduler remain authoritative. No Neon migration. The preview still blocks a legacy placeholder if its actual variant is absent; no answer key, notes, truth or future reveal is sent into rehearsals.

### New concepts and kart

- Saved all eight new concepts, including five Council/Dystopia rounds. Broadwater Farm, Blackbird Leys and Thamesmead South have council/primary references; Redoubt is the user's invented dystopia. The apology scenario is explicitly fictional and uses the working tournament. `Ferrier Sector` remains a draft because Royal Greenwich documents **Ferrier Estate**; the supplied exact name has not been authenticated. The Tribunal, Nextdoor and property rounds still need genuine source material. Group-chat double self-vote scoring, spoken debate pairing and push-your-luck raids remain disabled mechanic drafts. Exact ids, gaps and sources: [docs/content/tribunal-and-chaos.md](content/tribunal-and-chaos.md).
- Added `KartGameWrapper.tsx`, `useKartSocket.ts`, `TouchController.tsx` and the lazy Three.js stage canvas. These TypeScript versions match the repository. Default phones load a lightweight SVG HUD and A/B/R plus analog steering; the TV draws numbered ghost karts and live standings. Pointer cancellation, blur, hidden tabs, disconnection, pause and unmount release controls. Reduced motion, safe scrolling, keyboard controls and optional existing stage audio are retained.
- Inspected `Nathan-Richard-21/mario-kart-js` at `0f7a4305981206193c5efba64bc90755e6e85773` and the related upstream Mario Kart 3.js source. Ported the damped driving/release-boost model into pure server physics with a procedural party circuit. No upstream Nintendo artwork, music, original track, landing page, Playroom store or effect stack is bundled. Preserved the selected fork's declared permission notice in `THIRD_PARTY_NOTICES.md`; this is a documented party adaptation, not an untouched upstream engine build. Three.js/types are pinned and the lockfile retained.
- `packages/shared/src/kart.ts` owns pure input/tick/end reduction, eight ordered gates, timing and rankings. `apps/api/src/questions/kart.ts` persists frozen participants, bounded per-driver input queues, replay cursors, simulation and ledger results. Race ids include room id and phase generation. Only authenticated normalised inputs are accepted, at most one per 80ms. No client time, frames, position or hash can grant a lap. A guest sees its own kart and the leading results; the stage sees all participants. Reconnect cursors do not depend on a phone's clock.
- The existing durable scheduler owns a 200ms auxiliary race tick and the 45-second cutoff; physics substeps are at most 50ms. A finishing tick cannot double-advance with a due cutoff. Pause saves active-time remainders. Finishing times rank ahead of DNF, ties share place, DNF scores zero; finishers get `round(points × (participants − place + 1) / participants)`. The existing reveal/scores/next-question/final/podium phases handle the rest.
- Added an explicit authenticated **local** quiz → kart → podium rehearsal start. It pins `kart-rehearsal-v1`, is hidden in production builds and rejected by staging/production bindings, and never releases the birthday pack. Question packs remains an isolated controller-layout preview. Socket.io message semantics are mapped to the existing native WebSocket snapshots/inputs in [docs/kart-minigame.md](kart-minigame.md); no second transport or client-selected winner is introduced.
- Browser rehearsal exposed stop/start steering sensitivity: turning now scales with speed, as in the upstream model, and the boundary allows a recoverable slide. It also caught generic “No answer was received” race copy, duplicate timers, radial direction arrows and small race numbers. These were corrected, with regression checks for variable-speed laps, race result copy and server-confirmed completion callbacks.

### Verification

- `npm run content:check` passed in E: and through the final C: build. Only the seven new, explicitly incomplete concepts are reported; all former drafts and the kart round validate.
- `npm run typecheck` passed in E: and the matching C: verification copy after the implementation was final. The last browser-only changes add viewport/settled-screenshot checks and do not change runtime code.
- Root `npm run test:unit -- --maxWorkers=2` passed in C:: **61 files / 227 tests**. The root wrapper did not forward that optional worker flag and printed an npm warning; its complete web suite still ran and passed. Includes pointer independence/cancellation, keyboard/blur release, input heartbeat/cursor, once-only server completion callbacks, race-result copy, all previous phone controls and the existing application suite.
- `npm run test -w @26/api -- --project auth` passed in C:: **30 files / 201 tests**. The earlier run exposed the expected mechanic-list assertion after adding `kart`; the assertion now includes the new supported mechanic. No failing test was skipped or removed. Includes all source/content/privacy checks, crowd scoring, variable-speed laps, anti-forgery/replay checks and explicit staging/production rehearsal rejection even for an authorised controller.
- The focused combined auth/room regression run passed in C:: **16 files / 111 tests**, including `kart-room`, `party-polish-room`, `phase`, `vote`, `rounds`, `quiz`, `wordle-room`, kart scoring/guard, authoring, admin inspection, source packs, schedule and crowd helpers. Workerd cases verify actual quiz → kart → podium, queued input application, deadline/auxiliary separation, pause remainder across eviction, replay/range/identity rejection, exact cutoff, stable winners, DNF and ledger idempotency. These focused counts overlap the full auth suite and are not additive.
- Playwright final batch passed in C:: **7 cases** across `draft-polish`, `kart`, `party-concepts`, `question-phone-preview` and `who-said-it`. The kart case uses actual authenticated host/stage plus two separate phone sessions and real WebGL; it completes a lap, records a DNF at the cutoff, pauses/reloads/resumes, restores awarded points on reload and reaches the final podium. A final kart-only rerun also passed after adding **short landscape, reduced motion, 200% text at 320px and settled screenshot** checks. Portrait widths 320/390/430 have no horizontal overflow. Browser tests use the explicit local rehearsal, not a secretly released birthday pack.
- `npm run build` passed in C:, including **480 artifact files** checked for secrets and content preflight. No generated secret files remained in the C: build. Existing PGlite eval/large-chunk, local Better Auth schema-startup and Motion reduced-motion notices remain; functional authentication, browser assertions and build checks pass.
- Targeted ESLint passed with zero errors and the two existing Fast Refresh warnings. Prettier and `git diff --check` passed. Final hashes compare all changed E: files with the C: verification copy. Reviewed actual settled phone and stage screenshots under the C: copy's `.codex/previews/kart/`, plus the earlier multiple-choice rehearsal. Direction arrows are clockwise, stage race/reveal timers are distinct, race numbers are larger and phone results show the server time/award instead of a missing-answer message. No physical phone, OS zoom setting, venue projector or 80-player live verification is claimed; the browser check enlarges text through CSS.

### Try it, limits and next stage

Run `npm run dev`. Admin → Question packs → Birthday rehearses the completed questions; the Voting preview cycles labelled stand-in ballots without inventing winners. For the real kart flow, create a fresh local lobby, connect the stage and phones, then use Live controls → Start local kart rehearsal. Advance through the illustrative quiz into the sprint. The server controls the cutoff and reveal.

The circuit is a procedural party adaptation. Physical iOS/Android thermal behaviour, venue Wi-Fi/projector conditions and an 80-driver live race remain unverified. Seven new concepts still have the explicit gaps listed above. No production release is implied. Exact next stage: review the completed content and kart rehearsal, resolve the seven new drafts, and separately choose a birthday running order/version for a real party release and physical-device rehearsal. Do not automatically release, deploy or begin another mechanic.

## Commit and production deployment: draft polish and kart — 20 October 2026

Status: committed and deployed successfully following the user's explicit request. Implementation commit **`92e0e9685a2828c448bbe799d527f6dcb5fa4a6f`** saves all 114 pending files: completed former drafts, new concept catalogue, crowd mechanics, phone/stage polish and the synchronised kart adaptation. The pre-commit working files matched the tested C: verification copy exactly; staged whitespace checks passed. Existing final verification above remains applicable: 227 web tests, 201 full auth/API tests, 111 focused auth/room regressions, seven browser cases plus the final kart viewport rerun, type checks, lint, formatting and build. Counts overlap as described above. No runtime source changed after those checks.

Used the existing `deploy:prod` workflow and project-pinned Wrangler 4.136.3. Read-only identity verification confirmed the signed-in birthday administrator and the configured personal account `e6d408ebc85e159e6e22ee963641d342`; no other account was targeted. `npm run deploy:prod -- --dry-run` passed from E:, checking the production Worker package and bindings. `npm run deploy:prod` then passed from E: and published `26-humza-website` to **https://26.humza.website**, version **`779fcb2e-c151-48d8-ae22-072fdf61fa22`**, Worker startup 100 ms. Five changed public assets were uploaded, including the separate lazy kart renderer chunks. Both production builds removed their generated secret file and passed the **482-file artifact check** and content preflight. The seven newly incomplete concepts remain explicitly reported. Existing eval/chunk-size, non-inherited local-var and shell deprecation warnings remain; neither build nor deployment failed. The OAuth scope warning concerns unrelated newer products and did not prevent this Worker deployment.

This was a code deployment using existing remote secrets and bindings. No secret rotation, auth/archive database migration, resource creation, staging deployment, pack release or explicit live-room action was performed. Room schema metadata version 14 is applied additively by the existing room initialisation when a room is opened. `birthday-draft` retains its empty running order, and the local-only kart rehearsal start remains unavailable in production. No Git push was requested or performed.

Post-deployment checks passed: `/`, `/join`, `/admin` and `/api/health` returned 200; health identifies production. The live homepage references `/assets/index-CU0S2Kfu.js`, replacing `/assets/index-DrQV5mlQ.js`. That script and both `/assets/KartGameWrapper-DraamUJt.js` and `/assets/KartCanvas-CF3HrS-G.js` return 200 with JavaScript content types. A fresh 390px browser session passed home → Join the party → join code/nickname fields → Admin sign in → enabled email/sign-in controls, without horizontal overflow or page errors. No sign-in message was sent and no production game was created or advanced. The browser check screenshot is in the C: verification copy's ignored `.codex/previews/deploy-progress/` folder. The initial baseline command had a PowerShell quoting error; the corrected read-only baseline check succeeded before deployment.

Try the updated site, then Admin → Question packs after signing in. Exact next stage: review the deployed catalogue and previews, resolve the seven new draft gaps, and separately choose/release a birthday running order before using the kart round in a production party room. The authenticated real kart rehearsal remains available through local development as documented above. Deployment verification is recorded in this follow-up documentation commit.

## 20 October 2026 — kart enhancement pass paused for email/sign-in work

User explicitly paused kart development to prioritise beautiful site emails and code sign-in alongside magic links. All kart changes remain local and uncommitted. The production deployment from the previous entry is unchanged.

Work in progress: public drift-charge/boost/wrong-way telemetry, a stale-controller boost fix, optional captured thumb pad and swapped controls, clearer phone HUD/finish cards, procedural grandstands/trees/raised circuit, instanced kart meshes, frame-rate-independent visual smoothing, theme refresh and recoverable WebGL contexts. A per-driver pure `reduceKartTimeline` now replaces repeated whole-room input replay; its full-room isolation test passes. No new physics/score authority was added to clients.

Checks before pause: UI unit suite **62 files / 231 tests passed** before the latest timeline refactor; focused kart UI/scene **2 files / 8 tests passed**; typecheck and focused lint passed (one subsequent Fast Refresh helper extraction not yet rechecked). Latest focused API run: **11 of 12 tests passed**. The new 80-player DO test's final stale-speed assertion at 2,000ms is still failing; investigate the expected exponential coast interval, without weakening expiry behaviour. Its initial race-clock issue was fixed by keeping automatic alarms in the future while tests explicitly inject time. The existing two DO race tests and nine pure kart tests pass.

Real browser run reached the race and checked the new thumb pad/widths, but the driver reached only 97% before cutoff while the full parallel UI suite was competing for CPU. The GPU-recovery/result assertions were not reached. Rerun the browser test alone after verifying input replay and coasting, inspect screenshots, then complete all required checks. Do not label the kart enhancement pass complete. Exact next kart work on resume: resolve the full-room stale-speed assertion, verify timeline replay under delayed ticks, rerun actual quiz → two-phone race → podium with WebGL recovery, finish layout review and document final validation.

## 20 October 2026 — designed emails and alternate email-code sign-in deployed

Complete. The administrator receives one email containing a six-digit code and the existing scanner-safe magic link. Both expire after five minutes; code verification uses the existing Better Auth 1.7.5 instance, hashed OTP storage, disabled sign-up, five failed attempts, same-origin protection and the configured administrator allowlist. The existing session cookies and admin return destination work for either method. The login page offers paste/autofill-friendly code entry with explicit errors, loading states, focus after delivery and the local development inbox.

Added `packages/emails` with pinned React Email 6.11.3, shared responsive branding, code block, action button and results statistics. Resend now receives HTML plus the canonical plain text. HTML is rendered at delivery time so existing stored retries and provider idempotency keys remain unchanged; no extra outbox schema or auth migration is needed. Guest text is escaped and an embedded URL in a nickname cannot replace the final generated recap link. `npm run email:preview` renders three invented email fixtures without sending mail. Interfaces/docs are in the package, auth factory/routes/email adapter, admin API/page, shared optional local-inbox HTML and [apps/api/src/auth/README.md](../apps/api/src/auth/README.md).

Verified in an isolated C: release copy with the prior kart implementation: root `npm run test:unit` **61 files / 228 tests passed**; `npm run typecheck` passed; full API auth project **31 files / 208 tests passed**. Existing admin browser suite passed five cases; new email/code suite passed two after fixing disabled-at-mount focus and React Email's padding-on-cell responsive behaviour. Code login/session restoration and all three templates at 320/390/900px passed. Sign-in code entry fit 320/390/430px. Reviewed the actual 390px sign-in email screenshot. The initial preview harness failure was Playwright's JSX transform; a separate Vite-rendered fixture command resolved it. Production dry run and 485-file artefact/content checks passed. Seven unrelated birthday drafts remain incomplete and the running order remains unreleased.

User authorised deploying this fix before resuming kart work. Published only auth/email changes, keeping all 15 kart work-in-progress files out of the release. Used the existing `deploy:prod` workflow and the verified personal Cloudflare account, preserving existing remote secrets/resources. The existing public frontend API-key header was carried into the isolated frontend build internally, with its value withheld; no secret file was opened or copied. Deployment succeeded to **https://26.humza.website**, Worker version **`f94d3d47-baf6-46eb-a0d3-ddee49de6a38`**, startup 142 ms, main asset `index-BfNJd_tM.js`. Read-only production browser/API checks passed new sign-in wording, session 200, invalid-code-body 400, health 200, 390px width and no page errors. No production email was sent, no live room changed, and no database migration, secret rotation or pack release was performed. Real inbox rendering/delivery in Gmail/Outlook/Apple Mail remains unverified.

Exact next stage, now requested by the user: finish the bounded kart enhancement pass and its outstanding actual race/GPU-recovery checks, preserve enough account usage for the user's next task. The original request to continue until usage exhaustion is superseded.

## 20 October 2026 — bounded kart enhancement pass

Complete. The final browser rerun passed, including compact controller layout and thumb ownership recovery. Added server-projected drift charge, boost duration and wrong-way feedback, a drift-expiry/braking exploit fix, explicit get-ready/paused instructions, gate markers/place/speed proportion, and a separate confirmed finish/DNF card. Phones can use the native steering slider or an accessible captured thumb pad with dead zone and Swap sides. Independent thumb cancellation, pause/blur ownership reset and neutral release are covered. Compact active layout keeps the driving controls prominent. The R label now accurately describes drift/boost; this flat ghost sprint does not claim to implement a jump.

The stage has an original procedural venue with raised kerbs/plinth, dashed markings, stands, trees, a contrasting infield mark and clearer kart construction. Static props and dynamic kart bodies/wheels use bounded shared/instanced meshes. Pose/heading interpolation is frame-rate independent and takes the shortest turn; reduced motion does not interpolate travel. Theme changes rebuild the scene, hidden tabs suspend rendering, and lost/unavailable WebGL offers Retry circuit while the authoritative leaderboard continues. Resource-disposal and 80-kart geometry/draw-object bounds are tested.

`reduceKartTimeline` now replays each ghost's persisted server-stamped inputs independently with one whole-race clone per tick. Other guests' packet timing no longer subdivides that kart's integration. No browser time, checkpoint, score or finish authority was introduced. The new 80-player DO test passes input persistence across eviction, isolation, expiry and restricted guest projection. The failed 2-second stop assertion was corrected to a 3-second coast interval while explicitly retaining the 500ms input expiry for the last 100ms input. No expiry constant or scoring rule was weakened.

Checks: full root unit suite **62 files / 232 tests passed** with `npm run test:unit -- -- --maxWorkers=2`; `npm run typecheck` passed; focused API kart/HTML tests **3 files / 16 tests passed**, including the three actual DO tests; Worker-runtime email rendering and health **2 files / 2 tests passed**. The first heavily parallel unit run exposed an existing phase-transition test race between DOM entry and its mount effect; the assertion now waits for the same exact mount count instead of checking before the effect runs. Focused lint on all changed feature code passed. Repository-wide lint also reports two pre-existing errors (`apps/api/src/index.ts` unused `_c` and `apps/web/src/admin/rooms-page.tsx` synchronous effect state), plus existing Fast Refresh warnings; these unrelated source paths were not rewritten. The introduced auth helper lint warning was fixed with an explicitly typed function declaration, with no change to sign-in behaviour. Build/content/485-file artefact checks passed before the final cosmetic copy/ownership fixes; final build status is recorded below.

The complete real quiz → two-phone WebGL race → pause/reload → finished/DNF → saved award → podium browser test passed, including forced GPU context loss and recovery. It exercised 320/390/430px widths, short landscape, enlarged text and reduced motion. Reviewed actual TV and phone result screenshots. The final second run passed with the compact controller layout and thumb ownership fix. Reviewed the live controller screenshot: all A/B/R and steering controls fit the 390×844 viewport; secondary tools may scroll. Browser/API tests are local; physical iOS/Android thermal behaviour and an 80-device venue network remain unverified.

No kart enhancement deployment or birthday pack release was requested in the latest instruction. The email/sign-in release above remains production. Local rehearsal: `npm run dev`, create/sign into a lobby, join phones and connect the projector, choose Admin → Live controls → Start local kart rehearsal, then advance through quiz → kart. Exact next stage: user review of this tested enhancement pass; separately release a birthday running order/deploy kart when requested. Stop here to retain usage for the user's next task.

Final verification: the final build/content/485-file artefact check passed after all cosmetic and control-recovery fixes. E: source and the C: verification copy were checked byte-for-byte before saving the checkpoint. No further deployment was performed.

## 20 October 2026 — question catalogue browser

Implemented a browsable Admin → Question packs workspace instead of the single question dropdown and repeated full catalogue below the preview. Questions appear as selectable rows grouped by mechanic, with title, readiness and running-order status. Search matches titles, wording, IDs and mechanics; All/Ready/Drafts filters show counts and an explicit empty state. The selected question has a summary, missing requirements, full-details link and the existing real, isolated phone rehearsal. Previous/Next follows the visible grouped list and disables at the boundaries. Pack selection remains separate.

Selection and filters use existing URL query parameters, so refresh/direct links and browser history work. Opening full details preserves the browser context; the back link restores the selected question, search and readiness filter. Only existing authenticated catalogue metadata and phone projections are used. No answer key, room mutation, scoring change, question rewrite or pack release was added. The browser stacks on small admin screens, retains generous controls, and reuses the existing UI/Motion/theme primitives.

Files: `content-page.tsx`, `question-page.tsx`, admin CSS and their component tests; updated real browser tests for the new selection controls and details-link labels. Focused component tests initially passed 8 cases; an additional test checks back-link filter restoration. Real browser checks passed **3 cases**, covering actual phone submission/reset/pause/phase changes, multiple mechanics, details/privacy/404, authentication, return context and admin widths 320/390/430px plus existing larger/zoom checks. Typecheck, focused lint and build/content checks passed. Full unit result is recorded below. The browser screenshot uses stand-in rehearsal state; no live game was connected. Verification ran in the matching C: copy due to E: filesystem performance.

Exact next stage: review the new question browser locally, then deploy when requested. This request makes no deployment or running-order change.

Final verification: `npm run test:unit -- -- --maxWorkers=2` passed **62 files / 235 tests**. `npm run typecheck`, focused ESLint and the build/content checks passed. All three actual browser cases passed. The final source files match the verified C: copy; the only subsequent browser-test edit resets the scroll position before a screenshot. Changes are local and uncommitted.

## 20 October 2026 — phone and big-screen comparison

Implemented Admin → Question packs → selected question → Phone & big screen. Individual question details use the same comparison panel. Both previews follow the selected question and shared Get ready / Answering / Voting controls and reset together. The actual GuestPlay and StagePlay renderers are used, with existing stage safe areas, theme skin, typography and phase transitions. The projector iframe retains a 1920 × 1080 viewport scaled into a 16:9 frame; each screen has its own full-size link. The comparison stacks on narrow admin windows; side-by-side mode reserves at least a 320px phone viewport including allowance for its frame borders.

Added the authenticated `/admin/stage-preview/:version/:questionId` route, using the existing public question preview endpoint. Extracted the existing phone rehearsal fixtures into `question-rehearsal.ts` so both views share phase normalisation and explicitly labelled sample ballots. No live room, socket, timer, answer key, reveal or scores are fabricated. Phone submissions remain local to the phone view; they do not pretend to update a room or projector tally. Draft limitations, unavailable fields, sign-in recovery and retry remain explicit. Kart rehearsal continues to explain that no actual race is connected.

Files: preview panel/CSS, the new stage preview and its component tests, shared rehearsal helper, existing phone preview, application routes and browser tests. Root `npm run test:unit -- -- --maxWorkers=2` passed **63 files / 241 tests**; `npm run typecheck` passed. Focused lint passed with only the existing routes Fast Refresh warning. Build, artefact and content checks passed; seven existing incomplete birthday drafts remain unchanged. Final real browser checks passed **3 cases**, covering actual phone/projector rendering, shared phase/reset controls, a fixed 1920 × 1080 projector viewport, multiple mechanics, phone inputs, private inspection, authentication, no live sockets and 320/390/430px admin widths. Reviewed the actual comparison screenshot. The initial run exposed a phone-only instruction assertion on the stage and the follow-up caught the 4px phone-frame border allowance; both were corrected without changing question content or suppressing a failing check. The final build/content checks also passed after the CSS fix. Verification ran in the matching C: copy due to E: filesystem performance, with source copied back and compared byte-for-byte.

Try locally with `npm run dev`, sign into Admin → Question packs, select a question and scroll to Phone & big screen. Change phases for both views or open the big screen in its own tab for close inspection. No deployment or pack release was requested. Exact next stage: review the comparison, then commit/deploy when requested; actual connected room reveals, tallies and scores remain part of live-game rehearsal.

## 20 October 2026 — personal kart driving and a 50-player broadcast

Implemented the user's revised layout: guests drive entirely on their own phones; the projector becomes a spectator map and scoreboard. `KartDriverView` lazy-loads the existing Three.js circuit with a personal chase camera and a maximum of one kart, even if a full-room snapshot is supplied. The phone keeps steering/A/B/R, gates, server time, place, drift/boost/wrong-way feedback and the existing confirmed finish/DNF card. A lightweight SVG map switch disposes WebGL while keeping the same controls and socket. The map remains behind loading/recovery states. Mobile rendering requests low power, disables antialiasing/shadows/post-processing, caps DPR at 1 and targets 30fps. Hidden documents suspend rendering; reduced motion uses a north-up overhead view without the turning chase camera.

The big screen uses an SVG `KartMap` for every public driver pose, checkpoint sectors, finish stripe, theme colours and three separated leader number labels. It needs no WebGL context. `KartLeaderboard` pins five leaders and cycles five other drivers every four seconds, putting every member of a 50-player field on screen within the 45-second race. Operators can also browse the field manually. Cycling pauses with the game or while hidden. Server order, tied places, finish times and point awards are displayed directly; the display carousel has no gameplay authority. Layout checks keep ten rows visible at 1920 × 1080; phones are checked at 320/390/430px, short landscape and enlarged text.

No physics, socket protocol, scheduler or score-engine fork was introduced. Each phone still receives only its own pose, uses the existing 100ms input heartbeat and renders the server's saved ticks. The birthday `kart-sprint` remains ready in the draft catalogue and outside the running order. Its instructions and guest cues now say to race on the phone. New local rehearsals pin `kart-rehearsal-v2`; v1 remains resolvable with its original prompt/instructions so stored content is not rewritten. The birthday pack is not released.

Files/interfaces: `KartDriverView.tsx`, `KartMap.tsx`, `KartLeaderboard.tsx`, camera framing in `presentation.ts`, focused capacity/pose lookup in `circuit.ts`, existing canvas/wrapper/GuestKart/CSS, guest copy/direction, question instructions/registry, tests and [docs/kart-minigame.md](kart-minigame.md). Verified root `npm run test:unit -- -- --maxWorkers=2`: **64 files / 249 tests passed**. Typecheck and focused ESLint passed. Focused API kart logic/DO checks passed **2 files / 13 tests**, including 80-player persisted input isolation/recovery and old/new rehearsal content. Build, artefact checks and content preflight passed; seven unrelated birthday drafts remain incomplete.

The real two-phone quiz → race → pause/reload → GPU loss/retry → finish/DNF → saved award → podium browser test passed. An expanded real local room with two playing browser phones plus 48 passive registered stand-ins also passed, including all 50 map markers, browsing to drivers 46–50, scoreboard viewport fit, personal renderer identities, map switching and phone control bounds. Reviewed actual phone and 50-player stage screenshots. The first expanded attempt timed out at the existing cold local sign-in retry screen before enrolling any guests; the test now handles that explicit retry. The four-second carousel rerun caught a compact-phone viewport issue: the separate map-switch row could push pedals below the screen. Moving this secondary action into the driving viewport preserves full-size controls. After that fix, the full unit suite, typecheck, focused lint and build/content checks passed again. The final real 50-player browser rerun passed **1 case**, including the four-second carousel, 320/390/430px pedal bounds, short-landscape acceleration controls, GPU loss/retry, finish/DNF and podium. Reviewed the final 320px driving and 50-player broadcast screenshots. The verified source was copied back to E: and checked byte-for-byte.

Try with `npm run dev`, create/sign into a fresh lobby, connect the stage and phones, select Admin → Live controls → Start local kart rehearsal, then advance quiz → kart. Players watch their own driving view; the stage follows the field. Verification uses the matching C: source copy because E: filesystem operations are slow. Physical iOS/Android thermals, touch feel and 50 simultaneously active devices on venue Wi-Fi remain unverified. No deployment or unrelated resource changes were requested. Exact next stage: user review/deployment when requested, then a physical-device/venue rehearsal; no automatic birthday release or extra mechanic work.

Post-review correction: the phone's existing public leaderboard intentionally contains only the top eight plus the phone's own row. A screenshot revealed that using its length as the total displayed “of 8” in a 50-player race. Added optional server-projected `participantCount` from the frozen driver roster; the phone uses it and shows position alone for older snapshots. The pose and leaderboard shortlists remain unchanged. The existing full-room DO test now checks count 80 alongside one private pose and nine leaderboard rows. Root unit tests passed again **64 files / 249 tests**, focused API checks **2 files / 13 tests**, plus typecheck, focused lint and build/content. The final real 50-player browser check passed **1 case**, explicitly asserting “Position 1 of 50”, the restricted pose projection, phone controls at all three widths and short landscape, the spectator field pages, pause/reload, GPU recovery and persisted finish/DNF/podium scoring. All final source files match the verification copy. No deployment was performed.

## 20 October 2026 — playable upstream kart, isolated solo practice

Implemented the requested first step before room wiring. `/kart` now hosts an on-site solo build of the pinned Mario Kart 3.js fork, with its actual circuit/kart GLBs and adapted ground-following wheels, chassis, acceleration, steering, hop/drift boost and chase camera. Start loads the game assets; desktop arrows/Space and the existing shared phone controller drive it. Pause, explicit resume, reset, background input release, loading feedback and honest asset/WebGL retry are present. Portrait phones reserve space for full-size controls; landscape/desktop keep the kart visible between controls. The kart's admin comparison includes Play standalone kart. Other questions and existing layout rehearsals retain their behaviour.

Files/interfaces: new `apps/kart-solo` npm workspace, pinned engine dependencies, model/decoder assets, upstream provenance and notices, solo session adapter/UI/styles, `/kart` frame/route, admin link, component/browser tests, web predev/prebuild hooks and documentation. The generated `/kart-engine/` output is ignored and automatically rebuilt into web static assets before development/production builds. The same Worker serves it. No deployment, remote resources, room protocol, existing score engine or birthday running order changed. The pre-existing git lock helper work is preserved.

Decision: the upstream transient store is scoped to free solo practice, with no socket, validated lap, time limit, points or persistence. The original party race remains server-authoritative and uses its existing circuit. Full items/opponents/collision gameplay and upstream-to-room integration are deliberately deferred by the user's request. Music, landing-page graphics, external multiplayer providers and expensive effects are omitted. Models and Draco decoders are self-hosted. The upstream code/model provenance, exact asset hashes and decoder licence are retained.

Verification in the matching C: copy: root `npm run test:unit -- -- --maxWorkers=2` passed **65 files / 252 tests**; root `npm run typecheck` passed, including the new solo workspace. Focused ESLint passed with the existing routes Fast Refresh warning. Root `npm run build` passed the standalone/site builds, artefact checks (**499 files**) and content preflight; seven existing incomplete birthday drafts remain unchanged. `npx playwright test --config playwright.dev.config.ts kart-solo.spec.ts --workers=1` passed **3 cases**: actual GLB/WASM loading, acceleration, drift-release boost, pause/reset, context-loss recovery, no game room socket, held/released phone touch controls at 320/390/430px and short landscape, and failed-model retry. Reviewed real desktop, portrait and landscape screenshots. Physical-device thermals and mobile browser performance remain unverified.

Try locally: `npm run dev`, open `/kart`, press Start driving; or use the new link in the kart's admin Phone & big screen comparison. This is not deployed. Exact next stage: user review of standalone handling, followed by room integration when requested; no automatic next stage or deployment.

Final local setup: dependency installation in E: completed successfully and the lockfile still matches the verified C: copy. The standalone engine build then passed directly in E: (**697 modules**, 36.10s). An earlier extra E: build started before dependency extraction finished reported missing package files; rerunning after installation resolved it. All 33 deliberate source/configuration/documentation/asset files matched the verified copy before this final documentation note. A working local preview is running at `http://localhost:4173/kart`, and its browser panel was opened in Codex.

## 21 October 2026 — realtime fan-out, reconnects and sign-in start-up

Applied the plan in [docs/jackbox-realtime-plan.md](jackbox-realtime-plan.md), which compares 26 with the shipped Jackbox Party Pack 11 network client. All phases are built locally. Status, deviations and reasons are in that file's implementation table. Before and after figures are in [docs/verification-report.md](verification-report.md): at 80 guests the stage's worst wait between race updates fell from 31.8 seconds to 317 ms, and answer acknowledgement p95 fell from 3.1 s to 785 ms.

Files/interfaces: `room/realtime-meter.ts` (room health traffic), `packages/shared/src/rate-limit.ts`, `kartFrameSchema`, `acceptKartInputs` and `kartFrames` in `questions/kart.ts`, patch/resume views in `PartyRoom`, `live/server-clock.ts`, `play/preload.ts`, `device/error-reporter.ts`, `npm run load:realtime` with `apps/api/vitest.load.config.ts`. Socket messages added: `kart` frames, opt-in `patch` messages (`patches=1`, resume with `since=`), and `time:` clock samples. Room health gains Socket traffic and Phone errors, with the build id.

Decisions: controls stay durable before the tick reads them, as `kart-room.spec.ts` records; they are written once per tick with their own arrival times. The lifetime caps of 100 commands and 60 telemetry reports per phone are replaced by token buckets, because drafts counted towards the cap and could lock a phone out. The stage still hides a question at once on disconnect, and the room does not pause itself when the stage drops. Patches are opt-in, so a phone on an older cached build keeps full snapshots during a deploy. No future question's images are preloaded.

Also fixed: `PartyRoom` now opens its own database pool. The module-wide pool could be reused across rooms in one isolate, which Workers forbid, and a second room's diagnostics could hang. In development, a cold sign-in check could take longer than the 12-second client timeout and leave "We couldn’t reach sign-in" on screen. Vite now warms sign-in when it starts, and `useAdminSession` retries quietly up to three times before showing the message.

Commands: `npm run test:unit` 70 files / 276 tests passed; typecheck and build passed; API results and the two pre-existing lint errors are listed in the verification report. Not run: a browser check of the sign-in fix (another session held the dev port), staging, and the venue Wi-Fi drill. Changes are local and uncommitted. Exact next stage: review, then a staging deploy and the rehearsal steps in [docs/event-runbook.md](event-runbook.md) when requested.

Deployed-site follow-up (21 October 2026): staging showed the real cause of "We couldn’t reach sign-in". About one `/api/admin/session` call per page load ended in Cloudflare error 1101; the Worker log said the code had hung. `openDatabase` cached one Neon pool for the whole isolate, and Workers do not let a request use I/O that an earlier request opened, so the reused pool's query never finished. The error page is HTML, so the client could not read it and showed the message. `openDatabase` now gives each Neon caller its own pool and still caches local PGlite. `test/database-sharing.spec.ts` covers both.

## 21 October 2026 — kart multiplayer hardening, first stage

Status: implementation and logic/runtime checks complete; end-to-end browser rehearsal remains unverified. This stage hardens the existing connected ring circuit. The imported `/kart` circuit remains solo practice; no deployment, birthday release, external resource creation or unrelated Jackbox changes were made.

Files/interfaces: `questions/kart.ts` gains a bounded per-driver transient input buffer and saved pause-boundary release; `PartyRoom` validates collection/race/roster before buffering, flushes arrivals before host phase commands and retains the existing tick transaction. The pure shared kart reducer gains a trusted `release` event, with no WebSocket wire change or storage migration. `room-socket.ts` rejects backwards race time, old room/race frames, paused/non-collecting frames and attempts to reopen ended results. Existing kart API/scoring and socket test files cover these changes. Updated [docs/kart-minigame.md](kart-minigame.md) documents the transport and pause behaviour.

Decisions: at most four transient controls per driver, at least 80ms between arrivals, maximum 80 roster members. Invalid inputs and one noisy driver cannot evict another driver's queue. These controls remain unacknowledged until the existing durable tick processes them; eviction can lose transient arrivals. Pause catches up to its boundary, releases held controls and drift charge, clears pending histories and preserves reconnect sequence cursors. Existing speed/active boost, track, 45-second deadline, scoring, private phone projection and single room socket/scheduler remain in use.

Browser rehearsal changes: observe full snapshots, patches and compact kart frames; exercise independent driving and disconnect/rejoin while the other phone drives. `KART_REHEARSAL_PLAYERS=2` selects a lean two-phone run; the default retains 50-player map/field coverage. Stand-ins join in bounded bursts, with the last driver enrolled last. Local sign-in/room retry controls and bounded readiness waits handle visible startup failures without changing race deadlines or skipping assertions.

Commands/results in E: final `npm run test:unit -- -- --maxWorkers=2` passed **70 files / 277 tests**; `npm run test -w @26/api -- test/kart-room.spec.ts test/kart-score.spec.ts` passed **2 files / 16 tests**; `npm run typecheck` passed, including solo practice. Focused ESLint and source Prettier checks passed. `LOAD_SIZES=50 npm run load:realtime` passed **one local workerd sample**, with 50 authenticated synthetic clients and race updates. Numeric latency figures were not captured, so no performance improvement is claimed. The first cold unit run had four worker-start timeouts, and the first pause API case timed out; the unchanged assertions passed on warm reruns. An initial concurrent typecheck read the pre-edit shared declaration; rebuilding shared declarations and rerunning root typecheck passed.

Browser/manual verification: Chrome loaded the real local admin sign-in page. The standard Playwright dev-server startup exceeded 120 seconds; a direct `npm exec -w @26/web -- vite --port 4173` server eventually started. Rehearsals then used a temporary config against this source server; that config was removed afterwards. Full 50-player runs timed out during enrolment (29, then 42 guests), before racing. Two-phone attempts encountered unavailable admin room details, pending Advance requests, and finally a phone remaining “Reconnecting to the lobby” for 20 seconds. One attempt reached kart intro with both phones and the stage connected, but **no full browser race/reconnect/finish pass is claimed**. The final command used `KART_REHEARSAL_PLAYERS=2` and `kart.spec.ts --workers=1`. No full production build, deployment or physical-device/venue check was run.

Try the existing local server at `http://localhost:4173/admin`: create/sign into a lobby, connect the stage and phones, choose Live controls → Start local kart rehearsal and advance to kart. The unresolved local lobby/admin connectivity also affects this path. Exact next stage: diagnose that connectivity and complete a real two-phone race/reconnect/finish rehearsal before starting the separately scoped imported-circuit multiplayer integration. Do not treat the ring race as fully rehearsed or automatically begin the next stage.

## 21 October 2026 — kart hardening pushed and deployed

Following the user's explicit request, committed the ten kart implementation/test/documentation files as `34056cb` (`Harden kart multiplayer input and pause recovery`) and pushed `master` to `origin` (`https://github.com/Hum2a/26.git`). The branch was in sync before the commit; no remote history was rewritten.

`npm run deploy:both` passed, building and deploying staging followed by production through the existing release script. Both builds included solo/site bundles, generated-target validation, generated-secret stripping, artefact checks and content preflight. Existing bindings and deployed secrets were retained; no migration or secret rotation ran. Production Worker `26-humza-website` reports version `e7a33deb-e209-46f6-bf66-5006f4c45bbd`. Both environments contain application commit `34056cb`; this follow-up changes documentation only.

Post-deploy HTTP checks passed: `https://26-staging.humza.website/api/health` returned `ok: true` with `environment: staging`; `https://26.humza.website/api/health` returned `ok: true` with `environment: production`. `/join` and `/kart` returned HTTP 200 on both origins. These are availability checks, not an authenticated room or race rehearsal. The previous unit/API/type/lint/load results and unresolved local browser connectivity remain as recorded above; deployment does not resolve or validate that limitation.

Exact next stage: diagnose the lobby/admin connectivity and complete the real two-phone race/reconnect/finish rehearsal before integrating the imported circuit. No automatic next stage was started.

## 21 October 2026 — dedicated admin Kart page

Status: implemented locally. Added `/admin/kart` under the existing authenticated admin parent, a global Kart sidebar link, the Kart document title and a permitted sign-in return path. The page offers Drive, Phone & stage and Multiplayer views, using query parameters for direct links and short eased opacity transitions. Switching views unmounts the previous iframe/preview.

Drive embeds the existing `/kart-engine/index.html` solo application and links to `/kart` in a separate full-screen tab. It requests no room or content data. Phone & stage fetches existing authenticated content metadata only when selected, discovers the birthday kart (falling back to another actual kart pack), and reuses `PhonePreviewPanel` and the existing public-field preview routes. Loading, retry and missing-content states are explicit. Multiplayer links to the existing room workspace and explains the connected ring circuit, local-only rehearsal action and the separate solo circuit. No new socket, room state, scoring, question content, release or backend endpoint was introduced.

Files: new `admin/kart-page.tsx`, its CSS and five component tests; existing routes, admin shell, sign-in return allow-list, admin README and kart guide updated. Tests cover direct driving without content requests, active navigation/title, iframe teardown, birthday pack discovery/shared previews, recoverable missing layouts, existing-room navigation and safe sign-in return handling.

Verification: final `npm run test:unit -- -- --maxWorkers=2` passed **71 files / 282 tests**; `npm run typecheck` passed, including solo practice. Focused ESLint passed with the pre-existing routes Fast Refresh warning; the new page/test lint passed without errors. Edited source/docs were formatted and `git diff --check` passed. The first cold unit pass had four worker-start timeouts; the warm full rerun passed without changing assertions. Two Testing Library type errors in the new tests were corrected before the final typecheck. No production build, authenticated browser/visual rehearsal or deployment was run for this addition. A local source server was started and then stopped; no visual pass is claimed.

Try: `npm run dev`, sign in and choose Admin → Kart, or open `/admin/kart` directly. Existing solo/multiplayer and local connectivity limitations remain unchanged. Exact next stage: review this hub and push/deploy when requested, then resume the outstanding real multiplayer rehearsal before imported-circuit integration. No automatic next stage was started.

## 21 October 2026 — admin Kart page pushed and deployed

Following the user's explicit request, committed the nine admin Kart page/source/test/documentation files as `3c7037a` (`Add dedicated admin kart workspace`) and pushed `master` to `origin`. `npm run deploy:both` passed: staging, then production, using the existing environment-specific builds and bindings. Build, generated-secret stripping, artefact checks (515 files in the production build) and demo/birthday content preflight passed. No migrations, secret rotation, question-pack release or new remote resources were required. Production Worker version: `56bf6a9e-1ca1-4028-86b3-ce66fac22445`.

Post-deploy checks passed on both `https://26-staging.humza.website` and `https://26.humza.website`: `/api/health` returned `ok: true` and the matching environment; `/admin/kart` returned HTTP 200. Fetching each public entry bundle confirmed the Kart admin route, full-screen action and application commit `3c7037a`, so these checks verify the new application rather than only the SPA fallback. This follow-up changes documentation only. No authenticated visual/browser rehearsal is claimed; existing unit/type/lint results and multiplayer rehearsal limitations remain recorded above.

Try: sign in at `https://26.humza.website/admin/kart` or choose Kart in the admin sidebar. Exact next stage: review the live hub, then resume the outstanding multiplayer rehearsal; no automatic next stage was started.

## 21 October 2026 — arcade driving, solid track scenery and manual recovery

Status: implementation complete locally for imported solo driving and newly created connected ring races. Added a shared pure velocity/steering/grip model with bounded 20 ms steps, swept-circle wall/end-point contacts and sliding, braking before reverse, deliberate fresh-input drift boosts and collision cancellation of charge/boost. The ring keeps server authority, scoring, eight ordered gates and its existing scheduler/socket. New races store private physicsVersion arcade-v2; saved unversioned races continue using their original simulation. Wrong-way feedback uses resolved velocity. Public snapshot fields remain compatible with existing clients.

Files/interfaces: packages/shared/src/kart-driving.ts; versioned driver body/safe-pose/recovery state in kart.ts; generated solo track/colliders.json and its spatial index; reproducible scripts/kart-colliders.mjs / npm run kart:colliders; adapted solo PlayerController, surface sampling, render interpolation, cosmetic hop, gamepad adapter, toolbar/status and compact phone actions. The unchanged imported GLB SHA-256 is recorded in generated data and UPSTREAM.md. Solid fence/scenery meshes were sliced at body height and their projected edges visually audited against road/dirt geometry. Low kerbs, overhead signs and distant backdrop are excluded. No new obstacles, items, kart-to-kart impacts or imported-track multiplayer were added.

Back to track restores the last road pose with clearance to steer, removes velocity/drift/boost and requires fresh controls. Solo Reset kart remains a separate grid reset. Connected recovery uses the existing tracked command/receipt path with raceId/requestId, authenticated player identity, live collect validation, two-second active-race cooldown, pending-input clearing and durable commit before acknowledgement. It restores checkpoint/progress with no time/progress gain. Added recovery persistence/eviction, spectator/stale-race/cooldown, legacy-race, immutability, swept impact/corner/reverse/ring-boundary, drift-release, velocity-feedback, pending-control and socket-replay tests. Browser rehearsal also found and fixed keyboard key-up being ignored after focus moved to the steering slider; a regression test covers that release.

Verification: final npm run test:unit -- -- --maxWorkers=2 passed **71 files / 286 tests**; focused API tests (kart-driving.spec.ts, kart-score.spec.ts, kart-room.spec.ts) passed **3 files / 25 tests**. npm run typecheck passed including solo. npm run build passed, including generated-secret stripping, artefact checks and both content preflights (existing incomplete birthday drafts remain unchanged). npm run lint passed with the existing 12 Fast Refresh warnings; final focused lint on the last edited TypeScript files passed. Source formatting and git diff --check passed. Initial checks caught a zero-delta camera edge case and a React effect lint error; both were corrected without removing assertions.

Browser verification: the real solo Playwright scenario passed **1 test / 19.5 seconds**, covering GLB/Draco loading, driving distance/speed, gentle drift charge and release boost, manual recovery with stopped controls, pause, reset and context-loss recovery. Tight full-lock driving now reaches barriers/off-road, so the browser manoeuvre was updated to hold gentle steering in one pointer gesture. A separate live diagnostic observed repeated barrier contacts and reduced off-road speeds; the generated top-down collider audit was inspected. The two-phone Playwright scenario reached the connected kart collect phase and actual driver views, but failed its first movement assertion (observed speed zero within its five-second polling window). Its reconnect/podium/recovery sequence therefore remains unverified; no full browser multiplayer success is claimed. Physical-phone thermal performance, complete track laps and exhaustive scenery coverage remain manual verification. This is a ground-plane arcade model, not vertical rigid-body physics.

Try: npm run dev → Admin → Kart → Drive (or /kart) for solo. Connected races still use the existing ring rehearsal/workspace. No push or deployment was performed for this stage. Exact next stage: review the handling locally, diagnose the outstanding two-phone movement rehearsal, and push/deploy only when requested. No automatic next stage was started.

## 21 October 2026 — kart handling/collisions deployed

Following the user's explicit deployment request, committed the reviewed kart implementation as 6832f1f (Improve kart handling and add track collisions and recovery) and pushed master to origin. npm run deploy:both succeeded, building and deploying staging followed by production with existing bindings and secrets. Both environment builds, generated-secret stripping, artefact checks (517 files) and content preflights passed. No migrations, secret rotation, new resources or birthday pack release were performed.

Staging version: 3894a13f-1887-478a-9e28-009ee0e66e11. Production version: d682b023-4efa-46ab-8b30-0a394a39d0c2. Post-deployment HTTP checks passed on both domains: /api/health returned 200 with ok true and the correct environment; /admin/kart and /kart-engine/index.html returned 200; the referenced index-Dx2Pcf1P.js engine bundle returned 200 and included Back to track and barrier-contact feedback. These checks confirm the new engine is served; they do not establish live multiplayer movement. The prior 286 UI tests, 25 focused physics/room tests, typecheck, lint and solo browser result remain recorded above; no repeat broad testing was required for this deployment-only follow-up.

Try https://26.humza.website/admin/kart (Drive) or https://26.humza.website/kart. Existing unversioned races retain their original simulation; new ring races use arcade-v2. The two-phone browser movement failure remains unresolved/unverified. Exact next stage: review deployed solo handling and diagnose that connected multiplayer rehearsal. No automatic next stage was started.

## 21 October 2026 — animated kart drift effects

Status: implemented locally for imported solo driving and the connected 3D phone renderer. Added shared presentation-only driftStrength/driftSparks helpers and tests, a solo DriftEffects component, and one instanced drift/boost batch in the existing ring scene. Eight recycled wheel sparks ease in/out, spread/grow with drift charge, use the highlight when charged, and stretch/speed up for boost. Reduced motion uses two stationary wheel glows. Colours come from existing theme roles. No new assets, dependencies, scoring, physics, socket, timers, audio or state authority were introduced. The SVG stage/lightweight map is unchanged.

The existing 80-kart resource test initially caught an extra draw object. Consolidating the old boost cone into the new drift/boost batch retained the existing geometry/material/draw-object budgets and complete disposal coverage without weakening that test. Added tests cover charge growth, boost trails, recycled movement, frame-rate-independent emission, stationary reduced-motion feedback, actual scene matrices/instance counts and clearing emission when the race changes. Solo uses one instanced mesh and no per-frame React state.

Verification: final npm run test:unit -- -- --maxWorkers=2 passed **72 files / 290 tests**. npm run typecheck passed, including solo. Final npm run build passed, including generated-secret stripping, artefact checks and unchanged demo/birthday content preflight. Focused ESLint passed on changed TypeScript/TSX and tests. Real solo Playwright flow passed **1 test / 27.6 seconds**, covering asset load, speed/distance, drift charge/release boost, manual recovery, pause/reset and graphics context loss. Captured and visually inspected the new wheel sparks in the real circuit while paused (artifacts/browser-checks/drift-effects-paused.png). An earlier live screenshot delayed input release until the kart reached a barrier, so its boost assertion failed; the normal uninterrupted browser scenario passed. No two-phone/physical-device rehearsal was repeated; the previously recorded multiplayer movement limitation remains.

Files: apps/web/src/kart/drift-effects.ts and .test.ts; circuit.ts and circuit.test.ts; apps/kart-solo/src/DriftEffects.tsx and upstream/PlayerController.jsx; kart guide and upstream provenance updated. Try npm run dev → Admin → Kart → Drive, hold A and gentle steering with R, then release R to boost. No push or deployment was performed. Exact next stage: review the effects and deploy if requested, then resume the outstanding connected multiplayer movement investigation. No automatic next stage was started.

## 21 October 2026 — collectable kart power-ups (local implementation)

Implemented turbo, bubble shields and oil slicks for both imported solo practice and newly created connected ring races. The optional preference question received no answer; proceeded with the stated arcade-combat default. Added shared kart-powers.ts with deterministic item choice, swept pickup/hit checks, a one-item slot, per-driver eight-second box recharge, timed effects and bounded slicks. Ring races freeze power-up rules with private powerUpVersion 1; older stored races keep their original rules. Public snapshots add optional powers data; held inventories are projected only to their authenticated phone, including the personalised fast-frame path. Existing score/gate/deadline ownership is unchanged.

Turbo lasts 1.2 seconds, shield lasts five seconds and blocks one slick, and oil lasts eight seconds and applies a 1.6-second slowdown/cancels charge/boost. Owner grace is 750 ms and each slick hits a kart once. Maximum active slicks: 64. Use is an existing tracked command/receipt action (kart-use-item, raceId/requestId), validated against the racing authenticated principal and collect phase, caught up and persisted before acknowledgement. Retries reuse the original id. Using an item preserves held driving input. Manual recovery retains inventory and clears active effects; solo reset clears the full practice inventory/world. No client chooses an item, hit, player target, position, timer or score in a connected race.

Files/interfaces: packages/shared/src/kart-powers.ts and existing kart reducer/projection; API kart helper and shared kart action receipt path; room socket/guest acknowledgement wiring; reusable PowerUpControl; solo TrackItems and existing session/store/controller; ring scene and SVG map. Boxes/oil/shields use shared or instanced geometry, palette roles and reduced-motion fallbacks. Finish-line tiles were batched to offset the new draw objects. Solo inventory is isolated from per-frame React rerenders. Added kart-powers.spec.ts, room persistence/privacy/rejection coverage, item pending controls, socket replay, render-instance coverage and a real solo e2e pickup/use/reset scenario.

Verification: focused API tests passed **4 files / 30 tests** (kart-powers, kart-driving, kart-score, kart-room). Typecheck including solo and production build passed; build stripping/artefact and existing content preflights passed. Focused ESLint passed after correcting one prefer-const error; one solo updater parameter needed an explicit type. The real solo Playwright power-up scenario passed **1 test / 9.1 seconds**, including actual road collection, use, spent slot, reset, 390px layout and no page errors. Its first attempt expected generic use text when the shield correctly displayed its active status; the assertion now accepts the actual item-specific feedback.

Full UI verification is currently incomplete: an earlier full pass passed **72 files / 292 tests**; the subsequent pass had **292 passed / 1 failed** after the new renderer assertion was added. Concurrent driver-customisation edits added multiple driver-part batches, so the existing 80-kart resource test expects four batches of 80 but observes eleven. Those concurrent changes are preserved, and that assertion has not been removed, skipped or weakened. Driver/media work is appearing in the same workspace, including overlapping renderer/socket files; it is not part of this power-up change and must be reviewed separately before committing/deploying. A final green combined suite is still required before calling the stage fully verified. No multiplayer browser rehearsal or large-room item/hazard load test was repeated; the prior multiplayer movement limitation remains.

Try npm run dev → Admin → Kart → Drive, drive straight through a glowing box and press the named Use button. Connected item boxes appear only for new ring races. No commit, push or deployment was performed. Exact next stage: reconcile the concurrent driver renderer resource tests, run the combined required checks, review the power-ups and deploy when requested. No automatic next stage was started.

## 21 October 2026 — kart drivers with guest photo faces

Implemented drivers in the karts, chosen in the lobby, with an optional guest photo on the driver's face. Details and decisions are in [docs/kart-minigame.md](kart-minigame.md) under "Drivers and guest faces".

Files/interfaces: `packages/shared/src/kart-driver.ts` (roster, `driverChoiceSchema`, `lobbyDriverSchema`); `apps/api/src/room/drivers.ts`; `driver` socket command in `PartyRoom`; media `purpose` column with face rules in `media/records.ts`; exclusions in stats, trolls, the archive gallery and stage media; admin media face marker. Web: `DriverPicker`, `DriverBadge`, `driver-face.ts`, `drivers-context.ts`, `KartDriversProvider`, `driver-rig.ts`, `media/face-upload.ts`, `media/photo-prepare.ts`; circuit, canvas, map and leaderboard wiring.

Checks: `test/drivers-room.spec.ts` (3), `driver-rig.test.ts` (9), `driver-picker.test.tsx` (4), and the updated `circuit.test.ts` budget, which now also asserts the same draw-object count for one driver as for eighty. Full web unit suite 74 files / 306 tests passed before the final refactor; the related 17 files / 104 tests passed after it. The relevant API specs passed (10 files / 56 tests). Typecheck passed; lint has no errors. A headless Chromium render of all six styles, with and without a face, and of the look-back and finish poses, was reviewed. Not checked: a live room in the browser, physical phones and the projector.

This work shares files with the kart power-ups work in progress in the same checkout. Nothing is committed.

## 21 October 2026 — drift handling and turbo polish

Status: implemented locally. Fixed charge being lost when steering returns to neutral before the drift button is released. Shared arcade driving now latches drift direction, permits counter-steering without clearing the bank, has separate entry/sustain speed thresholds and builds charge faster while steering into the corner. Three charge tiers (700/1400/2400 charge-ms) award 600/900/1200 ms turbos with faster acceleration and no additive stacking. Grip recovery, stale controls, brake/throttle cancellation, dirt, impact and recovery retain explicit handling. Compact ring steering is tuned separately from the full solo circuit. Legacy races keep their original branch.

Files/interfaces: `packages/shared/src/kart-driving.ts` (`driftSide`, profile `driftTurnBase`, `drivingDriftLevel`); driving regression tests; presentation-only `driftPose` and test; solo controller, DriftEffects, upstream Kart/constants, charge-tier HUD/CSS; solo browser regression; kart guide/provenance. Solo now follows the physics for every input source, with eased slip yaw/lean, entry hop, turbo camera distance/FOV and a 32-particle world-space spark wake. Existing eight wheel particles remain. Reduced motion removes travel/camera/body effects and retains stationary wheel feedback. No new dependencies, audio, assets, sockets or score engines.

Verification so far: `npm run test:unit -- -- --maxWorkers=2` passed 75 files / 311 tests; `npm run typecheck` passed including solo; focused ESLint passed. `npm run test -w @26/api -- test/kart-driving.spec.ts test/kart-score.spec.ts test/kart-powers.spec.ts` passed 3 files / 27 tests, including after the final solo turn-base adjustment. Solo production builds passed (including the browser server's final predev rebuild); existing large-bundle advisory remains. Final `npm run build` also passed, including generated-secret stripping, 527-file artefact checks and content preflights; existing draft-content notices remain. `git diff --check` passed. Browser verification result is recorded below when complete. First attempt timed out starting the dev server; another hit a Windows watcher lock. An interrupted run was replaced after tuning. A screenshot during an earlier driving run delayed release until the kart entered dirt, correctly cancelling the bank; this is not a successful drift/boost rehearsal. The off-road screenshot was inspected for layout only.

Try `npm run dev` → `/kart` (or Admin → Kart → Drive). Accelerate, steer and hold Space/touch R; adjust the line, then release drift while keeping the accelerator held. The HUD names Mini/Super/Ultra readiness. Physical-phone feel and a live multiplayer rehearsal remain manual checks. No commit, push or deployment. Other device-profile work appearing concurrently in this checkout was left untouched. Exact next stage: review the local driving feel and physical-device handling; deploy only when requested. No automatic next stage started.

Final browser verification: `npx playwright test apps/web/e2e/kart-drift.spec.ts apps/web/e2e/kart-solo.spec.ts -g "real solo engine|loads the real circuit" --workers=1` passed **2 tests / 1.7 minutes** against the final production build. This covers real GLB/Draco loading, charge surviving neutral steering, actual release turbo with a recorded painted speed over 100 km/h during the turbo, the `/kart` iframe, distance, recovery, pause, reset and graphics context-loss recovery, with no page errors. The focused static-engine config is `playwright.kart.config.ts`; it builds the actual engine and needs no party server or credentials. Temporary diagnostics/configuration were removed.

The embedded investigation found a second product issue: terrain warning text hid an active turbo. The trace recorded Mini → Super → Turbo active alongside off-road text, followed by barrier cancellation; the key had released correctly. The HUD now keeps Boost visible alongside the terrain warning. The broad rehearsal uses gentler steering, starts as soon as its original 80 km/h condition is reached, and checks its original distance condition after release. The focused test records peak speed during painted Turbo active frames so polling cannot miss a short burst; its >100 km/h assertion is retained. Solo typecheck and final production build passed again after the HUD fix. Physical phones, full laps and a connected multiplayer driving rehearsal remain unverified; no deployment was performed.

Final repeated unit suite after the HUD fix: `npm run test:unit -- -- --maxWorkers=2` passed **75 files / 311 tests** (170 seconds). Final focused lint and whitespace checks passed. Required whole-workspace typecheck passed earlier, with solo typecheck repeated successfully after the last solo UI change. Stage complete locally. Exact next stage remains physical-device feel/lap review and connected multiplayer rehearsal; commit/deploy only on request.

## 21 October 2026 — photo wall, phase 1 (uploads and posts)

Plan: [docs/photo-wall-plan.md](photo-wall-plan.md). Defaults chosen by Humza: approve first, show in breaks only, gallery opt-in ticked by default.

Built: media purpose `wall` (photos only, allowed in every phase including the lobby and podium, its own limits of 15 per player and 250 per room, plus a 45-second cooldown and at most 3 waiting per player). New room tables `wall_post`, `wall_reaction` and `wall_setting`. Guest socket commands `wall-post` (media id, caption, frame, keep) and `wall-withdraw`, both through the receipted `acceptGuestValue` path. Captions are cleaned in `@26/shared` (`cleanWallCaption`) and frames come from `wallFrames`. Image reads for wall media: the host sees everything, the owner sees their own, and anyone else (the stage included) only sees a photo that is showing or has been shown. Withdrawing hides the image.

Fix found on the way: every committed photo was being added to the stage as a "Photo from" cue, whatever its purpose. Cues are now limited to question photos (`purpose = 'round'`), so wall photos and kart face photos no longer appear there.

Files: `apps/api/src/wall/store.ts`, `packages/shared/src/wall.ts`, `apps/api/src/media/records.ts`, `apps/api/src/media/routes.ts`, `apps/api/src/room/party-room.ts`, `apps/api/src/room/schema.ts`, `apps/api/src/room/limits.ts`, [docs/data-inventory.md](data-inventory.md).

Checks: `test/wall-upload.spec.ts` (6 tests) passed; `test/drivers-room.spec.ts` and `test/media.spec.ts` (10 tests) still pass; `npm run typecheck` passed. The full API and web suites were not run. Not built yet: the queue and scheduler (phase 2), host moderation commands (phase 3), snapshots (phase 4), and every screen. Nothing is committed.

## 21 October 2026 — photo wall, phase 2 (queue and timing)

Built: the pure queue engine `nextWall(state, event, now)` in `packages/shared/src/wall.ts`. Photos take turns by player (whoever's last photo started longest ago goes next, then the oldest approval). With `breaks` placement nothing starts during prompt, predict, collect, vote or reveal, and a photo already on screen finishes. More than 6 waiting shortens each photo to 5 seconds. Events: `tick`, `skip` and `force` (the last two are for the host controls in phase 3). Switching the wall off ends the photo on screen.

Room side: `apps/api/src/wall/queue.ts` `syncWall` reads the queue from SQL, runs the engine, writes statuses (`showing`, `shown`) and keeps one background job, `wall-advance`, due when the current photo ends. Background jobs keep running while a round is paused. It runs on a new or withdrawn post, on every phase entry (`createGameStore.onEnterPhase`) and on the alarm (`onBackgroundJob`). `onAlarm` now marks the wall job done before calling its hook, because the hook reschedules under the same job id.

Files: `packages/shared/src/wall.ts`, `apps/api/src/wall/queue.ts`, `apps/api/src/room/lifecycle.ts` (`wallAdvancePayload`), `apps/api/src/questions/multiple-choice.ts`, `apps/api/src/room/party-room.ts`. Tests: `test/wall-engine.spec.ts` (8, plain Vitest), `test/wall-queue.spec.ts` (4, room), and shared helpers moved to `test/wall-support.ts`.

Checks: all three wall specs (18 tests) passed; `phase`, `troll` and `hardening` specs (with the queue spec again, 20 tests) passed; `npm run typecheck` passed. The full suites were not run. Note for tests: an alarm set in the past can fire by itself before `runDurableObjectAlarm`, so assert the resulting state, not that call's return value. Not built yet: host moderation (phase 3), snapshots (phase 4), screens. Nothing is committed.

## 21 October 2026 — end-of-night fun facts

Status: implemented locally. A host-paced `facts` phase sits between the final scores and the podium. It only opens when the room has at least one card. Advance steps the card. The last Advance, and Finish, enter the podium and then queue the archive. There is no gameplay alarm.

Facts are calculated before the sentence, from data the room already stores. Guests only. Latest device report. A sentence may only repeat a number stored on its fact. Device lines do not name a guest. The matching phone and personal results can add “That’s you.” Sentences are frozen in `archive_fun_fact`. Membership stays in `archive_fun_fact_member` and off the public page. Room schema is 15 (`fun_fact_index`). Archive schema is 3.

Files: `apps/api/src/stats/fun-facts.ts`, `fun-source.ts`, `packages/shared` `funFactCardSchema` and the `facts` phase, room lifecycle and snapshots, archive document/store/mirror/schema, results projection, stage/phone/results/host screens, join copy, and the stats, device, results and data-inventory notes.

Checks: `npm run typecheck` passed. `npm run test:unit` passed **76 files / 314 tests**. API `test/fun-facts.spec.ts` (10), `test/fun-facts-room.spec.ts` (3), `test/archive.spec.ts` and `test/results.spec.ts` passed. `test/archive-room.spec.ts` and `test/results-room.spec.ts` failed before the tables existed (`relation "archive_fun_fact" does not exist`). The archive writer now applies the schema on use, and a later public results read for the rehearsal game succeeded, so those two specs were not re-run after that. The reach-podium loops in those files were raised from 16 to 32. `npm run archive:migrate -- --env local` was started and had not returned.

Browser: a local lobby with one guest skipped the facts phase. Final scores moved straight to the podium. The projector showed the podium and the existing device highlight, not a fun-fact sentence. Join → About this game includes the room-totals sentence. The public results page then showed Amina’s standing and the comparison highlight, and it omitted “From your phones” because that room had no fact cards. The archive read applies the schema itself, so the new tables were created on that read. A three-guest live facts beat, the phone “That’s you” line, and reduced motion on that beat were not reached in the browser. Those screens are covered by the web unit tests. Nothing is committed. Exact next step: re-run `test/archive-room.spec.ts` and `test/results-room.spec.ts` now that the tables exist, then walk a three-guest room through the facts beat.

## 22 October 2026 — photo wall, phase 3 (host moderation)

Built: host commands `wall-approve`, `wall-decline`, `wall-pull` (all take `postId`), `wall-skip`, `wall-next`, `wall-settings` (`wallSettings`: enabled, moderation, placement, showMs from 4 to 20 seconds, captions; only the fields given change), `wall-mute` and `wall-unmute` (`playerId`). They go through `/api/rooms/play` and `readHostDetails` like the troll switches, with receipts and rollback from `phaseCommand`. Decline and pull hide the image, even from its owner. Mute declines that guest's waiting photos, and kick now does the same. Every command runs the queue once, so the wall reacts straight away. `changeWallSettings` validates again inside the room rather than trusting the route. Host notices are in `apps/web/src/admin/command-notices.ts`.

Files: `apps/api/src/wall/moderation.ts`, `apps/api/src/room/routes.ts`, `apps/api/src/room/host-actions.ts`, `apps/api/src/room/party-room.ts`, `apps/api/src/room/limits.ts`, `apps/web/src/live/room-api.ts`. Test: `test/wall-moderation.spec.ts` (6); `test/wall-support.ts` gained a `host()` helper.

Checks: the first run passed 4 of 6 moderation tests. It found two problems: bad settings were accepted when the room was called directly (fixed by validating in the room), and the unmute test hit the cooldown (correct behaviour; the test now allows for it). The re-run after those fixes did not complete: the Cloudflare test workers failed to start while the machine was overloaded. Only `wall-engine.spec.ts` (8) ran and passed. **The room specs have not been re-run since the two fixes.** `npm run typecheck` reported no errors. Nothing is committed.

## 22 October 2026 — photo wall, phases 4 to 9

**Phase 4, snapshots.** One `wall` section in the lobby snapshot (`wallSnapshotSchema` in `packages/shared/src/wall.ts`), filled per audience by `apps/api/src/wall/snapshot.ts`. Everyone gets `enabled`, `placement`, `now` (with reaction totals) and `waiting`. The stage also gets `next` (to preload) and, at the podium, `reel`. A guest gets `blocked`, `cooldownUntil` and `mine` (status, queue position, reactions). The host gets `queue` (pending and queued, in show order), `recent`, `settings` and `muted`. A pending photo only reaches the host and its owner. When captions are off, they are left off the stage and other guests. `wallQueueOrder` gives the expected order. The image access rule moved to `apps/api/src/wall/access.ts` and now lets the stage fetch the next queued photo, so it can preload it.

**Phase 5, phone.** `apps/web/src/wall/`: `GuestWall` (composer with Take a photo, Selfie and Camera roll; live framed preview; caption with a count; seven frame chips; a gallery tick box, ticked by default; upload progress; Try again re-posts without re-uploading), a status tray with queue position and Withdraw, and a reaction bar while someone else's photo is up. `FramedPhoto` draws all seven frames with theme colours only. `sendWallPhoto` reuses `compactJpeg` (1280 px) and the existing slot, PUT and finalise; HEIC is refused with the existing message. A buzz plays when your photo goes up (`device/haptics`). The panel is a "📸 Send to the big screen" disclosure on the guest page, available in every phase including the lobby. New guest command `wall-react`: only the photo on screen, at most 20 per guest per photo, taps closer than 300 ms are not counted (table `wall_reactor`).

**Phase 6, projector.** `apps/web/src/stage/wall/stage-wall.tsx`: spotlight with a develop-style entrance and a countdown bar, the corner view during questions when chosen, floating reactions with running totals, a "📸 N waiting" badge, background preloading of `next`, and the podium filmstrip. Reduced motion uses fades only. `facts` now counts as a wait phase, so photos do not cover the end-of-night facts.

**Phase 7, host.** `/admin/rooms/:gameId/wall` (`apps/web/src/admin/wall-page.tsx`): on screen now (Pull it, Skip, Show next now), approvals with A and D shortcuts, the queue, settings, mute and unmute per guest, and everything shown so far (Hide everywhere). `WallQuickPanel` sits on the live desk. Sidebar link and sign-in return path added.

**Phase 8, results.** Stats fact `wall-loved` (most reactions, at least 5, no award on a tie, guests only) becomes a podium highlight: "Most loved photo: X's, with N reactions." The archive gallery now includes wall photos that were shown, kept and not hidden. The stage gets a podium `reel` of shown, visible photos, most loved first.

**Phase 9.** `apps/web/e2e/photo-wall.spec.ts` (phone sends, nothing on stage before approval, host approves, stage shows the frame, a reaction lands, pull removes it and the image 404s) is written but **not run**. `test/wall-load.spec.ts`: 20 guests send at once, each with a double tap; checks that there are no duplicates, one photo is on screen, 19 are queued, the rush timing applies, and there is one turn per guest.

Checks run (machine short on memory, so one worker): `wall-snapshot` and `wall-moderation` (9) passed; `wall-loved`, `wall-engine`, `wall-results`, `wall-snapshot` and `stats` (23) passed; web `src/wall` (5), `src/stage/wall` and `stage-page` (10), and `wall-page` (3) with `live-console` passed; `npm run typecheck` passed after every phase. Not built: the optional stage shutter sound; reporting a photo that fails to load to the host (the stage shows "This photo could not be shown" instead); a guest unticking "keep" after sending (withdrawing still removes it). Not run: Playwright, the full unit suites, and real phones. Nothing is committed.

Final check run (one worker): `wall-upload`, `wall-queue`, `wall-moderation`, `wall-load`, `media` and `archive-room`: 29 of 30 passed after the load test was corrected (the first photo of a rush goes up while the queue is empty, so it rightly gets the normal time; the test now checks the next photo). **`archive-room.spec.ts` › "reports preparing and ready without reading the archive database" fails** (`preparing` instead of `ready` after the export alarm). It still fails with the photo wall gallery query reverted and with the wall's phase-entry hook disabled, and no photos exist in that test, so it is not caused by the photo wall. It most likely comes from commit `13cbf91` (fun facts and the `facts` phase). Not investigated further.

## 22 October 2026 — admin coverage for every feature

Built a feature registry (`apps/web/src/admin/features.ts`) that drives the admin sidebar, page titles and room overview cards, and a coverage test (`features.test.ts`) that fails when a source folder has no admin owner, or when routes and registry disagree. A probe folder in both `apps/api/src` and `apps/web/src` was caught by the test and then removed. New rule [.agents/rules/50-admin-coverage.md](../.agents/rules/50-admin-coverage.md) (see, manage, rehearse; host-only snapshot data; tests), synced with `npm run agents:sync` (into `AGENTS.md`/`GEMINI.md` like the other always-on rules, and `.cursor/rules`).

New or extended views: room overview cards for every feature with live status and a "Try it" line; `/admin/rooms/:gameId/analytics`; troll history on the room Trolls page (`trollHistory` in the host snapshot only, from `trollHistoryRows`) with Cancel; a photo wall frame preview using a shipped sample picture. Page titles now use the registry labels (for example "Results" and "Health").

Checks: `npm run typecheck` passed; all 19 web admin test files (102 tests, including the new `analytics-page` and `features` tests) passed; `wall-snapshot` (with the new host-only troll history test) and `troll` specs (7) passed. Not run: the full suites and Playwright. Nothing is committed.

## 22 October 2026 — trolls finished

Every troll that was a placeholder or an idea in [apps/api/src/troll/README.md](../apps/api/src/troll/README.md) is now built, in six commits on master:

1. **Placeholders made real.** Invasion (the troller's driver face), Call from Mum (Answer or Decline), a shattered screen, generated sponsor lines, and a real theme jingle (`scripts/generate-theme-sting.mjs`).
2. **Fake phone chrome.** Screen recording, 1% battery, AirDrop spam, overheating, fake audience, always typing.
3. **Input sabotage, for any question design.** Shuffled answers, Pig Latin, possessed slider, reverse typing, autocorrect, character limit, haptics storm. Also adds `questionKinds`, and `submissionDisrupted` now reads the catalogue flag.
4. **Identity.** Silly name and Guest 14 via `displayNickname`, and fake last place.
5. **Stage theatre.** Instant replay, Speech!, fake exit, zoom and enhance.
6. **Scoring.** Steal, Robin Hood and shared score (`applyPointTransfers`, opt-in per question through `modifiers`), plus public vote and misattributed (stage captions only).

The catalogue now has 50 trolls. Checks: typecheck after every batch; `troll-catalogue`, `troll-identity`, `troll-theatre`, `troll`, `troll-score`, `quiz-score` and `stage-effects` specs passed; web `src/troll` (23 tests), `stage-page` and the admin coverage test passed. Not run: Playwright (including the updated crack step in `quiz.spec.ts`), the full suites, and real phones. No question pack opts in to steal, Robin Hood or share yet.

## 22 October 2026 — GitHub documentation presentation

Status: complete. Refreshed 43 existing Markdown pages and added `docs/README.md` as the documentation hub.

- **Files and interfaces:** root README introduction, task-based documentation directory, shared page navigation, collapsible contents on longer guides, clickable document references and consistent Markdown tables. No application interfaces changed.
- **Decisions:** preserved technical wording and historical results; left generated content exports, line-count reports, agent instructions and third-party licence text intact. Used repository-relative links and GitHub-compatible Markdown without external visual assets.
- **Verification:** unit tests passed (83 files, 346 tests). Relative-link and heading checks passed across 44 pages (292 file links). Prettier check and `git diff --check` passed before this log entry. `npm run typecheck` passed.
- **Manual verification:** reviewed source diffs and navigation structure. GitHub-rendered pages have not been visually inspected.
- **Remaining limitation:** some existing domain guides describe earlier implementation stages; this presentation pass does not certify or rewrite their technical claims.
- **Exact next stage:** review the README and documentation hub in GitHub’s rendered view. No implementation stage or deployment started.

## 22 October 2026 — kart power, turbo tiers and track interactions

Status: complete locally. The shared arcade driving model, both kart renderers and the host controls now support the requested handling and course changes.

### What changed

- Replaced forward target-speed damping with acceleration, power per unit mass, rolling resistance and aerodynamic drag. Boost expiry removes thrust without pulling the kart towards a speed cap. Kept bounded reverse and stronger resistance for stale controls. Swept-wall queries now use actual velocity.
- Mini, Super and Ultra drift releases now differ in thrust as well as duration. Added the shared `DriftGauge`, explicit ready/active tier labels and speed in km/h. Kept the older first-tier `driftCharge` wire field and added full-bank milliseconds/tier fields.
- Added `packages/shared/src/kart-course.ts`: deterministic moving sweepers, floor boosts, ramps, height/vertical velocity, glide/descent and independent per-feature cooldowns, so a boost can feed directly into a ramp. Physics and rendered hazards use the existing active race clock, including after recovery. Airborne karts skip floor items/oil; boundary walls remain solid.
- Integrated course props, deployed wings and flight height into solo, connected 3D and the SVG map. Kept shared geometry and disposal budgets. Corrected the upstream chassis calculation so flight raises wheels and body together.
- Admin → Kart → Drive has real-engine course switches, clear/restore, return to grid and direct boost/ramp/sweeper rehearsals. Configuration changes reset and pause practice. Imported rehearsal starts use verified road surface.
- Live controls show course status, airborne/boosting counts, on/off commands and history. New connected races default to course off. Turning it off lands karts and clears course boost. Commands use existing validation, transaction rollback and persisted receipts. The latest 20 changes are host-only `kartCourseHistory`; guest/stage snapshots omit it.

### Files and interfaces

Shared `kart-driving.ts`, `kart-course.ts`, `kart.ts` and `index.ts`; the existing API kart adapter, host actions/routes and control snapshot; existing solo controller/store/session plus `Course.tsx`; shared `DriftGauge`, connected phone/map/circuit/camera/driver rendering; `kart-course-controls.tsx`, command notices, scope and registry. Updated the data inventory and kart guide. No new resources, tables, sockets, schedulers or dependencies.

### Checks and results

- Web unit suite: **85 files, 350 tests passed**, including registry coverage, course controls, turbo gauge and real Three.js scene/resource checks. Both the root `npm run test:unit` and the final single-worker workspace suite were run; the first root run had 349 tests before the additional flight-rendering regression.
- Kart pure suites: **4 files, 35 tests passed**, covering power/coasting, tier thrust, boost-to-ramp combinations, swept triggers, glide/descent/landing, hazards, authoritative race integration and restored clock state.
- Kart room suite: **9 tests passed**, including on/off success, refusal, replay after eviction, forced landing and host-only history. Updated the existing end-of-game test to assert the facts phase before finishing at the podium.
- `npm run typecheck`: passed after fixing optional cooldown typing. The pure suites were rerun after the clock/cooldown changes.
- `npm run build`: passed, including the secret-artifact scan and content preflight. Existing large-chunk/PGlite build warnings and incomplete birthday drafts remain reported by the existing checks.
- Real browser suite: **4 Playwright tests passed** with `npx playwright test --config playwright.kart.config.ts --workers=1`: bank/release drift, ramp/glide/descent/landing with course switches, floor boost and moving sweeper. No party credentials or simulated engine were used.
- Targeted kart ESLint passed. Full `npm run lint` remains blocked by **five existing photo-wall errors** in `stage/wall/stage-wall.tsx`, `wall/guest-wall.tsx` and `packages/shared/src/wall.ts`; those unrelated files were not changed.

### Manual verification and remaining limits

Inspected real WebGL screenshots for deployed flight, phone practice at 390×844, landscape at 844×390 and the course set-up panel. Adjusted the panel, HUD and power-up placement to keep the driving controls clear. Corrected a rehearsal spawn in the imported start-grid surface gap and preserved pause across reset/remount.

No deployment. Physical phones, projector hardware, multiplayer flight in a browser and the full Worker suite have not been checked. Solo and connected races retain their separate tracks. Flight is a ramp-launched glide with landing, not unrestricted flight. Reload clients when introducing the new strict snapshot fields.

### Exact next stage

Try the handling in Admin → Kart → Drive and tune power/drag, tier thrust and course placement from hands-on feedback; then rehearse a connected room on real phones and the projector. No further stage started.

## 22 October 2026 — editable birthday order and score-seeded circuit round

Status: implemented locally; browser integration verification remains incomplete. No deployment.

- **Admin:** Question packs opens on a compact running-order editor with drag handles, accessible move/up/down/end controls, add/remove, explicit save/discard, revision conflicts, retry-safe receipts and the latest 20 save summaries. Catalogue search and real phone/stage rehearsals remain available; pack information, authoring guidance and rehearsals are expandable. Individual question pages use the same restrained typography and spacing. Live controls has an explicit Start birthday game action. Kart admin explains and rehearses the imported circuit and connected flow.
- **Ordering and versions:** ready catalogue rounds form the default birthday order, with `kart-sprint` last; incomplete drafts stay excluded. Orders support 1–80 distinct rounds and remain server-validated. Question wording, answers and assets remain versioned TypeScript. The existing registry gains `pack_order` and stores accepted saves with receipts atomically. A birthday start freezes the full private question script in existing `round_state` under `__pack` / `birthday-script`, using `birthday-r<revision>-<content hash>`. Later order/catalogue edits cannot change that game. Demo and stored ring rehearsals remain separately resolvable.
- **Race:** the birthday round selects `mario-circuit-v1` and a three-minute server deadline. The server reads current ledger totals plus manual adjustments at intro, sorts descending with joining-order ties and freezes up to 80 racers in five staggered columns. Initial safe recovery positions preserve starting distance. The existing input queues, scheduler, transport, scoring and podium flow are reused. Imported collision walls and road/dirt surface triangles are baked from the pinned GLB by `kart:colliders`; centreline progress and the broadcast map share `kart-route.ts`. Phones load the actual circuit and render only their own kart. Course features start enabled and remain reversible from Live controls.
- **Handling and resilience:** tighter low-speed steering fits the imported bends while retaining the prior high-speed drift response. Invalid off-route projection jumps award no progress and re-anchor the next sample so returning to the road can resume progress. Imported sectors require actual forward gate crossings, so short loops cannot accumulate a lap. Frozen scripts are used by vote, tie-break and diagnostics lookups as well as ordinary question rendering. Local auth’s SSR Vite loader has a separate dependency cache and no browser scan, avoiding a concurrent Windows cache rename.
- **Interfaces/files:** shared birthday order/save schemas, track/deadline/grid projection fields, `questions/birthday-order.ts`, registry RPCs, authenticated content order endpoint, `startBirthday`, private room script reads, `admin/running-order.tsx`, `content-workspace.css`, `kart-route.ts` and imported rendering. Updated question-authoring, kart guide and data inventory; regenerated the birthday running-order and answer-key exports with `npm run content:export`. Web tests use isolated threads with two workers after Windows fork-start failures; `REUSE_DEV_SERVER=1` allows an explicitly warmed dev server in the browser harness. No new service, socket, score engine or paid resource.
- **Verified:** web unit suite passed **87 files / 355 tests** with two isolated thread workers (`npm run test:unit` from the repository root). Focused admin/live/circuit suite passed **21 tests**. Kart/order pure suites passed **38 tests**, including all eight sectors completed by authoritative driving inputs, 80 distinct road-safe grid slots, deterministic script versions and cutoff restoration. Auth/order/vote/duel pure suites passed **29 tests**, including bounded request bodies, origin/auth checks and stale-save responses. Room suites passed **12 tests**, including score adjustment seeding for 80 registered racers, pause/resume and eviction, save/start replay and private script exclusion from every audience. Typecheck, production build, content preflight and targeted lint passed. Build retains existing large-chunk/PGlite warnings; unfinished content drafts are reported by preflight and excluded from the order.
- **Browser verification:** the authenticated running-order page and a real saved order were inspected in Chromium. The new cross-device Playwright smoke test remains failing on local Worker request timeouts when opening room access; it has not verified the connected imported renderer or completed the phone race. Direct room opening in a separate manual Chromium check succeeded. Initial attempts also exposed Vite cache contention and a locked generated asset when dev/build overlapped; the auth cache is now isolated from both browser dependencies and test output cleanup. After the rehearsal attempts, the source default of 56 ready rounds with kart last was restored. Physical phones/projector and 80 simultaneous browser renderers remain unverified. The test is retained, with no skip or weakened assertion.
- **Exact next stage:** resolve the local Worker transport timeout in the browser rehearsal, complete the imported phone race flow, then rehearse the birthday pack with physical phones and a projector and tune the three-minute cutoff from hands-on feedback. No deployment or further feature stage started.

## 24 October 2026 — performance without design or gameplay changes

Status: implemented and verified locally. No deployment, new dependency, paid resource, content change or protocol change.

- **Loading:** React Router lazy-loads public surfaces, individual admin pages and rehearsals; the admin registry still checks every lazy route. Kart intro preloading now warms only the renderer used by that surface, so the projector does not download unused 3D code. Fingerprinted scripts/styles/fonts get immutable cache rules; HTML, private media, unversioned audio, circuit models and question pictures keep their existing freshness policies. Tests guard the cache scope.
- **Room and delivery:** one synchronous broadcast shares its statistics source, aggregated facts and fun-fact selection across audiences and sockets, with fresh work on later changes. Added a question lookup map and four indexes for answer counts, player scoring and incoming reactions; query-plan tests verify use. Existing host Health diagnostics show `build:statistics`. Media permission checks now precede one streamed R2 read rather than a metadata read and a buffered download. Email libraries/rendering and local JPEG processing load on demand.
- **Rendering and memory:** validated socket patches retain unchanged field references; accepted commands leave the retry map while uncertain commands retain their original idempotency keys. Legacy full-snapshot sockets avoid unused patch serialisation. Static theme decoration/picker skip unrelated parent renders. Countdown intervals survive clock-only updates and stop while paused/held. No animation, scoring, timing authority, race input frequency, graphics quality or theme was removed or reduced.
- **Interfaces/files:** existing route table and registry test, socket/countdown/preloader/theme components; existing API room/statistics/media/email modules and SQLite schema indexes; `public/_headers`; `scripts/performance-audit.mjs`, `scripts/performance-preview.mjs`, `playwright.performance.config.ts` and browser budget/layout tests. Added [the audit and repeatable commands](performance.md) to the documentation hub. No new stored guest data or retention policy. Worker/load tests explicitly clear external database/email bindings, and the load harness pauses finished measurements and drains connections before moving on.
- **Measured:** total decoded initial JavaScript falls from 1,024,373 bytes on every entry route to **647,691 B home (−36.8%)**, **881,369 B join (−14.0%)**, **795,078 B projector setup (−22.4%)** and **652,560 B sign-in (−36.3%)**. These totals include all shared scripts, including resource entries with an `other` initiator. CSS falls from 220,486 B to 108,105 B home/sign-in, 186,910 B join and 163,077 B projector setup. Worker entry falls from 6,173.19 kB to 5,675.66 kB. Entry-file-only savings are deliberately not described as whole-page savings.
- **Checks:** `npm run test:unit` passed **89 files / 362 tests**; `npm run typecheck` passed; `npm run build` passed, including secret-artifact/content checks. API pure command `npx vitest run --project auth test/stats.spec.ts test/fun-facts.spec.ts test/media-check.spec.ts test/email-design.spec.ts` passed **28 tests**. Worker command selecting `room`, `patch-room`, `results-room`, `fun-facts-room`, `stats-room` and `kart-room` passed **39 tests**, including shared-work refresh, receipts/recovery and audience privacy. `npx playwright test --config playwright.performance.config.ts` passed **9 tests**: total script budgets, unloaded optional code, navigation and phone widths/landscape. `npm run load:realtime` passed its **8/30/80-guest** rehearsal after adding deterministic local bindings and orderly room shutdown. Targeted ESLint passed; the full repository lint was not rerun. An older stage snapshot key assertion was corrected to include the already-public wall field, preserving all privacy assertions.
- **Manual/browser verification:** `npm run perf:audit -- verified` against the explicit frontend-only `perf:serve` build recorded no script errors or horizontal overflow. All four 390×844 full-document screenshots match the pre-change baseline pixel for pixel. Inspected the home screenshot as well. Audit JSON, screenshots and command logs are under ignored `artifacts/browser-checks/performance/`.
- **Limits:** the normal local Worker preview intermittently timed out, so frontend metrics/layout checks used the isolated production-client preview and explicit signed-out session fixtures. The before/after servers differed in compression and other machine workloads were active: paint/long-task observations are diagnostic, not controlled speed comparisons or production Core Web Vitals. Initial parallel test attempts hit local worker-start/file-access failures; required checks were rerun successfully. Existing large-chunk/PGlite warnings and incomplete birthday drafts remain. Physical phones/projector, deployed headers/compression, production cold starts and real-user INP remain unverified. Live connected browser race flows were not rerun in this pass.
- **Exact next stage:** rehearse the unchanged app on physical phones and projector hardware, verify deployed delivery after an explicitly authorised deployment, and use those measurements to prioritise any further equivalent optimisations. Graphics/image quality, animation reduction, update cadence, prediction and history changes are listed separately in `performance.md` for a later user decision. No such pass or deployment has begun.

## 24 October 2026 — adaptive kart graphics and reversible photo bias

Status: implemented locally as the separately approved visual pass. The preceding
performance work was committed as `9c008d7` (`Optimise loading, room broadcasts and
media delivery`). This follow-up remains uncommitted; no deployment or paid
resource creation.

- **Kart:** connected phone views and real solo practice offer Auto, High and Low.
  Auto chooses balanced detail at 16–20 racers and low above 20, or after sustained
  slow visible frames. High overrides the policy. Shared graphics profiles change
  pixel density and decorative drift sparks/trails only. A local frame probe
  ignores warm-up and suspension; a slowdown stays latched until a mode change.
  Session storage holds the local choice; no frame/GPU diagnostics are uploaded.
  Changing graphics keeps the canvas, controls, race and server timing intact.
- **Photo bias:** new photos retain a clean normalised JPEG within the existing
  1280px/1MiB limits, starting at JPEG quality 95. The existing reported device
  family is frozen on photo reservation as iPhone, Android or unknown. iPhone
  display uses a 256px/quality-20 derivative; Android and unknown use the clean
  accepted copy. This is reversible and never replaces that copy. Previously
  discarded resolution cannot be restored, and legacy uploads remain unknown.
  Processing stays in the Worker outside the room's live action path. A private
  five-minute derivative cache follows current permission/visibility checks;
  ordinary private and published-gallery response policies are preserved.
- **Admin:** room Media shows the policy, per-family counts and latest 20 changes;
  receipted on/off commands persist and replay safely. It retains clean admin
  previews and rehearses both treatments through the real authenticated image
  processor with a stand-in asset, without saving a room action or photo. Kart
  Drive rehearses the shared 16/21-player policy in the actual solo renderer.
  Updated the existing feature registry, command notices and feedback scope.
  Public snapshots expose only a display revision, which refreshes photos and
  face textures immediately; source-family details/history stay host-only.
- **Files/interfaces:** `kart/graphics.ts`, preferences/controls/CSS and renderer
  adapters; `media/photo-bias.ts`, processor profiles, media delivery/cache,
  additive room/upload columns, host actions and snapshot schema; admin Media
  and photo rehearsal, media URL revision handling and face-texture disposal.
  Updated data inventory, kart guide and performance boundaries. No animation,
  theme, retained history, server update, tick or input rate was reduced.
- **Verification:** root `npm run test:unit` passed **92 files / 370 tests** and
  `npm run typecheck` passed. Focused existing Worker room/media/driver/wall
  privacy suites passed **31 tests**; new photo-policy suite passed **6 tests**
  (success/refusal/replay, audience privacy, source pinning, reversible real JPEG
  output, unchanged R2 bytes and hidden-media checks after derivative caching).
  Pure media/preview endpoint suites passed **10 tests**, including origin/auth,
  body bounds and both processor profiles. Targeted ESLint completed with zero
  errors and three existing Fast Refresh constant-export warnings in
  `framed-photo.tsx`. The real-engine browser test passed: 16/21-player policy,
  manual override, actual pixel-density changes on the same canvas and continued
  driving at 390px. No assertions were skipped or weakened.
- **Build/manual limits:** standalone kart and Worker/client production
  compilation completed, with existing large-chunk/PGlite warnings and unfinished
  birthday drafts. The final artifact scan passed (663 files), and the content
  preflight passed when rerun separately after the build session ended. Browser
  screenshots exercise software-rendered Chromium, not
  physical iPhones/Android phones or the projector. Cloudflare's deployed Images
  binding and connected multiplayer browser flow remain unverified. Initial
  local checks encountered worker-start/shutdown and server-start timeouts;
  successful reruns are logged under ignored `artifacts/browser-checks/performance`.
  `KART_PREBUILT=1` permits an explicitly completed standalone build in browser
  checks; `KART_TEST_PORT` isolates that preview from other workspace servers.
- **Exact next stage:** review this local follow-up, then rehearse the graphics
  options and photo switch on real phones/projector before an explicitly
  authorised deployment. No further feature pass has started.

## 27 October 2026 - developer tools and 100-player rehearsals

Status: implemented and checked locally, with the connected-browser limitation
below. No deployment, new dependency or paid resource.

- **Host workflow:** a registered room page at `/admin/rooms/:gameId/developer`
  sets 10/25/50/75/100 bots or a custom target, preserving identities on growth
  and enforcing a combined 100-player limit. It offers automatic answers,
  varied response pace, participation percentages, a manual answer burst,
  disconnect/reconnect, optional 10 Hz kart controls, measurement reset and JSON
  report download. Start demo/birthday, pause/resume, advance and skip reuse
  existing host commands. A private roster shows connection/answer status and
  points; the latest 20 population changes remain visible.
- **Real traffic and authority:** individual synthetic players use the existing
  guest socket client, public projections, command receipts and scoring path.
  An authenticated same-origin bootstrap issues ephemeral per-bot credentials;
  only hashes persist. Secrets travel in protocol headers rather than URLs,
  snapshots or browser storage. Removing bots revokes credentials and closes
  sockets, retaining accepted actions/history. Synthetic clients stay excluded
  from guest statistics, fun facts and the final guest archive. Automatic
  answering and kart traffic default off. At most four pending handshakes avoid
  flooding the browser connection queue.
- **Capacity:** the room, player collections, ballots, attribution, results and
  kart limits support 100 players. Text/content length limits stay unchanged.
  Full-room kart recovery and deterministic timeline tests now exercise 100
  drivers. The real-time load harness defaults to 10/25/50/75/100 guests and
  retains configurable duration/input rate.
- **Files/interfaces:** shared bot-count, private bootstrap and host projection
  schemas; `apps/api/src/developer/bots.ts`; additive `developer_bot` and
  `developer_tools` SQLite tables; existing host action/route/credential
  plumbing; `apps/web/src/developer/` planner, fleet, controls and tests;
  registry/route/sign-in return/command feedback integration;
  `apps/web/e2e/developer-tools.spec.ts`. Added [the rehearsal guide](developer-tools.md),
  documentation index entry and data inventory details. No competing socket
  client, scheduler, score engine or deployed adapter.
- **Verified:** root `npm run test:unit` passed **95 files / 383 tests**, and
  `npm run typecheck` passed. Developer/kart/route suites passed **32 tests**;
  room/Wordle/rank/vote/duel/stats/results regressions passed **34 tests**.
  `npm run load:realtime` passed all five populations through accepted answer
  bursts and kart updates. Focused developer UI/planner/fleet tests passed
  **12 tests**, including bounded pending handshakes, partial rankings,
  public Wordle boards, receipts, privacy and teardown. Targeted ESLint passed
  with only existing Fast Refresh warnings in `room-provider.tsx` and
  `routes.tsx`; the new developer files pass without warnings. New files pass
  Prettier checks. `npm run build` passed, including a 672-file secret scan
  and both content preflights; existing large-chunk/PGlite warnings and
  incomplete birthday drafts remain. No failing assertion was skipped or weakened.
- **Browser limits:** connected Chromium reached ten authenticated bot sockets.
  Initial 100-bot attempts exposed the need to bound browser handshakes; that
  ramp now has a regression test. Subsequent browser runs, including a
  separately started preview, alternated between the previously recorded local
  Worker room-opening timeouts and slow guest upgrades (six of ten connected
  within the 45-second check). The complete browser
  10-to-100 answer/reconnect/removal flow and phone layout are therefore not
  yet verified; its Playwright test is retained. The local load harness is a
  separate successful 100-connection check, not a substitute for this browser
  result. The compiled production preview also timed out opening a room; a
  final source-preview attempt timed out starting its server. Speculative
  local transport changes were reverted, leaving the existing auth and
  presence behaviour intact.
- **Operational limits:** keep Developer tools open to run its bots; background
  throttling and the host machine affect timings. Kart bots generate traffic
  without intelligent navigation or 100 rendered phones. Real devices, venue
  Wi-Fi and deployed capacity need manual rehearsal. Accepted test actions
  remain: use a fresh room for a clean run.
- **Exact next stage:** resolve the local Worker browser transport timeout,
  complete the retained connected-browser test, then rehearse staged
  populations with a real phone and projector. No deployment or later feature
  stage has started.

## 27 October 2026 — complete developer rehearsal toolkit

- **Status:** implemented; final connected validation stopped at the user’s request on 28 October. See the handover below.
- **Now available:** fresh isolated rehearsals from Admin Home/Rooms with saved
  browser setups and 10/25/50/75/100 presets; frozen demo or birthday order;
  automatic stage launch and bot-ready show start; a durable automatic runner,
  pause-at-reveal and stop-on-failure; question jump/repeat; five-second bot/host
  disconnect, late join and near-deadline answer scenarios; real generated phone
  launch at common viewport sizes beside the actual stage; 200-event private
  timeline, automatic checks and richer downloadable reports.
- **Files/interfaces:** `packages/shared/src/developer.ts` validates configuration,
  scenarios, bounded private rehearsal state/events/checks and a safe public
  revision; new `apps/api/src/developer/rehearsal.ts` uses the existing lifecycle,
  durable scheduler and receipted host commands. Additive room tables hold mode,
  diagnostic history, current connection presence, brief outages and generated
  phone markers. The phone bootstrap is authenticated and non-cacheable; its
  credentials use the existing game-scoped transport. New developer setup,
  profiles, controls, phone launcher and route reuse the real guest/stage screens.
  Registry, command notices, sign-in return paths and documentation are updated.
- **Decisions/defaults:** new setups default to demo, ten bots, automatic answers,
  1s base delay, full participation, 1s presentation beats and an 8s runner answer
  target; kart off, pause-at-reveal off, stop-on-failure on. Normal room clocks
  remain authoritative. The runner waits through host loss. Repeat/jump clears
  only the selected question’s answers/votes/points/runtime state and stops the
  runner; the private history and other questions remain. A dedicated room never
  queues final archives/emails. Ordinary rooms retain the previous bot-only tools
  and refuse destructive rehearsal navigation and scenario commands.
- **Local testing fix:** the existing Node local administrator check now signs a
  short-lived method/path/session proof and forwards it through both Node header
  representations. The Vite-to-Worker bridge uses raw headers; updating only the
  normal header map dropped the proof and produced a false sign-in failure.
  Untrusted proofs are removed first. Staging/production retain real auth.
- **Checks so far:** `npm run test:unit` passed **98 files / 388 tests** and root
  typecheck passed. Focused room/bootstrap/auth tests passed **24 tests** before
  final guard/forwarding refinements. Targeted lint passed after fixing ref reads
  during render. Initial Chromium runs exposed the proof forwarding issue; a
  diagnostic Chromium check now confirms authenticated room creation and reads
  return 200. The final connected browser suites are still running.
- **Manual verification / remaining limits:** no deployment or venue test has
  been performed. Bots need the Developer tools tab, do not render 100 phones
  and do not drive intelligently. Browser scheduling affects near-deadline
  timing and measured replies. The real phone launcher isolates the normal guest
  cookie; cookie-based upload/recovery needs an ordinary second-browser session.
  Answer-count checks explicitly show waiting for unsupported mechanics.
- **Exact next stage:** finish connected Chromium checks and final regression,
  lint/type/build checks, record actual outcomes here, then rehearse with physical
  phones and a projector in staged populations. No deployment is implied.

### 28 October continuation — final verification

- Production build passed, including the 682-file secret scan and both content
  preflights. Existing large-chunk/PGlite warnings and incomplete birthday drafts
  remain unchanged; no deployment was run.
- Targeted developer/guest/stage/admin web checks passed 19 files / 47 tests,
  and typecheck and targeted ESLint passed before the final unattended-runner
  refinement. The full unit rerun uses one worker after concurrent checks caused
  memory pressure on this machine. Cancelled resource-constrained runs are not
  counted as passes.
- A running rehearsal now pauses and cancels its runner wakeup when its controller
  disappears. The deliberate five-second host-loss scenario has a bounded 15s
  recovery grace. Browser checks explicitly isolate temporary Worker room storage
  alongside their existing temporary auth; ordinary local rooms stay persistent.
- Browser verification remains open: earlier source-browser runs reached the
  automatic reveal pause and presenting stage, but Vite errors after aborted
  requests blocked subsequent controls. Cold/stale-server runs also failed room
  reads or connection waits. Tests retain their real 100-client, answer and phone
  assertions; none is skipped or removed.

- Final full web rerun passed **98 files / 390 tests** using
  `npm run test:unit -- -- --maxWorkers=1`. All assertions stayed enabled.
- Final root `npm run typecheck` passed, including the standalone kart project.

### Handover — testing stopped at user request (28 October 2026)

- **Implementation:** all seven requested additions are present: saved fresh
  rehearsals, question jump/repeat, automatic runner, failure scenarios, real
  phone launcher, private event timeline/report and automatic checks. No
  deployment or paid resource creation was performed.
- **Verified:** full web suite **98 files / 390 tests**; root typecheck including
  standalone kart; production build and **682-file secret scan**; content
  preflights; targeted lint. Earlier Worker suites passed as recorded above.
- **Not fully verified:** the final Worker regression reruns failed to start the
  Cloudflare test worker (`fetch failed` / `ECONNRESET`) on Node 26 and the
  bundled Node 24. One broader attempt also timed out on the existing 30-second
  idle-alarm test. These are not counted as passes. The newest unattended-runner
  and late-alarm resume assertions therefore remain unverified in that runtime.
  Complete connected-browser testing, including 100 bots and the real phone
  flow, also remains unverified. Earlier runs reached four connected bots,
  automatic reveal pause and the presenting stage, before local Vite/runtime
  failures blocked further interaction.
- **Final refinements:** an alarm re-reads paused state after background work so a
  diagnostic pause preserves the resume timer. New developer panels have a zero
  minimum width for narrow admin layouts. Their latest connected layout check
  has not run. The ordinary private join receipt retains a generated phone’s
  join response for idempotent recovery, as documented in the data inventory.
- **Cleanup:** stopped the temporary dev server. No project Node/Worker process
  or listener on 4173, 5173 or 9229 remained in the cleanup inspection. Browser
  bot connections stop with their test browser/server; saved local test records
  are retained. No unrelated application was stopped.
- **Exact next stage:** no more testing runs in this session. When the user wants
  to resume, first retry the retained Worker and Playwright checks in a healthy
  local environment, then rehearse physical phones/projector and staged player
  counts. Do not deploy automatically.

## 28 October 2026 — requested push and deployment

- User explicitly requested pushing and deploying the developer toolkit after
  stopping local tests. Target: the configured staging and production Workers
  in the personal birthday-project account, staging first.
- Reuse the recorded 98-file/390-test web pass, root typecheck, lint and build
  verification. Do not restart load, bot or connected-browser test processes.
  The final Worker/browser validation limitations above still apply.
- Release plan: commit the feature, cut v0.0.5 using the existing release script,
  push master and the tag, then build each environment through the existing
  deploy script with its environment/config assertion and packaging dry run.
  Publish that same validated artifact and check each live health endpoint.
- No secret rotation, Neon migration, R2 provisioning or unrelated resource
  change is required. Durable Object developer tables are additive at bootstrap.
- **Complete:** feature commit `9ef618b` and release commit `1653c2c` are
  pushed to GitHub master, with annotated release tag `v0.0.5`.
- **Staging:** deployed `26-humza-website-staging`, version
  `ef8dbeb7-fc69-49b1-8c01-ad4832cbe4f3`. Live health reports
  `ok: true`, environment `staging`, version `0.0.5`; `/admin` returns HTTP 200.
- **Production:** deployed `26-humza-website`, version
  `dfa86a6b-714c-43c3-bd30-01da4e997587`. Live health reports
  `ok: true`, environment `production`, version `0.0.5`; `/admin` returns HTTP 200.
- **Release verification:** both environment builds, 682-file secret scans,
  content preflights, generated target/config assertions and Wrangler 4.136.3
  packaging dry runs passed. Each upload used its validated build. Production
  reused the freshly built environment-independent solo kart bundle; its Worker
  and web app were rebuilt for production. Existing large-chunk/PGlite warnings
  and unfinished birthday draft notices remain.
- **GitHub CI limitation:** the release workflow did not start any steps because
  GitHub reported an account billing/spending-limit block. This is not a test
  pass. Run: https://github.com/Hum2a/26/actions/runs/40654648290.
- **Testing limitation and cleanup:** no local tests, bots, browser rehearsals or
  dev servers were restarted. The retained final Worker regression and full
  connected 100-bot/phone-flow checks above remain unverified. Deployment health
  and HTTP checks do not establish those behaviours.
- **Try it:** open `/admin`, choose Fresh rehearsal, then use the room's Developer
  tools. Start with a small bot preset and increase counts when ready.
- **Exact next stage:** user-led rehearsal on staging or production. Retry the
  retained Worker/browser checks only when the user wants testing resumed and
  the local environment is healthy. No further automatic stage is started.

## 30 October 2026 — player control and late-entry hardening

- **Scope:** user requested stronger player control and reliable late/mid-game
  joining. Existing ordinary-question late joining, vote/duel participant freezes,
  reconnection, rename/removal/recovery and score tools are retained.
- **Added:** receipted `open-joining` / `close-joining` host commands in the existing
  route and room action flow; `room/admission.ts` stores the setting and a bounded
  20-change history in the existing round-state store. Existing rooms default to
  open. The optional validated `admission` projection is control-only.
- **Admin:** Players shows the live entry setting, history, reversible controls,
  late-player scoring rules and a private-browser rehearsal drill. Registry copy,
  data inventory and event runbook document the behaviour.
- **Recovery fixes:** removal consumes unused phone-transfer codes; issuing a new
  code supersedes older unused codes. Redemption rechecks the player and receipt
  inside its transaction. Recovery refuses nickname collisions with an actionable
  message. A replayed removal does not disconnect a subsequently recovered phone;
  replayed transfer work does not repeat socket replacement.
- **Decisions:** closing joining affects fresh registrations only. Existing
  reconnects and private transfers/recovery stay available. Late arrivals start
  at zero and use the remaining ordinary-question answer window. Existing frozen
  votes, duels and kart races retain their participants. While entry remains open,
  a removed person can register a fresh random identity; this is not an account or
  device-fingerprint ban. Close entry to stop fresh registrations.
- **Join retry fix:** the phone starts a new request after a definite refusal,
  so reopening entry works without changing nickname or reloading. Uncertain
  network/server outcomes retain the same request ID. Join requests time out
  after 12 seconds. Added guest-session API, router and connected-browser
  regressions alongside the existing cross-device admin flow.
- **Verified so far:** Players/registry tests passed **2 files / 12 tests** with
  `npm run test:unit -w @26/web -- src/admin/players-page.test.tsx src/admin/features.test.ts --maxWorkers=1 --pool=forks`.
  Guest-session API checks passed **1 file / 5 tests**, including definitive versus
  uncertain refusals and timeout, with the same flags and `src/live/guest-session.test.ts`.
  Final root `npm run typecheck` passed, including the standalone kart project,
  after the join retry changes. `git diff --check` and final targeted ESLint on all
  changed source/test files passed.
- **Runtime limitation:** broader runs on Node 26 stalled without completing.
  A Node 24 full-suite retry (with its supported storage flag) hit the existing
  router's 30-second dynamic-import setup timeout; tests in that file were not
  executed, and the remaining run did not finish. No test was intentionally
  skipped or disabled. Cloudflare room tests did not finish initialisation on
  either runtime. Those runs were stopped and are not passes. New Worker tests
  cover entry control, persistence/replay/refusal, private projections,
  reconnect/transfer while closed, stale transfer revocation, nickname collisions,
  removal replay after recovery and reveal-time late joining through pause/restart.
  No completed check is claimed here yet.
- **Manual verification:** browser, physical-phone and venue checks have not run
  for this change. No deployment or remote resource change is authorised by it.
- **Initial hand-off status:** implementation complete, with verification still
  incomplete at that point. The continuation below supersedes these initial
  check results and next steps.

### 30 October continuation — verification and recovery fixes

- The retained router regression passed **8 tests**. The initial full web rerun
  passed **98 files / 395 tests** using
  `npm run test:unit -- -- --maxWorkers=1 --pool=forks` (176 seconds).
- Inspection then found two gaps in the existing phone recovery UI: a fresh phone
  could not reach the transfer form before joining, and recovering the same
  identity did not restart its closed socket. The join page now offers the real
  transfer form without creating a new player, and successful redemption replaces
  the existing connection even when both IDs remain unchanged.
- Transfer requests now have the same 12-second bound and certain/uncertain retry
  distinction as joining. Network failures release the controls and retain the
  request ID. Confirmed refusals allow a fresh attempt. Tests cover fresh-phone
  redemption, same-identity reconnection, lost responses and timeout.
- Browser regressions now exercise a fresh phone recovering while entry is closed,
  an invalidated older code, reconnecting after recovery and a late arrival during
  a paused question who can answer after resume. The event runbook explains the
  actual entry point: room join link → Changed phones? → private code.
- The browser rehearsal exposed an existing stacking bug: the phone's answer dock
  intercepted taps on a cracked-screen troll's Dismiss button. Live guest screen
  effects now use React's existing portal API to escape the scroll stacking
  context. Standalone/admin screen previews keep their existing renderer. A new
  `troll/guest-troll.test.tsx` checks placement, escape dispatch and unmount cleanup;
  it and the existing screen-effect tests passed **2 files / 11 tests**.
- **Final unit checks:** `npm run test:unit -- -- --maxWorkers=1` passed
  **99 files / 401 tests** in 235 seconds after the recovery and troll-overlay
  changes (the previous run passed 98 files / 400 tests). The focused
  router and guest-session run passed **2 files / 18 tests**. Final
  `npm run typecheck`, targeted ESLint on every changed source/test file and
  `git diff --check` passed. On this Windows machine npm commands were invoked
  with `npm.cmd --script-shell=cmd.exe` because PowerShell startup stalled.
- **Room test dependency:** pinned `@cloudflare/vitest-plugin` **1.4.11**, compatible
  with the existing Vitest 4.1.11, and retained its lockfile. Its new esbuild and
  workerd script versions are explicitly allowlisted. Production Wrangler and
  deployment configuration are unchanged. This resolves the earlier import
  stall: the real room tests now start.
- **Partial room evidence:** the first four player-control cases passed under the
  real runtime: admission persistence/replay, reconnection/transfer while closed,
  code revocation and score-preserving recovery, and authorisation/replay for both
  entry commands. The nickname-collision refusal stalls when the storage
  transaction rolls back. A pre-existing native SQLite constraint test also
  stalls. An isolated native SQLite exception probe reproduces the stall without
  game imports; a Windows stack-trace-helper probe stalls too. This suggests a
  machine/runtime problem, but does not establish its exact cause. The full room
  suite is **not passed**. No test was disabled or weakened. Temporary diagnostic
  fixtures and source copies were removed; they are not feature verification.
- Filtered real-runtime checks subsequently passed the retained recovery/removal
  replay case (**1 selected test**) and reveal-time late-join/pause/reconnect case
  (**1 selected test**). Unselected cases in those diagnostic runs are not counted
  as passes. The nickname-collision rollback limitation remains.
- **Browser verification:** installed Playwright's missing Chromium headless shell.
  The connected admin flow successfully closed entry, refused a fresh join,
  reopened entry and accepted a retry. The quiz also exercised the late join and
  accepted answers through the mixed rounds. After the overlay fix it passed the
  troll dismissal and reached closing facts. Its helper still expected “Advance”
  during facts; it now uses the real “Next fact” / “Show the podium” controls and
  checks changed fact content as well as ordinary phase changes. The final
  `admin-live-controls.spec.ts` browser rehearsal passed, including private recovery
  on a fresh phone while joining is closed, reload, exactly one recovered player,
  stage privacy, pause/reload and viewport checks at 320/390/768/1280/1920px. The
  390px Players screenshot was visually inspected. The final separate
  `quiz.spec.ts` run passed in **1.4 minutes**, including the late player, mixed
  rounds, troll dismissal, reload and podium. The helper now selects the exact
  podium heading (avoiding ambiguous text matches) and bounds each command-response
  wait to 15 seconds. Both retained targeted browser tests passed on their final
  runs with `playwright.dev.config.ts --workers=1 --reporter=line`; this is not a
  claim that the entire Playwright suite ran. No assertion or test was disabled.
- **Status:** implementation, full unit suite, typecheck, targeted lint/format and
  both targeted connected browser rehearsals pass. Full Worker-suite verification
  remains incomplete because of the native nickname-collision rollback stall.
  No deployment or remote resource changes were made.
- **Exact next stage:** rerun the retained nickname-collision refusal and full
  Worker suite in a healthy native runtime; rehearse Admin → room → Players with
  physical phones and the venue projector/Wi-Fi. Do not deploy automatically.

## 31 October 2026 — kart-only lobbies

- **Request:** create a new lobby that plays just the existing Mario kart race.
- **Implementation:** `POST /api/rooms` accepts validated `kind: "kart"`; the
  registry persists it in the existing pending/completed creation receipt and
  refuses cross-kind reuse. `room/kart-lobby.ts` freezes only the existing
  `kart-sprint`, using a content-derived `kart-birthday-r0-…` room version. The
  saved birthday order and question files are unchanged. The existing room
  bootstrap transaction writes both the private script and mode timestamp before
  returning credentials. Old rooms/receipts default to ordinary party behaviour.
- **Manage:** `start-kart` runs through the existing host-command flow, validates
  the frozen script and lobby state again in the domain function, and uses the
  existing scheduler, socket, physics, scores and archive. Kart-only rooms refuse
  alternate quiz/rehearsal starts and go from final straight to podium, skipping
  the phone-facts interlude. No new race engine, state store or scheduler exists.
- **Admin:** Kart has Create kart lobby; Rooms links to it. New lobbies open Live
  controls with the normal code, a Start kart race button and private mode/time
  details. Overview retains those details after reopening. The registry entry
  explains creation and rehearsal. Existing solo, phone/stage previews, pause,
  course switches and player controls remain available.
- **Decisions:** one existing imported circuit, one lap, three-minute limit,
  up to 80 frozen racers. Late arrivals watch; another race uses a fresh lobby.
  This is a real deployed-capable mode, separate from the local ring rehearsal.
  Rehearse with a private second tab and the normal stage. No deployment is
  authorised or performed by this request.
- **Tests added:** `apps/api/test/kart-lobby.spec.ts` (creation persistence,
  replay, unchanged order, host-only metadata, authorised start/refusal/replay,
  late arrivals and direct podium); `apps/web/e2e/kart-lobby.spec.ts` (real admin,
  phone and stage flow); Kart page and Live console component regressions.
- **Verified:** final `npm run test:unit -- -- --maxWorkers=1` passed **99 files /
  403 tests** in 286.55 seconds. Focused Admin/registry checks passed **3 files /
  19 tests**. Final `npm run test -w @26/api -- test/kart-lobby.spec.ts
--project=room --maxWorkers=1 --no-isolate --disableConsoleIntercept
--reporter=verbose` passed **1 file / 3 tests** after the central mode guard,
  including refusal of alternate pack/rehearsal starts. Root typecheck, targeted
  ESLint on every changed feature source/test, Prettier checks and
  `git diff --check` passed. Commands used `npm.cmd --script-shell=cmd.exe` on this
  Windows machine.
- **Browser:** `playwright test apps/web/e2e/kart-lobby.spec.ts
--config=playwright.dev.config.ts --workers=1 --reporter=line` passed **1 test /
  59.0 seconds** on the final run. It covers real creation, the kart-only start,
  persisted mode after reload, phone controls, frozen late arrivals, pause/resume,
  phone reload, direct podium and host-only metadata. The first attempt had an
  ambiguous spectator-text selector; the assertion now targets the real phone
  status. Responsive assertions wait for the actual start control at 320/390/430px
  and 844×390 landscape. The loaded 1440px Admin screenshot was visually inspected.
  No assertion was disabled or weakened, and no timeout was increased to obtain a
  pass.
- **Status and limits:** feature complete locally. No deployment, physical-phone,
  venue Wi-Fi, projector or new 80-player load test was performed. This selected
  Worker run is not a full API-suite pass; the earlier native rollback limitation
  remains recorded above. The mode intentionally runs one race per fresh lobby.
- **Exact next stage:** user-led rehearsal with real phones and the venue stage;
  any deployment needs a separate user instruction. Do not automatically begin
  another build stage.

## 31 October 2026 — requested merge and staging/production release

- **Authorisation:** user explicitly requested merging the completed work, updating
  the default branch and deploying staging and production. The repository's
  default branch is `master`; no `main` exists. GitHub and a fresh fetch confirmed
  `master` matched `origin/master` at `74f4065` before this release.
- **Scope:** player admission/recovery hardening and kart-only lobbies from the
  preceding stages. Changes are isolated on
  `codex/kart-lobbies-and-player-recovery` before merging to `master`.
- **Preflight:** the pinned Wrangler login includes the configured personal
  account; both target Workers already list all 11 required secret names. This
  release needs no new database schema, Durable Object migration or secret sync.
  Existing deploy scripts build for each environment, scan artifacts, validate
  Worker name/domain/target and upload the application and API together.
- **Checks:** the preceding 403-test unit pass, typecheck, three kart-lobby room
  cases and connected browser rehearsals remain the feature evidence. Release
  support tests passed **12/12**. No protected/secret path is staged.
- **Existing repository-wide failures:** `npm run lint` reported **5 errors / 23
  warnings**, with errors in unchanged `stage/wall/stage-wall.tsx`,
  `wall/guest-wall.tsx` and `packages/shared/src/wall.ts`; `git diff --quiet HEAD`
  confirms those files are unchanged. `npm run format:check` reported **101
  unchanged files**. Changed-file lint/format checks pass. These are not full
  repository passes, and no rules or unrelated files were changed to hide them.
- **Merged and pushed:** feature commit `fcd5d9a`, merge commit `087122b` on
  `master`, pushed normally to `origin/master`. The working tree was clean before
  both environment builds. Remote `master` was checked against the deployed source.
- **Deployed:** `npm run deploy:staging` then `npm run deploy:prod` both completed
  successfully using the existing pinned Wrangler 4.136.3. Each rebuilt its
  environment, stripped the generated secret file, passed the artifact scan,
  content preflight and generated target/name/domain assertions, then uploaded
  the Worker and web assets. Existing chunk/PGlite and unfinished draft notices
  remain. No database migration, secret sync or unrelated resource change ran.
  - Staging: `7fc3c509-19bd-4010-a572-2886f6c0e5d8` at
    https://26-staging.humza.website.
  - Production: `930e1efb-2019-4827-b36f-ca319c404c0e` at
    https://26.humza.website.
- **Live checks:** both `/api/health` endpoints returned HTTP 200, `ok: true`, the
  correct environment and existing app version `0.0.5`. Both `/admin` pages returned
  200 and their newly built entry assets. The deployed kart creation, kart start
  and player admission chunks returned 200 with their new controls present.
  Isolated, read-only browser checks on both sites displayed the administrator
  email field and received HTTP 200 / `signedIn: false` from `/api/admin/session`,
  verifying deployed client/API compatibility without sending email or creating
  remote game data. The test browser was closed.
- **CI limitation:** GitHub did not start the release commit's Check job because
  recent account payments failed or the spending limit needs increasing. This
  is not a CI pass: https://github.com/Hum2a/26/actions/runs/41193270942. Existing
  repository lint/format failures and the full API-suite/native rollback
  limitation above remain unresolved; no checks were weakened.
- **Status:** requested code merged, pushed, deployed to staging and production,
  and checked live. This final release record is a documentation-only follow-up
  on `master`; the deployed application source is merge commit `087122b`.
- **Exact next stage:** user-led authenticated kart/player-control and physical
  venue rehearsal. No further build or deployment is automatically started.

## 31 October 2026 — whole-party presentation refresh

- **Scope:** the user confirmed phones, projector, kart, results and rehearsal
  feedback. Work is on `codex/party-presentation`; no deployment of this design
  is performed by this request.
- **Design:** shared palette-aware gradients, softened edges, quieter status
  plates, refined answer selection, dock, fields, panels and native dialogs.
  Existing themes retain their palettes and skins. MotionConfig honours reduced
  motion. Entrances do not delay actions, outgoing phone phases remain disabled,
  exiting name reactions are inert, and closing dialogs ignore pointer input.
  Authoritative projector headings switch immediately at opacity 0.96 or above.
- **Scoreboards:** `ui/scoreboard` renders server order, ties and points without
  calculating scores. Ten rows appear initially; Previous, Next and Top 10 reach
  everyone, with a live range and boundary states. Stable rows ease between
  positions and NumberFlow animates point changes. Layout measurements follow
  place/page changes rather than every race progress tick. Exiting rows are
  clipped to prevent temporary horizontal overflow when resizing. Kart browsing
  stays on the chosen page instead of cycling while someone reads. Quiz score
  phases have their own composition; results use the same shared board.
- **Notifications:** pinned Sonner 2.0.8 after checking its current official
  getting-started, toast, toaster and styling documentation. Motion layout/presence
  and NumberFlow docs were also checked. Only authenticated Admin mounts the
  toaster. Existing rehearsal receipts are deduplicated and batched for 900ms,
  with at most three groups per burst and refusals prioritised. History does not
  replay on entry; exit cancels pending messages. Live notifications can be
  paused, and the full filtered Event history remains available. Persistent
  command errors and downloadable reports remain.
- **Admin rehearsal:** Account & appearance renders the actual scoreboard with
  100 labelled sample players, score changes and notification controls. The
  registry describes this rehearsal. No new room, score engine, socket,
  scheduler, host command, snapshot field or persisted data was introduced.
- **Tests:** new scoreboard navigation/ties/shrinking population/empty cases,
  50-driver manual browsing, notification aggregation/deduplication/history
  suppression/refusal priority/cleanup, and real Admin rehearsal controls.
  Existing command coverage opens the retained timeline. Browser coverage uses
  a real 50-player lobby plus responsive/reduced-motion appearance previews.
  Existing question-preview coverage now opens the current catalogue and
  rehearsal disclosure; interaction and privacy assertions are retained.
- **Final checks:** `npm run test:unit` passed **102 files / 410 tests** on the
  final unchanged source (124.65 seconds). `npm run typecheck` passed, including
  kart-solo. `npm run build` passed: web/Worker/kart builds, generated-secret
  removal, a 693-file artifact scan and both content preflights. Existing large
  bundle/PGlite and unfinished birthday-draft notices remain. Changed-file
  ESLint has no errors and two pre-existing Fast Refresh warnings in
  stage-play/admin-shell. Changed-file Prettier and `git diff --check` passed.
  Commands used `npm.cmd --script-shell=cmd.exe` on Windows.
- **Browser evidence:** kart-only creation/phone/stage flow and both question
  preview cases passed, including answering, accepted, paused and get-ready
  states and 320/390/430px widths. The appearance rehearsal passed these widths
  and short landscape under normal/reduced motion. A 50-player map/board layout
  run passed at 1080p and 720p. Inspected phone, board and projector screenshots
  are under `.codex/previews/party-design` and `question-experience`.
  The final focused appearance run passed **1 test / 57.0 seconds**, including
  the resize fix and a light-theme notification/scoreboard screenshot. The
  updated question-preview pair and kart-only flow also passed in the broader
  selected runs. This does not convert the failures below into a full pass.
- **Unresolved browser checks:** the stricter 50-player run stalls awaiting the
  host pause receipt, including an isolated run. The existing full quiz test
  timed out waiting for an advance HTTP response; the full driving test reached
  DNF before its expected disabled accelerator. These are failed runs, not a
  full e2e pass. No assertion was skipped, removed or given a longer timeout to
  hide them. No server scheduling behaviour was changed for this visual task.
  Existing repository-wide lint/format and native Worker/SQLite limitations
  remain recorded above. Real venue/projector/Wi-Fi checks remain unperformed.
- **Status:** design implemented and build/unit/type checks green locally.
  Preview via `npm run dev` → `/admin/settings` → the real scoreboard and toast
  rehearsal. This change is not merged or deployed; live-flow verification is
  incomplete as described above.
- **Exact next stage:** resolve the recorded live-command/browser failures
  before a release, then rehearse with real devices. No next stage or deployment
  starts automatically.

## 1 November 2026 — app review and further polish

- **Scope:** continued the requested visual/interaction audit on the existing
  `codex/party-presentation` branch. Reviewed the loaded guest entry, projector
  setup, Admin home, missing-page, results and guest-link dialog in Chromium.
  Changes build on the preceding design; nothing was merged or deployed.
- **Admin entry:** normal room actions now precede the rehearsal form. Home and
  Rooms offer “Rehearse without guests” as a folded section. Its real form stays
  mounted while folded, retaining unfinished settings and uncertain creation
  requests rather than silently resetting them. Other disclosures still mount
  previews only when opened. Closing panels become inert and leave the
  accessibility tree immediately, while their visual exit eases away.
- **Sharing:** the existing guest QR dialog and the phone's join-code view offer
  a selectable, read-only guest link and Copy guest link. `ui/clipboard.ts` wraps
  the browser API; `ui/copy-button.tsx` announces success only after the browser
  confirms writing. Denial leaves the selectable URL and an honest fallback
  message. Projector QR codes retain their existing read-only presentation,
  without extra inputs or copy controls. No clipboard reads ship in the app.
- **Recovery and results:** the missing-page screen now uses the real party
  frame, a clear 404 and working join/home links, replacing the development
  shell and placeholder Results destination. Results loading has its own calm
  message, busy state and styled panel; it no longer suggests an archive failure
  while a reply is still pending. Invalid/preparing/unavailable states remain
  distinct, and retry behaviour is unchanged.
- **Scoreboard:** after the population shrinks, a clamped page is retained so
  adding players again does not unexpectedly jump back to an old page. Server
  ordering, ties, points and all game commands remain unchanged.
- **Files and interfaces:** extended shared `Disclosure` with opt-in
  `keepMounted`, and `JoinMark` with opt-in `allowCopy`. Added clipboard/copy
  primitives, missing-page/disclosure/join-mark tests and `e2e/polish.spec.ts`;
  extended Rooms/results/scoreboard tests. The existing developer rehearsal
  browser test now opens the new folded section before editing settings. No
  new route, feature folder, host command, data field or persistence was added;
  existing Admin coverage/ownership remains intact.
- **References:** checked the current official Motion AnimatePresence and
  reduced-motion documentation, and MDN Clipboard.writeText documentation.
  No additional dependency or competing component kit was introduced.
- **Verified:** `npm run test:unit` passed **105 files / 418 tests** in 224.35s.
  `npm run typecheck` passed, including kart-solo. `npm run build` passed the
  web/Worker/kart builds, generated-secret removal, 693-file artifact scan and
  content preflights. Existing bundle/PGlite and incomplete-draft notices remain.
  ESLint and Prettier checks on this pass's changed files passed. Commands used
  `npm.cmd --script-shell=cmd.exe` on Windows.
- **Browser verification:** `playwright test apps/web/e2e/polish.spec.ts
--config=playwright.dev.config.ts --workers=1 --reporter=line` passed **2 tests
  / 1.3 minutes**. It checks 320/390/430px and short landscape recovery screens,
  reduced motion, completed entrances and no horizontal overflow; an explicitly
  intercepted archive reply distinguishes loading from preparing. The real
  local authenticated room flow checks room-action placement, retained folded
  edits, exact clipboard URL and the QR dialog at phone widths. Clipboard reads
  occur only in that test after it has written its own local guest URL.
- **Manual review:** inspected the refreshed Admin home, loaded 390px recovery
  page and 320px share dialog screenshots under `.codex/previews/polish`.
  The initial audit caught a duplicate rehearsal form during implementation;
  it was removed and the final complete suite verifies a single folded form.
  Tests wait for completed entrance opacity before screenshots.
- **Status and limits:** polish complete locally. Try `npm run dev`, then
  Admin → Rooms → open a room → Show guest QR code, or visit an unknown address
  for the recovery screen. Clipboard permission refusal is covered by component
  tests; browser verification used Chromium. Physical phones/venue checks and
  the previous 50-player pause, quiz-advance and full-driving failures remain
  outside this pass's verified flows. No failing check was skipped or weakened.
- **Exact next stage:** resolve the previously recorded live-flow release
  blockers, then rehearse on venue devices before requesting a release.
  No next stage or deployment starts automatically.

## 1 November 2026 — requested presentation release

- **Authorisation:** the user explicitly requested committing, pushing, syncing,
  merging and deploying both environments after the remaining live-flow
  limitations were reported. Those limitations are still recorded above;
  this release does not claim to resolve them.
- **Preflight:** a fresh fetch confirms `master` is the remote default and is
  unchanged at `bdd863b`. The presentation branch contains only web UI,
  dependency-lock and documentation changes; no schema migration, Worker
  migration or new secret is required. Wrangler access is valid for this
  project's configured personal account, and both Workers have all 11 required
  secret names. No secret values were opened or changed.
- **Checks:** the final 418-test unit pass, root typecheck, production build and
  two polish browser cases from the preceding stage remain valid on this source.
  Release-support tests passed 12/12. The earlier live-flow failures and existing
  repository-wide lint/format limitations remain; they are not green checks.
- **Git:** the initial push check could not authenticate. The user restored
  GitHub sign-in, after which normal authenticated pushes succeeded. Feature
  commit `fd6581606939183a13702b708ddb663d4b7ecc14` is on local/remote
  `codex/party-presentation`; merge commit
  `afbdb054aa9383f28f6d870e0f7b03e34d215fbc` is on local/remote `master`.
  Fresh GitHub metadata and `git ls-remote --symref` confirm `master` remains
  the default. Local and remote master matched with no divergence and the
  working tree was clean before both environment builds. No force push ran.
- **Deployment:** `npm run deploy:staging` then `npm run deploy:prod` succeeded.
  Each rebuilt its environment, removed the generated secret file, passed the
  693-file artifact scan and content preflights, checked its generated
  Worker/domain/target, and uploaded the Worker plus 48 changed assets. Existing
  bundle/PGlite, secret-name configuration and draft-content notices remain.
  No migration, secret sync, new resource or unrelated project change ran.
  - Staging: `a446d37d-348d-4840-836d-2a2f5662909f` at
    https://26-staging.humza.website.
  - Production: `e26889f2-8c8a-4bb8-ad3e-47155bc88801` at
    https://26.humza.website.
- **Live verification:** both health endpoints returned HTTP 200, `ok: true`,
  their correct environment and the existing app version `0.0.5`. Isolated
  Chromium sessions on both sites verified administrator sign-in fields,
  HTTP 200 / `signedIn: false` session reads, enabled guest nickname fields,
  projector setup, and the new recovery screen at 390px with no horizontal
  overflow or page errors. The deployed scoreboard module returned HTTP 200
  and contained its new navigation. Screenshots are under
  `.codex/previews/release`; the verification browser was closed. These checks
  sent no live emails, created no remote room and changed no live game data.
- **CI:** GitHub's Check workflow ran this time: dependency installation and
  typechecking passed, then lint failed with the same **5 errors / 23 warnings**
  in unchanged wall files. `git diff --quiet bdd863b master` for
  `stage/wall/stage-wall.tsx`, `wall/guest-wall.tsx` and shared `wall.ts` confirms
  they were not changed by this release. Subsequent CI format/test/build/e2e
  steps did not run. This is not a green CI result:
  https://github.com/Hum2a/26/actions/runs/41339028000.
- **Status:** requested presentation/polish code committed, pushed, merged,
  synced and deployed to both environments, with live read-only checks passed.
  This final deployment record is a documentation-only follow-up on `master`;
  the deployed application source is merge commit `afbdb05`. Existing CI and
  the earlier full live-flow/native Worker limitations remain unresolved.
- **Exact next stage:** resolve those recorded failures and rehearse on venue
  devices. No further work or deployment starts automatically.

## 2 November 2026 — liquid-glass phone app, trolls, ranks and host safety

- **Context:** the user tried the live game and asked for a UI/UX pass: a
  failing photo upload, more fluid admin, livelier players, phones that fit
  without scrolling, a phone timer, a clear "answered" state, a question and
  troll overhaul with distinct trolls, a more interesting leaderboard visible
  on phones, an app-style phone with bottom tabs, and admin End game / Destroy
  room. Decisions taken with the user: a **liquid glass** look (they have no
  attachment to the earlier theme), tabs **Play · Ranks · Troll · Snap**, the
  previous uncommitted Codex work committed first (`ccbdecc`, 106 files / 426
  unit tests passing at that point), and one combined pass. Work is on branch
  `claude/liquid-glass-ui`; nothing was deployed.
- **Photo upload (root cause, reproduced live):** production `R2_ACCOUNT_ID`
  holds a Cloudflare API token rather than the 32-character account ID, so the
  presigned upload host was `<token>.r2.cloudflarestorage.com` and the browser
  PUT failed with status 0. That URL also exposed part of the token to phones.
  Code fixes: `presign.ts` treats a malformed account ID as unconfigured (no
  URL is built; the health report lists it as missing), and
  `putWithProgress` no longer adds the client API key header or cookies to a
  cross-origin presigned PUT, which a bucket CORS rule would refuse.
  **Not fixable in code:** set the real account ID secret, rotate the exposed
  token, and confirm the bucket CORS rule allows `PUT` with `content-type` from
  the party origins.
- **Host safety:** new host commands `end-now` (straight to the podium; the
  current question is not scored) and `destroy` (typed join code checked again
  in the room; sockets get a "room closed" message; jobs are cancelled through
  the scheduler; storage is wiped; the registry drops the join code and keeps a
  replay receipt; R2 objects are removed in the background). Admin → Live
  controls has an "End or destroy" section with confirmations; after a destroy
  the admin returns to Rooms with a notice and phones show "The host closed this
  room." See `docs/data-inventory.md`.
- **Phone app shell:** `guest/phone-shell.tsx` keeps one frame with a glass top
  bar (mark, live timer, connection, avatar menu), stacked pages that ease
  between tabs, the existing send dock (Play only) and a glass tab bar with a
  gliding pill and badges. A new beat that needs the phone (intro, prompt,
  collect, vote, predict) returns to Play; scores badge Ranks; the podium opens
  Ranks. Theme choice and "Changed phones?" moved into the avatar menu.
  Snap mounts its camera only while open. The lobby QR is folded under
  "Invite a friend". The preview frame without tabs is unchanged.
- **Timer and answer state:** `guest/phone-timer.tsx` reads the existing
  `usePhaseCountdown` (server deadline and clock offset), with a ring, an
  urgent last five seconds and Paused/Waiting states. `QuestionExperience` adds
  a progress pill and an answer banner driven only by the server snapshot
  (`answerStatus`): Sending… → Locked in with the room's answered count → at the
  reveal "+N points", "No points this time" or "No answer from you".
- **Questions:** standard choice tiles are glass, each with its own hue and
  shape (▲ ◆ ● ■ ★ ⬢) so colour never carries meaning alone; the sent tile is
  tagged "Your answer", others dim once locked, and the right answer glows at
  the reveal. The frame fills the phone height so two-to-six short options fit
  without scrolling; long labels switch to one column and may scroll.
  Bespoke designs keep their own look inside the frame.
- **Trolls:** `troll/troll-meta.ts` gives every troll kind a group (Phone
  chaos, Sabotage, Identity, Points, Big screen), icon and one-line blurb (a
  `Record` over the shared kinds, so a new kind fails typecheck). The Troll tab
  is a three-step flow with group filter chips, glass troll cards tinted by
  group, avatar target chips, then the existing confirmation and command.
  Incoming non-screen trolls show as group-coloured banners under the top bar
  on every tab. Screen gags are unchanged.
- **Ranks and leaderboards:** guest snapshots now include the top ten standings
  in scored phases (none while a hidden-score troll is active). The Ranks tab
  shows your place, points, movement and last award, a top-three podium and the
  rest with bars; it keeps the last standings between rounds and holds the
  personal recap. The shared scoreboard gains bars relative to the leader,
  ▲/▼ movement since the last standings and, on the projector scores phase, a
  top-three podium (rows stay in the list for screen readers).
- **Players:** `ui/player-avatar.tsx` gives each player a stable hue and
  initials; rehearsal bots get a dashed robot badge with their number. Lobby
  names are floating glass bubbles (independent bob per player, still under
  reduced motion) with compact like/dislike controls, on phone and projector.
- **Look and admin motion:** `ui/glass.css` (loaded globally) adds the frosted
  glass surface, option hues mixed from each theme's own palette, and a slowly
  drifting colour field (`ui/liquid-ground.tsx`) behind phone, stage, entry
  and admin frames. Reduced motion stops the drift and removes blur. Admin nav
  has a gliding active pill, room pages ease between routes (outgoing page
  frozen with `useOutlet`), and cards rise in with a short stagger. The room
  overview status now reads "Question N of M" (it previously added one to an
  already 1-based index).
- **Tests added/changed:** `apps/api/test/end-destroy.spec.ts` (end-now
  success/refusal/replay, destroy code check/wipe/socket message, registry
  forget/replay), `media-check.spec.ts` (malformed account ID), `quiz.spec.ts`
  (guests now receive standings); web `danger-zone.test.tsx`,
  `media-transfer.test.ts`, `guest/phone-shell.test.tsx`,
  `guest/ranks-tab.test.tsx`, `guest/phone-timer.test.tsx`,
  `troll/troll-tab.test.tsx`, `answerStatus` cases, and `router.test.tsx` now
  opens the avatar menu before "Changed phones?".
- **Manual verification (local dev, Chromium, 375×812 and 320×640):** joined a
  local room as a phone with 10 bots, played the illustrative demo through
  lobby, collect, locked in, reveal and scores, opened every tab, then used End
  game now and Destroy room from admin and watched the phone and admin react.
  Live production was only used for the upload diagnosis, in the user's own
  test room: one real photo send reserved an upload slot whose PUT then failed,
  so no file was stored.
- **Verified:** `npm run typecheck` passed. `npm run test:unit` passed **112
  files / 443 tests**. `npm run test -w @26/api` passed **89 files / 489
  tests**. Prettier is clean and ESLint reports no errors on the changed files
  (8 existing-style fast-refresh warnings). Browser checks were local only;
  physical phones, Safari/iOS glass rendering and the projector at venue size
  are not yet checked. Nothing is committed on this branch yet.
- **Exact next stage:** the user reviews the branch locally (or on staging if
  they ask for a deploy), fixes the production R2 secrets and CORS, then a
  venue-device rehearsal.

## 2 November 2026 — liquid-glass release

- **Authorisation:** the user asked to push, open a PR, merge and deploy.
- **Git:** `claude/liquid-glass-ui` pushed; PR https://github.com/Hum2a/26/pull/2
  merged into `master` as merge commit `0710660` (contains `ccbdecc` and
  `ba2ea5e`). CI was still running at merge time; its result is not recorded
  here as green.
- **Staging:** `npm run deploy:staging` succeeded, version
  `f812fb70-b6d7-4d2e-b57b-4bf3ff8f16e2`. `/api/health` returned `ok: true`,
  `environment: staging`; `/join` returned 200 and rendered the liquid-glass
  entry at 375px. No migration, secret change or new resource.
- **Production:** the session's permission check refused the production
  deploy, so the user ran `npm run deploy:prod` themselves. Afterwards
  `/api/health` returned `ok: true`, `environment: production`, `/join`
  returned 200, and the served bundle contains the new phone tab bar.
- **Unchanged limitation:** production photo uploads need the real
  `R2_ACCOUNT_ID`, a rotated token and the bucket CORS rule.

## 2 November 2026 — upload check on production, kart discoverability

- **Uploads verified live:** after the user set and synced the R2 secrets, a
  throwaway production lobby (`7WU96B`) was created, joined as "Upload test",
  and a generated 64×64 image went through slot → PUT → finalise via the
  driver-face path. The upload host was the account's R2 endpoint, the PUT
  returned 200 and finalise accepted the photo. The bucket CORS rule already
  allowed `PUT` with `Content-Type` from the party origins. The lobby was then
  destroyed from Admin → Live controls on production: the admin returned to
  Rooms with its notice and the phone showed "The host closed this room."
- **Kart:** the solo circuit already existed at `/kart` (linked only from Admin →
  Kart) and kart-only lobbies already existed (Admin → Kart → Multiplayer). The
  public home page now has "Fancy a lap? Practise kart solo", admin Home has a
  one-click "Create kart lobby" card with a solo link, and the solo page has a
  "← 26" way back.
- **Phone closed-room state:** a room that ends a phone's connection on
  purpose no longer also shows "Reconnecting", and the phone offers "Join
  another room". The destroy confirmation field has its own accessible name.
- **Verified:** `npm run typecheck` passed; `npm run test:unit` passed **112
  files / 446 tests**; Prettier and ESLint clean on the changed files. Local
  Chromium check of the home page and `/kart` at 375px.
- **Released (correction, 3 November):** this was later committed as
  `1445bd7`, merged through PR #3 as `b2aebeb`, deployed to staging (version
  `4fb34a7e-8e46-41de-a584-43a3c9aa5256`) by Claude and to production by the
  user, whose live bundle was then checked for the new kart and phone strings.

## 3 November 2026 — review follow-ups: recovery, rounds, trolls, rehearsals

- **Context:** a review listed eight open items. Decisions from the user: points
  trolls on every scored choice question; figurine self-vote doubles only when
  the room also picks you; Cursed search uses the proposed numbers; "Defend the
  indefensible" is dropped.
- **Deployment recovery:** every top-level route now has `ui/route-error.tsx`
  as its error screen. A tab left open across a deployment ("Failed to fetch
  dynamically imported module" and similar) reloads itself once (guarded for
  30 s in session storage), then offers Reload; other failures show a calm
  screen with no developer detail. `vite:preloadError` uses the same guard.
- **Rounds:** `defend-indefensible` removed from the catalogue, tests and
  content notes. `group-chat-figurine` is ready with `selfVoteBonus: "double"`
  (ballot scorer awards ×2 with detail `self-vote`; validated to need majority
  scoring and self-votes). `cursed-search-history` is ready on a new choice
  outcome, `push` (`questions/push-luck.ts`): lines every 6 s, the Raid drawn
  from after line 2/3/4/never and stored in `round_state` when answering opens,
  bails scored from the room's receipt time, banks 100/250/450/700, the Raid
  revealed only at the reveal. Phones and the projector share
  `play/guest-push.tsx` (BAIL in the dock; the projector shows bail counts).
  Both rounds are ready but **not in the running order** until the user says.
  The four content drafts (Reddit tribunal, Ferrier estate, Nextdoor,
  property price) still need the user's material.
- **Points trolls:** the birthday manifest adds `steal`, `robin-hood` and
  `share` to every scored choice (`outcome: correct`) without its own
  modifiers; the demo pack is unchanged. The public question schema only
  allowed `"double"`, which would have failed projection for these questions;
  it now accepts all four modifiers.
- **Troll rehearsals:** each troll without a full-screen preview has "Rehearse
  this troll" in Admin → Trolls: the real incoming banner from sample data and
  guided steps for a live check with bots and a second tab.
- **Phone tabs:** the phone returns to Play only when answers open (not at the
  get-ready beat), and Snap stays mounted once opened with the camera released
  while hidden, so an upload or voice clip in progress keeps its state. The
  in-question status line is shown again (it carries per-guest wording the
  flows rely on).
- **Tests:** API `points-trolls`, `push-luck`, `push-luck-room` (real room:
  Raid frozen before bails, bail banked, holder settled), self-vote scoring;
  web `route-error`, `guest-push`, `troll-rehearsal`, `stage-podium`. E2E specs
  updated for the tabbed phone (Troll/Snap tabs, exact Photo label, new send
  label).
- **Verified:** `npm run typecheck` passed; ESLint 0 errors / 27 warnings;
  `npm run test:unit` **116 files / 455 tests**; `npm run test -w @26/api`
  **92 files / 497 tests** (before the last web-only changes); content check
  passed with the four content drafts listed.
- **E2E (local dev, Chromium):** `kart.spec` and `admin-live-controls.spec`
  passed. `quiz.spec` now runs through troll and guess steps with the new UI
  and stops at the final advance to the podium; the podium itself renders in
  a unit test, so the cause is not identified. `media.spec` and
  `admin-sections.spec` fail at "Photo accepted." on the local upload; an A/B
  with the previous upload-header code fails identically, so it is not caused
  by that change; cause not identified. `photo-wall.spec` fails at the second
  phone's join on clean `master` too (both phones share a browser context).
  These are not passing checks.
- **Still outstanding:** the four content drafts; adding the two ready rounds
  to the order; the e2e failures above; physical phones (iOS Safari, Android),
  locking/reconnection, permissions, projector and venue Wi-Fi rehearsal.
  These follow-ups were committed as `dd167fb` and merged as `b8762e8`.
  Deployment verification was not recorded in that stage.

## 3 November 2026 — implement review remainder

Status: fixes implemented locally; full regression and connected-browser sign-off
remain blocked by local runtime startup stalls. This stage is not marked complete.

- Re-read the latest merge (`b8762e8`): deployment recovery, figurine self-vote
  scoring, Cursed Search History, scored-choice points trolls and guided troll
  rehearsals were already implemented. The debate round was dropped by the host.
  The two ready rounds remain outside the order; no live room was changed.
- Host decision in this chat: keep Reddit tribunal, Ferrier estate, Nextdoor and
  property price as explicit drafts. No sources, answers or images were invented.
- Fixed a local media target mismatch: local upload PUTs now always reach the
  emulated bucket that finalisation reads, even with real-shaped R2 credentials.
  Staging/production still sign genuine R2 targets and refuse missing credentials.
  Added `media-check.spec.ts` coverage for both boundaries.
- Deployment recovery now refuses automatic reload without a writable session
  storage guard. The real route recovery screen always leaves Reload available;
  it no longer risks an endless reload loop or a permanently disabled button.
  `route-error.test.tsx` covers refused storage reads and writes.
- Corrected Admin → Trolls to say the second question, matching server rules.
  The photo-wall browser test now uses separate guest contexts. Admin section
  assertions follow the current editable running order, collapsed pack details,
  and Next fact / Show the podium controls instead of obsolete UI expectations.
- Added `npm run smoke:rehearsal`, `playwright.rehearsal.config.ts` and the explicit
  local-only Worker fixture `apps/api/test/browser/wrangler.jsonc`. This uses
  ephemeral auth/room/media state, disables remote bindings and refuses a
  Cloudflare deployment target. Normal development config remains the default.
  Browser tests run serially because host OTP flows share one allowlisted admin.
  Evidence output goes to `artifacts/browser-checks`.
- Made Vitest’s Node 25+ web-storage flag conditional: the installed Node 24 LTS
  rejects that flag. No assertions, tests or required checks were removed.
- Updated `docs/question-authoring.md`, `docs/data-inventory.md` and
  `docs/event-runbook.md`: implemented variants, private Raid persistence, actual
  draft requirements and a concrete physical-phone/projector sign-off checklist.

Checks and evidence:

- `npm run typecheck`: passed after the initial upload/recovery fixes; not
  completed again after the later browser-harness configuration changes.
- `npm run build`: passed, including the existing generated-secret removal,
  711-file scan and content preflight. Four incomplete content drafts remain
  reported as expected. The later test-harness/config edits were after this build.
- API media regression: `npm run test -w @26/api -- --project auth
test/media-check.spec.ts` passed 1 file / 7 tests.
- Focused web recovery/admin coverage: `npm run test:unit -- --
src/ui/route-error.test.tsx src/admin/features.test.ts
src/admin/troll-rehearsal.test.tsx` passed 3 files / 11 tests.
- Full unit attempts on Node 26 stalled (one cold router import hit its existing
  30-second beforeAll timeout); runs were stopped, not counted as passes.
  Node 24 first rejected unconditional `--no-webstorage`; that configuration bug
  was fixed. Subsequent complete-suite attempts still stalled at startup.
- Full API regression was started but stalled during runtime startup and stopped.
  It is not a full-suite pass; the focused media pass above is separate evidence.
- Both compiled-preview `smoke` and isolated-development `smoke:rehearsal`
  selected media/photo-wall/quiz/admin-section runs timed out waiting 120 seconds
  for the local web server. No game assertions ran in those attempts.
- Final changed-file ESLint invocation also stalled without a result; it is not
  counted as passed. Changed files were formatted with the repository Prettier
  configuration. A final diff check was attempted but also did not finish.
- No deployment, remote resource creation, remote email send, or live game data
  change. Physical phones, venue Wi-Fi, HDMI/projector, deployed archive/email and
  connected load testing remain unverified.

Exact next stage: finish full unit/typecheck/lint and connected quiz/media/wall/
results browser runs on a working local runtime; fix any resulting assertions,
then carry out the physical-device checklist with the host. Include the two ready
rounds in the saved order only when explicitly requested. Four drafts remain out
until real source material is supplied. No deployment starts automatically.

## 3 November 2026 — review fixes deployed

- **Authorisation:** the user explicitly requested deployment after the preceding
  implementation report disclosed incomplete full-regression/browser checks.
- **Source:** deployed `b8762e8` plus the current local review fixes. The working
  tree remains uncommitted; no commit, push, PR or merge was requested or run.
- **Staging:** `npm run deploy:staging` passed its environment-specific build,
  generated-secret removal, 711-file artifact scan, content preflight and target
  configuration guard. Uploaded 39 changed assets to the existing Worker.
  Version `5acc36df-ebff-406b-9327-69f36b4f31b8` at
  https://26-staging.humza.website; served app `/assets/index-CZ6NP4I5.js`.
- **Production:** `npm run deploy:prod` passed the same release preflights and
  uploaded 39 changed assets to the existing Worker. Version
  `e01482cd-5fdd-4a7a-8041-937f06b0f419` at https://26.humza.website;
  served app `/assets/index-CU21_eC_.js`.
- **Live verification:** both health endpoints returned HTTP 200, `ok: true`,
  version `0.0.5` and the correct environment. Both sites served their new
  main bundle with the updated manual recovery copy and the updated Trolls
  module with second-question wording. Production `/join`, `/host`, `/admin`
  and `/kart` returned HTTP 200. These are read-only HTTP/bundle checks, not a
  complete interactive game or authentication rehearsal.
- **Scope and limitations:** four content drafts remain excluded. Existing
  bundle-size, PGlite eval, secret-name configuration and Node shell warnings
  remain. No migrations, secret sync, new resources, emails or live room changes
  were performed. Earlier full-regression/browser startup limitations and
  physical/venue checks remain unresolved; this deployment is not a test pass.
- **Exact next stage:** complete the pending regression and connected-browser
  verification, then the physical-device/venue checklist. No further stage or
  deployment starts automatically.

## 3 November 2026 — complete kart evolution plan (draft)

- **Request:** compare the current minigame with Mario-Kart-3.js and draft a plan
  to incorporate everything. Planning only; no implementation or deployment
  starts from this entry. Existing uncommitted review fixes were preserved.
- **Evidence:** original mustache-dev/Mario-Kart-3.js main at
  `83c3a8bb5aeab18b3d5f13084c5fba4a99cb78f7` and the already imported
  Nathan-Richard-21/mario-kart-js at `0f7a4305981206193c5efba64bc90755e6e85773`.
  Inventoried 103 and 113 source/asset/gitlink entries respectively and fetched
  108 text files across those pinned repositories, plus inspected the upstream
  joystick source. Binary assets were inventoried, not downloaded or visually
  verified. The VFX gitlink is recorded, not separately audited.
- **Deliverables:** `docs/kart-evolution-plan.md` (51 feature dispositions,
  phases 0–10, source links, architecture, admin coverage, rehearsal/tests,
  performance targets, decisions and completion gates) and
  `docs/kart-evolution-source-audit.json` (pinned paths, hashes, sizes, groups).
  Linked from the documentation index.
- **Findings:** most driving/course basics already exist; important additions
  are detailed connected vehicles/nearby opponents, full VFX/environment/look,
  control parity, complete lap/record/time-trial modes, named roadmap items,
  audio and scoped installable solo practice. Distinguish active, dormant and
  wishlist work. The named WebGPU canvas is not an actual WebGPU backend; the
  fork lap state lacks calls to its start/end-lap helpers in the audited source.
- **Proposed defaults:** preserve the existing one-lap/three-minute/80-player
  party race, ghost collisions and scoring; adapt source features through the
  current room/reducer/renderer boundaries. Item semantics, assets and budget
  numbers are proposals for implementation, not changes already made.
- **Validation:** documentation formatting, JSON structure, K01–K51 uniqueness,
  pinned-source inventory coverage and local Markdown links checked. No unit,
  typecheck, build, gameplay, physical-device or deployment check was run for
  this documentation-only draft; earlier runtime limitations remain.
- **Exact next stage:** review this plan, then explicitly request Phase 0 to
  settle baseline regressions and measurements. Do not begin implementation
  or deployment automatically.

## 3 November 2026 — kart evolution Phase 0 started

- **Authorisation:** user approved starting the complete evolution plan and automatic continuation after ordinary usage resets. Created active hourly chat heartbeat `continue-kart-evolution`; it checks usage first, preserves checkpoints, never purchases or spends reset credits, and does not deploy. Local machine/app must remain running. No exact reset trigger is claimed.
- **Checkpoint:** `docs/kart-evolution-checkpoint.md` records the current phase, evidence, failures and exact next actions. Existing review changes and four deferred content drafts remain intact. Phase 1 has not started.
- **Baseline harness:** `apps/api/test/realtime-load.spec.ts` and `apps/api/vitest.load.config.ts` accept `LOAD_TRACK=mario-circuit-v1`. This creates the genuine kart-only lobby and starts the authoritative imported circuit. Asserts actual track and frozen participant count, reports track/input rate and null quiz latency when no quiz runs, counts UTF-8 payload bytes and writes each completed size immediately. Existing ring/quiz mode remains the default. No game rules or dependencies changed.
- **Test setup:** changed web Vitest from threads to process forks after the unchanged router test passed with forks. Corrected `playwright.rehearsal.config.ts` to replace, rather than append to, the inherited preview server. Verified the append behaviour using the actual Playwright defineConfig API.
- **Verified:** root `npm run typecheck` passed twice, including after the harness/config changes; `git diff --check` passed. Router forks run passed 1 file / 12 tests (70.74s). Focused podium test on temporary npm-exec Node 22 passed 1 file / 1 test (24.28s), without changing pinned dependencies.
- **Not passed:** thread router cold-import hook timed out; full Node 26 fork suite stalled and was interrupted (worker termination named stage-podium.test.tsx). Selected quiz/media/photo-wall/admin browser runs timed out on server startup, including after correcting the duplicate-server setup; no browser assertions ran. First imported-circuit load attempt failed to start the Cloudflare runner (90.07s, no tests/measurements). An attempted API-workspace typecheck was invalid because that workspace has no such script; root check passed instead. An initial npm-exec --call diagnostic had an npm usage error; direct Node invocation worked.
- **In flight:** full web unit suite on Node 22 with one worker; imported-circuit 1/16/21/50/80 simulated-racer load repeated on Node 22; focused changed-file ESLint. These are not yet passes.
- **Manual verification:** no new interactive browser, physical phone, projector, device GPU or production Worker CPU verification. No new deployment, remote resources, remote messages or live room changes.
- **Exact next stage:** finish the Phase 0 checks, diagnose the remaining local startup stalls without skips or weakened assertions, capture connected imported-circuit lobby-to-podium and baseline evidence. Distinguish simulated local payload/wall time from actual billed CPU and physical rendering. Do not begin Phase 1 until the baseline gate passes.

Phase 0 follow-up evidence in this turn:

- Confirmed imported-circuit matrix now passed via the new portable `npm run load:kart-baseline` launcher on temporary Node 22: 1 file / 1 test, 55.57s total / 34.94s test time. Earlier shell assignment attempts silently used ring defaults; they are not evidence for the imported circuit.
- Numerical source: `docs/kart-evolution-baseline-data.json`; readable report: `docs/kart-evolution-baseline.md`. Stage cadence at 1/16/21/50/80 racers was 4.5/4.2/4.5/4.3/1.5 updates/s; the 80-racer p95 gap was 1,402ms. Six-second local samples with other checks running, not production capacity or actual Worker CPU. Investigate in an isolated longer run before new visual load.
- Focused glyph/stage-page Node 22 tests passed 2 files / 9 tests (16.12s). Full Node 22 suite still stalled and was interrupted. Node 22 browser repetition still timed out on server startup; no assertions ran.
- Changed-file ESLint passed including the launcher and metadata reporter. Final root typecheck repetition stalled and was interrupted; the earlier root passes remain separately recorded. No phase completion or deployment claimed.
- Next action remains Phase 0, led by isolated load diagnosis and full-suite/browser startup. The hourly heartbeat resumes from the saved checkpoint.

## 3 November 2026 — Phase 0 controlled load diagnosis

- Continued the approved kart plan; Phase 0 remains open and Phase 1 has not started. Preserved earlier review work and the four drafts; no deployment or gameplay change.
- Extended the portable baseline launcher with extended, idle and neutral modes and corresponding validated Worker-test bindings. Added a pure simulation diagnostic. Readable and raw evidence is in docs/kart-evolution-baseline.md and docs/kart-evolution-load-comparison.json.
- Two 20-second-per-size runs passed. Driving 50/80 racers yielded 2.7/0.9 stage updates/s and p95 gaps 863/2103ms; idle yielded 4.4/4.4 updates/s and 235/233ms. Pure Node simulation advanced 80 moving racers through 20 seconds in 603ms wall time; this is not Worker CPU. A neutral-message comparison remains pending and is needed before attributing the regression solely to transport.
- Main TypeScript build found and then passed after fixing the load reporter’s missing TaskMeta declaration. Solo tsc --noEmit also passed. Focused edited-file ESLint and git diff --check passed.
- Full web unit runs and direct Vite startup stalled and were interrupted. First neutral load attempt failed before tests at Cloudflare runner startup; clean retry pending. No tests were skipped or weakened. An initial solo check used a nonexistent packages/kart-solo working directory; corrected apps/kart-solo check passed.
- Local memory inspection showed low free memory during broad checks, but causality is unproved. Read-only workspace-process classification is pending; no unrelated processes were stopped.
- Exact next stage: record the neutral comparison, diagnose the remaining startup/input load issues, finish Phase 0 unit/typecheck/kart/browser gates and the connected lobby-to-podium rehearsal before adding visuals.

Input-path change and completed regression evidence:

- Added phase-scoped KartIngressCache in apps/api/src/room/kart-ingress.ts and used it in PartyRoom. Each control still checks fresh durable phase/pause/hold fields; the frozen roster is read once per scope/phase/question/version. Durable flush validation remains authoritative. No new commands, public fields, persisted data, host controls or game rules; existing Room admin coverage/ownership remains.
- Added kart-ingress.spec.ts: all 10 cache eligibility/invalidation tests passed. Kart pure tests passed 4 files / 35 tests; kart room/lobby passed 2 files / 12 tests after the change.
- Full web suite passed 116 files / 457 tests on Node 22 with normal two workers (135.79s). Includes admin feature ownership and kart renderer/controller tests. Earlier 240s outer-process timeout was not counted as a pass; individual test limits were unchanged.
- Post-cache neutral local sample improved 50/80 racers to 4.2/1.7 stage updates/s, p95 gaps 308/2820ms. Compared with previous neutral 3.5/0.4 and 552/6323ms. Keep the sample and runtime variability limitations; 80-racer capacity is still unresolved.
- Main TypeScript build, solo typecheck, changed-file lint and whitespace checks passed. Next: the connected browser race and pending quiz/media/wall/admin flows.

Browser progress and corrected rehearsal evidence:

- Isolated server startup is now demonstrated working, not merely pending: admin browser passed its full upload/moderation/private-media, completed-game, private/public results and responsive-layout workflow (1 test, 2.4m). Media and photo-wall cases also passed individually (11.6s / 15.8s).
- Quiz case passed (2.0m) after correcting completion handling; it retains exact real stage, receipt and privacy assertions. Final-action helpers have since been aligned explicitly with live-console.tsx and are being rechecked.
- Expanded kart rehearsal to two actual drivers plus a late spectator. Corrected a leftover one-racer expectation and an incorrectly inferred final-button label; final source uses the actual Show podium labels. Added an assertion for positive server-reported speed for both drivers and race/phone/podium screenshots. No game UI or rule change.
- Long browser checks now run through a local evidence wrapper writing live logs and code/signal completion status. A prior Node REPL call exceeded the tool response ceiling at 300s and reset without a complete result; it is not counted as a pass.
- Current final corrected admin/kart/quiz run: artifacts/kart-fix-checks/browser-final-check.log/.status.json/.result.json. Main web and focused API checks remain green as recorded above; no deployment performed.

## 3 November 2026 — Phase 0 browser regression and high-density canvas fix

- All 15 existing targeted browser cases passed on their current source across recorded serial subsets: admin, quiz, media, photo wall, two-driver connected kart and ten kart engine/power-up cases. Mixed failed batches remain failed. Latest admin-only rerun: 2.2m total / 1.7m case; quiz 1.8m; kart 29.0s. Two real phone sessions gained positive server speed; late spectator, pause/reconnect/resume, manual podium and privacy passed. Inspected race/phone/podium screenshots; these are Chromium simulations, not physical phones.
- Power-up case now uses real recovery to stop coasting before consumption, verifies speed zero and held item after recovery, then keeps use/empty/reset assertions. Retry passed 15.4s case / 27.9s total.
- New kart-render-baseline.spec.ts creates actual local kart rooms with one phone and the existing Developer bot fleet at 1/16/21/50/80, recording bounded RAF/draw-call observations, dimensions, server motion, stage population and errors. No fake renderer/socket/state. Phone switches to the real lightweight map before isolated SVG-stage measurements. Actual local workerd CPU profiling is sampled in a separate window through the rehearsal inspector.
- Regression proved high-density clipping: canvas client width 538 versus parent 359 at DPR2. Extended the existing canvas 100% width/height CSS rule to kart-canvas-mount. Subsequent real browser checks passed both width/height boundary assertions. No new controls, data or registry ownership; actual admin phone rehearsal uses this renderer/style.
- Measurement development failures retained: initial pause observations above one racer and final local Worker fetch failure; unsupported a input, then ignored ArrowUp on a focused button corrected to the real held pedal; initial inspector commands timed out until Runtime.enable handshake. Independent inspector handshake returned a real profile. None of these failed/interrupted batches is a complete matrix pass.
- Current browser-kart-render-v5 run is in flight; final profiling matrix, post-cache driving load and documentation reconciliation remain due. Main 457 web unit tests, 57 focused API tests and both typechecks previously passed after the input-cache change. Current existing e2e lint and whitespace passed; new profiler edit needs final lint. No deployment, remote resources or production-room changes.
- Exact next stage: finish Phase 0 measurements and checks, then report the gate and remaining physical/production limits. Phase 1 has not started.

## 4 November 2026 — Phase 0 clock-hint batching

- Ordinary usage resumed without spending reset credits. Phase0 remains open; no deployment or new game rules.
- KartIngressCache now reads phase eligibility once on cold ingress and refreshes after durable room changes and alarm commits, avoiding a SQL read on every continuous control packet. It remains a hint: each durable flush checks current phase/pause/hold, race, roster and revoked players. Disabled hints clear transient arrivals. Presence flushes under the old hold before releasing it, so held controls cannot restart the kart. No new stored/public fields or host commands; existing Room/Kart admin ownership remains.
- Added cold-clock cache coverage and two Room regressions deliberately retaining a stale hint across pause and controller hold. The first fixture sent an empty requestId and failed to prime ingress; corrected it to a valid UUID. No assertion removed. Current rerun passed4files/27tests (47.42s): ingress11, room11, lobby3, local-proof2. Main tsc-b and changed-file ESLint passed after the change. Solo/full web checks still need their final results.
- Prior roster-only driving load passed1file/1test63.81s: all50 and all80 racers moved;50=4.6updates/s,p95gap236ms;80=2.0/s,p95982ms. Stored as postRosterCacheDriving in comparison JSON. This predates clock-hint batching and is not its performance result.
- Bundled browser1/16/21 passed with genuine canvas bounds and pause;50 cleared the corrected held-pedal check but encountered debugger/host latency under traffic. Current profiler starts before race traffic and stops after authoritative pause; method5 explicitly includes warm-up/render windows. A50-only rerun with the new clock hint is in flight in bundled-baseline-50-clock-hint.log. No all5 matrix pass claimed.
- Fixed high-density canvas dimensions remain verified on High/Balanced/Low at1/16/21. Bundled local preview has an ephemeral proof key shared only across the build/preview pair, using existing session verification. Security TTL and client timeout unchanged. Temporary API tracing removed.
- Wawa gitlink resolved to wass08/wawa-vfx at exact0ecd0e7. Pinned package1.0.13 declaresMIT; complete pinned tree has no licence file. Three copied blobs identical and three differ. Audit JSON records hashes/evidence; retain licence/copy review before vendoring source.
- Exact next stage: record current50 result, complete80 and all5 local profiling, rerun the isolated load after clock batching, final full unit/typecheck and documentation reconciliation. Do not label Phase0 complete or begin dependent visual work yet.

4 November verification reconciliation:

- Exact root npm run test:unit passed116files/457tests (165.65s); exact npm run typecheck passed main and solo checks. final-check-results.json records exit0 and no signal for both. Current benchmark/config/Vite lint passed. No stage completion or deployment claimed.
- Post-clock-hint driving load passed58.06s: all50/80 moved; stage4.5/1.8updates/s,p95gaps244/1026ms. No measured cadence gain over roster-only4.6/2.0;80 remains unresolved.
- Dedicated performance suite now contains both rendering and profiled projects (10 discoverable cases). All CPU assertions stay in profiled cases; no failing checks removed to make the suite green. Ordinary e2e does not require this special local profiler. New path apps/web/perf/kart-render-baseline.spec.ts.
- Method7 rendering1/16/21 passed; subsequent50-only diagnostic observed positive human movement, then host POST aborted. Thus debugger overhead alone is not established as the cause. Both benchmark projects remain incomplete/failing. Current checkpoint was rewritten around this exact boundary and next tracing step.
- Inspected DPR2 phone capture: canvas fills its container. Physical phone/projector and real production capacity remain unverified. No new source vendored; Wawa licence/copy checks stay open.

## 4 November 2026 — Phase 0 local-runtime boundary and current race regression

- Current clock-hint Room source passed the connected two-phone kart browser regression in isolation: 1 case / 48.5s (1.1m total), exit0/no signal in browser-kart-post-clock-isolated.result.json. Includes positive server speeds, late spectator, pause/reload/resume, podium and privacy. First attempt failed the create-lobby URL deadline while lint/typecheck ran concurrently; retained as failed, with no timeout change.
- Supported local Node/Worker instrumentation showed the50 pause body fully consumed and sent to the runtime within4ms after authentication, but no outer application Worker fetch marker before the12s client abort. Independent health requests failed during load and after bot controls stopped. No demonstrated Room refusal, auth failure or exact upstream root cause. Connection:close trial also failed and was removed. Raw evidence: bundled-50-undici-boundary.log and bundled-50-health-load-boundary.log.
- Removed all temporary traces from API index/routes and Vite. No production logic, dependency version, proof validity or client/profiler timeout changed. Benchmark method9 retains held-pedal, positive-speed, canvas, error and authoritative-pause checks, and rethrows a motion failure after saving command evidence.
- Cleanup ESLint and main tsc-b exited0/no signal; exact full unit and root typecheck results remain as recorded above for unchanged Room logic. Baseline report reconciled with explicit historical/current passes and failures.
- Added a separate local-runtime regression using the actual Developer50-driver fleet and host pause/HTTP health, with no phone/WebGL context. Existing ten renderer/profiler cases are unchanged and remain required. Runtime project is currently running through the same isolated build/preview launcher; its result is pending in runtime-without-webgl.log. No new feature/public data/host command/admin registry entry; this uses existing Developer and Kart views.
- Phase0 remains open. Exact next: finish the no-WebGL boundary result, verify the new test/config, complete consistent50/80 renderer and WorkerCPU evidence. Phase1 has not started. No deployment or remote changes.

## Superseding finding — 4 November 04:33 UTC

All browser benchmark methods before10 opened a second control tab after starting the Developer fleet. PartyRoom.closeOlder replaces the old control socket; AdminRoomProvider.onReplaced sets blocked=true; DeveloperPage unmounts/closes its fleet. Therefore pre10 results do NOT measure the claimed active bot population. Frozen participant counts are not connected/sending bots. Preserve scratch metrics and failures, but do not use them as active-population rendering/CPU baselines. The local request traces reflect this flawed setup and do not establish load starvation or a specific upstream defect. API Node-load comparison data is independent and remains valid; two-real-phone workflow is unaffected.

Developer tools now reuse the existing start-kart command in the same tab, alongside existing pause/resume/advance. Other pack starts are disabled in kart-only lobbies. Component and registry checks passed2files/9tests22.24s. Method10 uses that sole control page and asserts every expected bot socket actually sent gas, plus the connected fleet count. New runtime-only test uses a separate stage-role map observer, not a second control tab. No new server command/data. Main unit/typecheck and new changed-file lint need a final run after this actual UI change.

Current managed4659 refers to the OLD failed no-WebGL setup (23.3s, no motion, never reached HTTP probe). Current corrected run is runtime-without-webgl-single-control.log; inspect its managed command result first. Reconcile the earlier boundary hypotheses above as superseded.

Final verification for same-tab rehearsal change:

- Exact root npm run test:unit passed116files/458tests164.38s; exact root npm run typecheck passed main and solo. Changed-file ESLint and git diff --check passed. Explicit exit0/no signal; single-control-check-results.json and named logs preserve results.
- Corrected no-WebGL50 run genuinely observed all50 bot sockets sending gas and positive server movement; only2 kart frames followed, then health/pause failed (180s test). Thus original fleet-lifecycle mistake is fixed, but local preview availability remains unresolved. Diagnostic now catches actual failed requests promptly; that reporting-only edit is lint/typechecked but not browser-rerun. No claim of50/80 capacity or Phase0 completion.
- Next: minimal external-WebSocket/HTTP reproduction; compare already-locked Vite runtime (Miniflare5.20260921.0-alpha/workerd1.20260921.1) and API-test runtime (5.20261023.3-beta/1.20261023.1), also accounting for API harness using in-runtime RPC rather than preview TCP. Version difference alone proves no cause. No dependency upgrades authorised in Phase0.
- Original10 baseline cases remain, plus1 standalone runtime case. Pre10 browser active-population claims are invalid; independent API load and current two-phone regression remain valid. No secrets/remote resources/deployments or new app data changed.

## 4 November 2026 — Phase 0 isolated runtime discrimination

- Added an explicit local-only50-WebSocket/10Hz/20s fixture and portable Node probe. Guards refuse staging/production; no game/state/score replacement. No new admin feature/command/data or dependency version. Six exact records retained in docs/kart-evolution-runtime-probe.json.
- Reproduced a native in-memory alarm crash in the Vite-locked runtime (Promise callback destroyed itself), matching workerd7191. Already-locked newer runtime passed. Old runtime also passed using disk-backed storage, through a Node HTTP/WebSocket bridge, with inspector proxy and with50 transactional SQLite writes per tick. This is diagnostic evidence, not app capacity.
- Tried isolated disk persistState in the actual50-bot browser check: FAILED55.8s,50 active senders/movement/3 frames, health timeout and pause abort. Reverted the unsuccessful Vite change. Therefore the synthetic crash is not established as the app stall cause. No speculative production fix, deadline extension or skipped assertion.
- Current root typecheck passed main/solo; helper syntax and whitespace passed. Final helper ESLint passed exit0/no signal (runtime-probe-final-lint.log). Existing458 app unit tests remain unchanged/current.
- Exact next: compare real Room attachment/auto-response and protocol behaviour in the passing minimal fixture. Phase0 remains open; no Phase1/deployment/remote changes.

## 4 November 2026 — Phase 0 synchronous initialisation regression

- Added isolated attachment, auto-response and empty-barrier modes to the diagnostic fixture; canonical comparison now retains12 cases. On the old runtime, the bridge fails POST/start with an EMPTY asynchronous blockConcurrencyWhile constructor barrier (ECONNRESET), while direct TCP and the already-locked newer runtime pass. Old bridge with identical automatic pong configured synchronously passed95ticks/9550 inputs/500pongs. Native attachments passed97ticks/14700 reads/4900 writes. No dependency upgrade.
- PartyRoom and RoomCodeRegistry constructors now run their entirely synchronous schema/pong setup directly before returning. No awaited work exists to protect with an async gate. No new schemas/public fields/commands, game rules or authority; existing Room admin coverage applies. Updated Room plumbing README. The real50-bot browser check is pending in runtime-sync-init.log (managed32150); no app fix claimed yet.
- PartyRoom-only change passed5API files/50tests73.20s (room,kart-room,kart-lobby,phase,ingress). Registry change followed and needs its final regression run. Full unit/typecheck also pending for this implementation stage.
- Corrected an earlier source interpretation: closeOlder is invoked for guests/projectors, not control sockets. Old population measurements lacked sent-input verification and remain unqualified, but that alone does not prove the fleet closed. Reworded Developer copy to the verified fact: navigating away from Developer tools stops its fleet. Same-page controls and new all-bot input checks remain valid.

## 4 November 2026 — Phase 0 corrected runtime baseline and final regressions

- Supersedes the synchronous-initialisation trial entry: actual app trial failed and all constructor/README changes were reverted. Fixture v1 unread POST bodies confounded barrier/reset conclusions; corrected v2 barrier and combined pong/attachments/SQL pass. No speculative production bootstrap fix remains.
- Added guarded local browser-test backend selection from the already-locked API runtime, using supported Node22.15+ registerHooks. No dependency versions/lock changes. Ordinary preview remains on its pinned backend; isolated test helper refuses non-rehearsal/non-isolated environments. Guard suite5/5 passed.
- Complete corrected rendering/profile matrix at1/16/21/50/80 plus runtime50 PASSED11cases/6.1m exit0/no signal; each actual bot input, movement, pause and inspector-profile assertion retained. Canonical JSON records exact samples/profile hashes. RAF and profile sampling are not physical FPS or billed CPU; no production capacity claim.
- Broad final browser run12/15 passed11.1m exit1. Solo acceleration and intermittent boost release fail; full quiz exceeded240s. Investigating bounded solo DOM/input recordings and quiz timing with original assertions/deadlines. No tests skipped or weakened. Phase0 remains open.
- Earlier458unit tests/main+solo typecheck/API27 cache tests passed; refresh due after final helpers/caption changes. See checkpoint for active sessions and exact next action. No Phase1, deployment or live remote changes.

- Diagnostic follow-up: full unchanged quiz PASSED2.2m under its original240s limit; broad failed batch remains recorded. Phone default-course trace caught a sweeper clearing drift charge before release. Explicit phone viewport and real Clear track setup passed both unchanged driving scenarios12.3s/17.6s. Promoted setup only; retained all speed/boost/recovery assertions and deadlines plus dedicated hazard/desktop graphics coverage. Final15-case batch running, serial verifier waits for success before all required checks.
- Reviewed method10 DPR2 phone captures1/21/80: canvas fits. Bottom dock overlaps lower pedal area at initial scroll; recorded for planned HUD refinement, no physical-device sign-off.

## 4 November 2026 — Phase 0 local baseline complete

- Complete11-case real rendering/inspector/runtime matrix passed6.1m, exit0/no signal, for1/16/21/50/80. Explicit guarded local test backend selects already-locked API Miniflare/workerd without dependency upgrade; normal preview's high-load SDK issue remains a documented tooling limitation. Canonical browser data/profile hashes and corrected runtime counterexamples saved. No precise upstream app cause or production capacity claim.
- Final broad browser run14passed/1failed9.5m: quiz, admin/results, media/wall, connected two-driver race/podium/privacy, graphics/course/drift, mobile layouts and asset recovery pass. Sole old power-up setup failed. Strengthened original power-up test passed separately41.7s/1.6m total, exit0/no signal: all15 scenarios have current pass evidence across runs; failed broad batch remains failed. No assertion/deadline removed, skip or only.
- Drift setup uses real phone viewport/Clear track controls after trace proved independent sweeper interference; dedicated course/hazard/desktop graphics tests retained. Power-up test adds distance beyond all boxes and exact item retention across recovery before use. No game physics/input/rule change. Temporary diagnostics archived outside discovery.
- Final exact root unit116files/458tests185.73s; root main+solo typecheck;10API files/88tests52.30s; five-population load1test45.66s; helper guards5/5 (skipped0); changed-file lint/content/whitespace passed. All explicit exit0/no signal; phase0-final-checks.json and named logs preserve evidence. Formatting checked phase files, final documentation reconciled. Content preflight retains four deferred drafts.
- Final6s load: all racers moving at1/16/21/50/80; stage4.5/4.3/4.5/4.7/2.5updates/s andp95gaps230/242/239/228/536ms; no full guest snapshots during windows. Six-second in-runtime API harness is distinct from browser TCP/20s samples; no performance improvement or smooth80 capacity claim.
- Reviewed current1/21/80DPR2 phone screenshots: canvas fits; bottom dock overlaps lower pedals in initial view, carried to Phase6 HUD. Physical phones/projector/venue and production budgets remain Phase10 checks. No new product data/public fields/host commands; existing Room/Kart/Developer admin coverage applies.
- Corrected control-tab eviction and unread-body fixture claims; unsuccessful constructor/disk trials reverted. Wawa provenance locked in audit; resolve notice/differences before new copied source. Preserved unrelated uncommitted work and all four drafts; no deployment/live-room/email/paid-resource changes.
- Exact next stage: Phase1 versioned contracts/asset manifests/readiness/capability-safe render budgets in existing adapters, plus Admin Kart/Health coverage and required tests. Detailed next actions and limitations in docs/kart-evolution-checkpoint.md. Phase1 has not started; continuation stays enabled for the unfinished full plan.

## 4 November 2026 — Phase 1 foundations in progress

- Added versioned inventory/schema for5 local kart files and18 embedded textures with exact source/hash/usage/retention metadata; no kart audio installed. Both renderer model adapters use shared paths. Node inventory tests check actual original bytes and embedded texture hashes. Authenticated read-only /api/admin/kart-assets uses existing validation/access/no-store path.
- Admin Kart now has cancellable,30s-bounded file integrity checks, local five-entry history, provenance/fingerprint inspection and actual graphics policy. Downloads are streamed into fixed manifest-sized buffers; no guest readiness or GPU claims. Real circuit rehearsal remains the existing iframe. Health shows public accepted finish-event history. No new host command or product persistence.
- Added versioned plain vehicle/effect descriptions shared by both isolated Three bundles, capability-limited graphics and scene spark/trail budgets; mandatory items/hazards/karts remain separate. Added bounded optional public finish events with stable eventId, race-scoped reconnect suppression and legacy snapshot support. Private input sequence assertion retained unchanged. No physics/scoring changes.
- Latest focused checks before final loader/reconnect edge additions: web15files/70tests20.60s and API5files/31tests22.62s passed; main/solo typecheck passed before newest adapters. Earlier red authoring iterations retained in tool history (Node file-test environment, panel presence/matcher, private sequence-name collision, new-test key order); fixed without weakening existing tests.
- Phase1 OPEN. Next: verify new actual-loading/reconnect edge tests, browser admin hash checks and both real renderers, final root unit/typecheck/lint/content checks, complete provenance/manifest/admin documentation before Phase2. No deployment/live rooms/emails/paid resources; four drafts preserved.

## 4 November 2026 — Phase 1 complete locally

- Shipped shared versioned asset/render/effect contracts and bounded public finish metadata, actual loader state and capability/decorative limits across the two retained renderer adapters. Installed inventory5files/18embedded textures with exact fingerprints; source ledger46media entries/29distinct Git blobs has per-entry disposition. Original-code VFX adaptation chosen; no new Wawa vendoring or dependency upgrades.
- Admin Kart Files & limits reads authenticated validated metadata, verifies actual downloads with fixed-size streamed buffers, cancels/times out/retries and retains five in-page check summaries. Default Drive stays immediate; rehearsal uses real engine. Health shows accepted bounded public finish history/count/version, never invented guest GPU readiness. Registry/data inventory/docs updated. No new host command/private field/product persistence.
- Final root unit118files/470tests136.62s; main+solo typecheck; API10files/79tests30.53s; changed-file lint/content/whitespace all passed, explicit exit0/no signal. phase1-compatible-checks.json and logs preserve exact results. Whole-frame unknown-cosmetic-version omission preserves strict timing/private-field checks. Initial Node JSON import failure corrected using required import attributes; failed iterations retained.
- Browser10cases3.1m passed; final Files & limits rerun21.4s/45.4s total passed. Real5/5 hashes, forced4/5 decoder failure, retry5/5, both real driving paths, layout/recovery and all course controls verified. Reviewed phone capture; detailed diagnostics moved off the default driving view.
- Final isolated root release build/strip/artifact/content passed20.756s, no deployment. --list discovered11 benchmark cases only, not new performance runs. Formatting phase files checked. Four content drafts unchanged/incomplete as requested.
- Remaining: ordinary local Vite high-load SDK limitation documented; physical devices/projector/venue/production budgets and old-client release boundary remain later checks. Lower-pedal/dock overlap stays Phase6 work. No live rooms/emails/paid resources/deployment or unrelated changes.
- Exact next stage: Phase2 detailed vehicles/drivers, bounded nearby opponents, chosen solo driver/face and optional3D spectator cameras, with real Admin Kart/Live rehearsal and required tests before Phase3. Saved exact files/tests/constraints in docs/kart-evolution-checkpoint.md. Continuation remains enabled for the unfinished full plan.

## 4 November 2026 — Phase 2 started, pose foundation only

- Added original pure version1 vehicle pose helper and plan-named vehicle-pose.test.ts. Bounded steering/roll and accepted-travel wheel angle; reduced motion suppresses decoration; non-finite and huge finite input stays safe. No renderer wiring or new runtime behaviour yet, so Phase2 is incomplete and admin integration is still due.
- Focused test1file/3tests passed1.40s exit0; files formatted. Full root unit/typecheck not rerun for this unwired increment.
- Next: integrate with existing detailed rig/renderers and Admin Kart, then nearby opponents and stage cameras under approved Phase2 tests/receipts/privacy rules. Current checkpoint preserves exact next actions; no Phase3/deployment/live resources. Ordinary usage nearly exhausted; reset credits untouched.

## 4 November 2026 — Phase2 opponents and connected vehicle adapter in progress

- Server selects max8 nearby public poses with retained-neighbour hysteresis; bounded roster-number selection persists in existing race state. Self and full stage field remain separate. Opponents default off; receipted host on/off commands, private bounded history and existing Live controls added with success/refusal/replay/audience tests. API opponents+room16tests21.54s passed.
- Connected rendering now bounds self+opponents at9, quality caps8/4/2, removes stale poses, and applies shared wheel/steering/roll. Lazy instanced7-part retained GLB uses native dimensions/shared textures; Low or failed model keeps simple vehicles and retry. No physics/scoring change. Focused web14files64tests16.84s and typecheck passed before newest rehearsal code.
- Added authenticated sample pose endpoint and real Admin Vehicles viewport/style controls; newest tests/typecheck pending. Phase2 remains open; checkpoint lists active check and exact remaining solo/stage/admin/browser work. No deployments or draft changes.

## Phase2 driver increment 2026-11-04T14:17:36.477Z

Focused web16files73tests21.18s and API3files32tests20.57s passed (phase2-focused-web/api.log). Browser initial2cases passed1.2m (browser-phase2-opponents); reviewed screenshot caught missing kart.css in standalone Vehicles view and ResizeObserver feedback. Fixed import and added real viewport bounds assertion; rerun now browser-phase2-driver (3cases including solo). Do not count this rerun as passed until its result.

Extracted native driver constructor factory, keeping both pinned Three runtimes separate with explicit nominal-type adapter boundary. Solo shares six styles/animation semantics and wheel dimensions/steering/travel helper; current terrain and drift physics retained. Face meshes/textures are capped per visible capacity including during roster rotation, pruned/disposed; test rotates80 through9. Connected camera eases only accepted boost feedback, reduced motion suppresses it. Parent practice adapter validates same-origin handshake, fetches authorised photo with2MB streaming/15s bound and sends only style+Blob; practice accepts no URLs/credentials and revokes local object URLs. Explicit guest practice button; Admin Vehicles local-image sample rehearsal, never uploaded or stored. New tests alongside code.

Latest root main+solo typecheck PASSED; focused web18files71tests21.89s PASSED before newest browser telemetry test instrumentation. Earlier initial nominal Three declaration mismatch corrected at isolated native adapter; no dependency/typecheck weakening. Newest browser/native image run pending. Full phase2 root unit not yet run; phase2 remains incomplete (stage cameras/commands/rehearsal + browser real host toggle still required). Keep all constraints and four drafts.

## Phase2 stage and verification increment 2026-11-04T14:34:20.095Z

Added optional server-selected map/overview/follow-leader/director stage presentation. Director rotates leading3 active public racers by accepted8s slots, frozen-roster tie breaks, safeemptyfallback. No new scheduler/input/score logic. Four receipted host commands validate again in domain; private20-entry stage history and public bounded revision let later host choices resume a locally returned map. Both new opponents/stage commands increment existing room stateVersion; replay does not apply again. Real /admin/kart?view=stage rehearsal shows80 labelledstand-ins with actual KartGameWrapper/KartCanvas; live controls see/manage stage mode/history and map return. Canvas stagefollow keepsfull80, reuses scene when director target changes, whole-track overview derived fromexistingroutebounds; no clientdirectorclock.

API4files38tests29.21s passed, then broader all kart+admin auth12files91tests54.02s passed afterversiontouchassertions. Browser stage2cases1.3m passed:80allmodes/immediatemap, actuallocal2phone hostopponents/camera/pause/map. Main+solo typecheck passed. First rootunit1failed124passed491tests226.77s: adminunit fixtureemptyrace correctlyyieldedoverview, fixedfixture torealstand-in (noassertionweakening). Next root125files492tests164.09s passed.

Final corrections: sample solo iframe must import its own styles (screenshotrevealed300x150 default); addedheightassertion. Solo driver now follows actual native chassis anchor, includingterrain/flight; no newstore. Sharedchassisroll now also usedinsolo. Bounded failed-face fallback and redrawcallback workunderpaused/reducedrenders; ignorelateloadersafterdispose. Photo notice keyed torequest, no synchronous effect-state reset. Changed-fileESLintpassed4.671s/contentpassed0.604s, exit0/nosignal; existingignorewarningsfor2upstreamJSfiles unchanged.

INCOMPLETE pending finalchecks: browser-phase2-final currently5new+existing solo regressioncases; final rootunit/typecheck in phase2-final-*.logs/results. Inspect actualcompletion, screenshotfinalsolo layout/alignment andno runtimeerrors, then local releasebuild/strip/artifact/content ifneeded. Do notmarkphase2completeuntilgreen. Fullplanunfinished; noPhase3beforephase2gate. No deployment/live/resources/draftchanges.

## Phase2 regression corrections 2026-11-04T14:40:59.840Z

Final root unit passed125files492tests198.86s, exit0. Full kart/admin API12files91tests54.02s passed. Local root release build/strip/artifact/content passed59.924s (phase2-build.result.json); benchmark --list only, not new measurements.

Eight-case browser final initially7passed/1failed3.7m: added toolbar driver selector caused real390px Reset kart overlap with Course set-up. Moved selector into existing secondary Course set-up; unchanged regression then reached its no-console-errors assertion and caught determinantAffine errors (7passed/1failed2m, browser-phase2-corrected). Root cause: new native solo driver constructors used pinned176 but hoisted Fiber renderer resolved another Three copy. Added Vite resolve.dedupe for three from solo app root, no dependency upgrades; runtime Scene/Renderer instanceof guard plus browserdataassert176/native true. This is a real bundle compatibility fix, not a suppressed assertion. Browser-phase2-native8cases RUNNING now; inspect exact outcome. Final typecheck28727 and changed-file lint/content36107 running. Rootunit source is unchanged by these last solo/build/e2e changes. Do not call Phase2 complete until browser and final native checks pass. Need local build AFTER final browser closes (avoid mutating practice output while browsers run).

Native solo driver follows chassis anchor height/heading, shared chassis roll, no new render pose store. Sample iframe styles now import at their own boundary; screenshot confirms full usable height. Practice selector lives in secondary set-up to avoid racing control overlap. Four deferred drafts and all prior limitations preserved.

## Phase2 native runtime verification 2026-11-04T14:42:33.265Z

The native bundle fix is verified by the running browser case: actual solo Scene/Renderer match constructors, Three revision176, driverinstance1/photo1 then0. Unchanged solo load/drive/drift/pause/reset/context-loss/no-console-errors regression also PASSED15.7s. Current8case run browser-phase2-native had firstcase cold local admin-session timeout30.1s (Checking administrator session; email not yet rendered), while second/third/auth passed. It ran alongside55s lint/typecheck. Do not extend timeouts, skip or relabel it green. Let run finish, then rerun final8 cases sequentially with no concurrent heavy checks/output builds. Added explicit pageerror assertions to both new suites (including phone/stage pages), preventing visual attributes alone from masking render errors. Final source lint/typecheck currentlygreen before these test-only pageerror assertions; final checks remaining in saved next actions.

## 4 November 2026 — Phase 2 complete locally

- Connected High/Balanced now use the retained detailed kart with shared steering, wheels and chassis roll; Low or failed downloads retain simple vehicles with retry. Server-selected ghost opponents are bounded at eight, four or two visible neighbours by graphics tier. Self remains separate and the stage map retains the full field. Frozen roster numbers and hysteresis stay in the existing race; input cadence, physics and scoring are unchanged.
- Six driver styles share native rig and animation semantics. Face resources stay within visible capacity, are released when hidden/departed, and fall back after image failure. Solo practice carries only explicit style/image bytes through a validated same-origin adapter. Native driver follows the actual chassis. Practice receives no room credentials, media URLs, socket or score authority.
- Added reversible stage overview, follow-leader and director modes with immediate full-map return. Server selection uses accepted time, not browser clocks. Existing commands/receipts/state versions carry opponent/camera choices; bounded histories are host-only. Admin Kart Vehicles and Stage views rehearse real components with 80 labelled stand-ins and a local sample image; Live controls manage settings/history. Registry, notices, data inventory and render contracts updated.
- Final root unit:125 files/492 tests passed198.86s. Main and solo typechecks passed. All kart/admin-auth API:12 files/91 tests passed54.02s. Eight browser cases passed2.0m with pageerror assertions, native Three revision checks, actual host controls, photo clearing, model recovery, phone sizes and the unchanged solo drive/drift/pause/reset regression. Exact logs/results are under artifacts/kart-fix-checks; phase2-summary.json indexes them.
- Final changed-file lint19.794s/content0.811s passed; existing upstream JSX lint-ignore warnings retained. Final isolated root release build/strip/artifact/content passed25.856s, exit0/no signal/error. Benchmark --list discovered11 cases only; no new measurements or deployment. Formatting and whitespace checked.
- Failed iterations retained: empty sample fixture corrected, standalone styles and iframe size corrected after screenshot review, phone Reset overlap fixed by moving driver selection into Course set-up, and incompatible Three matrices fixed by deduplicating solo's pinned0.176 runtime. Runtime Scene/Renderer guards and browser assertions now verify the boundary; no dependency upgrades or suppressed assertions. One cold local admin-session timeout was followed by a clean serial8-case run with unchanged timeouts.
- Physical phones/projector/venue/Worker budgets and old-client release checks remain Phase10; connected pedal/dock layout remains Phase6. The ordinary local SDK high-load limitation and explicit guarded test backend remain documented. No smooth80 certification. Four content drafts and unrelated work preserved; no deployment/live-room/email/paid-resource changes.
- Exact next stage:Phase3 original bounded drift/exhaust/terrain VFX, corrected skid marks, finite celebrations and real Admin VFX bench, with the plan's required expiry/duplicate/reduced-motion/flight/disposal/export tests. Phase3 has not started. Checkpoint rewritten for a concise handover; prior narrative preserved in phase2-checkpoint-history.md. Continuation remains enabled for the unfinished full plan.

## Phase 3 started — bounded effects foundation and early bench

Phase3 is INCOMPLETE. Added shared strict version1 local-preset schema/export and proposed scene budgets1024/512/128 particles and256/128/64 tyre segments. New scene-owned pure pool has bounded/recycled particles, ground/flight gating, emission/burst modes, lifetime/gravity/fade/size, accepted finish deduplication via existing event cursor, finite start/finish confetti, and endpoint-bounded tyre marks. No global VFX store or gameplay/network/persistence changes. Original procedural neutral alpha atlas and native instanced shader adapter added; no imported Wawa assets/source.

First focused pool1file7tests20.94s passed; next pool/renderer/existing drift3files13tests5.13s passed. Initial typecheck failed only for an unused type import, removed. Newest typecheck and focused bench/circuit/registry tests are running; inspect exact results before claiming passes.

Early Admin Kart Effects tab reads existing authenticated server stand-in poses and renders real circuit/new effects through explicit optional Canvas props. Local controls validate presets before rendering; pause/disable/reset/export/import and actual scene counts. It is labelled work in progress and does NOT enable new effects in live room/solo. Existing race path keeps established sparks; opt-in bench suppresses legacy sparks so budgets do not stack. New resources are lazy and scene-owned. Tests added alongside, browser kart-vfx.spec.ts NOT RUN yet.

Exact next: inspect phase3-bench-unit and phase3-typecheck outputs, fix failures, run isolated browser Effects bench including actual shader errors/pageerrors, then finish shortcomings (moving terrain/skid/impact/start/finish rehearsal scripts, variable trails/anchored flame behaviour, paused/hidden/reduced handling, fair budgets and resource measurements), integrate both native adapters and enable only after full admin/verification. Add required drift-effects extensions, all phase3 tests/full root unit/typecheck/API as needed. No Phase4 until complete. Preserve four drafts, secret/generated exclusions, no deployment/live rooms/emails/paid resources. Source list phase3-files.json.

## Phase 3 early bench verification — 2026-11-04T15:12:58.385Z

Focused pool/renderer/drift/circuit/bench/registry6files30tests9.22s PASSED, main+solo typecheck PASSED. Browser first bench test failed when changing reduced motion after mount: emitted particles kept running. Preserved assertion; extracted existing theme live browser-preference listener into shared anim/use-reduced-motion.ts (useSyncExternalStore), with a listener-change/cleanup test, and reused it in theme chrome and bench. Subsequent browser real shader/mesh/pause/disable/export/import/live-reduced test PASSED15.5s/35.0s total (browser-phase3-bench-motion). No shader/page errors.

Full rootunit129files503tests174.04s PASSED, root main+solo typecheck PASSED, changed-file lint38.988s and content0.725s PASSED. This is verification of the incomplete increment, not Phase3 completion. Latest addition after that check: bench High/Balanced/Low selector and matching counts, plus browser quality assertions and active screenshot. New browser-phase3-bench-quality is RUNNING; inspect result. Focused tests/typecheck/lint need final rerun for quality-only addition.

Pool counters now wrap and emission accumulation is bounded. Canvas clears VFX history on visibility changes so hidden-time events cannot reappear as fresh celebrations. New resources stay lazy/opt-in; existing live and solo still use prior effects. No new host command, gameplay authority, product storage or deployed resource. Phase3 remaining integration/rehearsal/measurement work remains exactly as noted above.

## Phase3 usable bench and wake semantics — 2026-11-04T15:21:43.608Z

Browser quality test PASSED17.8s/37.5s total: Low<=128 particles/self+2, Balanced<=512/self+4, real shader/mesh, pause/disable, validated export/import, dynamic reduced-motion suppression. Screenshot review prompted clearer touch-sized numeric fields and separated effect toggles. Final layout browser PASSED18.7s/34.6s total, including390px no horizontal overflow and44px minimum numeric input. Manual active screenshot reviewed.

Subsequent pure improvement: trailLength now bounds actual world-space wake distance (not just particle scale), while glow/arc/flame positions follow owner sockets and pause freezes them. Gravity tuning affects moving smoke/confetti, with meaningful tests. Pool tests now9 passed3.28s. New browser-phase3-wake-final currently RUNNING for those final cosmetic positions; full root/final type/lint checks to follow. Do not label Phase3 complete.

Exact remaining work: native solo adapter and chosen/preset practice transport; moving dust/terrain/tyre/contact/start/finish replay scripts using actual components; accurate ground alignment and contact socket placement; resource/quality/disposal/theme/hidden/pause checks and measurements. Current early bench is explicitly local-only, new effects not enabled in live/solo. Decide and implement receipted host enable/disable with bounded private history if enabling live room presentation. Preserve legacy reduced-motion sparks until the new adapters/admin gate is complete. Required phase-wide tests and final root unit/typecheck/API/browser verification before Phase4.

## 4 November 2026 — Phase 3 early bench verified; phase remains incomplete

- Final root unit129files505tests PASSED150.14s, exit0. Main+solo typecheck PASSED, exit0. Changed-file lint4.187s/content0.645s PASSED, no signal/error. Final actual browser Effects bench PASSED12.9s/27.8s total, exit0/no signal/error: real shaders, quality caps, native mesh mode, pause/disable, validated export/import, changing reduced motion while mounted,390px no overflow and44px controls. Exact summary and named logs: artifacts/kart-fix-checks/phase3-summary.json.
- Original bounded per-scene effects and validated local bench are now reviewable under Admin Kart → Effects. World-space trails respect distance; flame/glow/arc anchors follow current pose. Moving smoke/confetti respond to gravity, all particles expire/recycle, accepted event IDs suppress replay, and hidden-tab history is cleared. No external textures/Wawa source, global store, gameplay change or room/solo activation. Screenshot review fixed weak input styling; active viewport and controls reviewed.
- Phase3 is NOT COMPLETE. No root release build or API suite was rerun for this partial increment; Phase2’s prior results remain historical. No new host fields/actions/API routes/product persistence. New effects are explicitly isolated to the early admin bench.
- Exact next action: implement the native solo adapter and validated optional preset in existing practice transport/store, retaining pinned176 runtime checks; migrate actual effects entry points to the live reduced-motion adapter. Add replayable moving tyre/terrain/impact/start/finish scripts, accurate ground/socket alignment, theme/hidden/pause/disposal checks and resource measurements. Complete receipted host see/manage/rehearse controls before enabling room effects, and all plan-named tests/full final checks before Phase4. Current shader buffers retain fixed high allocation even on low active budget; do not claim memory/performance certification.
- Four drafts, unrelated uncommitted work, secrets/generated exclusions and all no-deploy/live-resource/email constraints preserved. Last usage read93% ordinary allowed, two reset credits untouched. Continuation stays enabled for unfinished plan.

## Phase3 practice preset contract — 4 November 2026, 15:52 UTC

Extended the existing strict practice-presentation validator with optional effects: a validated/cloned KartVfxPreset or explicit null reset. Unknown/undefined fields, future versions, nonfinite values and nested/top-level private fields reject the whole message. Existing style/Blob-only messages stay unchanged. The same-origin/source-checked solo receiver stores only the validated preset in existing ephemeral soloVfxPreset (defaultnull), clears it for legacy/reset messages and on cleanup. No new store, socket, score path, URL/credential transfer or rendering activation.

Focused practice validator/frame tests2files4tests PASSED4.38s (phase3-practice-contract.log), main+solo typecheck PASSED (phase3-practice-typecheck.log), changed-file lint3.333s/content0.567s PASSED (phase3-verify.result.json). Files formatted. Full root unit/browser were NOT rerun for this narrow protocol increment; prior505-test and browser passes remain historical to their source. Phase3 stays INCOMPLETE.

Exact next action: extend SoloPracticeFrame’s existing parent handshake with a validated optional preset and avoid re-fetching an unchanged face on every tuning change; then consume soloVfxPreset through a native176 R3F effects adapter using the existing scene-owned pool/factory. Preserve default legacy effects/null and native Scene/Renderer version guard. Add real Admin Effects solo rehearsal and browser coverage proving preset application/reset, bounded counts, pause/reduced-motion, face preservation and no room credentials. Do not expose a solo-effects control until it actually drives this adapter. Remaining moving terrain/skid/contact/event scripts, ground/socket alignment, host controls and resource measurements are still required before Phase3 completion/Phase4. Reset credits untouched; no deployment/live-room/email/paid-resource/draft changes.

## Phase3 native solo integration started — 2026-11-04T18:59:59.106Z

Ordinary quota reset1%, reset credits untouched. Parent SoloPracticeFrame now separates bounded authorised-photo loading from presentation sends, retaining one photo Blob per key; style/preset/readiness changes reuse bytes. New test proves one fetch, face preservation and explicit preset reset without room fields. Native SoloVfx uses scene-owned pool and shared original shader factory with solo176 constructors plus Scene/Renderer guard; no Three instances cross bundles. Old DriftEffects is retained as default legacy fallback when no preset. Explicit optional preset selects new adapter; disabled preset draws0, null restores legacy.

Admin Effects has opt-in real solo rehearsal, local sample face, preset/legacy switch and unmount; default practice/live rooms unchanged. New component/browser tests added alongside code. Focused tests and typecheck just launched (phase3-solo-unit/typecheck.log); inspect exact outputs. Browser native/face/tuning/pause/reduced/reset/socket tests NOT RUN yet. Phase3 remains INCOMPLETE; no Phase4/deployment.

## Phase3 native solo sender/adapter increment — 2026-11-04T19:04:10.663Z

Parent photo loading is now independent of style/preset/iframe readiness, with one bounded Blob cache. Metadata-only messages omit face to preserve the receiver’s existing object URL and texture; explicit null clears it, and a fresh frame revision resends actual bytes. Same strict validator, origin/source checks, no credentials/URLs/room fields. New unit test proves one photo fetch and no repeated image bytes through style/preset/reset changes.

Native SoloVfx consumes validated preset from the existing solo store, uses native176 constructors/guards and the shared scene-owned pool/masks/shaders, freezes on pause, honours the live reduced-motion adapter and resets hidden history. Null retains/restores LegacyDriftEffects; disabled preset draws0. Admin Effects exposes opt-in real solo rehearsal, local face, legacy toggle and close. Existing practice/live rooms remain default legacy, no authority change.

Focused sender/validator/admin3files7tests PASSED6.45s after metadata-only optimisation; initial6tests84.88s also passed before optimisation. Main+solo typecheck PASSED after both versions. Browser-phase3-solo launched now (2cases) for actual shaders/native176/photo preservation/pause/disable/reduced/legacy/socket and existing bench regression; NOT yet verified. No phase completion/Phase4.

## Phase3 moving scripts and accepted contact cue — 2026-11-04T19:14:11.137Z

Native solo browser2cases PASSED2.1m (solo48.1s, existing bench13.2s), actual176 shaders, bounded counts, metadata-only face preservation, pause, disabled preset, dynamic reduced motion, explicit legacy fallback and no room socket.

Added isolated finite moving scripts start/drift/boost/dirt/flight/impact/finish. They transform validated public stand-in data only, use no room/socket/score and zero stand-in points, keep stable terminal timestamps and explicit run IDs for replay. Canvas owns only cosmetic script time, paused/hidden/reduced-safe. Per-kind actual pool counts are available in admin. New optional public contact boolean projects accepted physics contact, no raw inputs; native uses existing body.contact. Pool emits once on a fresh contact edge, suppresses held/historical contact. No collision rule changes. Four focused script/pool/circuit/admin files26tests46.16s passed before latest UI selectors; API event/contact1file4tests5.56s passed; main+solo typecheck passed.

Added actual script pause/dust/flight/contact/finite-finish/replay browser test and admin command checks alongside. New browser-phase3-scripts (3cases) RUNNING; inspect completion. Phase3 remains incomplete, next accurate surface/socket alignment, host switch/history/receipts and resource measurements before full verification/Phase4. No deployment/live-room action/draft changes.

## Phase3 scripts and ground alignment increment — 2026-11-04T19:27:25.413Z

Initial moving browser failed at pause (349→449ms): script time advanced after the last displayed frame. Moved advance before render and explicitly observe rendered pause acknowledgement. Second browser passed pause but sparse polling missed the short contact burst. Added circuit integration test and changed finite-event browser observation to requestAnimationFrame. Ground browser all3cases PASSED2.0m: moving drift/dust/flight/contact/two finite finish replays, native176 solo and prior bench. Ground focused4files27tests PASSED16.46s; main+solo typecheck PASSED before host switch increment. Offline GLB audit now retains cosmetic solo-world Y in existing road/dirt triangles; verified every wall edge, every X/Z coordinate and source hash unchanged. Shared-index ground interpolation/upward normals/native offset tests pass. Pool distinguishes world Y from flight clearance; tyre endpoints/renderer align to slope. Start-grid seam explicitly retains approximate flat fallback, not measured geometry.

Host switch increment added, tests RUNNING (phase3-host-unit/api/typecheck.log): optional public effectsEnabled absent=legacy/true=new/false=no decoration; bounded control-only history20, commands through existing receipts/touch/room flow, Live controls enable/off/history and Effects rehearsal link. Guest/stage use existing scene adapter with separate pause and live reduced-motion subscription. API commit/eviction/replay/refusal/privacy and component tests added alongside. Need inspect exact results, resource measurements then full required checks. Phase3 INCOMPLETE; no Phase4/deployment/live-room/draft changes.

## Phase3 full integration verification — 2026-11-04T19:36:54.105Z

Main+solo typecheck PASSED (phase3-final-typecheck.log). Root unit132files521tests PASSED166.71s (phase3-full-unit.log). Selected API11files79tests PASSED74.72s (phase3-full-api.log). Real browser6cases PASSED2.6m (browser-phase3-room-resources): 80-driver stage/map modes, local2-phone room host effects on/off, stage pause + dynamic reduced motion/no diagnostics, finite moving scripts, six quality/restart resource runs with equal geometry/texture counts, native176 solo/photo preservation/legacy and existing bench. Local guarded test adapter only; not a live room/deployment.

Final narrow updates after broad start: corrected world-space wake segment heading, start script must show elapsed0 first, observed-start expiration test, actual slope transform/palette role assertions and finished bench copy. Final full unit rerun27243, lint/content27312, typed room auth rerun and resource-only browser with numeric log samples are now RUNNING; no phase-complete claim until all checks/build/format pass. No Phase4.

## Phase3 final safety audit — 2026-11-04T19:40:35.103Z

Resource-only browser PASSED1case1.5m (37.5s case), exact samples saved phase3-resources.json:43 geometries and19 textures constant across six restart/quality changes; Low33 calls/119–128particles/60–64marks, Balanced39/348/100, High46/655/180 (static warm-up45calls594particles). These are Chromium local-phone scene counts, not venue/device or 80-racer frame budgets. Final typed room API20tests PASSED41.54s.

Root final rerun exposed new observed-start test failure: implementation hard-coded3 confetti per actor while preset expected12. Fixed code to honour validated burstCount (first4 actors, bounded pool), preserving test. Added skid-history break for unsupported→road gaps. Host off now stays enabled through prompt/reveal/scores and for ended races, without catching up physics outside active phases; on still refuses ended/outside intro/collect. Tests prove ended UI safe-off, reveal command acceptance, invalid phase refusal and no private-history leak/replay. Focused safety unit/API/typecheck and root build now RUNNING (phase3-final-safety-*.log, phase3-final-build.log). Need final root rerun after fix, resource/host browser rerun, lint/content/owned format/whitespace. Phase3 still INCOMPLETE until green.

## Kart evolution Phase3 complete locally — 2026-11-04T19:45:56.184Z

Status: COMPLETE LOCALLY; Phase4 next, not started in this wake. K07–K17 now run through the scene-owned native186 connected and native176 solo adapters: dust/exhaust/sparks/glow/arcs/world-space wake/flames/grounded marks/finite celebrations, validated emitter controls and import/export, moving start/drift/boost/dirt/flight/impact/finish scripts, sample photo preservation and explicit legacy fallback. Corrected before-render pause clocks, observed start bursts honour the preset, fresh accepted contact edges, unsupported-ground skid gaps and slope transforms. Offline GLB audit adds cosmetic Y using the existing index; every wall/XZ coordinate and source hash unchanged. No new dependency/source media/Wawa store.

Admin: existing Kart entry, Effects real connected/solo rehearsal, local counts and all tuning/reset/disable/export controls. Live controls persist enable/off with existing receipts, rollback/stateVersion and bounded private history20; on refuses ended/outside active phases, off remains available in prompt/reveal/scores. Optional public flag absent preserves old races; false explicitly removes decoration. Guest/stage receive no history or renderer resource diagnostics. Existing reduced-motion subscription responds live; pause freezes, hidden resets history.

Final commands/results: npm run test:unit PASSED132files524tests231.71s (phase3-release-unit.log); npm run typecheck PASSED main+solo (phase3-final-safety-typecheck.log); selected API11files79tests74.72s plus final room safety20tests20.88s PASSED. Earlier full unit rerun caught fixed start burst=3 while preset=12; code fixed, test retained, final full run green. Final Playwright6cases PASSED2.7m (browser-phase3-final), including80-driver stage/map, actual local2-phone host on/off/pause/reduced, shaders/native176/photo/no-room-socket/legacy, finite replay scripts and repeated quality/resource bounds. Root npm run build PASSED including artifact/content checks; expected four drafts remain incomplete. Owned lint27.258s/content0.543s PASSED, formatting52sources and scoped git diff --check PASSED. No skipped or weakened tests.

Manual verification: inspected actual Effects screenshot; clear tuning controls, visible circuit/stand-ins, no390px overflow, input heights at least44px verified in browser. Final repeated Chromium rehearsal: geometries43/textures19 unchanged; Low33calls128particles60–64marks; Balanced39/372/100; High46/679/180. Exact samples phase3-final-resources.json. Counts include retained scene geometry and are not physical-device,80-racer frame-rate or GPU-byte certification. Existing ordinary Vite native-backend limitation remains; browser harness uses explicit guarded locked local test adapter. No deployment/live-room/email/paid resource/secret inspection; existing dirty work and four deferred drafts preserved.

Remaining: Phase4 K18–K25 Look/environment/lighting/grading with real neutral preset and real Look bench, then Phases5–10. Physical iPhone/Android/projector/venue and20-minute soak remain required in Phase10. Exact next action is at the top of kart-evolution-checkpoint.md. Continue automation remains enabled because the overall plan is unfinished.

## Kart Phase4 grading foundation started — 2026-11-04T20:03:00.530Z

Phase4 INCOMPLETE. Strict shared v1 look preset, original linear-light reference/shader and native bounded render-target factory added alongside tests. All named grading controls are wired; neutral bypasses allocation, target capped by actual quality/capability, state restored in finally, source tone mapping retained unless explicitly selected. No new dependencies or external assets. Admin Kart Look tab uses real connected scene and only implemented grading controls, before/after, grades, reset/export/import and local costs. Ordinary/live/solo paths unchanged unless explicit local look prop. Source list phase4-files.json. Native176/environment/shadows/sky/reflections/wind/chromatic/dirt/bloom/AO/tilt-shift and host room actions remain required.

First2files4tests had3pass1failure: resize legitimately calls target.dispose in Three, test now distinguishes resize release and final release. New5-file bench/registry tests and typecheck RUNNING (phase4-bench-*.log); inspect results. Added actual browser pixel neutral restoration/nonneutral/context/Low/reduced/width tests, NOT RUN yet. Save exact verification before proceeding. Phase3 final gate remains132files524tests etc above; no deployment/live room/draft changes.

## Phase4 grading verification increment — 2026-11-04T20:06:32.977Z

Focused bench/registry5files17tests PASSED14.52s before latest hue/global tests. Latest focused3files8tests PASSED48.16s (phase4-grade-unit-2.log), main+solo typecheck PASSED (phase4-grade-typecheck-2.log) after fixing literal preview label in the test fixture. CPU tests cover neutral HDR identity, RGB swap, all8 HSL band controls, all global knobs and bounded policy; target test accounts exactly for Three resize disposal and neutral release.

First browser failed by timeout waiting for getByLabel exact Look preset: nested select label text included options in that query, while role accessible name remained correct. Added explicit aria-label to the real preset selector; no timeout raised or assertions removed. Browser-phase4-grade-label now RUNNING. Actual shader/pixel/context verification still pending; inspect result before claiming grade works. Phase4 INCOMPLETE; no environment/solo/live look yet.

## Phase4 pixel proof and environment ownership — 2026-11-04T20:21:57.658Z

Actual grading browser PASSED1case40.8s (browser-phase4-grade-framebuffer,23.7s case): nonneutral output changes raw framebuffer hash; neutral restores EXACT hash/dimensions/colour, valid pixels; Low, AgX/global/mixer/HSL, strict import, WebGL loss/recovery, dynamic reduced motion and320/390/430/short landscape checks pass with no shader/page errors/no room sockets. Prior PNG equality failed solely at surrounding rounded frame/edge pixels (central rendered region had0 changed pixels); test now hashes full actual WebGL framebuffer with nonzero-colour assertion and retains screenshot evidence. It does not relax colour equality.

Added capability-clamped High4/Balanced2/Low0 MSAA to avoid degrading antialiasing through the new target; actual MSAA browser verification pending. Added original procedural sky/sun, theme-role environment light, native PMREM reflection ownership, single bounded1024 shadow map/56m camera with snapped follow centre and paused/reduced freeze. Low omits reflections/shadows, off restores source lights/material flags/environment and disposes owned maps. First env ownership unit3files8tests21.37s and main+solo typecheck passed before integration. Now wired to the real Look bench with Daylight, sky/sun/reflection/shadow controls and actual local shadow-map size; latest phase4-env-integrated unit/typecheck RUNNING. Browser with real PMREM/shadows NOT RUN yet; inspect focused results first then run kart-look. Native176/live settings/host actions and optical effects still missing. Phase4 INCOMPLETE; do not begin Phase5. No live room/deploy/draft/secret changes.

## Phase4 environment browser and native solo started — 2026-11-04T20:27:07.143Z

Connected environment browser PASSED1case1.1m (49.9s case, browser-phase4-environment): real sky/sun/native PMREM, actual1024 shadow texture, Low disables reflections/shadows, before restores exact full framebuffer source hash, grading/MSAA/AgX/import/context/reduced/viewport checks; no shader/page errors or room socket. Inspected actual daylight/shadow screenshot: racing line/signs/stand-ins stay visible. Integrated focused4files9tests8.61s and main+solo typecheck PASSED before native bridge work.

New native176 SoloLook now takes the existing R3F final render callback at priority1 (official hooks checked), creates resources only in committed effect, configures through the same plain preset/native constructor boundary, uses actual practice pose/ground and restores renderer/source scene on cleanup. No Three instance crosses versions. Existing strict practice message now accepts optional cloned look or null alongside effects/style/metadata-only face; parent preserves cached photo bytes, receiver stores in existing ephemeral store and clears on cleanup. Admin Look has opt-in real solo frame, local sample face, tune/before/legacy/close controls. New sender/validator tests and native browser case added alongside. Focused phase4-solo-unit/typecheck now RUNNING; inspect exact results then actual native browser. Phase4 still INCOMPLETE: optical suite, live host controls and final full gate remain. No deployment/live rooms/draft changes.

## Phase4 increment regressions and native boot investigation — 2026-11-04T20:34:52.137Z

Full root unit136files535tests PASSED249.44s (phase4-increment-full-unit.log) before final CSS/lifecycle/narrow scene changes. Main+solo typecheck and focused native9tests7.32s passed. Lint found redundant useCallback(read,[]) compiler rule; fixed by reusing the already stable module read function directly. Content passed1.185s. First native2-case browser failed missing first-frame driver marker and320px overflow; no assertions/timeouts weakened. File input constrained to available width: rerun browser-phase4-native-boot now connected case PASSED, native still missing frame marker with no captured shader/page error. Canvasdata-engine shows actual176, but driver callbacks have not produced markers.

Added explicit local native lifecycle ready/frame diagnostics and failure attribute dump. Look bench now closes connected preview when the real solo frame is open, avoiding two simultaneous expensive HDR/MSAA worlds; hides stale connected costs then. Existing continuous connected render semantics retained (not claiming paused framebuffers are readable after compositing). Actual look parameter changes force immediate cost updates. Browser-phase4-native-single-scene RUNNING; inspect. Native look remains UNVERIFIED. Phase4 incomplete; optical effects/live host settings/full final gate still pending. No deploy/live room/draft changes.

## Phase4 native readiness fix checkpoint — 2026-11-04T20:38:16.080Z

Native failure was first-frame readiness: no shader/page errors; failure dump shortly after5s showed genuine176, native=true, face1, Look preset/HDR/reflection true. Practice Ready previously set soloStarted before any render. Added one-shot soloLookReady in existing store and wait for successful NativeLook frame before Ready, keeping loading honest. Browser awaits actual Pause then checks exact native/face markers; no assertion/timeout weakened. Connected Look preview closes while solo open to avoid duplicate expensive scenes. Added local lifecycle diagnostics for investigation. Fixed file input width320 overflow; connected case passed in boot rerun.

Full root increment136files535tests249.44s PASSED before readiness fix; current typecheck PASSED (phase4-ready-typecheck.log). Previous scoped lint/content20.01s/4.456s passed. Browser-phase4-native-ready2cases RUNNING, inspect completion before claiming native works. Exact top-of-checkpoint resume action updated. Optical suite/live host coverage/full final gate remain, Phase4 INCOMPLETE. No deployment/live room/draft changes.

## Phase4 native opt-in rehearsal verified — 2026-11-04T20:40:50.768Z

Browser-phase4-native-ready2cases PASSED1.7m: native25.1s, connected45.0s. Actual176 scene/renderer, PMREM/reflection, face1 through metadata-only tuning, before/neutral and explicit legacy restoration all pass; connected framebuffer exact-neutral/context/Low/reduced/width tests pass. First-frame readiness fix is real product behaviour; no longer claims ready before rendering. Removed temporary diagnostic output/lifecycle attributes after proof. No test weakened.

Current increment final regression checks RUNNING: Look+oldVFX6browser, root unit, main+solo typecheck, owned lint/content. See top checkpoint for sessions/logs. Need inspect results and root build after browser; Phase4 remains incomplete (optical suite/live host controls/final full gate). Data inventory/plan status updated honestly. Ordinary quota last92% primary, reset credits untouched; preserve checkpoint before exhaustion. No deploy/live-room/draft changes.

## Phase4 current increment cross-checks — 2026-11-04T20:42:37.748Z

Final current-increment Look native+connected cases passed29.6s/52.9s in browser-phase4-increment-regression before old VFX cases. Combined concurrent root/browser load then failed old moving-script wait: sample1783ms after5s wait for2000ms. Root concurrently reports one router test failure (fresh retry after joining reopens,5887ms); complete failure details pending root finish. Do not label final checks green. Earlier136files535tests249.44s root pass and native-ready2browser1.7m remain valid historical evidence. No test assertions/timeouts weakened. Plan: let current checks finish, inspect exact failures, rerun root and browser SEQUENTIALLY to separate load/timing from real regressions, fix code if reproduced. Current lint/content PASSED85.349s/12.824s; main+solo current typecheck passed. Native temporary diagnostics removed. No Phase4 completion.

## Phase4 concurrent checks finished with failures — 2026-11-04T20:46:15.068Z

Browser current regression finished5pass/1fail2.9m: new Look native/connected both pass, old VFX resource/native/bench pass; old moving-flight clock wait1783ms vs2000ms failed after5s. Root current full run exited1 without final aggregate: router join retry and glyph feedback tests exceeded timing, then worker termination timed out for designs.test.tsx. No processes from this run remain (read-only process inventory checked; nothing killed). Source/check assertions unchanged.

Launched SEQUENTIAL root-only full rerun phase4-serial-full-unit.log, no browser/build alongside it; inspect returned session next. Then run old/new browser suite alone, then root build. This distinguishes resource contention/import stalls from real regression and never labels failed checks green. Latest typecheck/lint/content pass; Phase4 still incomplete.

## Drop tracked ignored check output — 2026-11-04

`.gitignore` now ignores all of `artifacts/`. `npm run git:drop-ignored` removes tracked paths that the ignore file covers and leaves the working copies on disk. It untracked `artifacts/kart-browser-checks/.last-run.json`; the file is still on disk and the index removal is staged, not committed. `node --experimental-strip-types --test scripts/git-drop-ignored.test.ts` passed 2 tests. `npm run agents:sync` copied the instruction into `AGENTS.md` and `GEMINI.md`. A second run of the command finds nothing left to drop.

## Local setup command — 2026-11-04

`npm run setup` installs dependencies, syncs environment files, generates a missing local client API key, copies agent instructions, generates Worker types, installs Playwright Chromium, then migrates and seeds the local database. It does not deploy, upload secrets, or replace an existing local key. `node --experimental-strip-types --test scripts/setup.test.ts` is the check for the step list. The full command was not run against this checkout.

## Sync deleted GitHub branches — 2026-11-04

`npm run git:sync` fetches every remote with prune, then deletes local branches whose upstream is gone. The checked-out branch, `master`, `main`, and branches that were never pushed stay. Unmerged branches stay unless `--force` is passed. The command was not run against this checkout. `node --experimental-strip-types --test scripts/git-sync.test.ts` passed 2 tests.

## Kart race in landscape on phones — 2026-11-04

**Status:** done for the connected phone race. Branch `kart-mobile-multiplayer`.

- The "Rotate your phone" overlay covered short landscape phones during the kart round, so the race could not be played sideways. `RotateHint` and `ControllerRoot` take `allowLandscape`; the guest page sets it while the current question is the kart round. The quiz keeps the hint.
- `GuestKart` sets `data-layout="race"` while the guest is actively racing. On short landscape screens (`orientation: landscape` and `max-height: 32rem`) `kart.css` hides the phone bar, tab bar, dock, notice and round header, fills the screen with the driving view, and floats the controls: steering bottom-left, a large A pedal with B and R beside it bottom-right (mirrored by Swap sides), stacked stats top-left, drift state and a slim drift meter top-centre, map/thumb-pad/swap options top-right, Back to track and the power-up on the left. Safe-area insets are respected. The power-up's default hint is marked `data-hint` and hidden in race mode; effects and notices still show. Finishing restores the normal layout and phone chrome.
- No change to input authority, socket cadence, scoring or server state.

**Checks:** `npx vitest run src/kart src/controller src/guest src/play` in `apps/web` passed 44 files / 195 tests before the new layout test; `src/kart/kart.test.tsx` then passed 13 tests including "marks only an active racer for the full-screen landscape race layout". `RotateHint.test.tsx` adds the allowed-landscape case. `npm run typecheck` passed. A throwaway Playwright probe (not committed) ran a real local two-phone kart lobby at 667×375, 844×390 and 932×430 with the API test database: the canvas fills the viewport, there is no horizontal or vertical overflow, every control is on screen, holding A drives the kart, and no page errors occurred. Screenshots were reviewed manually.

**Not verified:** physical iPhone/Android devices, the notch safe-area on a real device, the thumb-pad steering mode in landscape, and the root `npm run test:unit` / browser suites.

**Next:** race speed and multiplayer smoothness on phones (frame rate, input latency, opponent interpolation), then finish kart-evolution Phase 4.

## Responsive kart driving on phones — 2026-11-05

**Status:** done. Branch `kart-mobile-multiplayer`.

- **Own-kart prediction.** `apps/web/src/kart/self-prediction.ts` predicts the phone's own kart with the shared physics, anchored to each server frame with a round-trip replay and an easing correction. `KartCanvas` takes an optional `prediction`; `circuit.setPredicted` skips pose smoothing for that kart. `serverRoundTrip()` in `live/server-clock.ts` exposes the median measured round trip. Decision and limits recorded in `docs/kart-minigame.md`. The room remains authoritative; no message format, server cadence or rule changed.
- **Instant control sends.** `useKartSocket` sends changes straight away within the room's 80 ms arrival rule (90 ms gap), merging rapid changes; the heartbeat is unchanged.
- **60 fps** phone rendering on Balanced and High; Low stays at 30 fps and auto-quality still falls back to Low.
- **Steering.** The thumb pad steers from thumb travel since landing (`steerFromTravel`: 6% dead zone, 1.5 power curve, full lock at a third of the pad clamped to 48–90 px). Short landscape screens default to the pad, drawn as a wide strip in race mode, and follow rotation until the player chooses. The slider remains available.
- **Other racers** are carried forward along their heading for up to 250 ms between frames (`extrapolateKartPose`) so they glide on phones and the projector; reduced motion keeps exact poses.

**Checks:** root `npm run test:unit` passed 137 files / 548 tests. `npm run typecheck` passed. Changed-file ESLint passed. New tests: `self-prediction.test.ts` (7), send timing and gap in `kart.test.tsx`, `serverRoundTrip` in `server-clock.test.ts`, `extrapolateKartPose` in `presentation.test.ts`; the thumb-pad unit test and `e2e/kart.spec.ts` were updated to the travel-based steering with the same assertions on steering direction, second-thumb rejection, cancellation and release. Browser (dev config, local API test database): `kart.spec.ts` 1 passed, `kart-lobby.spec.ts` 1 passed, `kart-opponents.spec.ts` 3 passed, `kart-spectator.spec.ts` 2 passed. A throwaway probe counted rendered frames from pressing Accelerate to the drawn kart moving: 2–4 frames before, 1–2 after. The cloud browser renders WebGL in software at about 6 fps, so this shows the kart now moves on the next frame; it is not a millisecond figure for a phone.

**Not verified:** physical phones and real venue Wi-Fi latency, prediction quality during ramps/flight and oil hits (corrected by the next server frame), battery and heat at 60 fps.

**Next:** kart-evolution Phase 4 (optical suite, live host look controls, full gate), then Phases 5–10.

## Stage A — party-critical correctness — 2026-11-05

**Status:** done on branch `kart-mobile-multiplayer`, except the projector pairing code (A8.6), carried to Stage C. Plan: `/root/.claude/plans/glimmering-knitting-thacker.md` (options-first master plan written for an autonomous run; every choice that would need Humza is a switch).

**What changed**

- **Landscape kart states** (`7901f38`): `GuestKart` layouts `grid`/`race`/`finish`/`watch`; race notices (grid slot, paused, connection lost, returning) live in `.kart-race-status`, visible over the full-screen view. Fixes a regression from `4075b77` that hid them.
- **Trolls never block answers** (`586c185`): separate troll request and pending state in `guest/guest-page.tsx`.
- **Polls are just for fun** (`14388a0`): `awardsPoints()` in `multiple-choice.ts`; `selfAward` is null for rounds that cannot score; phone shows "Just for fun"; Ranks no longer repeats the previous round's points. Adds `npm run safe-env -- <cmd>` (`scripts/test-safe-env.mjs`), which blanks `DATABASE_URL` in `apps/api/.dev.vars` for a command and always restores it.
- **Live desk misclicks** (`c6659f0`): every start (birthday, kart, demo) confirms; the demo start is labelled as a rehearsal alternative; bots are refused in a room running the birthday script unless it is a rehearsal room (`liveBirthdayGame`).
- **Kart driving feel** (`d9d49b0`, `7db8d39`): one receipted `kart-setting` host command and `packages/shared/src/kart-settings.ts`; settings `prediction` (off/on/conservative), `glide`, `steering` (strip/slider/fixed-centre pad), `frameCap` (30/60/auto), `countdown` (3-2-1-GO/none). Room default in `round_state` `__kart/settings`, copied into new races; public `race.settings`; control-only 20-entry history; Admin Live controls → Driving feel. Prediction keeps a pedal held as a race begins.
- **Race countdown** (`7db8d39`): `kart/countdown.ts`, `KartCountdown` on phones and the stage, 3-2-1 over the last three seconds of the prompt then GO, from the room's deadline; no rule change. The versioned in-collect "grid hold" option is deferred to Phase 6 (F6) because it changes race rules and question versions.
- **Kart-only rooms** (`31a792c`): public `mode: "kart"` on snapshots; landscape lobby, hidden nickname cloud, race wording.
- **Projector** (`c30ca99`): dropped full screen keeps presenting with a hint (Escape still opens setup); reload mid-show reconnects and presents; setup button fades when idle; plain phase labels (`live/phase-label.ts`). The runbook's D/? stage shortcuts do not exist by design (a test forbids operator diagnostics on the projector); runbook correction is in Stage B.
- **Server** (`cf4d284`, `49e7071`, `9e17545`, `196fe30`, `a1e6325`, `0bafae6`): production no longer requires `EMAIL_TEST_RECIPIENT` (the secret already on the production Worker must be deleted once — see `docs/deployment.md`); failed alarms re-arm via `scheduler.rearmAfterFailure`; archive failures no longer block broadcasts; redacted JSON logs (`apps/api/src/log.ts`) and Workers Logs enabled for staging/production; archive attempts close their Neon connection; room JSON bodies capped at 64 KB; socket size measured in UTF-8 bytes; Better Auth session cookie cache (2 minutes) so host commands rarely touch Neon; Resend sends and Neon connections time out after 10 s; control credentials last 12 h and projector credentials 14 h (a 15-minute control credential made host commands fail mid-show).
- **80-racer cost** (`5c16608`): delivery counters kept in memory and saved every 64 sends; race-tick-only alarms skip archive queries.

**Checks (all run, all passed)**

- Root `npm run test:unit`: 143 files / 573 tests. `npm run typecheck`: passed.
- Full API suite (`npm run safe-env -- npm run test -w @26/api`): 105 files / 548 tests — the first recorded full pass (the last full run on record was 166 tests in September).
- Script tests: 29 passed.
- Browser (dev config, safe env): `kart-lobby.spec` (landscape grid/pause notices, natural 3-2-1-GO countdown on phone and stage), `kart.spec`, `birthday-pack.spec`, `shells.spec` passed. `admin-live-controls.spec` fails on its Players-page horizontal-overflow check and fails identically without these changes (pre-existing, Stage B). `quiz.spec` still stops before the podium (pre-existing, Stage B).
- Load (`npm run safe-env -- npm run load:realtime -w @26/api`, local emulator, not production): ring track 10/25/50/75/100 racers → stage 5/4.8/4.8/4.7/4.5 updates/s, p95 gap 205/210/210/240/260 ms; Mario circuit 80 racers → 4.7 updates/s, p95 260 ms (previous record 2.5/s, 536 ms).

**Not verified:** physical phones, projector, venue Wi-Fi, staging or production. Nothing was deployed.

**Next:** Stage B — release-candidate tooling for the birthday pack, B7/B8 suite fixes (quiz podium, Players overflow), release-script safety, lint/format clean-up, runbook and docs truth pass.

## Stage B and early Stage C — 2026-11-05/06

**Status:** in progress on `kart-mobile-multiplayer`. Items done are listed; items not started are listed under Next.

**Browser suite fixes (B8)**

- Players page overflowed 320px phones (selected-player panel and its fields kept intrinsic widths): `1e66ebe`. `admin-live-controls.spec` now passes.
- `quiz.spec` hung on its first advance: its helper treated any dialog as the finish confirmation. It now confirms only the finish/podium dialog (`1f81821`). The full illustrative quiz with host, stage and three phones passes (2.2 min) — first recorded pass.
- Shared `TextField` inputs overflowed 320px (public results email form): `47fb50f`. `admin-sections.spec`, `media.spec`, `photo-wall.spec` pass.
- Lesson recorded: the dev-config browser suite runs against a hot-reloading dev server; editing source during a run produces false failures. Full runs are made with no source edits.

**Release and CI (B9, B10)**

- `npm test` now runs script tests, the web unit suite and the API suite (it previously skipped the web suite).
- `npm run release` defaults to staging; production needs `--confirm-production`; production deploys are refused 20 Nov 00:00 – 22 Nov 12:00 (London) unless `--override-freeze` (`inDeployFreeze` in `scripts/release-support.ts`, tested); checks add unit, lint and script tests; `--full-checks` adds the API suite.

**Content and running order (B1–B3)**

- No formal birthday "release" is needed: Start birthday game already freezes `birthday-r<revision>-<hash>` and records the real scoring version. Answer key export is current.
- Admin → Question packs → Running order shows the estimated show length (`estimatedSeconds` per round from `apps/api/src/questions/runtime.ts`), flags runs of three or more same-series rounds, and offers _Suggest a mixed order_ (`running-order-plan.ts`; keeps kart last and order within each series; saves nothing until Save).

**Moderation (B5, partial)**

- Nicknames with slurs or explicit sexual terms are refused at join by the room (`packages/shared/src/moderation.ts`, ROT13-encoded list; look-alike and spaced spellings caught; Scunthorpe/therapist pass). Typed-answer moderation and round-media pre-moderation are not built.

**Docs (B12, D1)**

- `docs/event-runbook.md` pre-show steps rewritten for the birthday game, freeze, Neon autosuspend, Driving feel and projector behaviour.
- New `docs/decisions-for-humza.md`: jobs only Humza can do, every switch and default, choices made for him, draft question needs, open gaps.

**Stage C polish so far**

- Live desk: "Connected to the room"; answers counted against connected players; round number and next round's title from a control-only `nextQuestion`.
- Phones: Ranks remembers standings per game across a reload (session storage, nothing new sent by the room); "See the full results" at the podium; "Connecting…" before the first snapshot; no "Plenty more to come" after the last question.
- Security headers: nosniff, referrer policy, HSTS (this subdomain only), camera/microphone self-only; `/admin*` cannot be framed. No CSP before the party by decision.

**Checks**

- Root `npm run test:unit` 146 files / 588 tests and `npm run typecheck` after the gate fixes; API suite 106 files / 552 tests (one allowlist update for `estimatedSeconds`). Root `npm run build` with artifact checks passed.
- Browser: full dev-config suite run in progress at the time of writing; results appended below when complete.

**Deferred with reasons**

- 27 `react-refresh/only-export-components` lint warnings: moving exports across 14 files risks regressions for a development-only benefit; post-party clean-up branch.
- Projector pairing code, vote exclude-in-all-mode, typed-answer moderation, round-media pre-moderation, photo-wall failed-image skip: not started.

## Browser suite wrap-up (6 November 2026)

**Status:** partial. The full dev-config Playwright run (`npm run safe-env -- npx playwright test -c playwright.dev.config.ts`) was stopped after 20 specs because the Vite/Miniflare dev server began returning `fetch failed`, which made later failures unreliable. The five failures seen were then re-run serially.

| Spec                             | Result        | Cause                                                                                                                                                                |
| -------------------------------- | ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `admin-room-recovery.spec.ts`    | Fixed, passes | The QR dialog shows the link in an `<input>`; the test now checks its value.                                                                                         |
| `admin-question-details.spec.ts` | Fails (403)   | The test calls `/api/admin/content/...` with `page.request` and no client API key header. The route and spec are unchanged from `master`; not caused by this branch. |
| `draft-polish.spec.ts`           | Fails         | Same direct-request 403 (`data.interactive` undefined).                                                                                                              |
| `birthday-assets-prices.spec.ts` | Fails         | A card size moved 0.13 px against a 0.1 px tolerance. Unverified whether the branch's CSS changes caused it.                                                         |
| `developer-tools.spec.ts:74`     | Fails         | The rehearsal timeline never shows "Disconnect 25% of bots". Check against `bots.ts` `liveBirthdayGame` before merging.                                              |

Passing earlier in the same run or individually: quiz, kart, kart-lobby, kart-opponents, kart-spectator, admin-live-controls, admin-sections, admin-stage-flow, birthday-pack, media, photo-wall, shells, email-code. The remaining specs after `email-code` were not run.

**Next:** run the remaining specs on a fresh dev server, and check the developer-tools and asset-size failures against `master`.

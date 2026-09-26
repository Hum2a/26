# Build progress

Project: 26.humza.website  
Source of stage order: `docs/build-prompts.md`

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

## Stage 01

Status: complete.

The working directory contained only the two source documents. It is not the LifeSmart repository. Those files were copied unchanged to `docs/party-game-plan.md` and `docs/build-prompts.md`. SHA-256 prefixes `1209C4834D2A` and `32768B5527B0` match the originals.

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

- `apps/api/src/room/`: `PartyRoom` and `RoomCodeRegistry`, SQLite schema, receipts, the credential directory, transfer codes, and hibernating sockets. `apps/api/src/room/README.md` records the registry, directory, receipt, snapshot, and socket client.
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
- Content-author notes are in `apps/api/src/questions/README.md`.

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
- Content-author notes are in `apps/api/src/questions/README.md`.

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
- The author contract is in `apps/api/src/questions/README.md`.

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
- The implemented-versus-candidate list is `apps/api/src/troll/README.md`.
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
- Candidate trolls in `apps/api/src/troll/README.md` are not implemented. Asking for one is rejected.
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
- The operational notes are `apps/api/src/media/README.md`.

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
- The implemented-effects table is in `apps/api/src/troll/README.md`.

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
- `@26/shared` exports collector version 1, `normaliseDeviceReport`, `reportedScreenGroup`, `detailedTelemetryPolicy`, and the screen-group cutoff. The notes are `apps/api/src/device/README.md`.
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
- Facts are built in `apps/api/src/stats/aggregate.ts` from a `StatsSource`. `apps/api/src/stats/source.ts` reads that source from the room. The notes are `apps/api/src/stats/README.md`.
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
- `apps/api/src/questions/preflight.ts` checks ids, durations, answers, scoring, phase compatibility, attribution and troll compatibility, the implemented round kinds, and required assets. `npm run content:check` runs it. `npm run build` runs it after the secret scan. `npm run content:export` writes `docs/content/illustrative-answer-key.md` and `docs/content/illustrative-running-order.md`, then formats them. Both files say they are illustrative fixtures.
- `docs/content-guide.md` is the authoring guide. `apps/web/public/assets/demo-sting.wav` is a short placeholder tone, not a party sting.
- `apps/api/test/content-preflight.spec.ts` covers the real pack, a missing choice answer, an unlabelled prompt, and a missing sting.

### Decisions and defaults

- The demo pack stays the live question set until Humza supplies the party script. Prompts keep the "Illustrative demo:" prefix. Amina and Bilal are fixture names so the demo can score. They are not claims about guests.
- The fake countdown is not shown once a room is connected. The shell test now expects "No round is running." on a connected lobby, and still expects "Preview only. No round is running." before a room is connected.
- Build-time preflight fails on a missing sting or an unsupported selected effect. A missing file at runtime does not stop the round.
- No CMS, no new score engine, and no second room store.

### How to run it

1. `npm run content:check` and `npm run content:export`.
2. `npm run dev`, then open `/`, `/host`, and `/admin`.
3. Replace the questions in `apps/api/src/questions/demo-set.ts` when the real script exists, bump `demoQuestionSetVersion`, and run the two content commands again. The checklist of missing party assets is in `docs/content-guide.md`.

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

- Humza has not supplied the party questions, durations, which rounds allow double, shortlist versus the full room, the party sting, face or caption art, or question media. The checklist is in `docs/content-guide.md`. The current questions and `demo-sting.wav` are illustrative.
- A physical phone, a real rotation, and a projector or HDMI output were not checked.
- Remote Neon and Resend remain unset. `apps/api/.dev.vars` is not present. Nothing was deployed.
- A click on an open answer in the IDE browser missed the collect window. The Playwright quiz still answered through the podium with the host connected.
- The held-reveal status sentence was not screenshotted after the final script hash.
- Downloaded gallery copies still cannot be recalled. Entertainment audio can still drop after a refresh. Parallel local sign-in links can still collide when several Playwright browsers confirm the same administrator at once. This stage's quiz rerun used one worker and passed.

### Next stage

Prompt 18: Failure testing, security checks, and 75-player load testing. Do not start it from this stage.

## Stage 18

Status: complete.

Failure, access, and load checks run in the existing room harness. The printed 75-guest figures are from the local Durable Object emulator. The evidence is in `docs/verification-report.md`.

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

- `docs/deployment.md` has the per-environment build, migrate, secret, R2, and rollback commands, and the missing external setup.
- `docs/event-runbook.md` is the presenter and operator runbook, the same-room recovery drill, and the checklist of questions, media, and venue checks that did not happen here.
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

- No birthday Cloudflare account, R2 bucket, Images attachment, Neon database, or Resend key is configured. The exact list is in `docs/deployment.md`.
- `apps/api/r2-cors.json` still allows only the local preview origins. The deployed origin is not known, so it was not added.
- The question pack is still the illustrative demo. `docs/event-runbook.md` lists what Humza still has to supply and which venue checks remain.
- The 75-guest figures remain the local emulator sample from stage 18. Staging was not measured.
- `eslint-visitor-keys@5.0.1` still wants Node `^22.13.0`. This machine is v22.12.0. Lint passed.
- GitHub Actions was not run.

### Next stage

The numbered prompt sequence is complete. Do not start another prompt from this stage. Event preparation is the external list in `docs/deployment.md` and `docs/event-runbook.md`.

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

The numbered prompt sequence stays complete. Remaining setup is the Resend from-address, `BETTER_AUTH_URL`, and Cloudflare Worker secrets in `docs/deployment.md`.

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
- `.agents/rules/40-design.md` says screen colours come from the theme file. `npm run agents:sync` copied that rule.

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
- `docs/question-authoring.md` is the workflow. `.agents/rules/15-question-authoring.md` points agents at it. `npm run agents:sync` copied that rule.

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
- `npm run content:export` wrote the illustrative key and running order unchanged, and wrote `docs/content/birthday-answer-key.md` and `docs/content/birthday-running-order.md`. Both birthday files say the catalogue has no playable questions.
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
- `docs/qol-map.md` marks a named toast BLOCKED.

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
- A named toast is BLOCKED in `docs/qol-map.md` until a guest payload already includes the sender.

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
- `.agents/rules/45-themes.md` lists the install commands, the offline import, and which pack to search for each category. `.agents/rules/40-design.md` and `.agents/rules/30-web.md` point at that rule.

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




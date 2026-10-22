# What Jackbox Party Pack 11 does to stay smooth, and how 26 should use it

[Home](../README.md) · [Documentation](README.md) · [Event runbook](event-runbook.md)

<details>
<summary>On this page</summary>

- [Implementation status (21 October 2026)](#implementation-status-21-october-2026)
- [0. Method and limits](#0-method-and-limits)
- [1. How Jackbox does it](#1-how-jackbox-does-it)
- [2. Where 26 stands today](#2-where-26-stands-today)
- [3. The improvement plan](#3-the-improvement-plan)
- [4. Prioritised backlog](#4-prioritised-backlog)
- [5. Open questions and unknowns](#5-open-questions-and-unknowns)
- [Appendix A: Evidence index (Jackbox, static)](#appendix-a-evidence-index-jackbox-static)

</details>

## Implementation status (21 October 2026)

Every phase below has been built locally and is uncommitted. Measured figures are in [docs/verification-report.md](verification-report.md). Where the build differs from this plan, the reason is given here.

| Phase                | Status        | What changed from the plan                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| -------------------- | ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0 Measure            | Done          | The server meter counts messages and bytes, not durations. Workers freeze the clock during synchronous work, so CPU time cannot be read inside the room. Latency is measured by `npm run load:realtime`.                                                                                                                                                                                                                                                                   |
| 1 Build once         | Done          | Per-audience parts are built once per fan-out. The zod parse stays, because it applies defaults the clients rely on.                                                                                                                                                                                                                                                                                                                                                       |
| 2 Kart lane          | Done, adapted | Kart ticks send `kart` frames instead of full snapshots. Controls are **still persisted before the tick reads them**, which `kart-room.spec.ts` records as a decision. They are written in one transaction at the start of each tick rather than one per message, with their own arrival times. The scheduler-owned 200 ms alarm stays; there is no in-memory `setInterval`. Finished kart-tick job rows are now deleted, because `readJobs` read them all on every alarm. |
| 3 Rate limits        | Done          | The lifetime cap of 100 commands per phone, and of 60 telemetry reports, is replaced by in-memory token buckets. The old cap counted drafts and could lock a phone out for the rest of the game.                                                                                                                                                                                                                                                                           |
| 4 Coalescing         | Done          | A 30 ms fan-out window. Phase deadlines flush at once. A guest leaving updates only the stage and control.                                                                                                                                                                                                                                                                                                                                                                 |
| 5 Patches and resume | Done          | Opt-in with `patches=1`, so older cached clients keep full snapshots during a deploy. The client re-validates every merged result with `lobbySnapshotSchema` and falls back to a full snapshot on any mismatch.                                                                                                                                                                                                                                                            |
| 6 Reconnect          | Done, adapted | The stage still hides the question at once, which a test records. The automatic hold on stage loss is **not** added: a projector flicker would pause the room. The runbook tells Humza to press `P` instead.                                                                                                                                                                                                                                                               |
| 7 Clock sync         | Done, adapted | NTP-style offset plus a local deadline lock. Scheduled cue start times are not added: phase changes now reach every screen in a single fan-out, and a lead time would delay every reveal.                                                                                                                                                                                                                                                                                  |
| 8 Preload            | Done, adapted | Images are preloaded when a question is announced, never ahead of it, so no future question leaks. The kart code is warmed during the kart intro. Cache headers are unchanged: hashed bundles and unhashed question images share `/assets/`.                                                                                                                                                                                                                               |
| 9 Observability      | Done          | Phone script errors and the build id appear on Room health. The existing stats and archive already cover game metrics.                                                                                                                                                                                                                                                                                                                                                     |
| 10 Rehearsal         | Partly done   | The runbook has the steps and the harness. The staging run and the venue Wi-Fi drill need a deploy and the venue.                                                                                                                                                                                                                                                                                                                                                          |

Also fixed along the way:

- **Shared database pool.** `PartyRoom` reused a module-wide database pool across rooms. Workers forbid I/O across objects, so a second room's diagnostics could hang. Each room now opens its own pool. `operations.spec.ts` and `results-room.spec.ts` still fail locally when `.dev.vars` sets `DATABASE_URL`, with and without this change. They failed the same way on unmodified HEAD.
- **Sign-in message on first load.** In development, a cold sign-in check could time out and stay on "We couldn’t reach sign-in." The dev server now warms sign-in at start, and the page retries quietly.

Date: 2026-10-20. Sources: the shipped Steam build of The Jackbox Party Pack 11 (build 123, version 1.1.0, built 2025-11-13), and the 26 repository at commit `663771f`.

This document has three parts:

1. **Findings.** How Jackbox's realtime stack is built, taken from the shipped files.
2. **Where 26 stands.** The same areas in 26, with file references.
3. **The plan.** Ten phases of work, in priority order. Each phase says which Jackbox technique it borrows, what to change, which files are involved, and how to tell when it is done.

---

## 0. Method and limits

**What was analysed**

- `The Jackbox Party Pack 11.exe` with REA. The SHA-256 is `2c6b4c10dea14b351796e32323b1a7301d2b76801a10ea0172bfe482b3dd7dfa`, x86-64 PE. No disassembler engine (Ghidra or IDA) was configured, so there is no pseudocode. The native evidence is strings and RTTI class names.
- All 190 `.swf` files. Each was decompressed from CWS/ZWS, and the ActionScript (ABC) constant pools were read: class names, method names, opcode literals and error tables. The game logic and the network client live here, in a shared library that the build paths call `jbg-common/flash/src-jbgcommon`. Every game SWF ships its own copy.
- `websockets.dll`, `libuv.dll`, `libssl/libcrypto-1_1`, `sentry.dll`, `crashpad_handler.exe`.
- `jbg.config.jet`, `gameManifest.json`, `settings.json` and the per-game JSON files.

**What was not analysed**

- **The phone client** (`jackbox.tv`). It is not in the install. Phone-side behaviour below is inferred from the protocol that the host speaks.
- **The ecast server** (`ecast.jackboxgames.com`). Server behaviour is inferred from the opcodes, reply types and error codes the client understands. Nothing ran at runtime and no network traffic was captured.
- **Constant numeric values.** Backoff timings, for example, are bytecode literals, and string extraction does not recover them. Only the two timeouts in `jbg.config.jet` are known exactly.

**Labels used below**

- **Observed** means a literal string, class name or config value in the shipped files.
- **Inferred** means a conclusion drawn from observed names, with no execution seen.
- **Unknown** means it was not established.

---

## 1. How Jackbox does it

### 1.1 Overall architecture: the host runs the game, the server relays state

| Layer           | What it is                                                                                                                                                                                | Evidence                                                                                                                        |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Host (TV or PC) | Game logic, timers, scoring and all presentation. Built in ActionScript 3 and run by a custom AIR-derived native engine (`PartyPackNativeEngine`).                                        | Observed: PDB path `jbg-common\win\PartyPackNativeEngine\...`, `AirManagerComponent`, `AirWindowComponent`, `ExtensionContext`. |
| Relay (ecast)   | A cloud room server. It holds keyed **entities** (text, number, object, doodle, text-map, counters), enforces per-entity ACLs, filters text, rate-limits, and fans updates out to phones. | Observed: `serverUrl: ecast.jackboxgames.com`, `/api/v2/rooms/`, `ecast-v1`, and the opcode table in 1.3.                       |
| Phones          | Thin web clients. They render whatever entity the host has written for them, and write back into the entities they are allowed to edit.                                                   | Inferred from per-player entities, ACLs, `client/send`, and the host-only `host-token`.                                         |

**Why this keeps the game smooth.** The host never has to fan out messages itself. It writes one entity, and ecast delivers it to whoever is allowed to read it. The phones carry no game logic, so they cannot drift out of sync. They show the latest value of their entity.

### 1.2 The native transport is small and replaceable

- **Observed:** `NativeOverrideWebSocket` and `jackboxgames::win::WebSocket` / `WebSocketDelegate` (RTTI). The Flash-side socket (`com.worlize.websocket`) is still bundled, but on PC the engine routes the socket to native code.
- **Observed:** `websockets.dll` is libwebsockets 3.2.2, built with vcpkg on OpenSSL 1.1, with zlib/deflate support. `libuv.dll` provides the event loop.
- **Observed:** the WebSocket subprotocol string is `ecast-v1`.
- **Observed:** crash and error telemetry goes through `sentry.dll` and `crashpad_handler.exe`. `gameManifest.json` carries the Sentry DSN.
- **Inferred:** socket I/O and TLS run off the ActionScript thread, so a slow frame does not stall the network, and network jitter does not stall rendering.

### 1.3 The wire protocol is small and regular

The message classes are **Observed**: `jackboxgames.ecast.messages.Request`, `Reply`, `Notification` and `CallError`.

- `Request { seq, opcode, params }`: the client's call. `seq` is a client-side counter.
- `Reply { re, opcode, result }`: the answer. `re` echoes the request `seq`. Unmatched replies are logged with the string `"Reply received that client wasn't prepared for"`.
- `Notification { pc, opcode, result }`: a server push. `pc` is a server-side **delivery counter**, which the client tracks in `WSClient._updatePc`.

**The full opcode list** (all Observed literals, grouped):

- **Room:** `room/lock`, `room/exit`, `room/get-audience`, `room/start-audience`.
- **Clients:** `client/welcome`, `client/connected`, `client/disconnected`, `client/kicked`, `client/send`, `client/kick`.
- **Entities:** `text/create|set|update|echo|filter`, `number/create|get|update`, `object/create|set|update|echo`, `json/echo`, `lock`, `drop`, `echo`.
- **Collaborative or incremental:** `doodle/create|get|stroke|line|line/removed`, `text-map/create|get|state|synced|cursor-synced`.
- **Audience aggregates:** `audience/g-counter/create|get|increment`, `audience/pn-counter/create|get|increment|decrement`, `audience/count-group/create|get|increment`, `audience/text-ring/create|get`.
- **Misc:** `external-request/create|get`, `artifact/create`, `game/started`, `game/ended`, `game/metric`.

**Error codes** (Observed, `CallError.ERROR_MAP`): `RATE_LIMIT_EXCEEDED`, `PERMISSION_DENIED`, `ROOM_IS_FULL`, `ROOM_IS_LOCKED`, `ROOM_NOT_FOUND`, `PASSWORD_REQUIRED`, `INVALID_PASSWORD`, `ENTITY_NOT_FOUND`, `ENTITY_TYPE_ERROR`, `EntityAlreadyExists`, `FILTER_ERROR`, `NO_SUCH_CLIENT`, `NAME_REQUIRED`, `INVALID_ROLE`, `SERVER_IS_SHUTTING_DOWN`, `TwitchLoginRequired`, `LicenseCheckFailed` and others.

The game reacts to each code with its own message. It does not show a generic failure.

### 1.4 State is many small, keyed, versioned entities, not one big snapshot

This is the most important design choice for smoothness.

- **Observed:** every element type has `key`, `val` and `version` (`TextElement`, `NumberElement`, `ObjectElement`, `JSONElement`). Writers carry `from`, which is the author's client id.
- **Observed:** `ObjectEntity`, `TextEntity` and `NumberEntity` each have `_acl`, `locked` and `create/update/dispose`. `EcastUtil.aclCanWrite` decides who may write. `TextEntity.maxLength` is sent as a create parameter (`addMaxLengthToCreateParams`), so the **server** enforces length.
- **Observed:** the entity managers are `PlayerEntities` (one set per player, with a `keep` flag that controls survival across interactions), `SharedEntities`, `GameEntitiesHandler` and `EntityInteractionHandler`. The last one creates per-player entities when an interaction starts, waits until `_arePlayersDone`, then disposes of them.
- **Observed:** `PauseEntity` (`_hostIsPausedEntity`) and `mainAudienceEntity` (`JBGGameState`).
- **Inferred:** when one player changes, only that player's entity is rewritten. The other 7 phones get nothing. The audience gets one counter value, not every vote.

### 1.5 Reconnection is a resumable session, not a fresh join

- **Observed:** `ClientWelcome { id, secret, reconnect, entities, here, replayEnd }`. On join the client receives:
  - its id;
  - a reconnect **secret**;
  - the full entity map it is allowed to see;
  - who is present (`here`);
  - where replay ends.
- **Observed:** `WSClient.reconnect` uses a `ReconnectState` with values `CONNECTING`, `REPLAYING` and `COMPLETE`, and sends the literal `replay-since`. The client asks for every notification after its last `pc`, so missed deltas are replayed instead of the whole state being resent.
- **Observed:** `WSClientWatcher` runs `_onLostConnection` → `_tryToReconnect` and logs "Trying to reconnect automatically: ATTEMPT #N". `_getWaitAfterAttempt` calls `random` and `round`, which points to jittered backoff. `_getDurationUntilShowMenu` and `_getDurationUntilGiveUp` exist, and so does a menu that lets the operator choose (`_makeChoiceAndStopReconnecting`).
- **Observed:** `jbg.config.jet` sets `connectingDurationTrouble: 15000` and `connectingDurationAbort: 45000`. A "Connecting" widget appears, changes to a trouble state at 15 s, and gives up at 45 s.
- **Observed:** `EcastUtil.getDisconnectBehavior` returns `DISCONNECT_BEHAVIOR_RECONNECT` or `DISCONNECT_BEHAVIOR_GIVE_UP`, set per game by config.
- **Observed:** error strings `DISCONNECTED_ROOM_LOST_INFO`, "Room is dead:" and `INTERNET_DISCONNECTED`.
- **Observed:** the host connects with `?...&role=host&host-token=…`, and the assert reads "tried to connect with host role but without host token". Phones connect with `name`, `user-id` and `format`.
- **Observed:** `disconnectForDebugPurposes` exists. Jackbox builds in a way to test reconnection.

### 1.6 The audience scales because the server aggregates

- **Observed:** `GrowOnlyCounter`, `PositiveNegativeCounter`, `CountGroup { choices }` and `TextRing { elements, limit }`.
- **Inferred:** thousands of audience phones vote by incrementing a server-side counter (CRDT style). The host reads one aggregate, not thousands of messages. `TextRing` is a bounded ring buffer, keeping only the last N texts.
- **Observed:** `room/get-audience` returns `connections`. The lobby shows an audience count (`_lastAudienceCountSeen`, `maxAudienceCount`).

### 1.7 Guardrails are enforced by the server, not the host

- **Observed:** rate limits (`EcastRateLimitExceeded`), room locks (`room/lock`, `roomIsLocked`), passwords, Twitch lock, `maxPlayers` and `minPlayers`, kicks and bans (`ClientKicked.banned`).
- **Observed:** text filtering on the server, through `text/filter` and `getExtraCreateParamsForContentFilter`, with the levels off, hate speech and profanity. Names can be replaced with `safeNames` / `generateSafeNames`. The `moderation` package handles moderated rooms.
- **Inferred:** a misbehaving phone is throttled before its messages reach the host, so one person spamming cannot slow down the show.

### 1.8 Rich input is sent as increments

- **Observed:** doodles are sent stroke by stroke (`doodle/stroke` with `points`, `DoodleLine`, `DoodleLineRemoved`, `DoodleValue.live`). Drawings stream as appended lines rather than full images.
- **Observed:** `text-map` with `TextMapNode { author, pc }`, `TextMapCursorSynced` and `TextMapSynced`. This is collaborative text with cursor sync, built as a tree of nodes.
- **Observed:** content uploads support `OUTGOING_DATA_FORMAT_JSON_COMPRESSED` (`APIClient.sendContent`).

### 1.9 Presentation runs on a local timeline that the network does not drive

- **Observed:** the **Talkshow** engine. Games are exported as `TalkshowExport/project/data/start.swf`, run through cells and action packages (`ActionPackageRef`, `TimeoutBranchActionRef`, `PreloadManager`), and timed by `TimingManager` and `FrameTimer`. Pausing and resuming happen locally (`PausableEventDispatcher`).
- **Observed:** `JBGUtil.preloadImagesInCurrentMovie`, which logs "Preloading bitmaps… total VRAM". Bitmaps go into GPU memory before a scene starts.
- **Observed:** audio is FMOD Studio banks (`*.bank`, about 270 MB) with named events (`audiokeys.json`). Video is CRI `.usm`, about 1.7 GB of pre-rendered video rather than live-rendered sequences.
- **Observed:** `AsyncFunctionSequence` and `Promise` helpers sequence loads.
- **Inferred:** the network only _gates_ the show ("all players done", "time up"). It never drives individual animation frames, so jitter never shows up as stutter on the TV.

### 1.10 Operations

- **Observed:** Sentry DSN, `buildVersion` / `showBuildVersion`, metrics opcodes (`game/started` carries `isFirstGameEver` and `startType`; `game/metric`; `game/ended`), artifacts for post-game galleries, and `/storage/list/` for content.
- **Observed:** `settings.json` exposes accessibility timing controls: `ExtendedTimers`, `NoTimers` and `MotionSensitivity`.

### 1.11 Things not to copy

- **The host-authoritative model.** Jackbox needs it because the host is a console or PC, and that allows cheating by the host. 26's server-authoritative Durable Object is better for a hosted party. Keep it.
- **Secrets in client-shipped config.** `gameManifest.json` ships a third-party store client secret in plain text. 26's `check-artifacts.mjs` already guards against this. Keep that guard.
- **Flash, Perforce paths and a 2 GB install.** None of this applies to 26.

---

## 2. Where 26 stands today

### 2.1 What 26 already does well

| Technique                                                  | Jackbox equivalent          | 26 location                                                       |
| ---------------------------------------------------------- | --------------------------- | ----------------------------------------------------------------- |
| One authoritative room per game on a single-threaded actor | ecast room                  | `PartyRoom` Durable Object, `apps/api/src/room/party-room.ts:278` |
| Hibernatable sockets with automatic ping/pong              | native socket keep-alive    | `setWebSocketAutoResponse("ping","pong")`, `party-room.ts:285`    |
| Idempotent commands (requestId plus digest receipts)       | `Request.seq` / `Reply.re`  | `party-room.ts:1851-1880`                                         |
| Unacknowledged commands are resent on reconnect            | replay                      | `apps/web/src/live/room-socket.ts:203-225`                        |
| Jittered exponential backoff, capped at 8 s                | `_getWaitAfterAttempt`      | `room-socket.ts:310-313`                                          |
| Server clock in every snapshot (`serverNow`, `deadlineAt`) | host-owned timers           | `party-room.ts:2832-2834`, `use-phase-countdown.ts`               |
| Transactional alarm scheduler                              | `TimingManager`             | `apps/api/src/room/scheduler.ts`                                  |
| Role-scoped projections (guest, stage, control)            | ACL reads                   | `buildSnapshot(audience, self)`, `party-room.ts:2773`             |
| Payload cap and per-connection message cap                 | `RATE_LIMIT_EXCEEDED`       | `limits.ts:2,6`, `party-room.ts:1708,1765`                        |
| Newer tab replaces older                                   | `client/kicked`             | `closeOlder`, `party-room.ts:3082`                                |
| The game holds when the controller drops                   | `PauseEntity`               | `notePresence`, `lifecycle.ts:332`                                |
| Throttled live drafts (200 ms client, `draftGapMs` server) | `text-map` cursor sync      | `room-socket.ts:405`, `party-room.ts:2961`                        |
| Kart input backpressure (`bufferedAmount < 8192`)          | —                           | `room-socket.ts:394`                                              |
| Kart poses interpolated on the client                      | Talkshow local timeline     | `apps/web/src/kart/KartCanvas.tsx:7`                              |
| Reconnect banner delayed 1.5 s so blips do not flash       | `connectingDurationTrouble` | `apps/web/src/net/ReconnectBanner.tsx:4`                          |

### 2.2 Gaps, ordered by impact

**G1. Full snapshot per socket on every change.**

- `broadcast()` (`party-room.ts:2900`) calls `sendSnapshot` once per socket. Each call runs `buildSnapshot` (`party-room.ts:2773`).
- One build makes roughly 12+ SQL reads (players, room, presentation, play projection, trolls, stats, cloud, reactions, reveal names, media, drafts), plus `lobbySnapshotSchema.parse` (zod), plus `JSON.stringify`. Control sockets also add diagnostics and archive reads.
- **The cost:** with 80 guests, one broadcast means about 82 full builds, about 1,000 SQL reads, 82 zod parses and 82 serialisations.
- **The Jackbox difference:** the host writes one entity and the relay delivers that one entity.

**G2. Kart ticks trigger full broadcasts at 5 Hz.**

- `tickKart` bumps `state_version` every `kartTickMs = 200` (`questions/kart.ts:197`, `shared/src/kart.ts:5`).
- Every alarm ends with `this.broadcast()` (`party-room.ts:706`).
- **The cost (Inferred):** during a race with 80 players, that is about 410 full snapshot builds per second, on one single-threaded object, while it also takes inputs. This is the most likely source of jank or CPU-limit errors at full room size.

**G3. Kart inputs are durable writes at 10 Hz per player.**

- `useKartSocket` publishes every 100 ms (`useKartSocket.ts:34`).
- Each message runs `transactionSync` → `readRoundState` + `writeRoundState` (`party-room.ts:1747`, `kart.ts:140-157`).
- **The cost:** 80 drivers produce about 800 SQLite writes per second for data that is throwaway between ticks.
- **The Jackbox difference:** the host keeps transient input in memory. Only results are stored.

**G4. Rate-limit counting is two durable writes per message.**

- `addCount(principal)` and `addCount("room")` each open a `transactionSync` (`party-room.ts:1763-1764, 3189`).
- ecast rate-limits before persisting anything.

**G5. Every outbound message rewrites the socket attachment.**

- `send()` calls `serializeAttachment` on each send to bump `deliverySeq` (`party-room.ts:3058-3062`).
- During a broadcast, that is N attachment writes.

**G6. The client's version-gap path is dead.**

- `room-socket.ts:265-273` handles `{kind:"version"}` messages.
- The server's `send()` union (`party-room.ts:3043-3052`) never emits one.
- There is no delta channel, so every update is a snapshot.

**G7. Reconnect always means a full re-download.**

- On open, the server sends a full snapshot (`party-room.ts:1700`). That is fine for correctness.
- The client cannot say "I have version N", so even a 300 ms blip costs a full projection.
- Jackbox uses `replay-since <pc>`.

**G8. Presence changes broadcast to everyone.**

- Every socket close runs `refreshPresence` → `broadcast()` (`party-room.ts:2116-2131`), even when only a guest left and the flags did not change.
- The early `return` inside `commitAndArm` does not skip the broadcast.

**G9. Small hot-path costs.**

- **Clock offset.** It is computed from one sample per snapshot, with no round-trip correction. RTT is measured (`noteRtt`) but not used for clock offset.
- **Bursts.** A burst of answers in the last second causes one stage-and-control rebuild per answer (`broadcastFacilitators`, `party-room.ts:2555`). Nothing coalesces them.

---

## 3. The improvement plan

The phases are ordered so each one is measurable, and so the biggest risk to event night (G1 and G2) is fixed first. Every phase keeps 26's existing rules: memory is not the record, accepted work is written before the acknowledgement, and there is one socket per tab.

### Phase 0: Measure first (½ day)

**Borrowed from Jackbox:** `disconnectForDebugPurposes`, `game/metric`, Sentry.

1. **Load harness.** Add `scripts/load-room.ts`, a Node script using `ws`. It creates a room through the admin API on local or staging, joins N fake guests (default 80) through the real join flow, and drives them:
   - answers at random times inside the window;
   - drafts at 5 Hz;
   - kart inputs at 10 Hz;
   - random disconnects and reconnects (about 2% per second).
2. **Server timing.** In `PartyRoom`, wrap `broadcast`, `buildSnapshot` and `alarm` with `performance.now()` deltas. Record a rolling p50/p95/max and bytes sent in memory, and expose them through the existing diagnostics read (`room/diagnostics.ts`, `party-room.ts:1288`).
3. **Client metrics.** The existing connection log (`device/connection-log.ts`) already reports RTT and retries. Add the snapshot apply time and the gap between snapshot arrivals.
4. **Baseline.** Record the numbers in [docs/verification-report.md](verification-report.md) for 8, 30 and 80 guests in quiz and kart phases. Capture the Worker CPU time per alarm from `wrangler tail` on staging.

**Done when:** you have a table of p95 ack latency, snapshot bytes, builds per second and DO CPU ms for each phase type. Every later phase reports against this table.

### Phase 1: Build each snapshot once, send to many (1–2 days)

**Borrowed from Jackbox:** one entity write is fanned out by the relay (§1.4).

1. **Split the projection into three layers.**
   - `public`: the same for every guest. Players, phase, clock, cloud, namesReveal, media, public trolls, the guest-safe part of `play`.
   - `audience`: the stage or control extras.
   - `self`: per guest. `selfPlayerId`, `selfReactions`, `selfAward`/`selfStanding`, recap, private troll state.
2. **Cache by version.** In `broadcast()`, build `public` once per `stateVersion` and `JSON.stringify` it once. Build only the small `self` overlay per guest. Cache the stage and control projections by version too.
3. **Send it on the wire.** Either send `{kind:"snapshot", public:<pre-serialised>, self:{…}}` and merge on the client, or splice strings so the server never stringifies the big part twice. Update `lobbySnapshotSchema` in `packages/shared/src/index.ts` so that `public` and `self` are explicit.
4. **Run the schema check outside the hot path.** Move `lobbySnapshotSchema.parse` out of `buildSnapshot`. Run it in tests and in `APP_ENV=local`, and use the TypeScript type in staging and production. The schema still protects the client, because `room-socket.ts:278` already uses `safeParse`.
5. **Batch the per-guest reads.** `selfReactions`, recap and the like can come from one query keyed by player for all guests, instead of N queries.

**Files:** `party-room.ts` (`buildSnapshot`, `broadcast*`, `sendSnapshot`), `room/schema.ts`, `packages/shared/src/index.ts`, `apps/web/src/live/room-socket.ts`.

**Done when:** at 80 guests, one broadcast costs about one public build plus 80 small overlays. Broadcast p95 CPU falls by at least 70% from the Phase 0 baseline. All existing tests and the Playwright smoke still pass.

### Phase 2: Kart gets its own realtime lane (2–3 days)

**Borrowed from Jackbox:** the host keeps transient state in memory and only gates on the network (§1.9). Doodles stream increments (§1.8).

1. **Keep inputs in memory.**
   - Hold kart inputs in a `Map<playerId, InputQueue>` on the `PartyRoom` instance, not in `writeRoundState`.
   - Keep the existing validation (race id, sequence, the 80 ms floor, `kartLimitMs`) and the per-player `.slice(-4)` cap.
   - During a race the sockets are active, so the object stays resident. The durable record is what the race _produced_. If the object restarts mid-race, the existing timeline rebuild (`catchUp`) restarts from the last checkpoint.
2. **Checkpoint about once a second, not at 5 Hz.** Write the race state (`kart-session` plus poses) to SQLite every 5th tick and at race end. Scores are still written before any acknowledgement, as now.
3. **Separate the race frame from the room snapshot.**
   - On a kart tick, do **not** call `broadcast()`.
   - Send a compact `{kind:"kart", t, raceId, poses:[[x,z,heading,speed,lap,status],…]}` frame to the stage, and to racing guests only.
   - Use arrays or fixed numeric precision, not objects, at about 80–150 bytes per kart.
   - Bump `state_version` only on race events (start, finish, a player finishing). Phones then keep their snapshot during the race and only receive frames.
4. **Send phones less than the stage.** The stage gets every pose. A racing phone gets its own pose plus the standings, and only needs the others' poses if its view draws them (`KartDriverView` / `KartMap`). Offer a lower 5 Hz rate for the minimap.
5. **Keep alarms for coarse events.** The 200 ms alarm chain (`scheduleTick`, `kart.ts:161`) creates and deletes a job row every tick. During a race, drive ticks with an in-memory `setInterval` that the race owns, and keep a single alarm for the hard race deadline (`kartLimitMs`) as the durable safety net.
6. **Smooth on the client.**
   - `KartCanvas` already interpolates. Add a fixed render delay of about 1.5 frame intervals, 150 ms, using the existing server clock. Phones then always interpolate between two known frames and never extrapolate across a dropped packet.
   - Keep `bufferedAmount` backpressure. Add "latest input wins": if the previous publish is still buffered, replace it rather than queue it.

**Files:** `apps/api/src/questions/kart.ts`, `party-room.ts:1745-1762` and `alarm()`, `packages/shared/src/kart.ts` (frame schema), `apps/web/src/kart/*`, `apps/web/src/live/room-socket.ts` (new `onKartFrame`).

**Done when:**

- An 80-driver race shows zero full snapshot builds between race start and finish, outside events.
- SQLite writes during a race fall from about 800/s to under 5/s.
- The stage frame gap p95 is under 250 ms on staging with 80 fake drivers.

### Phase 3: Counters and rate limits in memory (½ day)

**Borrowed from Jackbox:** ecast rate-limits up front (§1.7). Audience votes are CRDT counters (§1.6).

1. **Replace `addCount` with an in-memory token bucket** per principal and per room.
   - For example: 20 messages per second burst, 100 per 10 s sustained, per guest. Tune from the Phase 0 numbers.
   - Persist only the totals, at phase change and in diagnostics.
   - Reply with the existing `messageLimitMessage`.
2. **Exempt pure-telemetry and draft messages** from the main bucket. Give them their own small bucket, so a chatty draft can never use up a guest's answer budget. Kart is already exempt.
3. **Hold name votes and reactions as counters.** They are like `pn-counter`. Keep a per-target counter in memory, write the vote row inside the command transaction (needed for exactly-once), and recompute the aggregate from memory rather than re-querying on every broadcast.

**Files:** `party-room.ts:1763-1774, 3189-3195`, `limits.ts`.

**Done when:** a normal command does no durable write before its own transaction, and spam tests in the harness still get rejected.

### Phase 4: Coalesce broadcasts (½ day)

**Borrowed from Jackbox:** the host renders at frame rate, so a burst of entity updates shows up in one frame.

1. **Replace direct `broadcast()` / `broadcastFacilitators()` / `broadcastStage()` calls** with `markDirty(scope)`. Schedule a single flush on a short timer (about 30–50 ms for stage and control, 0 ms or a microtask for the sender's own acknowledgement path).
   - A burst of 40 answers in the final second then produces one or two stage rebuilds instead of 40.
2. **Keep the sender fast.** The answering phone still gets its own acknowledgement and `self` overlay right away. Only the fan-out waits.
3. **Make phase changes urgent.** Alarms that change phase skip the delay and flush immediately, so every screen flips together.
4. **Fix G8.** Have `refreshPresence` return whether presence changed, and broadcast only then. Guest presence changes go to control and stage only.

**Files:** `party-room.ts` (all `broadcast*` call sites, `refreshPresence`).

**Done when:** in the harness's last-second answer burst, stage rebuilds per second are at most about 25, and the stage never misses a phase change.

### Phase 5: Versioned deltas and resume (2–3 days)

**Borrowed from Jackbox:** keyed versioned entities (§1.4), `ClientWelcome` and `replay-since` (§1.5).

1. **Give each slice its own version.** Track `version` separately for `players`, `clock`, `play`, `cloud`, `media`, `trolls`, `reveal` and `self`. The room `stateVersion` stays as the overall counter.
2. **Send a patch when the base matches.** Send `{kind:"patch", base, next, slices:{play:{…}, clock:{…}}}` when the client's last acknowledged version equals `base`. Otherwise send a full snapshot.
   - This revives the dead `version` path (G6) properly. On a gap (`next > lastStateVersion + 1` or a base mismatch), the client asks for a snapshot, which `publicVersionNeedsSnapshot` already does.
3. **Resume on reconnect.**
   - Add `?since=<stateVersion>` to the socket URL in `room-socket.ts:194`.
   - If the room is still at that version, the server replies `{kind:"welcome", unchanged:true, stateVersion}`.
   - If it is within a small window, keep a ring of the last 32 patches in memory, like a `TextRing`, and replay them.
   - Otherwise send a snapshot.
   - A brief Wi-Fi drop then costs bytes rather than a full projection, and the screen does not flicker.
4. **Keep sending a full snapshot for `phase` changes.** A patch path is the place stale-state bugs hide, so this keeps the risk down.

**Files:** `party-room.ts` (`send` union, socket upgrade at around 1680-1701), `packages/shared/src/index.ts` (`patch` / `welcome` schemas, `applyPatch`), `room-socket.ts`.

**Done when:**

- In the harness, 95% of non-phase updates go out as patches.
- A reconnect within 10 s with no state change sends under 200 bytes.
- A randomised test (apply patches against snapshots across 1,000 random sequences) proves the patched state always equals a fresh snapshot.

### Phase 6: Reconnect behaviour like a console game (1 day)

**Borrowed from Jackbox:** `WSClientWatcher` with show-menu and give-up times, `connectingDurationTrouble` 15 s and `connectingDurationAbort` 45 s, and `DISCONNECT_BEHAVIOR_*`.

1. **Use per-role escalation thresholds.**
   - **Guest:** silent below 1.5 s (as now), then the banner, then "Still trying…" at 10 s, then at 30 s "Tap to rejoin" with a manual retry. Keep retrying in the background.
   - **Stage:** show nothing on the projector for 3 s. After that show a small corner "Reconnecting" mark, never a full-screen error, because the room is watching. After 15 s show a host-facing hint to check the venue Wi-Fi.
   - **Control:** show the state at once, with a "Pause game" shortcut.
2. **Reconnect immediately on wake.** On `visibilitychange` to visible, on `online` and on `pageshow` (iOS back-forward cache), reset `attempt` to 0 and reconnect at once. Phones that slept should not sit out an 8 s backoff.
3. **Use full jitter.** Change the delay to `random(0, min(8000, 200·2^attempt))` instead of the current `+0–200 ms` (`room-socket.ts:310`). When the venue access point drops, all 80 phones then spread out instead of reconnecting in sync.
4. **Hold on stage loss as well, as a setting.** `notePresence` holds on controller loss today. Add an optional hold on **stage** loss, because a projector that is offline means the room cannot see the question. Jackbox pauses the host when ecast drops.
5. **Add a debug disconnect.** In local and staging, add an admin "drop all sockets" and a per-socket "drop me" button, like `disconnectForDebugPurposes`, to rehearse reconnects before the party.

**Files:** `room-socket.ts`, `apps/web/src/net/ReconnectBanner.tsx`, `apps/web/src/stage/*`, `apps/api/src/room/lifecycle.ts`, `admin/health-page.tsx`.

### Phase 7: Better clock sync and local presentation timeline (1–2 days)

**Borrowed from Jackbox:** Talkshow (`TimingManager`, `FrameTimer`). The network only gates scenes.

1. **NTP-style offset.**
   - The ping/pong path is an auto-response, so the Worker cannot stamp it. Add a cheap `{kind:"time"}` command, exempt from the rate limit, that returns `serverNow`.
   - Take 5 samples on connect and one every 30 s. Use the sample with the lowest RTT: `offset = serverNow − (sent + rtt/2)`.
   - Expose `serverClock()` from `room-socket.ts` and use it in `use-phase-countdown.ts` and `KartCanvas`.
   - Every phone's countdown then reaches zero within about ±50 ms of the stage.
2. **Cue start times instead of "now".** For reveals and stage animations, put `startsAt` (server time, about 300 ms in the future) in the snapshot or patch. Every screen schedules the animation locally for that instant, so phones buzz and the stage reveals at the same moment despite different latencies.
   - `revealNonce` is already a cue id. Add the timestamp.
3. **Lock locally at the deadline.** When `serverClock() >= deadlineAt`, disable submit on the phone right away. The server still decides (`answerLateMessage`). This mirrors entity `locked` and removes the "I pressed it and it said too late" moment.

**Files:** `room-socket.ts`, `use-phase-countdown.ts`, `stage/StageShow.tsx`, `use-stage-show.ts`, `rounds/SubmitButton.tsx`, the shared snapshot schema.

### Phase 8: Preload before the scene, not during it (1 day)

**Borrowed from Jackbox:** `preloadImagesInCurrentMovie` (VRAM), FMOD banks loaded per game, and pre-rendered video.

1. **Preload the next question's assets.** While question _k_ is in reveal or podium, send question _k+1_'s asset manifest to the stage, and to phones for option images. Preload with `new Image()` / `decode()` and `<link rel=preload>`.
   - The server already knows the running order (`questions/packs/birthday/manifest.ts`).
2. **Decode stage audio early.** Decode stage sound cues (`stage/audio.ts`) into `AudioBuffer`s at stage load. Keep one unlocked `AudioContext`, since Jackbox's equivalent is loading an FMOD bank once.
3. **Warm the kart.** Fetch the GLB, the Draco decoder and textures in the lobby before the race, with a hidden "warming" step. A first-race hitch is the classic party-game stutter.
4. **Cache.** Use long-lived cache headers and hashed names for static assets, so a reconnecting phone never re-downloads them. Vite already hashes names; check the Worker headers.
5. **Reserve layout space.** Use fixed-size skeletons for images so a slow image never shifts the submit button under a thumb.

**Files:** `stage/*`, `play/*`, `kart/*`, `apps/api/src/index.ts` (static headers), and the question projection (add `nextAssets`).

### Phase 9: Observability and post-event review (½–1 day)

**Borrowed from Jackbox:** Sentry, `game/started|metric|ended`, `buildVersion`.

1. **Error capture.** Add a small `window.onerror` / `unhandledrejection` reporter that sends errors over the existing socket as a `telemetry` command, using the same bucket as `device`, and stores them in the room. You get Sentry-like data without a third party.
2. **Show the Phase 0 timings on the admin health page** (`admin/health-page.tsx`): broadcast p95, frames per second, reconnects per minute, and the slowest phones.
3. **Show the build id.** Put the build or commit id in the stage corner (like `showBuildVersion`) and in every telemetry row, so a bug report can be tied to a deploy.
4. **Game metrics.** Emit `game-started`, `phase-metric` (answers per phase, median answer time, late rejections) and `game-ended` into the archive. This supports the post-party review in `event-runbook.md`.

### Phase 10: Rehearsal and event-day hardening (½ day plus a rehearsal)

1. **Run the harness on staging** at 80 guests, with 2% churn and an extra 300 ms of latency on 20% of clients (`tc` or a proxy). Gate a production deploy on the Phase 0 targets.
2. **Do a venue test.** Join 10 real phones on the venue Wi-Fi, toggle the access point, and confirm Phase 6 behaviour. Add the results to `event-runbook.md`.
3. **Add runbook entries:** "Projector lost connection", "Wi-Fi drop" and "One phone spamming" (now throttled by Phase 3), each with the exact admin action.

---

## 4. Prioritised backlog

| #   | Item                                   | Fixes      | Impact on smoothness                                   | Effort | Risk                                                 |
| --- | -------------------------------------- | ---------- | ------------------------------------------------------ | ------ | ---------------------------------------------------- |
| 1   | Phase 0 harness and timings            | —          | Makes everything below measurable                      | S      | Low                                                  |
| 2   | Kart realtime lane (Phase 2)           | G2, G3     | **Very high** in kart; it removes the main CPU hotspot | M      | Medium (race correctness: keep the `catchUp` tests)  |
| 3   | Build once, send to many (Phase 1)     | G1         | **High** at 30+ guests                                 | M      | Low–medium                                           |
| 4   | Coalesce and presence fix (Phase 4)    | G8, G9     | High in answer bursts                                  | S      | Low                                                  |
| 5   | In-memory rate limits (Phase 3)        | G4         | Medium                                                 | S      | Low                                                  |
| 6   | Reconnect UX and full jitter (Phase 6) | —          | High _perceived_ smoothness                            | S      | Low                                                  |
| 7   | Clock sync and cue times (Phase 7)     | G9         | High perceived "together-ness"                         | M      | Low                                                  |
| 8   | Preloading (Phase 8)                   | —          | Medium–high (first-scene hitches)                      | S–M    | Low                                                  |
| 9   | Deltas and resume (Phase 5)            | G5, G6, G7 | Medium (bandwidth, flicker)                            | L      | Medium (state divergence; needs the randomised test) |
| 10  | Observability (Phase 9)                | —          | Indirect                                               | S      | Low                                                  |

S is under 1 day, M is 1–3 days and L is more than 3 days. For a single fixed event date, items 1–8 are worth doing. Item 9 is the most work, with less benefit at 80 players on venue Wi-Fi, so defer it if time is short: Phases 1 and 4 already remove most of the fan-out cost.

---

## 5. Open questions and unknowns

- **Exact Jackbox backoff numbers.** `_getWaitAfterAttempt`, the show-menu time and the give-up time are bytecode constants. Finding them needs an ABC decompiler such as JPEXS, or a configured Ghidra or IDA for the native side.
- **The phone client.** The `jackbox.tv` bundle was not analysed. How it stores the reconnect `secret` (likely `localStorage`) and how it renders entities are inferred. An optional next step is to open `jackbox.tv` in the browser and analyse its bundle with REA's web tools.
- **ecast server internals.** Persistence, the region model, and the exact rate-limit numbers are not visible from the client.
- **26 hot-path cost on Workers.** The costs in §2.2 are counts of operations from the code, not measurements. Phase 0 exists to confirm or correct them before larger changes.

---

## Appendix A: Evidence index (Jackbox, static)

| Claim             | Literal evidence (from decompressed `YouRuinedIt.swf`, also in the other game SWFs)                                                                                                                |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Protocol envelope | `jackboxgames.ecast.messages:Request/seq`, `Reply/re`, `Notification/pc`, `WSClient/private:_updatePc`                                                                                             |
| Connect URL       | `wss`, `/api/v2/rooms/`, `/play?`, `host-token`, `user-id`, `format`, `convertToQueryString`                                                                                                       |
| Subprotocol       | `ecast-v1` (host exe)                                                                                                                                                                              |
| Resume            | `replay-since`, `ReconnectState` `CONNECTING`/`REPLAYING`/`COMPLETE`, `ClientWelcome/secret`, `/replayEnd`, `/reconnect`, `/entities`, `/here`                                                     |
| Watcher           | `WSClientWatcher/private:_tryToReconnect`, "Trying to reconnect automatically: ATTEMPT #", `_getWaitAfterAttempt` (with `random`, `round`), `_getDurationUntilShowMenu`, `_getDurationUntilGiveUp` |
| Timeouts          | `jbg.config.jet`: `connectingDurationTrouble: 15000`, `connectingDurationAbort: 45000`                                                                                                             |
| Entities and ACL  | `EcastUtil/aclCanWrite`, `TextEntity/_acl`, `locked`, `maxLength`, `PlayerEntities` `EntityMetadata/keep`, `SharedEntities`, `EntityInteractionHandler/_arePlayersDone`                            |
| Audience CRDTs    | `audience/g-counter/*`, `audience/pn-counter/*`, `audience/count-group/*`, `audience/text-ring/*`                                                                                                  |
| Server guardrails | `ECAST_ERROR_RATE_LIMIT_EXCEEDED`, `ROOM_IS_FULL`, `ROOM_IS_LOCKED`, `PERMISSION_DENIED`, `text/filter`, `getExtraCreateParamsForContentFilter`, `safeNames`                                       |
| Incremental input | `doodle/stroke`, `DoodleLineValue/points`, `text-map/cursor-synced`, `TextMapNode/pc`                                                                                                              |
| Native transport  | `NativeOverrideWebSocket`, `jackboxgames::win::WebSocket`, libwebsockets `v3.2.2` (vcpkg path), `libuv.dll`, OpenSSL 1.1                                                                           |
| Presentation      | `TalkshowExport/project/data/start.swf`, `TimingManager`, `FrameTimer`, `PreloadManager`, `JBGUtil/preloadImagesInCurrentMovie` ("Preloaded bitmaps total VRAM"), FMOD `.bank`, CRI `.usm`         |
| Ops               | `sentry.dll`, `crashpad_handler.exe`, `sentryDsn`, `game/started` (`isFirstGameEver`, `startType`), `game/metric`, `game/ended`, `artifact/create`                                                 |

# Performance, Memory-Leak & Cloudflare Plan Audit

> Detailed audit of long-session memory stability, CPU/SQLite/GPU bottlenecks for ~80 concurrent guests + projector + host control over a full party night, and whether Cloudflare paid plans materially help on the night.
>
> Complements [Performance pass — 24 October 2026](performance.md).

---

## 1. Executive Summary

- **Architecture fit:** Having one Worker + one SQLite-backed `PartyRoom` Durable Object (WebSocket Hibernation API), Neon/Resend kept off the live tap path, React Router route splitting, and instanced Three.js kart rendering is already a solid foundation.
- **Real risk on party night:** Repeated work multiplied by **~82 connected sockets** (80 phones + stage + host), continuous compositor blur/animation on mid-range phones over several hours, and uncollected client/server resources as players upload media, trigger chess searches, run kart sessions, or reconnect over venue Wi-Fi.
- **Cloudflare plan verdict:** **Workers Paid (\$5/month)** is strongly recommended for the party night (and **Images Paid (\$5/month)** if `env.IMAGES` remains enabled for photo normalisation/bias). Moving from Zone Free to Zone Pro (\$20/month) is **not** needed, and R2 remains inside its permanent free tier.

---

## 2. Memory Leaks & Long-Session Degradation Findings

### 2.1 `RoomSocket` retry queue retains rejected commands & timers on close

- **Where:** `apps/web/src/live/room-socket.ts` (`tracked`, `ack` handler, `onOpen`, `close`, `draftTimer`)
- **What happens:**
  - `tracked` deletes entries only when `parsed.accepted` is `true`, leaving commands acknowledged with `accepted: false` inside `tracked` permanently.
  - Because `onOpen` replays every remaining entry in `tracked`, a rejected command (e.g., late answer or duplicate vote) is re-sent and re-rejected on every reconnect/flaky Wi-Fi drop for the rest of the night.
  - `close()` closes the underlying WebSocket without clearing `tracked` or cancelling any pending `draftTimer`.

### 2.2 Continuous `time:` clock probe defeats DO WebSocket hibernation

- **Where:** `apps/web/src/live/room-socket.ts` (`heartbeatMs`, `probe`/`sendTimeProbe`), `apps/api/src/room/party-room.ts` (`time:` handler)
- **What happens:**
  - `PartyRoom` configures `setWebSocketAutoResponse` for `"ping"` -> `"pong"`, which lets Cloudflare answer heartbeats at the edge without waking the Durable Object.
  - However, clients also send `"time:${Date.now()}"` on a 20-second cadence. At 82 sockets, that invokes `webSocketMessage()` on `PartyRoom` ~4.1 times every second even during idle intervals (lobby, dinner breaks, post-podium), keeping the DO awake continuously, consuming Active Duration GB-s, and bypassing hibernation.

### 2.3 `PartyRoom.broadcast()` multiplies SQLite, Zod validation & JSON work by ~82×

- **Where:** `apps/api/src/room/party-room.ts` (`snapshotParts`, `buildSnapshot`, `sendView`, `broadcast`), `apps/api/src/questions/multiple-choice.ts` (`standings`), `apps/api/src/wall/snapshot.ts`, `apps/api/src/troll/engine.ts` (`trollSnapshot`, `hidesPersonalScore`)
- **What happens:**
  - Even with per-audience `snapshotParts` caching within a synchronous broadcast, `buildSnapshot()` still repeats room-wide work per socket (~82× per state change):
    - Queries room-level `wallSnapshot()`, `trollSnapshot()`, `hidesPersonalScore()`, `readRehearsal()`, `readKartLobby()`, and voter reaction summaries inside every guest iteration.
    - Runs `standings(sql)` via correlated sums plus repeated player display-nickname lookups.
    - Re-validates the generated server snapshot through `lobbySnapshotSchema.parse(...)` on every single socket send (~82 full Zod schema parses per broadcast).
    - In `sendView()`, runs `JSON.stringify` per snapshot field across ~82 sockets even when shared fields (`question`, `wall`, `players`, `standings`, `durations`, `trollCatalogue`) are bit-for-bit identical.

### 2.4 Unconditional `ensurePartySchema()` DDL & un-evicted `PartyRoom` caches

- **Where:** `apps/api/src/room/party-room.ts` (`constructor`, `destroyRoom`, `lastViews`), `apps/api/src/room/schema.ts` (`ensurePartySchema`)
- **What happens:**
  - `ensurePartySchema(sql)` runs ~80 `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, and `PRAGMA table_info(...)` statements inside `blockConcurrencyWhile` every time `PartyRoom` wakes from hibernation or restarts.
  - `lastViews` (`Map<string, SentView>`) caches the previous view per connection key, but revoked/removed guests or rotated credentials never purge superseded entries while live sockets churn.
  - `destroyRoom()` wipes SQLite tables and notifies clients, without clearing in-memory maps (`lastViews`, `rateBuckets`, `kartIngress`) or closing cached database pools.

### 2.5 Kart tick per-phone `O(N²)` scans & 3D client resource retention

- **Where:** `apps/api/src/questions/kart/kart.ts` (`kartFrames`, `phoneRaceView`), `apps/web/src/kart/circuit.ts`, `apps/web/src/kart/KartCanvas.tsx`
- **What happens:**
  - On the server at 5 Hz during a race, `kartFrames()` calls `phoneRaceView()` for every racer; inside `phoneRaceView()`, item presentation, participant filtering, leaderboard filtering, and linear `.find(...)` lookups on `race.drivers` execute repeatedly for all 80 phones (~240+ linear scans per tick).
  - On the client, `circuit.ts` removes departed drivers from `poses`, `serverSeen`, `travel`, and `emission`, but leaves Sprite textures/materials in `labels` undisposed until full `circuit.dispose()`. `KartCanvas` cleanup calls `renderer.dispose()` without calling `renderer.forceContextLoss()`, risking WebGL context exhaustion across repeated rehearsals/races on mobile Safari/Chrome. Per-frame `update()` / prediction loops allocate temporary `Set`, array, and vector objects at 60 FPS.

### 2.6 `StockfishEngine` idle worker + leaked/un-terminated WASM Workers

- **Where:** `apps/web/src/chess/stockfish-worker.ts`
- **What happens:**
  - `initialize()` spawns `this.worker`, runs a full UCI handshake, and leaves `this.worker` idle while `go()` spawns another Worker (`activeSearchWorker`) per search (to enforce UCI `bestmove` isolation, locked down in `apps/web/src/chess/stockfish-worker-isolation.test.ts`).
  - Once `bestmove` arrives or `searchWorker.onerror` fires, `searchWorker` is never terminated until the next `go()` or engine `terminate()`, keeping a multi-megabyte Stockfish WASM worker heap alive indefinitely after a move or completion.
  - In `initialize()`, the 10-second `timeout` and `worker.onerror` reject without calling `worker.terminate()`, leaking hung WASM workers if initialisation stalls.

### 2.7 `VoiceTake` Object URL leak & `recordWav` stream/context leaks

- **Where:** `apps/web/src/media/voice-take.tsx`, `apps/web/src/media/wav.ts`
- **What happens:**
  - `VoiceTake` only revokes `preview` inside "Record again" and before saving a new clip, not on component unmount (nor if `recordWav()` resolves after unmount), leaking `blob:` URLs backing audio buffers.
  - `recordWav()` calls `stream.getTracks().forEach(t => t.stop())`, node `.disconnect()`, and `context.close()` outside `try/finally`, and collects PCM audio into `samples: number[]` (`~130k+` dynamic array pushes for 2.9s @ 44.1/48 kHz) instead of a pre-allocated typed buffer.

### 2.8 Client re-fetching of `private, no-store` room media

- **Where:** `apps/api/src/media/finalise.ts` (`acceptedMediaHeaders`), `apps/web/src/stage/wall/stage-wall.tsx` (`Preload`, `Spotlight`, `Reel`), `apps/web/src/ui/player-avatar.tsx`, `apps/web/src/wall/framed-photo.tsx`
- **What happens:**
  - `acceptedMediaHeaders()` intentionally returns `Cache-Control: private, no-store` (enforced by privacy tests in `apps/api/test/media-check.spec.ts` so withdrawn/hidden media cannot stay in shared HTTP disk caches).
  - However, because the projector/phone DOM relies on standard `<img src="/api/rooms/.../media/...">`, `no-store` prevents HTTP cache reuse across `Preload` -> `Spotlight` -> `Reel` transitions and across phase remounts of 80 `<PlayerAvatar>` components (lobby, scoreboard, kart, results), multiplying Worker + DO `readMedia()` + R2 reads.
  - A bounded, room-scoped in-memory image/blob cache on the client eliminates repeated fetches within the active tab while strictly preserving `private, no-store` HTTP headers and clearing immediately when leaving the room or on load/moderation error.

### 2.9 Heavy GPU compositor blur & animation overhead (`LiquidGround` + `.glass` + `NameCloud`)

- **Where:** `apps/web/src/ui/glass.css`, `apps/web/src/lobby/name-cloud.css`, `apps/web/src/lobby/name-cloud.tsx`
- **What happens:**
  - Three continuously animating `70vmax` blobs using `filter: blur(60px)` (`.liquid-blob`) sit behind up to 80 simultaneous `.name-bubble.glass` elements (`backdrop-filter: blur(22px) saturate(170%)` plus an infinite `name-float` keyframe). On phone GPUs and projectors, every animated frame invalidates dozens of overlapping backdrop-filter passes, driving thermal throttling and battery drain during a long lobby.

### 2.10 `RanksTab` render-path serialisation & synchronous storage writes

- **Where:** `apps/web/src/guest/ranks-tab.tsx`
- **What happens:**
  - Comparing and persisting the last scoreboard inside render/sync helpers runs `JSON.stringify(items)` and synchronous `sessionStorage.setItem` on every snapshot update with 80 players, blocking the UI thread unnecessarily when scoreboard rows did not change.

---

## 3. Cloudflare Free vs Paid Plans Assessment (Single Party Night)

### Quota & Billing Comparison (Verified against Cloudflare Documentation)

| Resource | Workers Free | Workers Paid (\$5/mo base) | Party Night (~80 phones, 1 projector, 1 host) |
| --- | --- | --- | --- |
| **Active CPU / invocation** (Worker & DO) | **10 ms** hard limit (terminates request on breach) | **30 s default** (configurable up to 5 min via `limits.cpu_ms`); 30M CPU-ms/mo incl., \$0.02/M extra | **Critical risk on Free.** 82-socket fan-out bursts, stats aggregation, or kart 5 Hz ticks can breach 10 ms CPU and kill DO ticks/connections. Paid removes the 10 ms cliff. |
| **Workers Requests** (`run_worker_first` `/api/*`, `/ws/*`; static `ASSETS` free & unlimited) | **100,000 / day** hard cap | **10M / month** incl., \$0.30/M extra | Safe with Paid; Free risks daily exhaustion across rehearsals, 80 joins, media fetches, avatars, and HTTP/WS traffic. |
| **Durable Object Requests** (WS msgs: 20:1 ratio; `setWebSocketAutoResponse` does not wake/bill) | **100,000 / day** hard cap (00:00 UTC reset) | **1M / month** incl., \$0.15/M extra | Free cap is tight once guests chat/react/drive kart and probes wake the DO; Paid removes the cliff. |
| **Durable Object Duration** (128 MB RAM baseline; hibernated WS idle = \$0) | **13,000 GB-s / day** | **400,000 GB-s / month** incl., \$12.50/M GB-s | One DO awake continuously = ~0.125 GB-s/s -> ~10,800 GB-s/day, right near Free's 13,000 GB-s/day limit if probes prevent hibernation. |
| **DO SQLite Rows Written** | **100,000 / day** hard cap | **50M / month** incl., \$1.00/M extra | Every insert/update/alarm/index write counts. 80 guests answering rounds + reactions + kart logs can push close to 100k/day if verbose writes happen. Paid gives 500× headroom. |
| **DO SQLite Rows Read** | **5M / day** hard cap | **25B / month** incl., \$0.001/M extra | N+1 broadcast queries hit Free much sooner than batched reads; Paid practically eliminates the ceiling. |
| **Cloudflare Images Binding (`env.IMAGES`)** | Free allowance: **5,000 unique transforms/mo** (hard error `9422` above 5k; binding setups typically require Paid) | **Images Paid (\$5/mo)** incl. 5,000 unique transforms, \$0.50/1k extra | Needed because staging/prod declare `images: { binding: "IMAGES" }`. Well under 5,000 transforms on party night -> flat \$5/mo. |
| **Cloudflare R2 Storage** | Free tier: **10 GB**, **1M Class A**, **10M Class B/mo**, **\$0 egress** | Same permanent free tier; pay only beyond caps | Party media stays comfortably inside the free tier. |
| **Smart Placement & DNS Zone** | No Smart Placement; Free DNS Zone covers custom domains & Cloudflare proxy | Smart Placement incl. in Workers Paid | Keep DNS Zone on **Free** (do not upgrade to Zone Pro at \$20/mo). |

### Practical Recommendations for Party Night

1. **Upgrade to Workers Paid (\$5/month)** before dress rehearsal — eliminating the **10 ms CPU ceiling** and **100k/day DO/SQLite hard stops** is the single highest-value reliability win. Total bill for a single night will realistically be **\$5–\$10** (Workers Paid \$5 + Images Paid \$5).
2. **Keep Cloudflare DNS Zone on Free** (Zone Pro \$20/mo adds WAF/Polish features you do not need for this app).
3. **Host colocation trick for DO + Neon latency:** Create and open the live party `PartyRoom` from the venue / a UK connection so Cloudflare instantiates the Durable Object near guests and near Neon (`aws-eu-west-2`), keeping Postgres archive/auth hops fast without touching Workers geolocation manually.
4. **Fix the software bottlenecks anyway:** Even on Workers Paid, fixing broadcast amplification, hibernation wakes, SQLite N+1s, and client GPU/memory leaks keeps tick latency low and phones cool and responsive throughout the entire evening.

---

## 4. Remediation & Optimisation Work Log

- [x] `RoomSocket` & connection telemetry (`apps/web/src/live/room-socket.ts`, `apps/web/src/device/connection-log.ts`): delete rejected (`accepted: false`) entries from `tracked` on `ack`, clear `draftTimer`/`draftPending` in `clearHeartbeat()`, clear `tracked`/`lastSnapshot`/`lastView` on `stop()`/`close()`, throttle `time:` clock probes (`timeProbeRefreshMs = 4 * 60_000`) and skip them for `botSession`, keep 20s `"ping"` auto-response pure, and gate 60s `summaryTimer` pings via `hasUrgentConnectionDelta()` / `maybeSendPeriodicConnection()`.
- [x] `StockfishEngine` (`apps/web/src/chess/stockfish-worker.ts`): release handshake worker after `readyok`, terminate workers on init timeout/`onerror`/`catch` and search `onerror`, and clear `ready` unconditionally in `terminate()` while preserving worker isolation.
- [x] `VoiceTake` & `recordWav` (`apps/web/src/media/voice-take.tsx`, `apps/web/src/media/wav.ts`): add unmount guard, `recording` lock, and `useEffect` `URL.revokeObjectURL` cleanup in `VoiceTake`; wrap `AudioContext`/node/`onaudioprocess`/track teardown in `try/finally`, clear the recording timer on completion, and write PCM into a pre-allocated `Float32Array` buffer.
- [x] Kart engine (`apps/web/src/kart/circuit.ts`, `apps/web/src/kart/KartCanvas.tsx`, `apps/api/src/questions/kart/kart.ts`): add `disposeLabel()` to prune/dispose departed driver sprites/materials/textures and reuse scratch `present` `Set` in `circuit.ts`; call `renderer.forceContextLoss()` before `renderer.dispose()` in `KartCanvas.tsx`; pre-index racers once per tick via `buildKartFrameIndex()` / `KartFrameIndex` in `kartFrames()`.
- [x] `PartyRoom` / SQLite / Broadcast (`apps/api/src/room/schema.ts`, `apps/api/src/room/party-room.ts`, `apps/api/src/room/names.ts`, `apps/api/src/questions/multiple-choice.ts`, `apps/api/src/wall/snapshot.ts`, `apps/api/src/troll/engine.ts`): fast-path `ensurePartySchema()` / `ensure()` via `schema_meta`; batch `standings()` and nickname lookups; hoist room-wide snapshot work per broadcast (`RoomWideSnapshotData`, `allVoterReactions`, `prepareWallShared`, `prepareTrollShared`, `preparePlayShared`); cache shared serialized fields via `WeakMap` in `sendView()`; bound/evict stale `views`/`lastViews`; and release caches/timers/db in `destroyRoom()`.
- [x] Media & UI (`apps/web/src/media/media-cache.ts`, `apps/web/src/ui/roster.tsx`, `apps/web/src/stage/wall/stage-wall.tsx`, `apps/web/src/wall/framed-photo.tsx`, `apps/web/src/wall/guest-wall.tsx`, `apps/web/src/ui/player-avatar.tsx`, `apps/web/src/troll/classic-trolls.tsx`, `apps/web/src/stage/stage-presentation.tsx`, `apps/web/src/stage/stage-sound.tsx`, `apps/web/src/kart/DriverBadge.tsx`, `apps/web/src/kart/KartMap.tsx`, `apps/web/src/kart/KartCanvas.tsx`, `apps/web/src/ui/glass.css`, `apps/web/src/lobby/name-cloud.css`, `apps/web/src/guest/ranks-tab.tsx`): add bounded (`MEDIA_CACHE_MAX_ENTRIES = 96`) room-scoped `blob:` image cache preserving `Cache-Control: private, no-store`, clear stale rooms via `RosterProvider`/`StageWall`, and wire all phone, stage, troll (`ScreenInvasion`), and kart face/photo consumers; replace `.liquid-blob` `filter: blur(60px)` with multi-stop radial gradients and remove per-pill `backdrop-filter` on `.name-bubble`; replace `RanksTab` render-time `JSON.stringify`/`sessionStorage.setItem` and `O(N²)` nickname scans with structural equality helpers, `Map` lookup, and `useEffect` storage sync.


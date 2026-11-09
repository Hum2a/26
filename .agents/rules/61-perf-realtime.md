---
description: WebSocket messages, patches, reconnect, and 80-player fan-out
trigger: glob
globs:
  - apps/web/src/live/**/*.ts
  - apps/web/src/net/**/*.ts
  - apps/web/src/net/**/*.tsx
  - apps/web/src/kart/useKartSocket.ts
  - apps/web/src/device/**/*.ts
  - apps/api/src/room/**/*.ts
  - packages/shared/src/**/*.ts
---

# Realtime messages (~80 phones)

There is **one** socket client: `openRoomSocket` in `apps/web/src/live/room-socket.ts`. There is **one** room object: `PartyRoom`. Do not add a second WebSocket, EventSource, or polling loop for live play.

Clients send **intents**. The room sends **snapshots, patches, kart frames, and acks**. Phones never invent phase, score, or clock.

## Size and shape

- Guest command bodies stay inside `maxPayloadBytes` (4 KiB) in `apps/api/src/room/limits.ts`. Do not attach photos, WAVs, or GLBs to a socket message; those go through the media upload path.
- Public snapshots are a **projection**. Guest and stage payloads must not include host-only fields, answer keys, or other players’ chess boards. Chess already splits guest / stage / control schemas — keep that split.
- Prefer a **patch** of changed top-level snapshot fields. `PartyRoom` already sends `kind: "patch"` when the patch is smaller than ~80% of a full snapshot. Do not add a new ad-hoc “delta” format beside it.
- A kart tick is `kind: "kart"`, merged with `mergeKartFrame`. It must not carry the lobby, media list, or question text. If the phone has no matching race snapshot, request a full snapshot — do not guess.

```ts
// ❌ BAD — 80 phones × full lobby on every race tick
send(ws, { kind: "snapshot", snapshot: buildSnapshot("guest", playerId) });

// ✅ GOOD — PartyRoom.broadcastKart + mergeKartFrame on the client
send(ws, { kind: "kart", ...frame });
```

## Frequency and batching

| Path                  | Budget                                                                                                                      |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Guest answers / votes | Token bucket `commandRateLimit` (burst 30, 3/s)                                                                             |
| Live drafts           | Debounce 200ms on the phone (`submitDraft`); `draftRateLimit` on the room                                                   |
| Kart inputs           | Client drops when `bufferedAmount >= 8192`; room `KartInputBuffer` keeps ≤4 per driver, ≥80ms apart, flush on the race tick |
| Clock probes          | Five on open, then with the 20s heartbeat (`timeRateLimit`)                                                                 |
| Device telemetry      | Phase change, resize (debounced), once a minute (`telemetryRateLimit`)                                                      |
| Broadcast coalescing  | `broadcastWindowMs = 30` so clustered writes share one fan-out                                                              |

```ts
// ❌ BAD — emit a draft on every keystroke
socket.send(JSON.stringify({ kind: "command", name: "draft", text }));

// ✅ GOOD — existing submitDraft leading-edge 200ms timer
```

Do not `requestSnapshot` in a loop, on every focus, or from a `setInterval`. The socket already asks once after a failed patch or a stale kart frame.

## Fan-out

Build **shared snapshot parts once per audience**, then specialise per guest (self answer, self chess, self troll). `snapshotParts` + `buildSnapshot` already do this. Do not run eighty identical SQL queries in a `for (const ws of sockets)` loop.

Eighty reconnects after a Wi-Fi blip must **jitter**. `reconnectDelay` uses full jitter capped at 8s. Do not reconnect on a fixed 100ms timer.

```ts
// ❌ BAD
setTimeout(connect, 100);

// ✅ GOOD
setTimeout(connect, reconnectDelay(attempt));
```

## Acks and optimism

Persist, then ack (`requestId`). Retries reuse the same idempotency key. The phone may show “sending”; it may not show “accepted” until `onAck`. Kart steering is the exception: local prediction in the canvas, room still owns the race.

## Diagnostics

`createRealtimeMeter` counts messages in memory for the host health view. Do not write those counters to SQLite on every send. Do not log full snapshots.

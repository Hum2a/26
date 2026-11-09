---
description: Durable Object hot path, storage, alarms, and live-guest cost
trigger: glob
globs:
  - apps/api/**/*.ts
  - packages/shared/**/*.ts
---

# Durable Object server hot path

One Worker, one SQLite-backed Durable Object per room (`PartyRoom`), one durable scheduler for alarms. Neon, Resend, and image/audio work stay **outside** the live guest-action path.

`packages/shared` logic takes `now: number`. Never call `Date.now()` inside reducers, scoring, or rate limits. The DO may read the clock at the edge and pass it in.

## Transactions and storage

SQLite on a DO is durable and not free. Each `storage.transactionSync` / SQL batch is work that **blocks the object** for every guest.

- Persist an accepted action **before** the success ack. Group the writes for one intent into **one** transaction (receipt, answer row, `state_version`, next alarm).
- Do not start a nested transaction per player in a fan-out.
- Memory is a cache (`KartIngressCache`, `KartInputBuffer`, rate buckets, last views). After a restart, rebuild from SQL; do not require the cache for correctness.
- Rate buckets live in memory (`maxRateBuckets = 400` for 80 phones × several names). Do not persist token buckets.

```ts
// ❌ BAD — SQL per socket while broadcasting
for (const ws of sockets) {
  const nickname = sql.exec("SELECT nickname FROM player WHERE player_id = ?", id);
  send(ws, nickname);
}

// ✅ GOOD — snapshotParts loads players once; buildSnapshot reuses parts
const parts = this.snapshotParts("guest", statistics);
```

`KartIngressCache` exists so unacked kart controls do not re-parse the roster. Do not delete it to “simplify”. Do not use it as authority for scoring.

## Alarms and ticks

`alarm()` runs due jobs in one `commitAndArm` transaction. A **kart race tick** (five times a second) must stay `raceTickOnly`: flush inputs, step the race, skip archive queries, and prefer `broadcastKart()` over a full snapshot.

```ts
// ❌ BAD — settle archive and rebuild guest snapshots 5×/s during a race
await settleArchive(...);
this.broadcast();

// ✅ GOOD — existing alarm() short-circuit
if (!raceTickOnly || !this.broadcastKart()) {
  this.broadcast(true);
}
```

Do not add a second `setTimeout` scheduler beside the durable alarm. Do not use `Date.now()` inside `reduceKart` / chess / troll reducers.

## CPU on the object

The DO is single-threaded for the room. A 20ms stall is 20ms of lag for 80 phones.

- Keep JSON.parse/stringify and Zod at the boundary, once per message.
- Do not run Stockfish, image codecs, or `jpeg-js` on the room object for a live tap.
- Chess move validation belongs in the mechanic; engine search belongs in the **phone worker**.
- Load tests: `npm run load:realtime -w @26/api`. A new broadcast or per-input SQL needs a thought for 80 senders.

## Effects after reduce

Shared helpers return `{ state, effects }`. The DO executes effects (broadcast, alarm, persist). Do not hide a broadcast inside a domain function that also writes SQL in a surprising second pass.

## Config

Read bindings from the request env. `no-restricted-syntax` already forbids `process.env` in `apps/api/src` and `packages/shared/src`. Local fakes must refuse to succeed when `APP_ENV` is `staging` or `production`.

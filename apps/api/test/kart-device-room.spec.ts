import { env, evictDurableObject, runInDurableObject } from "cloudflare:test";
import { expect, it } from "vitest";
import { payloadDigest } from "../src/room/digest.ts";
import { createSqlStore } from "../src/room/sql-store.ts";
import { questionFor } from "../src/questions/registry.ts";
import {
  acceptKartFinish,
  readKart,
  acceptKartInput,
} from "../src/questions/kart/kart.ts";
import { kartNeutral } from "@26/shared";

it("projects exact self checkpoints without treating accepted ingress as simulated input", async () => {
  const { stub, players, now } = await setup();
  await runInDurableObject(stub, (_instance, state) => {
    const sql = state.storage.sql,
      store = createSqlStore(sql),
      q = questionFor(store.readRoom());
    if (q?.kind !== "kart") throw new Error("Kart required");
    const race = readKart(sql, q.id)!;
    expect(
      acceptKartInput(
        sql,
        store,
        players[0]!,
        { ...kartNeutral, gas: true, raceId: race.raceId, sequence: 9 },
        q,
        now,
      ),
    ).toBe(true);
  });
  const first = (await stub.snapshotFor("guest", players[0])).play!.kart!;
  expect(first.timingMode).toBe("device-v1");
  expect(first.inputCursor).toBe(9);
  expect(first.rollback!.appliedSequence).toBeLessThan(9);
  expect(first.rollback!.body).toHaveProperty("vx");
  expect((await stub.snapshotFor("stage")).play!.kart!.rollback).toBeUndefined();
  expect((await stub.snapshotFor("control")).play!.kart!.rollback).toBeUndefined();
  expect(
    (await stub.snapshotFor("guest", players[1])).play!.kart!.rollback!.appliedSequence,
  ).not.toBe(9);
});

it("persists trusted finishes and receipts across eviction, ties once, and refuses changed or late reports", async () => {
  const { stub, players } = await setup();
  const raceId = (await stub.snapshotFor("stage")).play!.kart!.raceId;
  const requestId = crypto.randomUUID();
  const report = { raceId, elapsedMs: 12345, lapsMs: [12345] };
  async function send(playerId: string, id: string, payload: unknown) {
    await runInDurableObject(stub, async (instance, state) => {
      const pair = new WebSocketPair();
      state.acceptWebSocket(pair[1], ["guest"]);
      pair[1].serializeAttachment({
        role: "guest",
        principalId: playerId,
        deliverySeq: 0,
      });
      pair[0].accept();
      try {
        await instance.webSocketMessage(
          pair[1],
          JSON.stringify({
            kind: "command",
            name: "kart-finish",
            requestId: id,
            report: payload,
          }),
        );
      } finally {
        pair[0].close();
        pair[1].close();
      }
    });
  }
  await send(players[0]!, requestId, report);
  expect(
    (await stub.snapshotFor("stage")).play!.kart!.leaderboard.find(
      (d) => d.playerId === players[0],
    )!.timeMs,
  ).toBe(12345);
  await runInDurableObject(stub, (_instance, state) => {
    expect(
      JSON.parse(
        state.storage.sql
          .exec<{ result_json: string }>(
            "SELECT result_json FROM receipt WHERE principal = ? AND request_id = ?",
            players[0],
            requestId,
          )
          .toArray()[0]!.result_json,
      ),
    ).toEqual({ accepted: true });
  });
  await evictDurableObject(stub);
  await send(players[0]!, requestId, report);
  await send(players[0]!, requestId, { ...report, elapsedMs: 1, lapsMs: [1] });
  expect(
    (await stub.snapshotFor("stage")).play!.kart!.leaderboard.find(
      (d) => d.playerId === players[0],
    )!.timeMs,
  ).toBe(12345);
  await send(players[1]!, crypto.randomUUID(), report);
  const view = await stub.snapshotFor("stage");
  expect(view.phase).toBe("reveal");
  expect(view.play!.kart!.leaderboard.map((d) => d.place)).toEqual([1, 1]);
  await send(players[1]!, crypto.randomUUID(), {
    ...report,
    elapsedMs: 1,
    lapsMs: [1],
  });
  await runInDurableObject(stub, (_instance, state) => {
    expect(
      state.storage.sql
        .exec<{ n: number }>(
          "SELECT COUNT(*) n FROM receipt WHERE principal = ? AND request_id = ?",
          players[0],
          requestId,
        )
        .toArray()[0]!.n,
    ).toBe(1);
    const rows = state.storage.sql
      .exec<{ points: number }>(
        "SELECT points FROM score_ledger WHERE detail LIKE 'kart:finished:%'",
      )
      .toArray();
    expect(rows.map((r) => r.points)).toEqual([100, 100]);
  });
});

it("refuses invalid splits, identities, wrong races, paused/held and closed windows", async () => {
  const { stub, players, now } = await setup();
  await runInDurableObject(stub, (_instance, state) => {
    const sql = state.storage.sql,
      store = createSqlStore(sql),
      q = questionFor(store.readRoom());
    if (q?.kind !== "kart") throw new Error("Kart required");
    const report = {
      raceId: readKart(sql, q.id)!.raceId,
      elapsedMs: 1000,
      lapsMs: [1000],
    };
    const finish = (id: string, value: unknown = report, at = now) =>
      acceptKartFinish(sql, store, q, id, value, at);
    expect(finish("spectator").ok).toBe(false);
    expect(finish(players[0]!, { ...report, raceId: "old" }).ok).toBe(false);
    expect(finish(players[0]!, { ...report, lapsMs: [500, 1000] }).ok).toBe(false);
    expect(finish(players[0]!, { ...report, elapsedMs: -1 }).ok).toBe(false);
    const room = store.readRoom();
    store.writeRoom({ ...room, paused: true });
    expect(finish(players[0]!).ok).toBe(false);
    store.writeRoom({ ...room, hold: "controller" });
    expect(finish(players[0]!).ok).toBe(false);
    store.writeRoom(room);
    expect(finish(players[0]!, report, now + 1000000).ok).toBe(false);
    expect(finish(players[0]!).ok).toBe(true);
    expect(finish(players[0]!).ok).toBe(false);
  });
});

async function setup(names = ["Amina", "Bilal"], collect = true) {
  // Keep automatic wall-clock alarms in the future; tests explicitly drive the injected clock.
  const now = Date.now() + 60_000,
    created = await env.ROOM_CODE_REGISTRY.getByName("codes").createLobby({
      requestId: crypto.randomUUID(),
      digest: await payloadDigest({ action: "create" }),
      now: new Date(now).toISOString(),
    });
  if (!created.ok) throw new Error(created.message);
  const room = created.result,
    stub = env.PARTY_ROOM.getByName(room.gameId);
  const players = [];
  for (const nickname of names) {
    const p = await stub.joinPlayer({
      nickname,
      requestId: crypto.randomUUID(),
      now: new Date(now).toISOString(),
    });
    if (!p.ok) throw new Error(p.message);
    players.push(p.playerId);
  }
  const credential = {
    credentialId: room.control.credentialId,
    secret: room.control.secret,
  };
  expect(
    (
      await stub.startKartRehearsal({
        ...credential,
        requestId: crypto.randomUUID(),
        nowMs: now,
      })
    ).ok,
  ).toBe(true);
  // Actual first quiz -> actual second kart intro, using the same authoritative phase graph.
  for (let n = 1; n <= 5; n++)
    expect(
      (
        await stub.advanceRound({
          ...credential,
          requestId: crypto.randomUUID(),
          nowMs: now + n,
        })
      ).ok,
    ).toBe(true);
  expect((await stub.snapshotFor("stage")).play?.question.kind).toBe("kart");
  for (let n = 6; collect && n <= 7; n++)
    expect(
      (
        await stub.advanceRound({
          ...credential,
          requestId: crypto.randomUUID(),
          nowMs: now + n,
        })
      ).ok,
    ).toBe(true);
  return { stub, players, now: now + (collect ? 7 : 5), credential };
}

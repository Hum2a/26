import { env, evictDurableObject, runInDurableObject } from "cloudflare:test";
import { expect, it } from "vitest";
import { payloadDigest } from "../src/room/digest.ts";
import { createSqlStore } from "../src/room/sql-store.ts";
import { readKart, useKartItem } from "../src/questions/kart/kart.ts";
import { questionFor } from "../src/questions/registry.ts";
import { writeRoundState } from "../src/questions/round-state.ts";
import { createKartPowers, createDrivingBody } from "@26/shared";
import { onAlarm } from "../src/room/lifecycle.ts";
import { createGameStore } from "../src/questions/multiple-choice.ts";
it("freezes an active bomb fuse through pause and eviction, then resolves it once on resumed active time", async () => {
  const { stub, players, credential, now } = await setup();
  await runInDurableObject(stub, (_instance, state) => {
    const sql = state.storage.sql,
      store = createSqlStore(sql),
      q = questionFor(store.readRoom());
    if (q?.kind !== "kart") throw new Error("Kart required");
    const race = readKart(sql, q.id)!;
    race.itemRules = { version: 2, allowed: ["bomb"] };
    race.drivers.forEach((driver, index) => {
      Object.assign(driver, {
        x: 42,
        z: index ? -3 : 0,
        heading: Math.PI / 2,
        power: createKartPowers(),
      });
      driver.physics = createDrivingBody(driver.x, driver.z, driver.heading);
    });
    race.drivers[0]!.power!.item = "bomb";
    writeRoundState(sql, q.id, "kart-race", race);
    expect(useKartItem(sql, store, q, players[0]!, race.raceId, now)).toEqual({
      ok: true,
    });
  });
  expect(
    (
      await stub.pauseRound({
        ...credential,
        requestId: crypto.randomUUID(),
        nowMs: now + 400,
      })
    ).ok,
  ).toBe(true);
  await evictDurableObject(stub);
  await runInDurableObject(stub, (_instance, state) => {
    const sql = state.storage.sql,
      q = questionFor(createSqlStore(sql).readRoom())!;
    onAlarm(createGameStore(sql), now + 9000);
    const race = readKart(sql, q.id)!;
    expect(race.elapsedMs).toBe(400);
    expect(race.itemsWorld!.projectiles).toHaveLength(1);
    expect(
      race.itemsWorld!.history.filter((event) => event.kind === "launch"),
    ).toHaveLength(1);
  });
  expect(
    (
      await stub.resumeRound({
        ...credential,
        requestId: crypto.randomUUID(),
        nowMs: now + 10000,
      })
    ).ok,
  ).toBe(true);
  await runInDurableObject(stub, (_instance, state) => {
    const sql = state.storage.sql,
      q = questionFor(createSqlStore(sql).readRoom())!;
    onAlarm(createGameStore(sql), now + 11000);
    expect(readKart(sql, q.id)!.itemsWorld!.projectiles).toHaveLength(1);
    onAlarm(createGameStore(sql), now + 11200);
    const race = readKart(sql, q.id)!;
    expect(race.elapsedMs).toBe(1600);
    expect(race.itemsWorld!.projectiles).toHaveLength(0);
    expect(
      race.itemsWorld!.history.filter((event) => event.kind === "explode"),
    ).toHaveLength(1);
    expect(
      race.itemsWorld!.history.find((event) => event.kind === "explode")?.atMs,
    ).toBe(1500);
    expect(race.drivers[1]!.power!.slowedUntil).toBeGreaterThan(race.elapsedMs);
    onAlarm(createGameStore(sql), now + 11400);
    expect(
      readKart(sql, q.id)!.itemsWorld!.history.filter(
        (event) => event.kind === "explode",
      ),
    ).toHaveLength(1);
  });
});
it("persists guest item use before acknowledgement, replays it exactly and refuses stage/anonymous actors", async () => {
  const { stub, players } = await setup();
  const requestId = crypto.randomUUID();
  let first: unknown;
  for (const replay of [false, true]) {
    if (replay) await evictDurableObject(stub);
    await runInDurableObject(stub, async (instance, state) => {
      const sql = state.storage.sql,
        q = questionFor(createSqlStore(sql).readRoom())!;
      if (!replay) {
        const race = readKart(sql, q.id)!;
        race.itemRules = { version: 2, allowed: ["treat"] };
        race.drivers[0]!.power = { ...createKartPowers(), item: "treat" };
        writeRoundState(sql, q.id, "kart-race", race);
      }
      const pair = new WebSocketPair();
      state.acceptWebSocket(pair[1], ["guest"]);
      pair[1].serializeAttachment({
        role: "guest",
        principalId: players[0],
        deliverySeq: 0,
        kartItems: 2,
      });
      pair[0].accept();
      const messages: Record<string, unknown>[] = [];
      pair[0].addEventListener("message", (event) => {
        messages.push(JSON.parse(String(event.data)));
      });
      try {
        await instance.webSocketMessage(
          pair[1],
          JSON.stringify({
            kind: "command",
            name: "kart-use-item",
            requestId,
            raceId: readKart(sql, q.id)!.raceId,
          }),
        );
        await expect
          .poll(() => messages.find((message) => message.kind === "ack"))
          .toMatchObject({ accepted: true, requestId });
        const ack = messages.find((message) => message.kind === "ack");
        if (replay) expect(ack).toEqual(first);
        else first = ack;
        const saved = readKart(sql, q.id)!;
        expect(saved.drivers[0]!.power!.item).toBeNull();
        expect(saved.drivers[0]!.power!.turboUntil).toBe(600);
        expect(
          saved.itemsWorld!.history.filter((event) => event.kind === "use"),
        ).toHaveLength(1);
      } finally {
        pair[0].close();
        pair[1].close();
      }
    });
  }
  for (const role of ["presentation", "guest"] as const)
    await runInDurableObject(stub, async (instance, state) => {
      const pair = new WebSocketPair();
      state.acceptWebSocket(pair[1], [role]);
      pair[1].serializeAttachment({
        role,
        principalId: crypto.randomUUID(),
        deliverySeq: 0,
        kartItems: 2,
      });
      pair[0].accept();
      const messages: Record<string, unknown>[] = [];
      pair[0].addEventListener("message", (event) => {
        messages.push(JSON.parse(String(event.data)));
      });
      try {
        await instance.webSocketMessage(
          pair[1],
          JSON.stringify({
            kind: "command",
            name: "kart-use-item",
            requestId: crypto.randomUUID(),
            raceId: (await instance.snapshotFor("stage")).play!.kart!.raceId,
          }),
        );
        await expect
          .poll(() => messages.find((message) => message.kind === "ack"))
          .toMatchObject({ accepted: false });
      } finally {
        pair[0].close();
        pair[1].close();
      }
    });
});
it("asks older tabs to refresh before sending expanded frames and accepts the advertised client capability", async () => {
  const { stub, players, credential, now } = await setup(undefined, false);
  await runInDurableObject(stub, async (instance, state) => {
    const old = new WebSocketPair(),
      current = new WebSocketPair();
    for (const [pair, capable] of [
      [old, false],
      [current, true],
    ] as const) {
      state.acceptWebSocket(pair[1], ["guest"]);
      pair[1].serializeAttachment({
        role: "guest",
        principalId: players[0],
        deliverySeq: 0,
        ...(capable ? { kartItems: 2 } : {}),
      });
      pair[0].accept();
    }
    const older: Record<string, unknown>[] = [],
      newer: Record<string, unknown>[] = [];
    old[0].addEventListener("message", (e) => {
      older.push(JSON.parse(String(e.data)));
    });
    current[0].addEventListener("message", (e) => {
      newer.push(JSON.parse(String(e.data)));
    });
    try {
      expect(
        (
          await instance.hostAction({
            ...credential,
            action: "kart-item-rules",
            itemRules: { version: 2, allowed: ["treat"] },
            requestId: crypto.randomUUID(),
            nowMs: now + 1,
          })
        ).ok,
      ).toBe(true);
      await expect
        .poll(() => older.find((message) => message.kind === "replaced"))
        .toMatchObject({ message: expect.stringContaining("Refresh") });
      expect(
        older.filter(
          (message) => message.kind === "snapshot" || message.kind === "kart",
        ),
      ).toEqual([]);
      await expect
        .poll(() =>
          newer.some(
            (message) =>
              message.kind === "snapshot" ||
              message.kind === "patch" ||
              message.kind === "kart",
          ),
        )
        .toBe(true);
    } finally {
      old[0].close();
      current[0].close();
      current[1].close();
    }
  });
});
it("freezes expanded rules before racing, persists receipts and keeps host inventory/history private", async () => {
  const { stub, players, credential, now } = await setup(undefined, false);
  const command = {
    ...credential,
    action: "kart-item-rules",
    itemRules: { version: 2, allowed: ["treat", "tennis", "shield"] },
    requestId: crypto.randomUUID(),
    nowMs: now + 1,
  };
  const first = await stub.hostAction(command);
  expect(first.ok).toBe(true);
  await evictDurableObject(stub);
  expect(await stub.hostAction(command)).toEqual(first);
  const host = await stub.snapshotFor("control");
  expect(host.kartItems?.current).toEqual(command.itemRules);
  expect(host.kartItems?.rulesHistory).toHaveLength(1);
  for (const audience of ["stage", "guest"] as const) {
    const view = await stub.snapshotFor(
      audience,
      audience === "guest" ? players[0] : undefined,
    );
    expect(view.kartItems).toBeUndefined();
    const presentation = view.play?.kart?.presentation;
    expect(presentation?.version).toBe(3);
    expect(JSON.stringify(presentation)).not.toMatch(
      /rulesHistory|hitPlayers|targetId|ownerId/,
    );
  }
  for (let n = 2; n <= 3; n++)
    expect(
      (
        await stub.advanceRound({
          ...credential,
          requestId: crypto.randomUUID(),
          nowMs: now + n,
        })
      ).ok,
    ).toBe(true);
  for (const paused of [false, true]) {
    if (paused)
      expect(
        (
          await stub.pauseRound({
            ...credential,
            requestId: crypto.randomUUID(),
            nowMs: now + 4,
          })
        ).ok,
      ).toBe(true);
    expect(
      (
        await stub.hostAction({
          ...command,
          requestId: crypto.randomUUID(),
          nowMs: now + 5,
        })
      ).ok,
    ).toBe(false);
  }
  expect(await stub.hostAction(command)).toEqual(first);
  expect((await stub.snapshotFor("control")).kartItems?.rulesHistory).toHaveLength(1);
  expect(
    (
      await stub.hostAction({
        ...command,
        secret: "wrong",
        requestId: crypto.randomUUID(),
      })
    ).ok,
  ).toBe(false);
});
for (const action of ["kart-items-off", "kart-items-on", "kart-items-clear"] as const)
  it(`${action} succeeds once, replays after eviction, refuses non-kart rounds and wrong authority`, async () => {
    const { stub, credential, now } = await setup();
    const command = {
      ...credential,
      action,
      requestId: crypto.randomUUID(),
      nowMs: now + 1,
    };
    expect(
      (
        await stub.hostAction({
          ...command,
          secret: "wrong",
          requestId: crypto.randomUUID(),
        })
      ).ok,
    ).toBe(false);
    const first = await stub.hostAction(command);
    expect(first.ok).toBe(true);
    await evictDurableObject(stub);
    expect(await stub.hostAction(command)).toEqual(first);
    const data = (await stub.snapshotFor("control")).kartItems!;
    expect(
      data.history.filter(
        (e) => e.kind === (action === "kart-items-clear" ? "clear" : "spawning"),
      ),
    ).toHaveLength(1);
    expect(data.spawning).toBe(action !== "kart-items-off");
    await runInDurableObject(stub, (_instance, state) => {
      const store = createSqlStore(state.storage.sql);
      store.writeRoom({ ...store.readRoom(), phase: "lobby" });
    });
    expect(
      (
        await stub.hostAction({
          ...command,
          requestId: crypto.randomUUID(),
          nowMs: now + 2,
        })
      ).ok,
    ).toBe(false);
  });
it("projects only each phone's own expanded inventory while preserving the legacy base fields", async () => {
  const { stub, players } = await setup(undefined, false);
  await runInDurableObject(stub, (_instance, state) => {
    const sql = state.storage.sql,
      q = questionFor(createSqlStore(sql).readRoom())!;
    const race = readKart(sql, q.id)!;
    race.itemRules = { version: 2, allowed: ["treat", "tennis"] };
    race.drivers[0]!.power = { ...createKartPowers(), item: "treat" };
    race.drivers[1]!.power = { ...createKartPowers(), item: "tennis" };
    writeRoundState(sql, q.id, "kart-race", race);
  });
  await evictDurableObject(stub);
  for (const [index, item] of ["treat", "tennis"].entries()) {
    const race = (await stub.snapshotFor("guest", players[index])).play!.kart!;
    expect(race.powers?.selfItem).toBeNull();
    expect(race.presentation?.version === 3 && race.presentation.items.heldItem).toBe(
      item,
    );
  }
  const stage = (await stub.snapshotFor("stage")).play!.kart!;
  expect(
    stage.presentation?.version === 3 && stage.presentation.items.heldItem,
  ).toBeNull();
  expect(
    (await stub.snapshotFor("control")).kartItems?.held.map((d) => d.item),
  ).toEqual(["treat", "tennis"]);
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

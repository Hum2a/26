import { env, evictDurableObject, runInDurableObject } from "cloudflare:test";
import { expect, it } from "vitest";
import { payloadDigest } from "../src/room/digest.ts";
import { withClientApiQuery } from "./client-api-key.ts";

async function setup() {
  const result = await env.ROOM_CODE_REGISTRY.getByName("codes").createLobby({
    requestId: crypto.randomUUID(),
    digest: await payloadDigest({ action: "create" }),
    now: new Date().toISOString(),
  });
  if (!result.ok) throw new Error(result.message);
  const created = result.result;
  return {
    created,
    stub: env.PARTY_ROOM.getByName(created.gameId),
    control: {
      credentialId: created.control.credentialId,
      secret: created.control.secret,
    },
  };
}

it("scales a real room to 100, replays after eviction and removes only bots", async () => {
  const { stub, control } = await setup();
  const guest = await stub.joinPlayer({
    nickname: "Bot 001",
    requestId: crypto.randomUUID(),
    now: new Date().toISOString(),
  });
  expect(guest.ok).toBe(true);
  const input = {
    ...control,
    action: "developer-bots",
    botCount: 10,
    requestId: crypto.randomUUID(),
    nowMs: Date.now(),
  };
  expect((await stub.hostAction({ ...input, secret: "wrong" })).ok).toBe(false);
  const accepted = await stub.hostAction(input);
  expect(accepted.ok).toBe(true);
  const first = await stub.snapshotFor("control");
  expect(first.developerTools?.bots).toHaveLength(10);
  expect(first.developerTools?.bots[0]?.nickname).toBe("Bot 002");
  await evictDurableObject(stub);
  expect(await stub.hostAction(input)).toEqual(accepted);
  expect((await stub.snapshotFor("control")).developerTools?.history).toHaveLength(1);
  expect((await stub.hostAction({ ...input, botCount: 11 })).ok).toBe(false);
  expect(
    (await stub.hostAction({ ...input, requestId: crypto.randomUUID(), botCount: 100 }))
      .ok,
  ).toBe(false);
  expect(
    (await stub.hostAction({ ...input, requestId: crypto.randomUUID(), botCount: 99 }))
      .ok,
  ).toBe(true);
  const full = await stub.snapshotFor("control");
  expect(full.players).toHaveLength(100);
  expect(full.developerTools?.bots.slice(0, 10)).toEqual(first.developerTools?.bots);
  for (const audience of ["stage", "guest"] as const) {
    const snapshot = await stub.snapshotFor(audience);
    expect(snapshot.players).toHaveLength(100);
    expect(snapshot.developerTools).toBeUndefined();
    expect(JSON.stringify(snapshot)).not.toContain('"history"');
    expect(JSON.stringify(snapshot)).not.toContain('"secret"');
  }
  const remove = { ...input, requestId: crypto.randomUUID(), botCount: 0 };
  const removed = await stub.hostAction(remove);
  expect(removed.ok).toBe(true);
  expect(await stub.hostAction(remove)).toEqual(removed);
  expect((await stub.snapshotFor("control")).players.map((p) => p.nickname)).toEqual([
    "Bot 001",
  ]);
});

it.each([-1, 101, 1.5, Number.NaN, undefined])(
  "refuses invalid bot target %s without changing the room",
  async (botCount) => {
    const { stub, control } = await setup();
    expect(
      (
        await stub.hostAction({
          ...control,
          action: "developer-bots",
          botCount,
          requestId: crypto.randomUUID(),
          nowMs: Date.now(),
        })
      ).ok,
    ).toBe(false);
    expect((await stub.snapshotFor("control")).players).toHaveLength(0);
  },
);

it("uses bot-only scoped WebSocket credentials, persists the answer before ack and revokes removed bots", async () => {
  const { stub, control, created } = await setup();
  expect(
    (
      await stub.hostAction({
        ...control,
        action: "developer-bots",
        botCount: 1,
        requestId: crypto.randomUUID(),
        nowMs: Date.now(),
      })
    ).ok,
  ).toBe(true);
  expect(
    (await stub.openBotSessions({ ...control, secret: "wrong", nowMs: Date.now() })).ok,
  ).toBe(false);
  const sessions = await stub.openBotSessions({ ...control, nowMs: Date.now() });
  if (!sessions.ok) throw new Error(sessions.message);
  const bot = sessions.sessions[0]!;
  const protocol = `26-bot.${bot.playerId}.${bot.secret}`;
  const request = (
    gameId = created.gameId,
    token = protocol,
    origin = "http://example.com",
  ) =>
    new Request(withClientApiQuery(`http://example.com/ws/${gameId}?role=guest`), {
      headers: {
        Upgrade: "websocket",
        Origin: origin,
        "sec-websocket-protocol": token,
      },
    });
  const other = await setup();
  for (const [response, status] of [
    [await other.stub.fetch(request(other.created.gameId)), 401],
    [await stub.fetch(request(created.gameId, protocol, "https://wrong.example")), 403],
    [
      await stub.fetch(
        request(created.gameId, `26-bot.${bot.playerId}.${"x".repeat(43)}`),
      ),
      401,
    ],
  ] as const) {
    expect(response.status).toBe(status);
    await response.text();
  }
  await stub.startDemo({
    ...control,
    requestId: crypto.randomUUID(),
    nowMs: Date.now(),
  });
  for (let n = 0; n < 3; n++) {
    if ((await stub.snapshotFor("stage")).phase === "collect") break;
    await stub.advanceRound({
      ...control,
      requestId: crypto.randomUUID(),
      nowMs: Date.now(),
    });
  }
  const response = await stub.fetch(request());
  expect(response.status).toBe(101);
  expect(response.headers.get("sec-websocket-protocol")).toBe(protocol);
  const socket = response.webSocket!;
  socket.accept();
  const requestId = crypto.randomUUID();
  const ack = new Promise<Record<string, unknown>>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("Missing bot answer acknowledgement")),
      5000,
    );
    socket.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data)) as Record<string, unknown>;
      if (message.kind === "ack" && message.requestId === requestId) {
        clearTimeout(timer);
        resolve(message);
      }
    });
  });
  socket.send(
    JSON.stringify({ kind: "command", name: "answer", requestId, optionId: "circle" }),
  );
  expect((await ack).accepted).toBe(true);
  expect((await stub.snapshotFor("guest", bot.playerId)).play?.selfAnswer).toEqual({
    kind: "choice",
    optionId: "circle",
  });
  const closed = new Promise<void>((resolve) =>
    socket.addEventListener("close", () => resolve(), { once: true }),
  );
  socket.close(1000, "Rehearsal finished");
  await closed;
  // Closing the last connection may hibernate the object before the test resumes.
  await stub.snapshotFor("control");
  await evictDurableObject(stub);
  expect((await stub.snapshotFor("guest", bot.playerId)).play?.selfAnswer).toEqual({
    kind: "choice",
    optionId: "circle",
  });
  const stored = await runInDurableObject(stub, (_instance, state) =>
    JSON.stringify(
      state.storage.sql
        .exec(`SELECT secret_hash FROM credential WHERE player_id = ?`, bot.playerId)
        .toArray(),
    ),
  );
  expect(stored).not.toContain(bot.secret);
  await stub.hostAction({
    ...control,
    action: "developer-bots",
    botCount: 0,
    requestId: crypto.randomUUID(),
    nowMs: Date.now(),
  });
  expect((await stub.fetch(request())).status).toBe(401);
});

it("refuses to add bots to the live birthday game but still removes them, and allows them in a rehearsal room", async () => {
  const { stub } = await setup();
  await runInDurableObject(stub, async (_instance, state) => {
    const { setBotCount, liveBirthdayGame } = await import("../src/developer/bots.ts");
    const { writeRoundState } = await import("../src/questions/round-state.ts");
    const sql = state.storage.sql;
    const now = Date.now();
    // An ordinary lobby takes bots for a rehearsal with the demo.
    expect(liveBirthdayGame(sql)).toBe(false);
    setBotCount(sql, 2, now);
    // Once the birthday script is frozen into the room, adding bots is refused.
    writeRoundState(sql, "__pack", "birthday-script", { order: [] });
    expect(liveBirthdayGame(sql)).toBe(true);
    expect(() => setBotCount(sql, 5, now + 1)).toThrow("live birthday game");
    // Removing bots that were already there still works.
    expect(() => setBotCount(sql, 0, now + 2)).not.toThrow();
    // A dedicated rehearsal room with the same script may use bots.
    sql.exec(`INSERT INTO developer_rehearsal (id, payload) VALUES (1, '{}')`);
    expect(liveBirthdayGame(sql)).toBe(false);
    expect(() => setBotCount(sql, 3, now + 3)).not.toThrow();
  });
});

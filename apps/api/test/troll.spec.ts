import { env, evictDurableObject } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { withClientApiQuery } from "./client-api-key.ts";
import { payloadDigest } from "../src/room/digest.ts";
import {
  trollLockedMessage,
  trollModifierMessage,
  trollSlotMessage,
  trollSpentMessage,
} from "../src/room/limits.ts";

describe("troll engine", () => {
  it("spends one token once, queues one slot, and refunds a troll that never starts", async () => {
    const created = await createRoom();
    const stub = room(created.gameId);
    await start(stub, created);
    const amina = await join(stub, "Amina");
    const bilal = await join(stub, "Bilal");
    const chen = await join(stub, "Chen");
    expect((await stub.snapshotFor("guest", amina.playerId)).trolls.token).toBe(
      "locked",
    );
    const early = await connect(stub, created.gameId, guestCookie(amina));
    await nextMatching(early, (message) => message.kind === "snapshot");
    expect(
      (await send(early, { name: "troll", effect: "crack", targetId: bilal.playerId }))
        .error,
    ).toBe(trollLockedMessage);
    early.close();

    await skipTo(stub, created, "colour");
    await reach(stub, created, "colour", "collect");
    const options = (await stub.snapshotFor("guest", bilal.playerId)).play?.question;
    const requestId = crypto.randomUUID();
    const socket = await connect(stub, created.gameId, guestCookie(amina));
    await nextMatching(socket, (message) => message.kind === "snapshot");
    expect(
      (
        await send(
          socket,
          { name: "troll", effect: "crack", targetId: bilal.playerId },
          requestId,
        )
      ).accepted,
    ).toBe(true);
    expect(
      (
        await send(
          socket,
          { name: "troll", effect: "crack", targetId: bilal.playerId },
          requestId,
        )
      ).accepted,
    ).toBe(true);
    expect(
      (await send(socket, { name: "troll", effect: "call", targetId: chen.playerId }))
        .error,
    ).toBe(trollSpentMessage);
    socket.close();
    expect((await stub.snapshotFor("guest", bilal.playerId)).play?.question).toEqual(
      options,
    );
    expect((await stub.snapshotFor("guest", amina.playerId)).trolls.token).toBe(
      "spent",
    );
    await evictDurableObject(stub);
    expect(
      (await stub.snapshotFor("guest", bilal.playerId)).trolls.active.some(
        (effect) => effect.kind === "crack",
      ),
    ).toBe(true);

    const chenSocket = await connect(stub, created.gameId, guestCookie(chen));
    await nextMatching(chenSocket, (message) => message.kind === "snapshot");
    expect(
      (
        await send(chenSocket, {
          name: "troll",
          effect: "call",
          targetId: bilal.playerId,
        })
      ).accepted,
    ).toBe(true);
    chenSocket.close();
    const dara = await join(stub, "Dara");
    const daraSocket = await connect(stub, created.gameId, guestCookie(dara));
    await nextMatching(daraSocket, (message) => message.kind === "snapshot");
    expect(
      (
        await send(daraSocket, {
          name: "troll",
          effect: "invasion",
          targetId: bilal.playerId,
        })
      ).error,
    ).toBe(trollSlotMessage);
    daraSocket.close();
    expect((await stub.snapshotFor("guest", dara.playerId)).trolls.token).toBe("ready");
    expect(
      (await stub.snapshotFor("guest", chen.playerId)).trolls.active.some(
        (effect) => effect.status === "queued",
      ),
    ).toBe(true);

    expect(
      (
        await stub.skipRound({
          ...control(created),
          requestId: crypto.randomUUID(),
          nowMs: Date.now(),
        })
      ).ok,
    ).toBe(true);
    expect((await stub.snapshotFor("guest", chen.playerId)).trolls.token).toBe("ready");
    expect((await stub.snapshotFor("guest", amina.playerId)).trolls.token).toBe(
      "spent",
    );
    await reach(stub, created, "candles", "collect");
    const again = await connect(stub, created.gameId, guestCookie(chen));
    await nextMatching(again, (message) => message.kind === "snapshot");
    expect(
      (await send(again, { name: "troll", effect: "crack", targetId: amina.playerId }))
        .accepted,
    ).toBe(true);
    expect(
      (await send(again, { name: "troll", effect: "crack", targetId: bilal.playerId }))
        .error,
    ).toBe(trollSpentMessage);
    again.close();
  });

  it("pauses an effect across a restart and keeps nickname ownership on the player", async () => {
    const created = await createRoom();
    const stub = room(created.gameId);
    await start(stub, created);
    const amina = await join(stub, "Amina");
    const bilal = await join(stub, "Bilal");
    await skipTo(stub, created, "colour");
    await reach(stub, created, "colour", "collect");
    const socket = await connect(stub, created.gameId, guestCookie(amina));
    await nextMatching(socket, (message) => message.kind === "snapshot");
    expect(
      (await send(socket, { name: "troll", effect: "swap", targetId: bilal.playerId }))
        .accepted,
    ).toBe(true);
    socket.close();
    const swapped = await stub.snapshotFor("guest", amina.playerId);
    expect(
      swapped.players.find((player) => player.playerId === amina.playerId)?.nickname,
    ).toBe("Bilal");
    expect(
      swapped.players.find((player) => player.playerId === bilal.playerId)?.nickname,
    ).toBe("Amina");
    expect(
      (
        await stub.hostAction({
          ...control(created),
          requestId: crypto.randomUUID(),
          nowMs: Date.now(),
          action: "rename",
          playerId: amina.playerId,
          nickname: "Nova",
        })
      ).ok,
    ).toBe(true);
    expect(
      (await stub.snapshotFor("stage")).players.find(
        (player) => player.playerId === bilal.playerId,
      )?.nickname,
    ).toBe("Nova");
    const effectId = (await stub.snapshotFor("control")).hostEffects?.[0]?.effectId;
    if (!effectId) {
      throw new Error("The swap was not listed for the host.");
    }
    expect(
      (
        await stub.hostAction({
          ...control(created),
          requestId: crypto.randomUUID(),
          nowMs: Date.now(),
          action: "cancel-effect",
          effectId,
        })
      ).ok,
    ).toBe(true);
    const restored = await stub.snapshotFor("stage");
    expect(
      restored.players.find((player) => player.playerId === amina.playerId)?.nickname,
    ).toBe("Nova");
    expect(
      restored.players.find((player) => player.playerId === bilal.playerId)?.nickname,
    ).toBe("Bilal");

    const crack = await connect(stub, created.gameId, guestCookie(bilal));
    await nextMatching(crack, (message) => message.kind === "snapshot");
    expect(
      (await send(crack, { name: "troll", effect: "crack", targetId: amina.playerId }))
        .accepted,
    ).toBe(true);
    crack.close();
    expect(
      (
        await stub.pauseRound({
          ...control(created),
          requestId: crypto.randomUUID(),
          nowMs: Date.now(),
        })
      ).ok,
    ).toBe(true);
    await evictDurableObject(stub);
    expect(
      (await stub.snapshotFor("guest", amina.playerId)).trolls.active[0]?.expiresAt,
    ).toBeNull();
    expect(
      (
        await stub.resumeRound({
          ...control(created),
          requestId: crypto.randomUUID(),
          nowMs: Date.now(),
        })
      ).ok,
    ).toBe(true);
    expect(
      (await stub.snapshotFor("guest", amina.playerId)).trolls.active[0]?.expiresAt,
    ).toEqual(expect.any(Number));
  });

  it("doubles an enabled question and withholds a speed bonus from a dodging button", async () => {
    const doubled = await createRoom();
    const doubledRoom = room(doubled.gameId);
    await start(doubledRoom, doubled);
    const amina = await join(doubledRoom, "Amina");
    const bilal = await join(doubledRoom, "Bilal");
    const chen = await join(doubledRoom, "Chen");
    await skipTo(doubledRoom, doubled, "colour");
    await reach(doubledRoom, doubled, "colour", "collect");
    const caster = await connect(doubledRoom, doubled.gameId, guestCookie(bilal));
    await nextMatching(caster, (message) => message.kind === "snapshot");
    expect(
      (
        await send(caster, {
          name: "troll",
          effect: "double",
          targetId: amina.playerId,
        })
      ).accepted,
    ).toBe(true);
    caster.close();
    await answer(doubledRoom, doubled.gameId, amina, "blue");
    await answer(doubledRoom, doubled.gameId, chen, "green");
    await reach(doubledRoom, doubled, "colour", "reveal");
    expect(
      (await doubledRoom.snapshotFor("guest", amina.playerId)).play?.selfAward,
    ).toBe(160);
    expect(
      (await doubledRoom.snapshotFor("guest", chen.playerId)).play?.selfAward,
    ).toBe(0);

    const speed = await createRoom();
    const speedRoom = room(speed.gameId);
    await start(speedRoom, speed);
    const fast = await join(speedRoom, "Amina");
    const slowed = await join(speedRoom, "Bilal");
    const plain = await join(speedRoom, "Chen");
    await skipTo(speedRoom, speed, "candles");
    await reach(speedRoom, speed, "candles", "collect");
    const denied = await connect(speedRoom, speed.gameId, guestCookie(fast));
    await nextMatching(denied, (message) => message.kind === "snapshot");
    expect(
      (
        await send(denied, {
          name: "troll",
          effect: "double",
          targetId: slowed.playerId,
        })
      ).error,
    ).toBe(trollModifierMessage);
    expect(
      (
        await send(denied, {
          name: "troll",
          effect: "yield",
          targetId: slowed.playerId,
        })
      ).accepted,
    ).toBe(true);
    denied.close();
    expect((await speedRoom.snapshotFor("guest", fast.playerId)).trolls.token).toBe(
      "spent",
    );
    const before = (await speedRoom.snapshotFor("guest", slowed.playerId)).play
      ?.question;
    await answer(speedRoom, speed.gameId, slowed, "twenty-six");
    await answer(speedRoom, speed.gameId, plain, "twenty-six");
    expect(
      (await speedRoom.snapshotFor("guest", slowed.playerId)).play?.question,
    ).toEqual(before);
    await reach(speedRoom, speed, "candles", "reveal");
    expect(
      (await speedRoom.snapshotFor("guest", slowed.playerId)).play?.selfAward,
    ).toBe(120);
    expect(
      (await speedRoom.snapshotFor("guest", plain.playerId)).play?.selfAward,
    ).toBeGreaterThan(120);
  });
});

async function answer(
  stub: ReturnType<typeof room>,
  gameId: string,
  player: { gameId: string; playerId: string; secret: string },
  optionId: string,
) {
  const socket = await connect(stub, gameId, guestCookie(player));
  await nextMatching(socket, (message) => message.kind === "snapshot");
  expect((await send(socket, { name: "answer", optionId })).accepted).toBe(true);
  socket.close();
}

async function start(
  stub: ReturnType<typeof room>,
  created: Awaited<ReturnType<typeof createRoom>>,
) {
  expect(
    (
      await stub.startDemo({
        ...control(created),
        requestId: crypto.randomUUID(),
        nowMs: Date.now(),
      })
    ).ok,
  ).toBe(true);
}

async function skipTo(
  stub: ReturnType<typeof room>,
  created: Awaited<ReturnType<typeof createRoom>>,
  questionId: string,
) {
  for (let step = 0; step < 8; step += 1) {
    const snapshot = await stub.snapshotFor("stage");
    if (snapshot.play?.question.id === questionId) {
      return;
    }
    const moved = await stub.skipRound({
      ...control(created),
      requestId: crypto.randomUUID(),
      nowMs: Date.now(),
    });
    if (!moved.ok) {
      throw new Error(moved.message);
    }
  }
  throw new Error(`The room did not skip to ${questionId}.`);
}

async function reach(
  stub: ReturnType<typeof room>,
  created: Awaited<ReturnType<typeof createRoom>>,
  questionId: string,
  phase: string,
) {
  for (let step = 0; step < 8; step += 1) {
    const snapshot = await stub.snapshotFor("stage");
    if (snapshot.play?.question.id === questionId && snapshot.phase === phase) {
      return;
    }
    const moved = await stub.advanceRound({
      ...control(created),
      requestId: crypto.randomUUID(),
      nowMs: Date.now(),
    });
    if (!moved.ok) {
      throw new Error(moved.message);
    }
  }
  throw new Error(`The room did not reach ${questionId} ${phase}.`);
}

async function send(
  socket: WebSocket,
  command:
    | { name: "troll"; effect: unknown; targetId: unknown }
    | { name: "answer"; optionId: string },
  requestId = crypto.randomUUID(),
) {
  socket.send(JSON.stringify({ kind: "command", requestId, ...command }));
  const message = await nextMatching(
    socket,
    (item) => item.kind === "ack" && item.requestId === requestId,
  );
  return message as { accepted?: boolean; error?: string };
}

async function join(stub: ReturnType<typeof room>, nickname: string) {
  const joined = await stub.joinPlayer({
    nickname,
    requestId: crypto.randomUUID(),
    now: new Date().toISOString(),
  });
  if (!joined.ok) {
    throw new Error(joined.message);
  }
  return joined;
}

async function createRoom() {
  const created = await env.ROOM_CODE_REGISTRY.getByName("codes").createLobby({
    requestId: crypto.randomUUID(),
    digest: await payloadDigest({ action: "create" }),
    now: new Date().toISOString(),
  });
  if (!created.ok) {
    throw new Error(created.message);
  }
  return created.result;
}

function room(gameId: string) {
  return env.PARTY_ROOM.get(env.PARTY_ROOM.idFromName(gameId));
}

function control(created: Awaited<ReturnType<typeof createRoom>>) {
  return {
    credentialId: created.control.credentialId,
    secret: created.control.secret,
  };
}

function guestCookie(joined: {
  gameId: string;
  playerId: string;
  secret: string;
}): string {
  return `26_guest=${joined.gameId}.${joined.playerId}.${joined.secret}`;
}

async function connect(
  stub: ReturnType<typeof room>,
  gameId: string,
  cookie: string,
): Promise<WebSocket> {
  const response = await stub.fetch(
    new Request(withClientApiQuery(`http://example.com/ws/${gameId}?role=guest`), {
      headers: {
        Upgrade: "websocket",
        Connection: "Upgrade",
        Origin: "http://example.com",
        Cookie: cookie,
      },
    }),
  );
  expect(response.status).toBe(101);
  const socket = response.webSocket;
  if (!socket) {
    throw new Error("The room did not return a socket.");
  }
  socket.accept();
  return socket;
}

function nextMatching(
  socket: WebSocket,
  predicate: (message: Record<string, unknown>) => boolean,
): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.removeEventListener("message", onMessage);
      reject(new Error("Timed out waiting for a socket message."));
    }, 5_000);
    function onMessage(event: MessageEvent) {
      const message = JSON.parse(String(event.data)) as Record<string, unknown>;
      if (!predicate(message)) {
        return;
      }
      clearTimeout(timer);
      socket.removeEventListener("message", onMessage);
      resolve(message);
    }
    socket.addEventListener("message", onMessage);
  });
}

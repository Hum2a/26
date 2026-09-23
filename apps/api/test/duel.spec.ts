import { env, evictDurableObject } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { withClientApiQuery } from "./client-api-key.ts";
import { payloadDigest } from "../src/room/digest.ts";
import {
  answerDuplicateMessage,
  answerPausedMessage,
  duelInvalidMessage,
  duelLateMessage,
  duelRoleMessage,
  predictionClosedMessage,
  predictionContestantMessage,
  predictionUnknownMessage,
} from "../src/room/limits.ts";

describe("simultaneous duels and a spectated finale", () => {
  it("keeps a frozen odd pairing and resolves a missing opponent", async () => {
    const created = await createRoom();
    const stub = room(created.gameId);
    await start(stub, created);
    const amina = await join(stub, "Amina");
    const bilal = await join(stub, "Bilal");
    const chen = await join(stub, "Chen");
    await skipTo(stub, created, "clash");

    const before = await roles(stub, [amina, bilal, chen]);
    expect(before.filter((entry) => entry.duel.role === "solo")).toHaveLength(1);
    expect(before.filter((entry) => entry.duel.role === "pair")).toHaveLength(2);
    const pair = before.filter((entry) => entry.duel.role === "pair");
    expect(pair[0]?.duel.opponentId).toBe(pair[1]?.playerId);
    expect(pair[1]?.duel.opponentId).toBe(pair[0]?.playerId);
    const used = new Set(
      before.flatMap((entry) =>
        [entry.playerId, entry.duel.opponentId].filter(Boolean),
      ),
    );
    expect(used.size).toBe(3);

    await evictDurableObject(stub);
    const restored = await roles(stub, [amina, bilal, chen]);
    expect(restored.map((entry) => entry.duel.opponentId)).toEqual(
      before.map((entry) => entry.duel.opponentId),
    );

    const players = [amina, bilal, chen];
    const opponent = pair[0];
    const named = pair[1];
    const opponentPlayer = players.find(
      (player) => player.playerId === opponent?.playerId,
    );
    const namedPlayer = players.find((player) => player.playerId === named?.playerId);
    if (!opponent || !named || !opponentPlayer || !namedPlayer) {
      throw new Error("The room did not freeze a pair.");
    }
    expect(
      (
        await stub.hostAction({
          ...control(created),
          requestId: crypto.randomUUID(),
          nowMs: Date.now(),
          action: "rename",
          playerId: namedPlayer.playerId,
          nickname: "Nova",
        })
      ).ok,
    ).toBe(true);
    const renamed = (await stub.snapshotFor("guest", opponentPlayer.playerId)).play
      ?.duel;
    expect(renamed?.opponentId).toBe(namedPlayer.playerId);
    expect(renamed?.opponent).toBe("Nova");

    await reach(stub, created, "clash", "collect");
    expect(
      (
        await stub.pauseRound({
          ...control(created),
          requestId: crypto.randomUUID(),
          nowMs: Date.now(),
        })
      ).ok,
    ).toBe(true);
    const paused = await connect(stub, created.gameId, guestCookie(opponentPlayer));
    await nextMatching(paused, (message) => message.kind === "snapshot");
    expect((await send(paused, { name: "duel", value: 26 })).error).toBe(
      answerPausedMessage,
    );
    paused.close();
    expect(
      (
        await stub.resumeRound({
          ...control(created),
          requestId: crypto.randomUUID(),
          nowMs: Date.now(),
        })
      ).ok,
    ).toBe(true);

    const playing = await connect(stub, created.gameId, guestCookie(opponentPlayer));
    await nextMatching(playing, (message) => message.kind === "snapshot");
    expect((await send(playing, { name: "duel", value: "26" })).error).toBe(
      duelInvalidMessage,
    );
    expect((await send(playing, { name: "duel", value: 26 })).accepted).toBe(true);
    expect((await send(playing, { name: "duel", value: 20 })).error).toBe(
      answerDuplicateMessage,
    );
    playing.close();
    await evictDurableObject(stub);
    const answered = await stub.snapshotFor("guest", opponentPlayer.playerId);
    expect(answered.play?.selfAnswer).toEqual({ kind: "duel", value: 26 });
    expect(answered.play?.selfAward).toBeNull();

    const late = await join(stub, "Dara");
    const lateSocket = await connect(stub, created.gameId, guestCookie(late));
    await nextMatching(lateSocket, (message) => message.kind === "snapshot");
    expect((await stub.snapshotFor("guest", late.playerId)).play?.duel?.role).toBe(
      "late",
    );
    expect((await send(lateSocket, { name: "duel", value: 26 })).error).toBe(
      duelLateMessage,
    );
    lateSocket.close();

    await reach(stub, created, "clash", "reveal");
    expect(
      (await stub.snapshotFor("guest", opponentPlayer.playerId)).play?.selfAward,
    ).toBe(50);
    expect(
      (await stub.snapshotFor("guest", namedPlayer.playerId)).play?.selfAward,
    ).toBe(0);
    const scored = await stub.scoreRecord();
    expect(
      (
        await stub.hostAction({
          ...control(created),
          requestId: crypto.randomUUID(),
          nowMs: Date.now(),
          action: "rereveal",
        })
      ).ok,
    ).toBe(true);
    expect(await stub.scoreRecord()).toEqual(scored);
    await evictDurableObject(stub);
    expect(await stub.scoreRecord()).toEqual(scored);
    expect(
      (await stub.snapshotFor("stage")).play?.standings?.find(
        (row) => row.nickname === "Nova",
      )?.points,
    ).toBe(0);
  });

  it("shares the question points when both answers are equally close", async () => {
    const created = await createRoom();
    const stub = room(created.gameId);
    await start(stub, created);
    const amina = await join(stub, "Amina");
    const bilal = await join(stub, "Bilal");
    await skipTo(stub, created, "clash");
    const views = await roles(stub, [amina, bilal]);
    expect(views.every((entry) => entry.duel.role === "pair")).toBe(true);
    await reach(stub, created, "clash", "collect");
    for (const player of [amina, bilal]) {
      const socket = await connect(stub, created.gameId, guestCookie(player));
      await nextMatching(socket, (message) => message.kind === "snapshot");
      expect((await send(socket, { name: "duel", value: 26 })).accepted).toBe(true);
      socket.close();
    }
    await reach(stub, created, "clash", "reveal");
    const reveal = (await stub.snapshotFor("stage")).play?.reveal;
    expect(reveal?.kind).toBe("duel");
    if (reveal?.kind === "duel") {
      expect(reveal.pairs[0]?.result).toBe("tie");
    }
    expect((await stub.snapshotFor("guest", amina.playerId)).play?.selfAward).toBe(50);
    expect((await stub.snapshotFor("guest", bilal.playerId)).play?.selfAward).toBe(50);
  });

  it("freezes finale predictions before the contestants play", async () => {
    const created = await createRoom();
    const stub = room(created.gameId);
    await start(stub, created);
    const amina = await join(stub, "Amina");
    const bilal = await join(stub, "Bilal");
    const chen = await join(stub, "Chen");
    await skipTo(stub, created, "clash");
    await skipTo(stub, created, "finale");
    await reach(stub, created, "finale", "predict");
    const predicting = await stub.snapshotFor("stage");
    expect(predicting.play?.reveal).toBeNull();
    expect(JSON.stringify(predicting.play?.duel)).not.toContain("leftValue");
    const chenView = (await stub.snapshotFor("guest", chen.playerId)).play?.duel;
    expect(chenView?.role).toBe("spectator");
    expect(chenView?.cards.map((card) => card.label).sort()).toEqual([
      "Amina",
      "Bilal",
    ]);

    const socket = await connect(stub, created.gameId, guestCookie(chen));
    await nextMatching(socket, (message) => message.kind === "snapshot");
    expect(
      (await send(socket, { name: "ballot", candidateId: crypto.randomUUID() })).error,
    ).toBe(predictionUnknownMessage);
    const contestant = await connect(stub, created.gameId, guestCookie(amina));
    await nextMatching(contestant, (message) => message.kind === "snapshot");
    expect(
      (await send(contestant, { name: "ballot", candidateId: bilal.playerId })).error,
    ).toBe(predictionContestantMessage);
    contestant.close();
    expect(
      (await send(socket, { name: "ballot", candidateId: amina.playerId })).accepted,
    ).toBe(true);
    socket.close();

    await reach(stub, created, "finale", "collect");
    const closed = await connect(stub, created.gameId, guestCookie(chen));
    await nextMatching(closed, (message) => message.kind === "snapshot");
    expect(
      (await send(closed, { name: "ballot", candidateId: bilal.playerId })).error,
    ).toBe(predictionClosedMessage);
    expect((await send(closed, { name: "duel", value: 26 })).error).toBe(
      duelRoleMessage,
    );
    closed.close();

    const aminaSocket = await connect(stub, created.gameId, guestCookie(amina));
    await nextMatching(aminaSocket, (message) => message.kind === "snapshot");
    expect((await send(aminaSocket, { name: "duel", value: 26 })).accepted).toBe(true);
    aminaSocket.close();
    const bilalSocket = await connect(stub, created.gameId, guestCookie(bilal));
    await nextMatching(bilalSocket, (message) => message.kind === "snapshot");
    expect((await send(bilalSocket, { name: "duel", value: 0 })).accepted).toBe(true);
    bilalSocket.close();

    await reach(stub, created, "finale", "reveal");
    expect((await stub.snapshotFor("guest", amina.playerId)).play?.selfAward).toBe(70);
    expect((await stub.snapshotFor("guest", bilal.playerId)).play?.selfAward).toBe(0);
    expect((await stub.snapshotFor("guest", chen.playerId)).play?.selfAward).toBe(30);
    const reveal = (await stub.snapshotFor("stage")).play?.reveal;
    expect(reveal?.kind).toBe("finale");
    if (reveal?.kind === "finale") {
      expect(reveal.backers).toEqual([{ nickname: "Chen", contestant: "Amina" }]);
    }
    const scored = await stub.scoreRecord();
    expect(
      (
        await stub.hostAction({
          ...control(created),
          requestId: crypto.randomUUID(),
          nowMs: Date.now(),
          action: "rereveal",
        })
      ).ok,
    ).toBe(true);
    expect(await stub.scoreRecord()).toEqual(scored);
  });

  it("skips a tied-only finale for a unique leader and after finish is requested", async () => {
    const unique = await createRoom();
    const uniqueRoom = room(unique.gameId);
    await start(uniqueRoom, unique);
    const leader = await join(uniqueRoom, "Amina");
    await join(uniqueRoom, "Bilal");
    expect(
      (
        await uniqueRoom.hostAction({
          ...control(unique),
          requestId: crypto.randomUUID(),
          nowMs: Date.now(),
          action: "adjust",
          playerId: leader.playerId,
          points: 5,
          reason: "Desk fix for the round",
        })
      ).ok,
    ).toBe(true);
    await skipTo(uniqueRoom, unique, "clash");
    expect(
      (
        await uniqueRoom.skipRound({
          ...control(unique),
          requestId: crypto.randomUUID(),
          nowMs: Date.now(),
        })
      ).ok,
    ).toBe(true);
    const skipped = await uniqueRoom.snapshotFor("stage");
    expect(skipped.phase).toBe("final");
    expect(skipped.play?.question.id).toBe("clash");

    const finishing = await createRoom();
    const finishingRoom = room(finishing.gameId);
    await start(finishingRoom, finishing);
    await join(finishingRoom, "Amina");
    await join(finishingRoom, "Bilal");
    await skipTo(finishingRoom, finishing, "clash");
    expect(
      (
        await finishingRoom.finishRound({
          ...control(finishing),
          requestId: crypto.randomUUID(),
          nowMs: Date.now(),
        })
      ).ok,
    ).toBe(true);
    expect(
      (
        await finishingRoom.skipRound({
          ...control(finishing),
          requestId: crypto.randomUUID(),
          nowMs: Date.now(),
        })
      ).ok,
    ).toBe(true);
    const ended = await finishingRoom.snapshotFor("stage");
    expect(ended.phase).toBe("final");
    expect(ended.play?.question.id).toBe("clash");
  });

  it("does not invent a finale contestant who never joined", async () => {
    const created = await createRoom();
    const stub = room(created.gameId);
    await start(stub, created);
    const amina = await join(stub, "Amina");
    const chen = await join(stub, "Chen");
    await skipTo(stub, created, "clash");
    await skipTo(stub, created, "finale");
    expect((await stub.snapshotFor("guest", amina.playerId)).play?.duel?.role).toBe(
      "solo",
    );
    const spectator = (await stub.snapshotFor("guest", chen.playerId)).play?.duel;
    expect(spectator?.role).toBe("spectator");
    expect(spectator?.cards.map((card) => card.label)).toEqual(["Amina"]);
  });
});

async function roles(stub: ReturnType<typeof room>, players: { playerId: string }[]) {
  const views = [];
  for (const player of players) {
    const duel = (await stub.snapshotFor("guest", player.playerId)).play?.duel;
    if (!duel) {
      throw new Error("The duel state was missing.");
    }
    views.push({ playerId: player.playerId, duel });
  }
  return views;
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
  for (let step = 0; step < 12; step += 1) {
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
  for (let step = 0; step < 12; step += 1) {
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
  command: { name: "duel"; value: unknown } | { name: "ballot"; candidateId: unknown },
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

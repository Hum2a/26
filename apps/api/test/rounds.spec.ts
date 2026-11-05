import { env, evictDurableObject } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { withClientApiQuery } from "./client-api-key.ts";
import { payloadDigest } from "../src/room/digest.ts";
import {
  answerDuplicateMessage,
  answerPausedMessage,
  estimateClosedMessage,
  estimateInvalidMessage,
  estimateStepMessage,
  rankClosedMessage,
  rankDuplicateMessage,
  rankMissingMessage,
  rankUnknownMessage,
} from "../src/room/limits.ts";

describe("slider and ranking rounds", () => {
  it("plays choice, slider, and ranking in one game without rescoring", async () => {
    const created = await createRoom();
    const stub = room(created.gameId);
    const started = await stub.startDemo({
      ...control(created),
      requestId: crypto.randomUUID(),
      nowMs: Date.now(),
    });
    expect(started.ok && started.phase).toBe("intro");
    const joined = await stub.joinPlayer({
      nickname: "Amina",
      requestId: crypto.randomUUID(),
      now: new Date().toISOString(),
    });
    if (!joined.ok) {
      throw new Error(joined.message);
    }
    await reach(stub, created, "shape", "collect");
    const socket = await connect(stub, created.gameId, guestCookie(joined));
    await nextMatching(socket, (message) => message.kind === "snapshot");
    await send(socket, { name: "answer", optionId: "circle" });
    socket.close();
    await reach(stub, created, "shape", "reveal");
    expect((await stub.snapshotFor("guest", joined.playerId)).play?.reveal).toEqual({
      kind: "choice",
      correctOptionId: "circle",
    });

    await reach(stub, created, "letters", "collect");
    const open = await stub.snapshotFor("guest", joined.playerId);
    expect(open.play?.question).toMatchObject({
      kind: "slider",
      initial: 10,
      minimum: 0,
      maximum: 20,
      step: 1,
    });
    expect(open.play?.selfAnswer).toBeNull();
    expect(open.play?.selfAward).toBeNull();
    expect(JSON.stringify(open)).not.toContain("truth");
    expect(JSON.stringify(open)).not.toContain("bands");

    const guessing = await connect(stub, created.gameId, guestCookie(joined));
    await nextMatching(guessing, (message) => message.kind === "snapshot");
    for (const value of ["8", null, 21, -1]) {
      const rejected = await send(guessing, { name: "estimate", value });
      expect(rejected.accepted).toBe(false);
      expect(rejected.error).toBe(estimateInvalidMessage);
    }
    const offStep = await send(guessing, { name: "estimate", value: 8.5 });
    expect(offStep.accepted).toBe(false);
    expect(offStep.error).toBe(estimateStepMessage);
    const wrongRound = await send(guessing, {
      name: "rank",
      placements: [{ itemId: "friends", tierId: "first" }],
    });
    expect(wrongRound.error).toBe(rankClosedMessage);

    const paused = await stub.pauseRound({
      ...control(created),
      requestId: crypto.randomUUID(),
      nowMs: Date.now(),
    });
    expect(paused.ok).toBe(true);
    const whilePaused = await send(guessing, { name: "estimate", value: 8 });
    expect(whilePaused.error).toBe(answerPausedMessage);
    const resumed = await stub.resumeRound({
      ...control(created),
      requestId: crypto.randomUUID(),
      nowMs: Date.now(),
    });
    expect(resumed.ok).toBe(true);

    const requestId = crypto.randomUUID();
    const accepted = await send(guessing, { name: "estimate", value: 8 }, requestId);
    expect(accepted.accepted).toBe(true);
    const replay = await send(guessing, { name: "estimate", value: 8 }, requestId);
    expect(replay.accepted).toBe(true);
    const duplicate = await send(guessing, { name: "estimate", value: 9 });
    expect(duplicate.error).toBe(answerDuplicateMessage);
    expect((await stub.snapshotFor("stage")).play?.submissionCount).toBe(1);
    guessing.close();

    await evictDurableObject(stub);
    const restored = await stub.snapshotFor("guest", joined.playerId);
    expect(restored.phase).toBe("collect");
    expect(restored.play?.selfAnswer).toEqual({ kind: "slider", value: 8 });
    expect(restored.play?.selfAward).toBeNull();
    expect((await stub.scoreRecord()).rows).toBe(3);

    await reach(stub, created, "letters", "reveal");
    const revealed = await stub.snapshotFor("guest", joined.playerId);
    expect(revealed.play?.reveal).toMatchObject({
      kind: "slider",
      truth: 8,
      unit: "letters",
    });
    expect(revealed.play?.selfAward).toBe(100);
    const stage = await stub.snapshotFor("stage");
    expect(stage.play?.reveal).toMatchObject({
      kind: "slider",
      guesses: [{ nickname: "Amina", value: 8, points: 100 }],
    });
    expect(stage.play?.hostResponses).toBeUndefined();
    const host = await stub.snapshotFor("control");
    expect(host.play?.hostResponses?.[0]?.summary).toBe("8 letters");
    const scored = await stub.scoreRecord();
    const again = await stub.rescoreCurrent();
    expect(again).toEqual(scored);
    expect(again.rows).toBe(4);
    await evictDurableObject(stub);
    expect((await stub.snapshotFor("guest", joined.playerId)).play?.selfAward).toBe(
      100,
    );

    await reach(stub, created, "lineup", "collect");
    const rankingOpen = await stub.snapshotFor("guest", joined.playerId);
    expect(rankingOpen.play?.selfAnswer).toBeNull();
    expect(rankingOpen.play?.question).toMatchObject({
      kind: "rank",
      items: [{ id: "cake" }, { id: "candles" }, { id: "song" }, { id: "friends" }],
    });
    expect(JSON.stringify(rankingOpen)).not.toContain("itemIds");
    const ranking = await connect(stub, created.gameId, guestCookie(joined));
    await nextMatching(ranking, (message) => message.kind === "snapshot");
    expect((await send(ranking, { name: "estimate", value: 8 })).error).toBe(
      estimateClosedMessage,
    );
    expect((await send(ranking, { name: "rank", placements: "nope" })).error).toBe(
      rankUnknownMessage,
    );
    expect(
      (
        await send(ranking, {
          name: "rank",
          placements: [
            { itemId: "friends", tierId: "first" },
            { itemId: "friends", tierId: "second" },
            { itemId: "song", tierId: "third" },
            { itemId: "candles", tierId: "fourth" },
          ],
        })
      ).error,
    ).toBe(rankDuplicateMessage);
    expect(
      (await send(ranking, { name: "rank", placements: partyOrder().slice(0, 3) }))
        .error,
    ).toBe(rankMissingMessage);
    const placed = await send(ranking, { name: "rank", placements: partyOrder() });
    expect(placed.accepted).toBe(true);
    ranking.close();

    await evictDurableObject(stub);
    expect((await stub.snapshotFor("guest", joined.playerId)).play?.selfAnswer).toEqual(
      {
        kind: "rank",
        placements: partyOrder(),
      },
    );
    await reach(stub, created, "lineup", "reveal");
    const ranked = await stub.snapshotFor("guest", joined.playerId);
    expect(ranked.play?.selfAward).toBe(80);
    const order = ranked.play?.reveal?.kind === "rank" ? ranked.play.reveal.order : [];
    expect(order[0]?.itemIds).toEqual(["friends"]);
    const finalScore = await stub.scoreRecord();
    expect(finalScore.rows).toBe(5);
    expect(ranked.play?.selfStanding?.points ?? 0).toBeGreaterThanOrEqual(280);
    const repeated = await stub.rescoreCurrent();
    expect(repeated).toEqual(finalScore);
    await evictDurableObject(stub);
    expect((await stub.snapshotFor("guest", joined.playerId)).play?.selfAward).toBe(80);
    expect((await stub.scoreRecord()).total).toBe(finalScore.total);
  });

  it("writes no ledger row when a slider is skipped before the reveal", async () => {
    const created = await createRoom();
    const stub = room(created.gameId);
    await stub.startDemo({
      ...control(created),
      requestId: crypto.randomUUID(),
      nowMs: Date.now(),
    });
    const joined = await stub.joinPlayer({
      nickname: "Amina",
      requestId: crypto.randomUUID(),
      now: new Date().toISOString(),
    });
    if (!joined.ok) {
      throw new Error(joined.message);
    }
    for (let step = 0; step < 3; step += 1) {
      const skipped = await stub.skipRound({
        ...control(created),
        requestId: crypto.randomUUID(),
        nowMs: Date.now(),
      });
      expect(skipped.ok).toBe(true);
    }
    await reach(stub, created, "letters", "collect");
    const socket = await connect(stub, created.gameId, guestCookie(joined));
    await nextMatching(socket, (message) => message.kind === "snapshot");
    expect((await send(socket, { name: "estimate", value: 8 })).accepted).toBe(true);
    socket.close();
    expect((await stub.scoreRecord()).rows).toBe(0);
    const skipped = await stub.skipRound({
      ...control(created),
      requestId: crypto.randomUUID(),
      nowMs: Date.now(),
    });
    expect(skipped.ok).toBe(true);
    const after = await stub.snapshotFor("stage");
    expect(after.play?.question.id).toBe("lineup");
    expect((await stub.scoreRecord()).rows).toBe(0);
  });
});

it("previews the next round for the live desk only", async () => {
  const created = await createRoom();
  const stub = room(created.gameId);
  await stub.startDemo({
    ...control(created),
    requestId: crypto.randomUUID(),
    nowMs: Date.now(),
  });
  const joined = await stub.joinPlayer({
    nickname: "Amina",
    requestId: crypto.randomUUID(),
    now: new Date().toISOString(),
  });
  if (!joined.ok) throw new Error(joined.message);
  const host = await stub.snapshotFor("control");
  expect(host.nextQuestion?.title).toBeTruthy();
  expect(host.nextQuestion?.title).not.toBe(host.play?.question.prompt);
  expect((await stub.snapshotFor("stage")).nextQuestion).toBeUndefined();
  expect(
    (await stub.snapshotFor("guest", joined.playerId)).nextQuestion,
  ).toBeUndefined();
});

function partyOrder() {
  return [
    { itemId: "friends", tierId: "first" },
    { itemId: "cake", tierId: "second" },
    { itemId: "song", tierId: "third" },
    { itemId: "candles", tierId: "fourth" },
  ];
}

async function reach(
  stub: ReturnType<typeof room>,
  created: Awaited<ReturnType<typeof createRoom>>,
  questionId: string,
  phase: string,
) {
  for (let step = 0; step < 40; step += 1) {
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
    | { name: "answer"; optionId: string }
    | { name: "estimate"; value: unknown }
    | { name: "rank"; placements: unknown },
  requestId = crypto.randomUUID(),
) {
  socket.send(JSON.stringify({ kind: "command", requestId, ...command }));
  return nextMatching(
    socket,
    (message) => message.kind === "ack" && message.requestId === requestId,
  );
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

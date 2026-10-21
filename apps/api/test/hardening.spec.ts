import {
  env,
  evictDurableObject,
  runDurableObjectAlarm,
  runInDurableObject,
} from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { apiFetch } from "./api-fetch.ts";
import { withClientApiQuery } from "./client-api-key.ts";
import { payloadDigest } from "../src/room/digest.ts";
import {
  answerClosedMessage,
  answerDuplicateMessage,
  digestMismatchMessage,
  transferUsedMessage,
} from "../src/room/limits.ts";

describe("failure and access hardening", () => {
  it("replays a lost answer after a restart and rejects a changed payload", async () => {
    const created = await createRoom();
    const stub = room(created.gameId);
    await start(stub, created);
    await reach(stub, created, "shape", "collect");
    const amina = await join(stub, "Amina");
    const socket = await connect(stub, created.gameId, guestCookie(amina), "guest");
    await nextMatching(socket, (message) => message.kind === "snapshot");
    const before = await stub.snapshotFor("guest", amina.playerId);
    expect(JSON.stringify(before)).not.toContain("correctOptionId");

    const requestId = crypto.randomUUID();
    const ballotId = crypto.randomUUID();
    const answerAck = nextMatching(
      socket,
      (message) => message.kind === "ack" && message.requestId === requestId,
    );
    const ballotAck = nextMatching(
      socket,
      (message) => message.kind === "ack" && message.requestId === ballotId,
    );
    socket.send(
      JSON.stringify({
        kind: "command",
        name: "answer",
        requestId,
        optionId: "circle",
        playerId: "someone-else",
        phase: "lobby",
      }),
    );
    socket.send(
      JSON.stringify({
        kind: "command",
        name: "ballot",
        requestId: ballotId,
        candidateId: "circle",
      }),
    );
    expect((await answerAck).accepted).toBe(true);
    expect((await ballotAck).accepted).toBe(false);
    socket.close();

    await evictDurableObject(stub);
    const restored = await connect(stub, created.gameId, guestCookie(amina), "guest");
    await nextMatching(restored, (message) => message.kind === "snapshot");
    const replay = await send(
      restored,
      { name: "answer", optionId: "circle", phase: "collect" },
      requestId,
    );
    expect(replay.accepted).toBe(true);
    const changed = await send(
      restored,
      { name: "answer", optionId: "star" },
      requestId,
    );
    expect(changed).toMatchObject({ accepted: false, error: digestMismatchMessage });
    restored.close();

    const rows = await count(stub, `SELECT COUNT(*) AS total FROM choice_answer`);
    expect(rows).toBe(1);
    expect((await stub.snapshotFor("guest", amina.playerId)).play?.selfAnswer).toEqual({
      kind: "choice",
      optionId: "circle",
    });

    await reach(stub, created, "shape", "reveal");
    const lateId = crypto.randomUUID();
    const lateSocket = await connect(stub, created.gameId, guestCookie(amina), "guest");
    await nextMatching(lateSocket, (message) => message.kind === "snapshot");
    const late = await send(
      lateSocket,
      { name: "answer", optionId: "star", phase: "collect" },
      lateId,
    );
    expect(late.accepted).toBe(false);
    expect([answerClosedMessage, answerDuplicateMessage]).toContain(late.error);
    lateSocket.close();
    expect(await count(stub, `SELECT COUNT(*) AS total FROM choice_answer`)).toBe(1);
  });

  it("keeps one score adjustment and one finish flag across a restart", async () => {
    const created = await createRoom();
    const stub = room(created.gameId);
    const amina = await join(stub, "Amina");
    const requestId = crypto.randomUUID();
    const adjusted = await stub.hostAction({
      ...control(created),
      requestId,
      nowMs: Date.now(),
      action: "adjust",
      playerId: amina.playerId,
      points: 15,
      reason: "Host correction",
    });
    expect(adjusted.ok).toBe(true);
    await evictDurableObject(stub);
    const replay = await stub.hostAction({
      ...control(created),
      requestId,
      nowMs: Date.now(),
      action: "adjust",
      playerId: amina.playerId,
      points: 15,
      reason: "Host correction",
    });
    expect(replay).toEqual(adjusted);
    const altered = await stub.hostAction({
      ...control(created),
      requestId,
      nowMs: Date.now(),
      action: "adjust",
      playerId: amina.playerId,
      points: 40,
      reason: "A different correction",
    });
    expect(altered).toMatchObject({ ok: false, error: "digest_mismatch" });
    expect(await count(stub, `SELECT COUNT(*) AS total FROM score_adjustment`)).toBe(1);

    await start(stub, created);
    const finishId = crypto.randomUUID();
    const finished = await stub.finishRound({
      ...control(created),
      requestId: finishId,
      nowMs: Date.now(),
    });
    expect(finished.ok).toBe(true);
    await evictDurableObject(stub);
    expect(
      await stub.finishRound({
        ...control(created),
        requestId: finishId,
        nowMs: Date.now(),
      }),
    ).toEqual(finished);
    expect(await count(stub, `SELECT finish_after AS total FROM room`)).toBe(1);
  });

  it("keeps one guess ballot across a restart", async () => {
    const created = await createRoom();
    const stub = room(created.gameId);
    await start(stub, created);
    const amina = await join(stub, "Amina");
    const bilal = await join(stub, "Bilal");
    await reach(stub, created, "who", "collect");
    const socket = await connect(stub, created.gameId, guestCookie(amina), "guest");
    await nextMatching(socket, (message) => message.kind === "snapshot");
    const requestId = crypto.randomUUID();
    expect(
      (await send(socket, { name: "ballot", candidateId: bilal.playerId }, requestId))
        .accepted,
    ).toBe(true);
    socket.close();
    await evictDurableObject(stub);
    const restored = await connect(stub, created.gameId, guestCookie(amina), "guest");
    await nextMatching(restored, (message) => message.kind === "snapshot");
    expect(
      (await send(restored, { name: "ballot", candidateId: bilal.playerId }, requestId))
        .accepted,
    ).toBe(true);
    expect(
      (
        await send(
          restored,
          {
            name: "ballot",
            candidateId: amina.playerId,
          },
          requestId,
        )
      ).error,
    ).toBe(digestMismatchMessage);
    restored.close();
    expect(await count(stub, `SELECT COUNT(*) AS total FROM vote_ballot`)).toBe(1);
  });

  it("does not let a paused or idle alarm skip ahead, and races one advance", async () => {
    const idle = await createRoom();
    const idleRoom = room(idle.gameId);
    const armed = await runInDurableObject(idleRoom, async (_instance, state) =>
      state.storage.getAlarm(),
    );
    expect(armed).not.toBeNull();
    expect(await runDurableObjectAlarm(idleRoom)).toBe(true);
    expect((await idleRoom.snapshotFor("stage")).phase).toBe("lobby");

    const created = await createRoom();
    const stub = room(created.gameId);
    const nowMs = Date.now();
    await stub.startFixture({
      ...control(created),
      requestId: crypto.randomUUID(),
      nowMs,
      durations: { intro: 60_000, prompt: 90_000, collect: 60_000 },
    });
    expect(
      (
        await stub.pauseRound({
          ...control(created),
          requestId: crypto.randomUUID(),
          nowMs,
        })
      ).ok,
    ).toBe(true);
    await makeDue(stub);
    await runDurableObjectAlarm(stub);
    const paused = await stub.snapshotFor("stage");
    expect(paused.phase).toBe("intro");
    expect(paused.paused).toBe(true);

    const raced = await createRoom();
    const raceRoom = room(raced.gameId);
    await raceRoom.startFixture({
      ...control(raced),
      requestId: crypto.randomUUID(),
      nowMs: Date.now(),
      durations: { intro: 60_000, prompt: 90_000 },
    });
    await makeDue(raceRoom);
    await Promise.all([
      raceRoom.advanceRound({
        ...control(raced),
        requestId: crypto.randomUUID(),
        nowMs: Date.now(),
      }),
      runDurableObjectAlarm(raceRoom),
    ]);
    expect((await raceRoom.snapshotFor("stage")).phase).toBe("prompt");
  });

  it("rejects a foreign origin, a guest control attempt, and a reused transfer", async () => {
    const created = await createRoom();
    const other = await createRoom();
    const amina = await join(room(created.gameId), "Amina");
    const foreign = await room(created.gameId).fetch(
      new Request(
        withClientApiQuery(`http://example.com/ws/${created.gameId}?role=guest`),
        {
          headers: {
            Upgrade: "websocket",
            Origin: "https://evil.example",
            Cookie: guestCookie(amina),
          },
        },
      ),
    );
    expect(foreign.status).toBe(403);

    const crossSite = await room(created.gameId).fetch(
      new Request(
        withClientApiQuery(`http://example.com/ws/${created.gameId}?role=guest`),
        {
          headers: {
            Upgrade: "websocket",
            Origin: "http://example.com",
            "sec-fetch-site": "cross-site",
            Cookie: guestCookie(amina),
          },
        },
      ),
    );
    expect(crossSite.status).toBe(403);

    const escalated = await room(created.gameId).fetch(
      new Request(
        withClientApiQuery(`http://example.com/ws/${created.gameId}?role=control`),
        {
          headers: {
            Upgrade: "websocket",
            Origin: "http://example.com",
            Cookie: guestCookie(amina),
          },
        },
      ),
    );
    expect(escalated.status).toBe(401);

    const stage = await room(created.gameId).fetch(
      new Request(
        withClientApiQuery(`http://example.com/ws/${created.gameId}?role=stage`),
        {
          headers: {
            Upgrade: "websocket",
            Origin: "http://example.com",
            Cookie: `26_room_presentation=${created.presentation.credentialId}.${created.presentation.secret}`,
          },
        },
      ),
    );
    expect(stage.status).toBe(101);
    const stageSocket = stage.webSocket;
    stageSocket?.accept();
    if (!stageSocket) {
      throw new Error("The stage socket is missing.");
    }
    const refused = await send(stageSocket, { name: "answer", optionId: "circle" });
    expect(refused).toMatchObject({ accepted: false });
    stageSocket.close();

    const crossed = await room(other.gameId).advanceRound({
      ...control(created),
      requestId: crypto.randomUUID(),
      nowMs: Date.now(),
    });
    expect(crossed.ok).toBe(false);

    const missingOrigin = await apiFetch("http://example.com/api/rooms/join", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        code: created.joinCode,
        nickname: "Bilal",
        requestId: crypto.randomUUID(),
      }),
    });
    expect(missingOrigin.status).toBe(403);

    const issued = await room(created.gameId).issueTransfer({
      playerId: amina.playerId,
      requestId: crypto.randomUUID(),
      now: new Date().toISOString(),
    });
    if (!issued.ok) {
      throw new Error(issued.message);
    }
    const redeemed = await room(created.gameId).redeemTransfer({
      code: issued.code,
      requestId: crypto.randomUUID(),
      now: new Date().toISOString(),
    });
    expect(redeemed.ok).toBe(true);
    expect(
      await room(created.gameId).redeemTransfer({
        code: issued.code,
        requestId: crypto.randomUUID(),
        now: new Date().toISOString(),
      }),
    ).toMatchObject({ ok: false, message: transferUsedMessage });
    const oldSocket = await room(created.gameId).fetch(
      socketRequest(created.gameId, guestCookie(amina), "guest"),
    );
    expect(oldSocket.status).toBe(401);
  });

  it("accepts a broken device report without changing who the player is", async () => {
    const created = await createRoom();
    const stub = room(created.gameId);
    await start(stub, created);
    await reach(stub, created, "shape", "collect");
    const amina = await join(stub, "Amina");
    const socket = await connect(stub, created.gameId, guestCookie(amina), "guest");
    await nextMatching(socket, (message) => message.kind === "snapshot");
    expect(
      (
        await send(socket, {
          name: "device",
          reason: "initial",
          report: {
            platform: null,
            screen: "missing",
            hardware: { logicalProcessors: "lots" },
          },
        })
      ).accepted,
    ).toBe(true);
    expect(
      (await send(socket, { name: "connection", rttMs: "fast", submissionRetries: -4 }))
        .accepted,
    ).toBe(true);
    expect((await send(socket, { name: "answer", optionId: "circle" })).accepted).toBe(
      true,
    );
    socket.close();
    const again = await connect(stub, created.gameId, guestCookie(amina), "guest");
    await nextMatching(again, (message) => message.kind === "snapshot");
    again.close();
    const summary = await stub.readGameplayContext(amina.playerId);
    expect(summary.connection?.reconnects).toBe(1);
    expect(summary.connection?.socketOpens).toBe(2);
    const family = summary.contexts[0]?.report.deviceFamily ?? "unknown";
    expect(family).not.toBe("Amina");
    expect((await stub.snapshotFor("guest", amina.playerId)).selfPlayerId).toBe(
      amina.playerId,
    );
  });
});

async function start(
  stub: ReturnType<typeof room>,
  created: Awaited<ReturnType<typeof createRoom>>,
) {
  const started = await stub.startDemo({
    ...control(created),
    requestId: crypto.randomUUID(),
    nowMs: Date.now(),
  });
  if (!started.ok) {
    throw new Error(started.message);
  }
}

async function reach(
  stub: ReturnType<typeof room>,
  created: Awaited<ReturnType<typeof createRoom>>,
  questionId: string,
  phase: string,
) {
  for (let step = 0; step < 48; step += 1) {
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

function guestCookie(joined: { gameId: string; playerId: string; secret: string }) {
  return `26_guest=${joined.gameId}.${joined.playerId}.${joined.secret}`;
}

function socketRequest(gameId: string, cookie: string, role: string): Request {
  return new Request(
    withClientApiQuery(`http://example.com/ws/${gameId}?role=${role}`),
    {
      headers: {
        Upgrade: "websocket",
        Connection: "Upgrade",
        Origin: "http://example.com",
        Cookie: cookie,
      },
    },
  );
}

async function connect(
  stub: ReturnType<typeof room>,
  gameId: string,
  cookie: string,
  role: string,
): Promise<WebSocket> {
  const response = await stub.fetch(socketRequest(gameId, cookie, role));
  expect(response.status).toBe(101);
  const socket = response.webSocket;
  if (!socket) {
    throw new Error("The room did not return a socket.");
  }
  socket.accept();
  return socket;
}

async function send(
  socket: WebSocket,
  command: Record<string, unknown>,
  requestId = crypto.randomUUID(),
) {
  socket.send(JSON.stringify({ kind: "command", requestId, ...command }));
  return nextMatching(
    socket,
    (message) => message.kind === "ack" && message.requestId === requestId,
  );
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

async function count(stub: ReturnType<typeof room>, sql: string): Promise<number> {
  return runInDurableObject(stub, async (_instance, state) => {
    const row = state.storage.sql.exec<{ total: number }>(sql).toArray()[0];
    return row?.total ?? 0;
  });
}

async function makeDue(stub: ReturnType<typeof room>): Promise<void> {
  await runInDurableObject(stub, async (_instance, state) => {
    state.storage.sql.exec(
      `UPDATE schedule_job SET due_at = 1 WHERE status = 'pending' AND job_type = 'gameplay'`,
    );
    await state.storage.setAlarm(1);
  });
}

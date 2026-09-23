import { env, runInDurableObject } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { withClientApiQuery } from "./client-api-key.ts";
import { payloadDigest } from "../src/room/digest.ts";

describe("device context", () => {
  it("stores a bounded report for the authenticated player and still scores without one", async () => {
    const created = await createRoom();
    const stub = room(created.gameId);
    const amina = await join(stub, "Amina");
    const bilal = await join(stub, "Bilal");
    const chen = await join(stub, "Chen");
    await start(stub, created);
    await reach(stub, created, "shape", "collect");

    const aminaSocket = await connect(
      stub,
      created.gameId,
      guestCookie(amina),
      "203.0.113.8",
    );
    await nextMatching(aminaSocket, (message) => message.kind === "snapshot");
    expect(
      (
        await send(aminaSocket, {
          name: "device",
          reason: "initial",
          report: {
            playerId: bilal.playerId,
            userAgent:
              "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) SECRET-UA-TOKEN",
            ip: "203.0.113.8",
            model: "iPhone 16 Pro",
            screen: { width: 999_999, height: 844 },
            viewport: { width: 390, height: 800 },
            effectiveType: "4g",
          },
        })
      ).accepted,
    ).toBe(true);
    for (let index = 0; index < 20; index += 1) {
      await send(aminaSocket, {
        name: "device",
        reason: "interval",
        report: { viewport: { width: 390 + index, height: 800 } },
      });
    }
    const aminaView = await stub.readGameplayContext(amina.playerId);
    expect(aminaView.contexts).toHaveLength(1);
    expect(aminaView.contexts[0]?.participating).toBe(true);
    const stored = JSON.stringify(aminaView.contexts[0]?.report);
    expect(stored).not.toContain("SECRET-UA-TOKEN");
    expect(stored).not.toContain("203.0.113.8");
    expect(stored).not.toContain("iPhone 16 Pro");
    expect(stored).toContain('"bearer":"unknown"');
    expect(aminaView.contexts[0]?.report).toMatchObject({
      deviceFamily: "iphone",
      screen: { width: null },
      network: { quality: "4g", bearer: "unknown" },
      physical: { model: "unknown" },
    });
    expect(await stub.readGameplayContext(bilal.playerId)).toMatchObject({
      contexts: [],
    });

    const bilalSocket = await connect(
      stub,
      created.gameId,
      guestCookie(bilal),
      "203.0.113.8",
    );
    await nextMatching(bilalSocket, (message) => message.kind === "snapshot");
    expect(
      (await send(bilalSocket, { name: "answer", optionId: "circle" })).accepted,
    ).toBe(true);
    expect(
      (await stub.readGameplayContext(bilal.playerId)).answers[0]?.contextId,
    ).toBeNull();
    expect(
      (await send(aminaSocket, { name: "answer", optionId: "circle" })).accepted,
    ).toBe(true);
    expect((await stub.readGameplayContext(amina.playerId)).answers[0]?.contextId).toBe(
      aminaView.contexts[0]?.contextId,
    );

    await reach(stub, created, "shape", "scores");
    const aminaScore =
      (await stub.readGameplayContext(amina.playerId)).scores[0]?.points ?? 0;
    const bilalScore =
      (await stub.readGameplayContext(bilal.playerId)).scores[0]?.points ?? 0;
    expect(aminaScore).toBeGreaterThanOrEqual(100);
    expect(bilalScore).toBeGreaterThanOrEqual(100);

    const reserved = await stub.reserveMedia({
      playerId: amina.playerId,
      secret: amina.secret,
      requestId: crypto.randomUUID(),
      kind: "photo",
      nowMs: Date.now(),
    });
    expect(reserved.ok).toBe(true);
    const before = await stub.readGameplayContext(amina.playerId);
    expect(before.retention?.days).toBe(30);
    expect(before.retention?.dueAt ?? 0).toBeGreaterThan(Date.now() + 20 * 86_400_000);
    await stub.configureTelemetryRetention(0);
    await fireAlarm(stub);
    const after = await stub.readGameplayContext(amina.playerId);
    expect(after.contexts).toHaveLength(0);
    expect(after.answerCount).toBe(before.answerCount);
    expect(after.mediaCount).toBe(before.mediaCount);
    expect(after.scoreCount).toBe(before.scoreCount);
    expect(after.aggregate).not.toBeNull();
    expect(after.playerCount).toBe(3);
    expect((await stub.readGameplayContext(chen.playerId)).contexts).toHaveLength(0);
    expect(after.connection?.reconnects).toBe(before.connection?.reconnects);
    const families = after.aggregate?.family_counts_json;
    await stub.configureTelemetryRetention(0);
    await fireAlarm(stub);
    const again = await stub.readGameplayContext(amina.playerId);
    expect(again.aggregate?.family_counts_json).toBe(families);
    expect(again.answerCount).toBe(before.answerCount);

    aminaSocket.close();
    bilalSocket.close();
  });

  it("counts sockets, caps samples, and keeps one player across a transfer", async () => {
    const created = await createRoom();
    const stub = room(created.gameId);
    const amina = await join(stub, "Amina");
    const first = await connect(stub, created.gameId, guestCookie(amina));
    await nextMatching(first, (message) => message.kind === "snapshot");
    await send(first, {
      name: "device",
      reason: "initial",
      report: { platform: "Android", screen: { width: 400, height: 800 } },
    });
    await send(first, {
      name: "connection",
      rttMs: [40, 80, 99_999],
      submissionRetries: 9,
      uploadAttempts: 1,
      uploadFailures: 1,
      uploadDurationMs: 1_500,
    });
    first.close();
    const second = await connect(stub, created.gameId, guestCookie(amina));
    await nextMatching(second, (message) => message.kind === "snapshot");
    second.close();
    const third = await connect(stub, created.gameId, guestCookie(amina));
    await nextMatching(third, (message) => message.kind === "snapshot");
    const summary = await stub.readGameplayContext(amina.playerId);
    expect(summary.connection).toMatchObject({
      socketOpens: 3,
      reconnects: 2,
      samples: [40, 80],
      submissionRetries: 5,
    });
    expect(summary.contexts).toHaveLength(1);
    const oldContext = summary.contexts[0]?.contextId;

    await start(stub, created);
    await reach(stub, created, "shape", "collect");
    expect((await send(third, { name: "answer", optionId: "circle" })).accepted).toBe(
      true,
    );
    const issued = await stub.issueTransfer({
      playerId: amina.playerId,
      requestId: crypto.randomUUID(),
      now: new Date().toISOString(),
    });
    if (!issued.ok) {
      throw new Error(issued.message);
    }
    const redeemed = await stub.redeemTransfer({
      code: issued.code,
      requestId: crypto.randomUUID(),
      now: new Date().toISOString(),
    });
    if (!redeemed.ok) {
      throw new Error(redeemed.message);
    }
    expect(redeemed.playerId).toBe(amina.playerId);
    expect((await stub.snapshotFor("stage")).players).toHaveLength(1);
    const moved = await connect(
      stub,
      created.gameId,
      guestCookie({ ...amina, secret: redeemed.secret }),
    );
    await nextMatching(moved, (message) => message.kind === "snapshot");
    await send(moved, {
      name: "device",
      reason: "initial",
      report: { platform: "Android", screen: { width: 400, height: 800 } },
    });
    const movedView = await stub.readGameplayContext(amina.playerId);
    expect(movedView.playerCount).toBe(1);
    expect(movedView.contexts).toHaveLength(2);
    expect(movedView.contexts[1]?.participating).toBe(false);
    expect(movedView.contexts[1]?.contextId).not.toBe(oldContext);
    expect(movedView.answers[0]?.contextId).toBe(oldContext);
    third.close();
    moved.close();
  });
});

async function send(socket: WebSocket, command: Record<string, unknown>) {
  const requestId = crypto.randomUUID();
  socket.send(JSON.stringify({ kind: "command", requestId, ...command }));
  const message = await nextMatching(
    socket,
    (item) => item.kind === "ack" && item.requestId === requestId,
  );
  return message as { accepted?: boolean };
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

async function fireAlarm(stub: ReturnType<typeof room>) {
  await runInDurableObject(stub, async (instance) => {
    await instance.alarm();
  });
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
  ip?: string,
): Promise<WebSocket> {
  const response = await stub.fetch(
    new Request(withClientApiQuery(`http://example.com/ws/${gameId}?role=guest`), {
      headers: {
        Upgrade: "websocket",
        Connection: "Upgrade",
        Origin: "http://example.com",
        Cookie: cookie,
        ...(ip ? { "CF-Connecting-IP": ip } : {}),
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
  matches: (message: { kind?: string; requestId?: string }) => boolean,
): Promise<{ kind?: string; requestId?: string }> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("The socket stayed quiet.")),
      5_000,
    );
    const onMessage = (event: MessageEvent) => {
      const message = JSON.parse(String(event.data)) as {
        kind?: string;
        requestId?: string;
      };
      if (!matches(message)) {
        return;
      }
      clearTimeout(timer);
      socket.removeEventListener("message", onMessage);
      resolve(message);
    };
    socket.addEventListener("message", onMessage);
  });
}

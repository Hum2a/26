import { env, evictDurableObject } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { withClientApiQuery } from "./client-api-key.ts";
import { demoAnswerKeyMarker } from "../src/questions/demo-set.ts";
import { payloadDigest } from "../src/room/digest.ts";
import { answerDuplicateMessage, answerUnknownMessage } from "../src/room/limits.ts";

describe("illustrative multiple choice", () => {
  it("lets a guest arriving at reveal play the next question, including reconnecting through a pause", async () => {
    const created = await createRoom();
    const stub = room(created.gameId);
    await stub.startDemo({
      ...control(created),
      requestId: crypto.randomUUID(),
      nowMs: Date.now(),
    });
    await untilPhase(stub, created, "reveal");
    const joined = await stub.joinPlayer({
      nickname: "Late guest",
      requestId: crypto.randomUUID(),
      now: new Date().toISOString(),
    });
    if (!joined.ok) throw new Error(joined.message);
    expect(
      (await stub.snapshotFor("control")).adminPlayers?.find(
        (p) => p.playerId === joined.playerId,
      )?.points,
    ).toBe(0);
    await untilPhase(stub, created, "collect");
    expect(
      (
        await stub.pauseRound({
          ...control(created),
          requestId: crypto.randomUUID(),
          nowMs: Date.now(),
        })
      ).ok,
    ).toBe(true);
    const socket = await connect(stub, created.gameId, guestCookie(joined));
    await nextMatching(socket, (m) => m.kind === "snapshot");
    expect((await stub.snapshotFor("guest", joined.playerId)).paused).toBe(true);
    expect(
      (
        await stub.resumeRound({
          ...control(created),
          requestId: crypto.randomUUID(),
          nowMs: Date.now(),
        })
      ).ok,
    ).toBe(true);
    const view = await stub.snapshotFor("guest", joined.playerId);
    if (view.play?.question.kind !== "choice")
      throw new Error("Expected the next choice question");
    const requestId = crypto.randomUUID();
    socket.send(
      JSON.stringify({
        kind: "command",
        name: "answer",
        requestId,
        optionId: view.play.question.options[0]!.id,
      }),
    );
    expect(
      await nextMatching(socket, (m) => m.kind === "ack" && m.requestId === requestId),
    ).toMatchObject({ accepted: true });
    socket.close();
    await evictDurableObject(stub);
    expect(
      (await stub.snapshotFor("guest", joined.playerId)).play?.selfAnswer?.kind,
    ).toBe("choice");
  });

  it("persists an answer before the acknowledgement and scores the reveal once", async () => {
    const created = await createRoom();
    const stub = room(created.gameId);
    const started = await stub.startDemo({
      ...control(created),
      requestId: crypto.randomUUID(),
      nowMs: Date.now(),
    });
    expect(started.ok && started.phase).toBe("intro");
    await untilPhase(stub, created, "collect");

    const joined = await stub.joinPlayer({
      nickname: "Amina",
      requestId: crypto.randomUUID(),
      now: new Date().toISOString(),
    });
    if (!joined.ok) {
      throw new Error(joined.message);
    }
    const before = await stub.snapshotFor("guest", joined.playerId);
    expect(before.play?.reveal).toBeNull();
    expect(JSON.stringify(before)).not.toContain("correctOptionId");
    expect(JSON.stringify(before)).not.toContain(demoAnswerKeyMarker);

    const socket = await connect(stub, created.gameId, guestCookie(joined));
    await nextMatching(socket, (message) => message.kind === "snapshot");
    socket.send(
      JSON.stringify({
        kind: "command",
        name: "answer",
        requestId: crypto.randomUUID(),
        optionId: "nope",
        playerId: "someone-else",
      }),
    );
    const rejected = await nextMatching(socket, (message) => message.kind === "ack");
    expect(rejected.accepted).toBe(false);
    expect(rejected.error).toBe(answerUnknownMessage);

    const requestId = crypto.randomUUID();
    socket.send(
      JSON.stringify({
        kind: "command",
        name: "answer",
        requestId,
        optionId: "circle",
      }),
    );
    const accepted = await nextMatching(
      socket,
      (message) => message.kind === "ack" && message.requestId === requestId,
    );
    expect(accepted.accepted).toBe(true);
    socket.close();

    await evictDurableObject(stub);
    const restored = await stub.snapshotFor("guest", joined.playerId);
    expect(restored.play?.selfAnswer).toEqual({
      kind: "choice",
      optionId: "circle",
    });
    expect(restored.phase).toBe("collect");

    const again = await connect(stub, created.gameId, guestCookie(joined));
    await nextMatching(again, (message) => message.kind === "snapshot");
    const duplicateId = crypto.randomUUID();
    again.send(
      JSON.stringify({
        kind: "command",
        name: "answer",
        requestId: duplicateId,
        optionId: "star",
      }),
    );
    const duplicate = await nextMatching(
      again,
      (message) => message.kind === "ack" && message.requestId === duplicateId,
    );
    expect(duplicate.accepted).toBe(false);
    expect(duplicate.error).toBe(answerDuplicateMessage);
    again.close();

    await untilPhase(stub, created, "reveal");
    const revealed = await stub.snapshotFor("guest", joined.playerId);
    expect(revealed.play?.reveal).toEqual({
      kind: "choice",
      correctOptionId: "circle",
    });
    expect(revealed.play?.standings).toBeNull();
    expect(revealed.play?.selfStanding?.points).toBeGreaterThan(100);
    const stage = await stub.snapshotFor("stage");
    expect(stage.play?.standings?.[0]?.nickname).toBe("Amina");
    expect(JSON.stringify(stage)).not.toContain(demoAnswerKeyMarker);

    const first = await stub.rescoreCurrent();
    const second = await stub.rescoreCurrent();
    expect(second).toEqual(first);
    expect(first.rows).toBe(1);
    expect(first.total).toBe(revealed.play?.selfStanding?.points);
  });
});

async function untilPhase(
  stub: ReturnType<typeof room>,
  created: Awaited<ReturnType<typeof createRoom>>,
  phase: string,
) {
  for (let step = 0; step < 8; step += 1) {
    const snapshot = await stub.snapshotFor("stage");
    if (snapshot.phase === phase) {
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
  throw new Error(`The room did not reach ${phase}.`);
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

function socketRequest(gameId: string, cookie: string): Request {
  return new Request(withClientApiQuery(`http://example.com/ws/${gameId}?role=guest`), {
    headers: {
      Upgrade: "websocket",
      Connection: "Upgrade",
      Origin: "http://example.com",
      Cookie: cookie,
    },
  });
}

async function connect(
  stub: ReturnType<typeof room>,
  gameId: string,
  cookie: string,
): Promise<WebSocket> {
  const response = await stub.fetch(socketRequest(gameId, cookie));
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

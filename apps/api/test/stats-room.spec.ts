import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { withClientApiQuery } from "./client-api-key.ts";
import { payloadDigest } from "../src/room/digest.ts";

describe("statistics from room records", () => {
  it("builds highlights from accepted answers and keeps a recap on that guest", async () => {
    const created = await createRoom();
    const stub = room(created.gameId);
    const amina = await join(stub, "Amina");
    const bilal = await join(stub, "Bilal");
    await start(stub, created);
    await reach(stub, created, "shape", "collect");
    const aminaSocket = await connect(stub, created.gameId, guestCookie(amina));
    await nextMatching(aminaSocket, (message) => message.kind === "snapshot");
    const bilalSocket = await connect(stub, created.gameId, guestCookie(bilal));
    await nextMatching(bilalSocket, (message) => message.kind === "snapshot");
    expect(
      (await send(aminaSocket, { name: "answer", optionId: "circle" })).accepted,
    ).toBe(true);
    expect(
      (await send(bilalSocket, { name: "answer", optionId: "circle" })).accepted,
    ).toBe(true);

    const preview = await stub.snapshotFor("control");
    const text = (preview.highlights ?? []).map((card) => card.stage).join(" ");
    expect(text).toContain("2 of the 2");
    expect(text).toContain("Circle");
    expect(text).not.toContain("31 of the 48");
    expect(preview.highlights?.every((card) => card.illustrative)).toBe(true);
    expect(preview.recap).toBeUndefined();

    const stage = await stub.snapshotFor("stage");
    expect(stage.highlights).toBeUndefined();
    expect(stage.recap).toBeUndefined();
    expect(JSON.stringify(stage)).not.toContain("userAgent");

    const aminaView = await stub.snapshotFor("guest", amina.playerId);
    const recap = (aminaView.recap ?? []).map((card) => card.results).join(" ");
    expect(recap).not.toContain("Bilal");
    expect(recap).not.toContain("Your fastest");
    expect(
      (aminaView.recap ?? []).every((card) =>
        card.factId.startsWith(`player:${amina.playerId}:`),
      ),
    ).toBe(true);
    expect(aminaView.highlights).toBeUndefined();
    aminaSocket.close();
    bilalSocket.close();
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

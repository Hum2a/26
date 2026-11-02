import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { withClientApiQuery } from "./client-api-key.ts";
import { payloadDigest } from "../src/room/digest.ts";
import {
  endNowClosedMessage,
  roomDestroyedMessage,
  roomMissingMessage,
} from "../src/room/limits.ts";

describe("ending a game now", () => {
  it("jumps straight to the podium, refuses in the lobby and replays", async () => {
    const created = await createRoom();
    const stub = room(created.gameId);
    const early = await stub.endNow({
      ...control(created),
      requestId: crypto.randomUUID(),
      nowMs: Date.now(),
    });
    expect(early).toMatchObject({ ok: false, message: endNowClosedMessage });

    const started = await stub.startDemo({
      ...control(created),
      requestId: crypto.randomUUID(),
      nowMs: Date.now(),
    });
    expect(started.ok && started.phase).toBe("intro");
    const requestId = crypto.randomUUID();
    const ended = await stub.endNow({
      ...control(created),
      requestId,
      nowMs: Date.now(),
    });
    expect(ended).toMatchObject({ ok: true, phase: "podium", paused: false });
    expect((await stub.snapshotFor("stage")).phase).toBe("podium");

    const replayed = await stub.endNow({
      ...control(created),
      requestId,
      nowMs: Date.now(),
    });
    expect(replayed).toEqual(ended);
    const again = await stub.endNow({
      ...control(created),
      requestId: crypto.randomUUID(),
      nowMs: Date.now(),
    });
    expect(again).toMatchObject({ ok: false, message: endNowClosedMessage });
  });

  it("refuses a guest credential", async () => {
    const created = await createRoom();
    const refused = await room(created.gameId).endNow({
      credentialId: crypto.randomUUID(),
      secret: "not-the-secret",
      requestId: crypto.randomUUID(),
      nowMs: Date.now(),
    });
    expect(refused.ok).toBe(false);
  });
});

describe("destroying a room", () => {
  it("needs the join code, then closes sockets and wipes the room", async () => {
    const created = await createRoom();
    const stub = room(created.gameId);
    const joined = await stub.joinPlayer({
      nickname: "Amina",
      requestId: crypto.randomUUID(),
      now: new Date().toISOString(),
    });
    if (!joined.ok) throw new Error(joined.message);

    const wrong = await stub.destroyRoom({
      ...control(created),
      requestId: crypto.randomUUID(),
      nowMs: Date.now(),
      confirmCode: "ZZZZZZ",
    });
    expect(wrong).toMatchObject({ ok: false, error: "invalid" });
    expect((await stub.snapshotFor("stage")).players).toHaveLength(1);

    const socket = await connect(stub, created.gameId, guestCookie(joined));
    const goodbye = nextMatching(socket, (message) => message.kind === "replaced");
    const destroyed = await stub.destroyRoom({
      ...control(created),
      requestId: crypto.randomUUID(),
      nowMs: Date.now(),
      confirmCode: created.joinCode.toLowerCase(),
    });
    expect(destroyed).toMatchObject({
      ok: true,
      gameId: created.gameId,
      joinCode: created.joinCode,
      mediaKeys: [],
    });
    expect(await goodbye).toMatchObject({ message: roomDestroyedMessage });

    const after = await stub.destroyRoom({
      ...control(created),
      requestId: crypto.randomUUID(),
      nowMs: Date.now(),
      confirmCode: created.joinCode,
    });
    expect(after).toMatchObject({ ok: false, message: roomMissingMessage });
    const rejoin = await stub.joinPlayer({
      nickname: "Late",
      requestId: crypto.randomUUID(),
      now: new Date().toISOString(),
    });
    expect(rejoin.ok).toBe(false);
  });

  it("drops the join code once and replays the same request", async () => {
    const created = await createRoom();
    const registry = env.ROOM_CODE_REGISTRY.getByName("codes");
    const requestId = crypto.randomUUID();
    expect(await registry.destroyedRoom(created.gameId, requestId)).toBeNull();
    const forgotten = await registry.forgetRoom({ gameId: created.gameId, requestId });
    expect(forgotten).toEqual({ gameId: created.gameId, joinCode: created.joinCode });
    expect(await registry.resolve(created.joinCode)).toBeNull();
    expect(await registry.hasGame(created.gameId)).toBe(false);
    expect(await registry.destroyedRoom(created.gameId, requestId)).toEqual(forgotten);
    expect(await registry.forgetRoom({ gameId: created.gameId, requestId })).toEqual(
      forgotten,
    );
    const listed = await registry.listRooms({ limit: 100 });
    expect(listed.rooms.map((row) => row.gameId)).not.toContain(created.gameId);
  });
});

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

async function connect(stub: ReturnType<typeof room>, gameId: string, cookie: string) {
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
  if (!socket) throw new Error("The room did not return a socket.");
  socket.accept();
  return socket;
}

function nextMatching(
  socket: WebSocket,
  match: (message: Record<string, unknown>) => boolean,
): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("No matching message.")), 5_000);
    socket.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data)) as Record<string, unknown>;
      if (match(message)) {
        clearTimeout(timer);
        resolve(message);
      }
    });
  });
}

import { env, runInDurableObject } from "cloudflare:test";
import { apiFetch } from "./api-fetch.ts";
import { withClientApiKeyHeaders, withClientApiQuery } from "./client-api-key.ts";
import { describe, expect, it } from "vitest";
import { movedSessionMessage, newerTabMessage } from "@26/shared";
import { payloadDigest } from "../src/room/digest.ts";
import type { GuestJoinResult } from "../src/room/party-room.ts";

// Keep joins inside the guest credential TTL when identify() uses real time.
const now = new Date(Date.now() - 60_000).toISOString();

describe("durable lobby", () => {
  it("indexes the round counts and per-player scoring queries used by snapshots", async () => {
    const created = await createRoom();
    await runInDurableObject(room(created.gameId), (_instance, state) => {
      const checks = [
        [
          "SELECT COUNT(*) FROM choice_answer WHERE question_id = ?",
          "choice_answer_question",
        ],
        [
          "SELECT SUM(points) FROM score_ledger WHERE player_id = ?",
          "score_ledger_player",
        ],
        [
          "SELECT SUM(points) FROM score_adjustment WHERE player_id = ?",
          "score_adjustment_player",
        ],
        ["SELECT * FROM name_reaction WHERE target_id = ?", "name_reaction_target"],
      ];
      for (const [query, index] of checks) {
        const plan = state.storage.sql
          .exec<{ detail: string }>(`EXPLAIN QUERY PLAN ${query}`, "sample")
          .toArray();
        expect(plan.map((row) => row.detail).join(" ")).toContain(index);
      }
    });
  });
  it("rejects a repeated join code and a repeated game id", async () => {
    const registry = env.ROOM_CODE_REGISTRY.getByName("codes");
    const first = await registry.claim({
      joinCode: "ABCDEF",
      gameId: "ABCDEFGHJKLM",
      createdAt: now,
    });
    const sameCode = await registry.claim({
      joinCode: "abcdef",
      gameId: "NPQRSTUVWXYZ",
      createdAt: now,
    });
    const sameId = await registry.claim({
      joinCode: "ZZZZZZ",
      gameId: "ABCDEFGHJKLM",
      createdAt: now,
    });

    expect(first).toEqual({ ok: true });
    expect(sameCode).toEqual({ ok: false, reason: "code" });
    expect(sameId).toEqual({ ok: false, reason: "id" });
    await expect(registry.resolve("abcdef")).resolves.toEqual({
      gameId: "ABCDEFGHJKLM",
    });
  });

  it("replays a create and rejects a different digest", async () => {
    const registry = env.ROOM_CODE_REGISTRY.getByName("codes");
    const requestId = crypto.randomUUID();
    const digest = await payloadDigest({ action: "create" });
    const first = await registry.createLobby({ requestId, digest, now });
    const replay = await registry.createLobby({ requestId, digest, now });
    const mismatch = await registry.createLobby({
      requestId,
      digest: await payloadDigest({ action: "other" }),
      now,
    });

    expect(first.ok).toBe(true);
    expect(replay.ok).toBe(true);
    if (!first.ok || !replay.ok) {
      return;
    }
    expect(replay.result.gameId).toBe(first.result.gameId);
    expect(replay.result.joinCode).toBe(first.result.joinCode);
    expect(mismatch).toMatchObject({ ok: false, error: "digest_mismatch" });
  });

  it("keeps concurrent joins as separate players, including a shared address", async () => {
    const created = await createRoom();
    const stub = room(created.gameId);
    const joined = await Promise.all([
      stub.joinPlayer({ nickname: "Amina", requestId: crypto.randomUUID(), now }),
      stub.joinPlayer({ nickname: "Bilal", requestId: crypto.randomUUID(), now }),
    ]);
    expect(joined.every((item) => item.ok)).toBe(true);
    if (!joined[0]?.ok || !joined[1]?.ok) {
      return;
    }
    expect(joined[0].playerId).not.toBe(joined[1].playerId);

    const shared = await Promise.all([
      postJoin(created.joinCode, "Cara", "203.0.113.8"),
      postJoin(created.joinCode, "Dev", "203.0.113.8"),
    ]);
    expect(shared[0]?.playerId).not.toBe(shared[1]?.playerId);
    const snapshot = await stub.snapshotFor("stage");
    expect(snapshot.players).toHaveLength(4);
  });

  it("rejects a nickname collision without creating a second player", async () => {
    const created = await createRoom();
    const stub = room(created.gameId);
    const first = await stub.joinPlayer({
      nickname: " Sam ",
      requestId: crypto.randomUUID(),
      now,
    });
    const second = await stub.joinPlayer({
      nickname: "sam",
      requestId: crypto.randomUUID(),
      now,
    });
    expect(first.ok).toBe(true);
    expect(second).toMatchObject({
      ok: false,
      error: "conflict",
      message: "That nickname is already in this room. Choose another.",
    });
    expect((await stub.snapshotFor("stage")).players).toHaveLength(1);
  });

  it("replays a join and rejects a reused request with a different nickname", async () => {
    const created = await createRoom();
    const stub = room(created.gameId);
    const requestId = crypto.randomUUID();
    const first = await stub.joinPlayer({ nickname: "Amina", requestId, now });
    const replay = await stub.joinPlayer({ nickname: "Amina", requestId, now });
    const mismatch = await stub.joinPlayer({ nickname: "Bilal", requestId, now });

    expect(first.ok).toBe(true);
    expect(replay.ok).toBe(true);
    if (!first.ok || !replay.ok) {
      return;
    }
    expect(replay.playerId).toBe(first.playerId);
    expect(replay.secret).toBe(first.secret);
    expect(mismatch).toMatchObject({ ok: false, error: "digest_mismatch" });
    expect((await stub.snapshotFor("stage")).players).toHaveLength(1);
  });

  it("reads players from SQLite on a later invocation and leaves device context empty", async () => {
    const created = await createRoom();
    const stub = room(created.gameId);
    const joined = await stub.joinPlayer({
      nickname: "Amina",
      requestId: crypto.randomUUID(),
      now,
    });
    expect(joined.ok).toBe(true);
    const rows = await runInDurableObject(stub, async (_instance, state) => {
      return state.storage.sql
        .exec(`SELECT nickname, device_context_id, device_context_version FROM player`)
        .toArray();
    });
    expect(rows).toEqual([
      {
        nickname: "Amina",
        device_context_id: null,
        device_context_version: null,
      },
    ]);
    const again = await stub.snapshotFor("stage");
    expect(again.players.map((player) => player.nickname)).toEqual(["Amina"]);
  });

  it("stops joining when the room already has 80 players", async () => {
    const created = await createRoom();
    const stub = room(created.gameId);
    await runInDurableObject(stub, async (_instance, state) => {
      for (let index = 0; index < 80; index += 1) {
        const nickname = `Guest ${index}`;
        state.storage.sql.exec(
          `INSERT INTO player (
            player_id, nickname, nickname_key, revoked_at, device_context_id, device_context_version
          ) VALUES (?, ?, ?, NULL, NULL, NULL)`,
          crypto.randomUUID(),
          nickname,
          nickname.toLowerCase(),
        );
      }
    });
    const full = await stub.joinPlayer({
      nickname: "Late",
      requestId: crypto.randomUUID(),
      now,
    });
    expect(full).toMatchObject({ ok: false, error: "full" });
  });

  it("ignores a player id in the socket payload and keeps the cookie identity", async () => {
    const created = await createRoom();
    const stub = room(created.gameId);
    const amina = await stub.joinPlayer({
      nickname: "Amina",
      requestId: crypto.randomUUID(),
      now,
    });
    const bilal = await stub.joinPlayer({
      nickname: "Bilal",
      requestId: crypto.randomUUID(),
      now,
    });
    if (!amina.ok || !bilal.ok) {
      throw new Error("players did not join");
    }
    const socket = await connect(stub, created.gameId, guestCookie(amina), "guest");
    const opening = await nextMessage(socket);
    expect(opening.kind).toBe("snapshot");
    const snapshot = opening.snapshot as { selfPlayerId?: string };
    expect(snapshot.selfPlayerId).toBe(amina.playerId);

    socket.send(
      JSON.stringify({
        kind: "command",
        name: "snapshot",
        requestId: crypto.randomUUID(),
        playerId: bilal.playerId,
      }),
    );
    const follow = await nextMatching(socket, (message) => message.kind === "snapshot");
    const next = follow.snapshot as { selfPlayerId?: string };
    expect(next.selfPlayerId).toBe(amina.playerId);
    socket.close();
  });

  it("rejects a guest cookie from another room", async () => {
    const first = await createRoom();
    const second = await createRoom();
    const joined = await room(first.gameId).joinPlayer({
      nickname: "Amina",
      requestId: crypto.randomUUID(),
      now,
    });
    if (!joined.ok) {
      throw new Error("player did not join");
    }
    const response = await room(second.gameId).fetch(
      socketRequest(second.gameId, guestCookie(joined), "guest"),
    );
    expect(response.status).toBe(401);
    expect(response.headers.get("content-type")).toContain("application/json");
  });

  it("closes the older tab when the same guest opens a newer one", async () => {
    const created = await createRoom();
    const joined = await room(created.gameId).joinPlayer({
      nickname: "Amina",
      requestId: crypto.randomUUID(),
      now,
    });
    if (!joined.ok) {
      throw new Error("player did not join");
    }
    const first = await connect(
      room(created.gameId),
      created.gameId,
      guestCookie(joined),
      "guest",
    );
    await nextMessage(first);
    const replaced = nextMatching(first, (message) => message.kind === "replaced");
    const second = await connect(
      room(created.gameId),
      created.gameId,
      guestCookie(joined),
      "guest",
    );
    expect(await replaced).toMatchObject({
      kind: "replaced",
      message: newerTabMessage,
    });
    const open = await runInDurableObject(
      room(created.gameId),
      async (_instance, state) => {
        return state.getWebSockets("guest").length;
      },
    );
    expect(open).toBe(1);
    second.close();
  });

  it("closes the old phone when a transfer is redeemed", async () => {
    const created = await createRoom();
    const stub = room(created.gameId);
    const joined = await stub.joinPlayer({
      nickname: "Amina",
      requestId: crypto.randomUUID(),
      now,
    });
    if (!joined.ok) {
      throw new Error("player did not join");
    }
    const socket = await connect(stub, created.gameId, guestCookie(joined), "guest");
    await nextMessage(socket);
    const replaced = nextMatching(socket, (message) => message.kind === "replaced");
    const issued = await stub.issueTransfer({
      playerId: joined.playerId,
      requestId: crypto.randomUUID(),
      now,
    });
    if (!issued.ok) {
      throw new Error("transfer was not issued");
    }
    const redeemed = await stub.redeemTransfer({
      code: issued.code,
      requestId: crypto.randomUUID(),
      now,
    });
    expect(redeemed.ok).toBe(true);
    if (!redeemed.ok) {
      return;
    }
    expect(redeemed.secret).not.toBe(joined.secret);
    expect(await replaced).toMatchObject({ message: movedSessionMessage });
    const oldSocket = await stub.fetch(
      socketRequest(created.gameId, guestCookie(joined), "guest"),
    );
    expect(oldSocket.status).toBe(401);
    const moved = await stub.fetch(
      socketRequest(created.gameId, guestCookie(redeemed), "guest"),
    );
    expect(moved.status).toBe(101);
    moved.webSocket?.accept();
    moved.webSocket?.close();
  });

  it("omits verifiers and private admin data from the stage snapshot", async () => {
    const created = await createRoom();
    await room(created.gameId).joinPlayer({
      nickname: "Amina <b>",
      requestId: crypto.randomUUID(),
      now,
    });
    const snapshot = await room(created.gameId).snapshotFor("stage");
    const text = JSON.stringify(snapshot);
    expect(snapshot.phase).toBe("lobby");
    expect(snapshot.paused).toBe(false);
    expect(snapshot.held).toBe(false);
    expect(snapshot.deadlineAt).toBeNull();
    expect(snapshot.players[0]?.nickname).toBe("Amina <b>");
    expect(snapshot.selfPlayerId).toBeUndefined();
    expect(text).not.toContain(created.control.secret);
    expect(text).not.toContain(created.presentation.secret);
    expect(text).not.toContain("secretHash");
    expect(text).not.toContain("codeHash");
    expect(text).not.toContain("humza@");
    expect(Object.keys(snapshot).sort()).toEqual([
      "cloud",
      "deadlineAt",
      "finishAfterRound",
      "gameId",
      "held",
      "joinCode",
      "media",
      "namesReveal",
      "paused",
      "phase",
      "play",
      "players",
      "questionSetVersion",
      "remainingMs",
      "revealNonce",
      "scoringVersion",
      "serverNow",
      "stageHidden",
      "stateVersion",
      "trolls",
      "wall",
    ]);
  });

  it("requires an administrator session to create a room over HTTP", async () => {
    const response = await apiFetch("http://example.com/api/rooms", {
      method: "POST",
      headers: {
        origin: "http://example.com",
        "content-type": "application/json",
      },
      body: JSON.stringify({ requestId: crypto.randomUUID() }),
    });
    expect(response.status).toBe(401);
    const text = await response.text();
    expect(text).not.toContain("joinCode");
  });

  it("returns the guest cookie without putting the secret in JSON", async () => {
    const created = await createRoom();
    const requestId = crypto.randomUUID();
    const response = await apiFetch("http://example.com/api/rooms/join", {
      method: "POST",
      headers: {
        origin: "http://example.com",
        "content-type": "application/json",
        "cf-connecting-ip": "203.0.113.9",
      },
      body: JSON.stringify({
        code: created.joinCode,
        nickname: "Amina",
        requestId,
      }),
    });
    expect(response.status).toBe(200);
    const cookie = response.headers
      .getSetCookie()
      .find((value) => value.startsWith("26_guest="));
    expect(cookie).toContain("Path=/");
    expect(cookie).not.toContain("Secure");
    const body = await response.text();
    const secret = cookie?.split(".")[2]?.split(";")[0];
    expect(secret && secret.length > 10).toBe(true);
    expect(body).not.toContain(secret ?? "missing-secret");
    expect(body).toContain("Amina");
  });

  it("upgrades a guest socket through the worker", async () => {
    const created = await createRoom();
    const joined = await room(created.gameId).joinPlayer({
      nickname: "Amina",
      requestId: crypto.randomUUID(),
      now,
    });
    if (!joined.ok) {
      throw new Error("player did not join");
    }
    const response = await apiFetch(
      socketRequest(created.gameId, guestCookie(joined), "guest"),
    );
    expect(response.status).toBe(101);
    const socket = response.webSocket;
    expect(socket).toBeDefined();
    socket?.accept();
    const opening = await nextMessage(socket as WebSocket);
    expect(opening.kind).toBe("snapshot");
    socket?.close();
  });

  it("answers an unknown socket with JSON", async () => {
    const response = await apiFetch(
      withClientApiQuery("http://example.com/ws/ABCDEFGHJKLM"),
      {
        headers: {
          Upgrade: "websocket",
          Origin: "http://example.com",
        },
      },
    );
    expect(response.status).toBe(404);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(await response.text()).not.toContain("<html");
  });
});

async function createRoom() {
  const created = await env.ROOM_CODE_REGISTRY.getByName("codes").createLobby({
    requestId: crypto.randomUUID(),
    digest: await payloadDigest({ action: "create" }),
    now,
  });
  if (!created.ok) {
    throw new Error(created.message);
  }
  return created.result;
}

function room(gameId: string) {
  return env.PARTY_ROOM.get(env.PARTY_ROOM.idFromName(gameId));
}

async function postJoin(code: string, nickname: string, address: string) {
  const response = await apiFetch("http://example.com/api/rooms/join", {
    method: "POST",
    headers: {
      origin: "http://example.com",
      "content-type": "application/json",
      "cf-connecting-ip": address,
    },
    body: JSON.stringify({
      code,
      nickname,
      requestId: crypto.randomUUID(),
    }),
  });
  expect(response.status).toBe(200);
  return (await response.json()) as { playerId: string };
}

function guestCookie(joined: Extract<GuestJoinResult, { ok: true }>): string {
  return `26_guest=${joined.gameId}.${joined.playerId}.${joined.secret}`;
}

function socketRequest(gameId: string, cookie: string, role: string): Request {
  return new Request(
    withClientApiQuery(`http://example.com/ws/${gameId}?role=${role}`),
    {
      headers: withClientApiKeyHeaders({
        Upgrade: "websocket",
        Connection: "Upgrade",
        Origin: "http://example.com",
        Cookie: cookie,
      }),
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

function nextMessage(socket: WebSocket): Promise<Record<string, unknown>> {
  return nextMatching(socket, () => true);
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

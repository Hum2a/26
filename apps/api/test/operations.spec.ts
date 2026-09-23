import { env, evictDurableObject, runInDurableObject } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { apiFetch } from "./api-fetch.ts";
import { withClientApiQuery } from "./client-api-key.ts";
import { payloadDigest } from "../src/room/digest.ts";

describe("event operations", () => {
  it("redacts diagnostics and keeps them off a guest cookie", async () => {
    const created = await createRoom();
    const stub = room(created.gameId);
    const amina = await join(stub, "Amina");
    await runInDurableObject(stub, async (_instance, state) => {
      state.storage.sql.exec(
        `INSERT INTO media_upload (
          upload_id, request_id, player_id, kind, question_index, temp_key,
          status, lease_until, attempts, created_at, hidden, failure
        ) VALUES (?, ?, ?, 'photo', 0, ?, 'leased', 1, 0, 1, 0, ?)`,
        crypto.randomUUID(),
        crypto.randomUUID(),
        amina.playerId,
        `tmp/${created.gameId}/stuck`,
        "write amina@example.test via postgres://user:secret@db.example/party",
      );
      state.storage.sql.exec(
        `INSERT INTO media_upload (
          upload_id, request_id, player_id, kind, question_index, temp_key,
          status, lease_until, attempts, created_at, hidden
        ) VALUES (?, ?, ?, 'photo', 0, ?, 'leased', ?, 0, 2, 0)`,
        crypto.randomUUID(),
        crypto.randomUUID(),
        amina.playerId,
        `tmp/${created.gameId}/live`,
        Date.now() + 60_000,
      );
    });

    const report = await stub.diagnostics({
      ...control(created),
      nowMs: Date.now(),
    });
    expect(report.ok).toBe(true);
    if (!report.ok) {
      return;
    }
    const text = JSON.stringify(report.report);
    expect(text).not.toContain("amina@example.test");
    expect(text).not.toContain("postgres://");
    expect(text).not.toContain("correctOptionId");
    expect(text).not.toContain(created.control.secret);
    expect(report.report.media.leased).toBe(2);
    expect(
      report.report.media.attention.map((item) => item.failure).join(" "),
    ).toContain("[redacted]");
    expect(report.report.delivery.testRecipient).toBe(false);

    const guest = await apiFetch(
      `http://example.com/api/rooms/${created.gameId}/diagnostics`,
      {
        headers: {
          origin: "http://example.com",
          cookie: `26_guest=${created.gameId}.${amina.playerId}.${amina.secret}`,
        },
      },
    );
    expect(guest.status).toBe(401);

    const host = await apiFetch(
      `http://example.com/api/rooms/${created.gameId}/diagnostics`,
      {
        headers: {
          origin: "http://example.com",
          cookie: controlCookie(created),
        },
      },
    );
    expect(host.status).toBe(200);
    const body = await host.text();
    expect(body).not.toContain("amina@example.test");
    expect(body).not.toContain("postgres://");

    const noOrigin = await apiFetch(
      `http://example.com/api/rooms/${created.gameId}/diagnostics`,
      { headers: { cookie: controlCookie(created) } },
    );
    expect(noOrigin.status).toBe(200);
    const foreign = await apiFetch(
      `http://example.com/api/rooms/${created.gameId}/diagnostics`,
      {
        headers: {
          origin: "https://elsewhere.example",
          cookie: controlCookie(created),
        },
      },
    );
    expect(foreign.status).toBe(403);
  });

  it("releases an expired media lease once and leaves a live lease alone", async () => {
    const created = await createRoom();
    const stub = room(created.gameId);
    const amina = await join(stub, "Amina");
    await runInDurableObject(stub, async (_instance, state) => {
      state.storage.sql.exec(
        `INSERT INTO media_upload (
          upload_id, request_id, player_id, kind, question_index, temp_key,
          status, lease_until, attempts, created_at, hidden
        ) VALUES (?, ?, ?, 'voice', 0, 'tmp/expired', 'leased', 1, 1, 1, 0)`,
        "expired-upload",
        crypto.randomUUID(),
        amina.playerId,
      );
      state.storage.sql.exec(
        `INSERT INTO media_upload (
          upload_id, request_id, player_id, kind, question_index, temp_key,
          status, lease_until, attempts, created_at, hidden
        ) VALUES (?, ?, ?, 'voice', 0, 'tmp/live', 'leased', ?, 0, 2, 0)`,
        "live-upload",
        crypto.randomUUID(),
        amina.playerId,
        Date.now() + 60_000,
      );
    });
    const released = await stub.hostAction({
      ...control(created),
      requestId: crypto.randomUUID(),
      nowMs: Date.now(),
      action: "release-stuck-media",
    });
    expect(released).toMatchObject({ ok: true, released: 1 });
    const again = await stub.hostAction({
      ...control(created),
      requestId: crypto.randomUUID(),
      nowMs: Date.now(),
      action: "release-stuck-media",
    });
    expect(again).toMatchObject({ ok: true, released: 0 });
    const statuses = await runInDurableObject(stub, async (_instance, state) =>
      state.storage.sql
        .exec<{ upload_id: string; status: string }>(
          `SELECT upload_id, status FROM media_upload ORDER BY upload_id`,
        )
        .toArray(),
    );
    expect(statuses).toEqual([
      { upload_id: "expired-upload", status: "open" },
      { upload_id: "live-upload", status: "leased" },
    ]);
  });

  it("retries a failed local email job once for the same request", async () => {
    const created = await createRoom();
    const stub = room(created.gameId);
    const amina = await join(stub, "Amina");
    await stub.diagnostics({ ...control(created), nowMs: Date.now() });
    await runInDurableObject(stub, async (_instance, state) => {
      state.storage.sql.exec(
        `INSERT INTO dev_delivery_job (
          job_id, game_id, player_id, purpose, recipient, idempotency_key,
          status, attempts, subject, body_text, created_at, updated_at
        ) VALUES (?, ?, ?, 'results', ?, ?, 'failed', 1, 'Scores', 'Your scores', ?, ?)`,
        `results:${created.gameId}`,
        created.gameId,
        amina.playerId,
        "guest@example.test",
        `results:${created.gameId}`,
        new Date().toISOString(),
        new Date().toISOString(),
      );
    });
    const requestId = crypto.randomUUID();
    const first = await stub.hostAction({
      ...control(created),
      requestId,
      nowMs: Date.now(),
      action: "retry-delivery",
    });
    const replay = await stub.hostAction({
      ...control(created),
      requestId,
      nowMs: Date.now(),
      action: "retry-delivery",
    });
    expect(first).toMatchObject({ ok: true, retried: 1 });
    expect(replay).toMatchObject({ ok: true, retried: 1 });
    const outbox = await runInDurableObject(
      stub,
      async (_instance, state) =>
        state.storage.sql
          .exec<{ total: number }>(`SELECT COUNT(*) AS total FROM dev_email_outbox`)
          .toArray()[0]?.total,
    );
    expect(outbox).toBe(1);
    const summary = await stub.scoreSummary({
      ...control(created),
      nowMs: Date.now(),
    });
    expect(summary.ok).toBe(true);
    if (!summary.ok) {
      return;
    }
    expect(summary.markdown).toContain(`Game ${created.gameId}`);
    expect(summary.markdown).toContain("1. Amina — 0");
    expect(summary.markdown).not.toContain("guest@example.test");
    const downloaded = await apiFetch(
      `http://example.com/api/rooms/${created.gameId}/summary`,
      {
        headers: {
          origin: "http://example.com",
          cookie: controlCookie(created),
        },
      },
    );
    expect(downloaded.status).toBe(200);
    expect(downloaded.headers.get("content-type")).toContain("text/markdown");
    expect(await downloaded.text()).toContain("1. Amina — 0");
  });

  it("keeps the same answer after the room restarts", async () => {
    const created = await createRoom();
    const stub = room(created.gameId);
    await start(stub, created);
    await reach(stub, created, "shape", "collect");
    const amina = await join(stub, "Amina");
    const socket = await connect(stub, created.gameId, guestCookie(amina));
    await nextMatching(socket, (message) => message.kind === "snapshot");
    const requestId = crypto.randomUUID();
    const ack = nextMatching(
      socket,
      (message) => message.kind === "ack" && message.requestId === requestId,
    );
    socket.send(
      JSON.stringify({
        kind: "command",
        name: "answer",
        requestId,
        optionId: "circle",
      }),
    );
    expect((await ack).accepted).toBe(true);
    socket.close();
    expect(await count(stub, `SELECT COUNT(*) AS total FROM choice_answer`)).toBe(1);

    await evictDurableObject(stub);
    expect(await count(stub, `SELECT COUNT(*) AS total FROM choice_answer`)).toBe(1);
    const restored = await connect(stub, created.gameId, guestCookie(amina));
    const snapshot = await nextMatching(
      restored,
      (message) => message.kind === "snapshot",
    );
    expect(JSON.stringify(snapshot)).toContain("circle");
    expect(JSON.stringify(snapshot)).not.toContain("correctOptionId");
    const repeated = await send(restored, { name: "answer", optionId: "star" });
    expect(repeated.accepted).toBe(false);
    restored.close();
    expect(await count(stub, `SELECT COUNT(*) AS total FROM choice_answer`)).toBe(1);
    const summary = await stub.scoreSummary({
      ...control(created),
      nowMs: Date.now(),
    });
    expect(summary.ok && summary.markdown).toContain("Amina");
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

function controlCookie(created: Awaited<ReturnType<typeof createRoom>>): string {
  return `26_room_control=${created.control.credentialId}.${created.control.secret}`;
}

function guestCookie(joined: { gameId: string; playerId: string; secret: string }) {
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

async function send(socket: WebSocket, command: Record<string, unknown>) {
  const requestId = crypto.randomUUID();
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

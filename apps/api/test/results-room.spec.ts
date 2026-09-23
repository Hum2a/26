import { env, runInDurableObject } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { apiFetch } from "./api-fetch.ts";
import { EmailUncertain, type OutboundEmail } from "../src/auth/create-email.ts";
import { acceptedKey } from "../src/media/keys.ts";
import { payloadDigest } from "../src/room/digest.ts";
import { PartyRoom } from "../src/room/party-room.ts";

describe("public results stay separate from a personal recap", () => {
  it("shows standings without credentials, device rows, or another player's recap", async () => {
    const created = await createRoom();
    const stub = room(created.gameId);
    const amina = await join(stub, "Amina");
    const bilal = await join(stub, "Bilal");
    const mediaId = crypto.randomUUID();
    const finalKey = acceptedKey(created.gameId, mediaId);
    await runInDurableObject(stub, async (_instance, state) => {
      state.storage.sql.exec(
        `INSERT INTO media_upload (
           upload_id, request_id, player_id, kind, question_index, temp_key,
           media_id, final_key, content_type, status, attempts, created_at, hidden
         ) VALUES (?, ?, ?, 'photo', 0, 'temp/photo', ?, ?, 'image/jpeg', 'accepted', 0, ?, 0)`,
        crypto.randomUUID(),
        crypto.randomUUID(),
        amina.playerId,
        mediaId,
        finalKey,
        Date.now(),
      );
      state.storage.sql.exec(
        `INSERT INTO device_context (
           context_id, player_id, collector_version, participating, material_hash,
           report_json, created_at, updated_at
         ) VALUES (?, ?, 1, 1, 'hash', ?, ?, ?)`,
        crypto.randomUUID(),
        amina.playerId,
        JSON.stringify({ marker: "PRIVATE-DEVICE-RESULTS" }),
        Date.now(),
        Date.now(),
      );
    });
    await env.MEDIA_BUCKET.put(finalKey, new Uint8Array([1, 2, 3]));
    await reachPodium(stub, created);
    await finishArchive(stub);

    const published = await apiFetch(
      `http://example.com/api/rooms/${created.gameId}/results`,
    );
    const body = await published.text();
    expect(published.status).toBe(200);
    expect(body).toContain("Amina");
    expect(body).toContain("Bilal");
    expect(body).toContain("Shared by Amina, who sent this photo.");
    expect(body).not.toContain(amina.playerId);
    expect(body).not.toContain(bilal.playerId);
    expect(body).not.toContain(amina.secret);
    expect(body).not.toContain("PRIVATE-DEVICE-RESULTS");
    expect(body).not.toContain("playerId");

    const guessed = await apiFetch(
      `http://example.com/api/rooms/${created.gameId}/results/mine?playerId=${amina.playerId}`,
    );
    expect(guessed.status).toBe(401);

    const own = await apiFetch(
      `http://example.com/api/rooms/${created.gameId}/results/mine`,
      {
        headers: { cookie: guestCookie(created.gameId, amina) },
      },
    );
    expect(own.status).toBe(200);
    const personal = (await own.json()) as { nickname: string };
    expect(personal.nickname).toBe("Amina");
    expect(JSON.stringify(personal)).not.toContain("Bilal");
    expect(JSON.stringify(personal)).not.toContain(amina.secret);

    const visible = await apiFetch(
      `http://example.com/api/rooms/${created.gameId}/gallery/${mediaId}`,
    );
    expect(visible.status).toBe(200);
    expect(visible.headers.get("cache-control")).toBe(
      "public, max-age=60, must-revalidate",
    );

    const hidden = await stub.hostAction({
      ...control(created),
      requestId: crypto.randomUUID(),
      nowMs: Date.now(),
      action: "hide-media",
      mediaId,
    });
    expect(hidden.ok).toBe(true);
    const removed = await apiFetch(
      `http://example.com/api/rooms/${created.gameId}/gallery/${mediaId}`,
    );
    expect(removed.status).toBe(404);
    expect(removed.headers.get("cache-control")).toBe("no-store");
    expect((await stub.snapshotFor("stage")).archive).toBeUndefined();
  });

  it("confirms an address once, retries an uncertain send, and expires a personal link", async () => {
    const created = await createRoom();
    const stub = room(created.gameId);
    const amina = await join(stub, "Amina");
    await reachPodium(stub, created);
    await finishArchive(stub);
    await runInDurableObject(stub, async (instance) => {
      const target = instance as PartyRoom & { sentMail?: OutboundEmail[] };
      target.sentMail = [];
      target.useEmailSender({
        kind: "local-inbox",
        async send(message) {
          target.sentMail?.push(message);
          if (target.sentMail?.length === 1) {
            throw new EmailUncertain();
          }
        },
      });
    });

    const first = await postEmail(created.gameId, amina, "Amina@Example.test");
    expect(first).toEqual({ status: "uncertain" });
    const second = await postEmail(created.gameId, amina, "amina@example.test");
    expect(second).toEqual({ status: "sent" });
    const third = await postEmail(created.gameId, amina, "amina@example.test");
    expect(third).toEqual({ status: "sent" });
    const sent = await readMail(stub);
    expect(sent).toHaveLength(2);
    expect(sent[0]?.idempotencyKey).toBe(sent[1]?.idempotencyKey);
    expect(sent[0]?.text).not.toContain(amina.secret);

    const verify = linkParam(sent[1]?.text ?? "", "verify");
    const confirmed = await apiFetch(
      `http://example.com/api/rooms/${created.gameId}/results/verify`,
      {
        method: "POST",
        headers: { "content-type": "application/json", origin: "http://example.com" },
        body: JSON.stringify({ token: verify, playerId: "someone-else" }),
      },
    );
    expect(await confirmed.json()).toEqual({ status: "sent" });
    const mailed = await readMail(stub);
    expect(mailed).toHaveLength(3);
    const recap = linkParam(mailed[2]?.text ?? "", "recap");
    expect(recap).not.toBe("");
    expect(mailed[2]?.text).not.toContain(amina.secret);

    const opened = await apiFetch(
      `http://example.com/api/rooms/${created.gameId}/results/mine?token=${encodeURIComponent(recap)}&playerId=guessed`,
    );
    expect(opened.status).toBe(200);
    expect(((await opened.json()) as { nickname: string }).nickname).toBe("Amina");

    const guessed = await apiFetch(
      `http://example.com/api/rooms/${created.gameId}/results/mine?token=not-a-grant`,
    );
    expect(guessed.status).toBe(404);

    await runInDurableObject(stub, async (_instance, state) => {
      state.storage.sql.exec(
        `UPDATE dev_email_grant SET expires_at = ? WHERE purpose = 'results'`,
        new Date(0).toISOString(),
      );
    });
    const expired = await apiFetch(
      `http://example.com/api/rooms/${created.gameId}/results/mine?token=${encodeURIComponent(recap)}`,
    );
    expect(expired.status).toBe(410);

    const jobs = await runInDurableObject(stub, async (_instance, state) =>
      state.storage.sql.exec(`SELECT job_id FROM dev_delivery_job`).toArray(),
    );
    expect(jobs).toHaveLength(2);
  });

  it("keeps one local outbox message when the same address is asked twice", async () => {
    const created = await createRoom();
    const stub = room(created.gameId);
    const amina = await join(stub, "Amina");
    await reachPodium(stub, created);
    await finishArchive(stub);
    expect(await postEmail(created.gameId, amina, "amina@example.test")).toEqual({
      status: "sent",
    });
    expect(await postEmail(created.gameId, amina, "amina@example.test")).toEqual({
      status: "sent",
    });
    const rows = await runInDurableObject(stub, async (_instance, state) =>
      state.storage.sql.exec(`SELECT recipient FROM dev_email_outbox`).toArray(),
    );
    expect(rows).toHaveLength(1);
  });

  it("leaves an unknown game without standings", async () => {
    const missing = await apiFetch("http://example.com/api/rooms/ABCDEFGH/results");
    expect(await missing.json()).toEqual({ state: "unknown" });
  });
});

function linkParam(text: string, name: string): string {
  const match = text.match(/https?:\/\/\S+/);
  if (!match?.[0]) {
    return "";
  }
  return new URL(match[0]).searchParams.get(name) ?? "";
}

async function postEmail(
  gameId: string,
  guest: { playerId: string; secret: string },
  email: string,
) {
  const response = await apiFetch(
    `http://example.com/api/rooms/${gameId}/results/email`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "http://example.com",
        cookie: guestCookie(gameId, guest),
      },
      body: JSON.stringify({ email, playerId: "guessed-player" }),
    },
  );
  return response.json();
}

async function readMail(stub: ReturnType<typeof room>) {
  return runInDurableObject(stub, async (instance) => {
    const target = instance as PartyRoom & { sentMail?: OutboundEmail[] };
    return target.sentMail ?? [];
  });
}

async function finishArchive(stub: ReturnType<typeof room>) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    if ((await stub.snapshotFor("control")).archive?.status === "completed") {
      return;
    }
    await runInDurableObject(stub, async (_instance, state) => {
      state.storage.sql.exec(
        `UPDATE schedule_job SET due_at = ?, status = 'pending' WHERE job_id = 'archive-export'`,
        Date.now() - 1,
      );
    });
    await runInDurableObject(stub, async (instance) => {
      await (instance as PartyRoom).alarm();
    });
  }
  throw new Error("The archive did not finish.");
}

async function reachPodium(
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
  const finished = await stub.finishRound({
    ...control(created),
    requestId: crypto.randomUUID(),
    nowMs: Date.now(),
  });
  if (!finished.ok) {
    throw new Error(finished.message);
  }
  for (let step = 0; step < 16; step += 1) {
    const snapshot = await stub.snapshotFor("stage");
    if (snapshot.phase === "podium") {
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
  throw new Error("The room did not reach the podium.");
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

function guestCookie(gameId: string, guest: { playerId: string; secret: string }) {
  return `26_guest=${gameId}.${guest.playerId}.${guest.secret}`;
}

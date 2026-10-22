import { env, runInDurableObject } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { apiFetch } from "./api-fetch.ts";
import type { ArchiveDocument } from "../src/archive/document.ts";
import { sqliteMirror } from "../src/archive/mirror.ts";
import type { ArchiveWriter } from "../src/archive/store.ts";
import { payloadDigest } from "../src/room/digest.ts";
import { PartyRoom } from "../src/room/party-room.ts";

describe("completed games become an archive", () => {
  it("shows the podium before export and keeps it when the database fails", async () => {
    const created = await createRoom();
    const stub = room(created.gameId);
    await join(stub, "Amina");
    await bindWriter(stub, (box) => {
      box.fail = 8;
    });
    await reachPodium(stub, created);

    const stage = await stub.snapshotFor("stage");
    expect(stage.phase).toBe("podium");
    expect(stage.archive).toBeUndefined();
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const current = await stub.snapshotFor("control");
      if (current.archive?.status === "failed") {
        break;
      }
      await pullExport(stub);
      await bindWriter(stub);
      await fireAlarm(stub);
    }
    const failed = await stub.snapshotFor("control");
    expect(failed.phase).toBe("podium");
    expect(failed.archive?.status).toBe("failed");
    expect((await stub.snapshotFor("stage")).archive).toBeUndefined();

    const retried = await stub.hostAction({
      ...control(created),
      requestId: crypto.randomUUID(),
      nowMs: Date.now(),
      action: "retry-archive",
    });
    expect(retried.ok).toBe(true);
    await bindWriter(stub, (box) => {
      box.fail = 0;
    });
    await pullExport(stub);
    await fireAlarm(stub);
    const completed = await stub.snapshotFor("control");
    expect(completed.archive?.status).toBe("completed");
    expect(completed.phase).toBe("podium");
    const stored = await storedDocuments(stub);
    expect(stored).toHaveLength(1);
  });

  it("does not append a second publication after a lost acknowledgement", async () => {
    const created = await createRoom();
    const stub = room(created.gameId);
    await join(stub, "Amina");
    await bindWriter(stub, (box) => {
      box.fail = 1;
      box.loseAck = true;
    });
    await reachPodium(stub, created);
    if ((await storedDocuments(stub)).length === 0) {
      await fireAlarm(stub);
    }
    expect((await stub.snapshotFor("control")).archive?.status).toBe("pending");
    await pullExport(stub);
    await bindWriter(stub, (box) => {
      box.fail = 0;
      box.loseAck = false;
    });
    await fireAlarm(stub);
    expect((await stub.snapshotFor("control")).archive?.status).toBe("completed");
    expect(await storedDocuments(stub)).toHaveLength(1);
  });

  it("survives a later alarm and stores one mirror row", async () => {
    const created = await createRoom();
    const stub = room(created.gameId);
    await join(stub, "Amina");
    await reachPodium(stub, created);
    await runInDurableObject(stub, async (instance, state) => {
      (instance as PartyRoom).useArchiveWriter(sqliteMirror(state.storage));
    });
    await fireAlarm(stub);
    await fireAlarm(stub);
    const rows = await runInDurableObject(stub, async (_instance, state) =>
      state.storage.sql
        .exec<{ game_id: string }>(`SELECT game_id FROM dev_archive_publication`)
        .toArray(),
    );
    expect(rows).toHaveLength(1);
    expect((await stub.snapshotFor("stage")).phase).toBe("podium");
    expect((await stub.snapshotFor("control")).archive?.status).toBe("completed");
  });

  it("writes a correction revision and leaves the earlier media flag frozen", async () => {
    const created = await createRoom();
    const stub = room(created.gameId);
    const amina = await join(stub, "Amina");
    await bindWriter(stub);
    const mediaId = crypto.randomUUID();
    await runInDurableObject(stub, async (_instance, state) => {
      state.storage.sql.exec(
        `INSERT INTO media_upload (
           upload_id, request_id, player_id, kind, question_index, temp_key,
           media_id, status, attempts, created_at, hidden
         ) VALUES (?, ?, ?, 'photo', 0, 'temp/photo', ?, 'accepted', 0, ?, 0)`,
        crypto.randomUUID(),
        crypto.randomUUID(),
        amina.playerId,
        mediaId,
        Date.now(),
      );
    });
    await reachPodium(stub, created);
    if ((await storedDocuments(stub)).length === 0) {
      await fireAlarm(stub);
    }
    const hidden = await stub.hostAction({
      ...control(created),
      requestId: crypto.randomUUID(),
      nowMs: Date.now(),
      action: "hide-media",
      mediaId,
    });
    expect(hidden.ok).toBe(true);
    await bindWriter(stub);
    await pullExport(stub);
    await fireAlarm(stub);
    const documents = await storedDocuments(stub);
    expect(documents.map((item) => item.kind)).toEqual(["final", "correction"]);
    expect(documents[0]?.hidden).toEqual([false]);
    expect(documents[1]?.hidden).toEqual([true]);
    expect(documents[0]?.revision).not.toBe(documents[1]?.revision);
  });

  it("writes a score correction without changing the stored final points", async () => {
    const created = await createRoom();
    const stub = room(created.gameId);
    const amina = await join(stub, "Amina");
    await bindWriter(stub);
    await reachPodium(stub, created);
    if ((await storedDocuments(stub)).length === 0) {
      await fireAlarm(stub);
    }
    const adjusted = await stub.hostAction({
      ...control(created),
      requestId: crypto.randomUUID(),
      nowMs: Date.now(),
      action: "adjust",
      playerId: amina.playerId,
      points: 5,
      reason: "Late correction",
    });
    expect(adjusted.ok).toBe(true);
    await bindWriter(stub);
    await pullExport(stub);
    await fireAlarm(stub);
    const documents = await storedDocuments(stub);
    expect(documents).toHaveLength(2);
    expect(documents[0]?.points).toEqual([0]);
    expect(documents[1]?.points).toEqual([5]);
    expect(documents[1]?.kind).toBe("correction");
  });

  it("reports preparing and ready without reading the archive database", async () => {
    const missing = await apiFetch("http://example.com/api/rooms/ABCDEFGH/results");
    expect(missing.status).toBe(200);
    expect(await missing.json()).toEqual({ state: "unknown" });

    const created = await createRoom();
    const stub = room(created.gameId);
    await join(stub, "Amina");
    await bindWriter(stub, (box) => {
      box.fail = 1;
    });
    await reachPodium(stub, created);
    const preparing = await apiFetch(
      `http://example.com/api/rooms/${created.gameId}/results`,
    );
    expect(await preparing.json()).toEqual({ state: "preparing" });

    await bindWriter(stub, (box) => {
      box.fail = 0;
    });
    await pullExport(stub);
    await fireAlarm(stub);
    const ready = await apiFetch(
      `http://example.com/api/rooms/${created.gameId}/results`,
    );
    expect(await ready.json()).toEqual({ state: "ready" });
    expect((await stub.snapshotFor("stage")).phase).toBe("podium");
  });
});

type ArchiveBox = {
  documents: ArchiveDocument[];
  keys: Set<string>;
  fail: number;
  loseAck: boolean;
};

async function bindWriter(
  stub: ReturnType<typeof room>,
  update?: (box: ArchiveBox) => void,
) {
  await runInDurableObject(stub, async (instance) => {
    const roomInstance = instance as PartyRoom & { archiveBox?: ArchiveBox };
    roomInstance.archiveBox ??= {
      documents: [],
      keys: new Set<string>(),
      fail: 0,
      loseAck: false,
    };
    update?.(roomInstance.archiveBox);
    const box = roomInstance.archiveBox;
    const writer: ArchiveWriter = {
      async write(document) {
        const key = `${document.gameId}:${document.revision}`;
        if (box.keys.has(key)) {
          return "present";
        }
        if (box.fail > 0) {
          box.fail -= 1;
          if (box.loseAck) {
            box.keys.add(key);
            box.documents.push(document);
          }
          throw new Error("unavailable");
        }
        box.keys.add(key);
        box.documents.push(document);
        return "stored";
      },
      async purgeDeviceDetails() {
        return 0;
      },
      async readPublic() {
        return null;
      },
      async readPersonal() {
        return null;
      },
    };
    roomInstance.useArchiveWriter(writer);
  });
}

async function storedDocuments(stub: ReturnType<typeof room>) {
  return runInDurableObject(stub, async (instance) => {
    const box = (instance as PartyRoom & { archiveBox?: ArchiveBox }).archiveBox;
    return (box?.documents ?? []).map((document) => ({
      revision: document.revision,
      kind: document.kind,
      points: document.standings.map((standing) => standing.points),
      hidden: document.media.map((item) => item.hidden),
    }));
  });
}

async function fireAlarm(stub: ReturnType<typeof room>) {
  await runInDurableObject(stub, async (instance) => {
    await (instance as PartyRoom).alarm();
  });
}

async function pullExport(stub: ReturnType<typeof room>) {
  await runInDurableObject(stub, async (_instance, state) => {
    state.storage.sql.exec(
      `UPDATE schedule_job SET due_at = ?, status = 'pending' WHERE job_id = 'archive-export'`,
      Date.now() - 1,
    );
  });
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
  for (let step = 0; step < 32; step += 1) {
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

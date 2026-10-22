import { env, runInDurableObject } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { payloadDigest } from "../src/room/digest.ts";

describe("fun facts at the end of the night", () => {
  it("shows one sentence at a time, then the podium queues the archive", async () => {
    const created = await createRoom();
    const stub = room(created.gameId);
    const nia = await join(stub, "Nia");
    const others = [];
    for (const nickname of ["Bea", "Cal", "Dee", "Eli", "Fay"]) {
      others.push(await join(stub, nickname));
    }
    await storeReports(stub, [
      [nia.playerId, "firefox"],
      ...others.map((guest) => [guest.playerId, "chrome"] as const),
    ]);
    await start(stub, created);
    await finish(stub, created);
    const skipped = await stub.skipRound({
      ...control(created),
      requestId: crypto.randomUUID(),
      nowMs: Date.now(),
    });
    expect(skipped.ok).toBe(true);
    await finish(stub, created);

    const stage = await stub.snapshotFor("stage");
    expect(stage.phase).toBe("facts");
    expect(stage.funFact).toMatchObject({
      index: 0,
      card: { text: "Illustrative. 1 person used Firefox." },
    });
    expect(stage.funFact?.appliesToYou).toBeUndefined();
    expect(stage.funFactList).toBeUndefined();
    expect(stage.highlights).toBeUndefined();
    expect(JSON.stringify(stage.funFact)).not.toContain("Chrome");
    expect(JSON.stringify(stage.funFact)).not.toContain(nia.playerId);

    const niaView = await stub.snapshotFor("guest", nia.playerId);
    expect(niaView.funFact?.appliesToYou).toBe(true);
    expect(niaView.funFactList).toBeUndefined();
    const otherView = await stub.snapshotFor("guest", others[0]!.playerId);
    expect(otherView.funFact?.appliesToYou).toBe(false);

    const host = await stub.snapshotFor("control");
    expect(host.funFactList?.index).toBe(0);
    expect(host.funFactList?.cards.length).toBeGreaterThan(1);
    expect(host.funFactList?.cards[1]?.text).toContain("Chrome");
    expect(host.funFact).toBeUndefined();
    expect(await pendingGameplay(stub)).toBe(0);
    expect(await archiveRows(stub)).toBe(0);

    const moved = await stub.advanceRound({
      ...control(created),
      requestId: crypto.randomUUID(),
      nowMs: Date.now(),
    });
    expect(moved.ok).toBe(true);
    const next = await stub.snapshotFor("stage");
    expect(next.phase).toBe("facts");
    expect(next.funFact?.index).toBe(1);
    expect(next.funFact?.card.text).toContain("Chrome");

    for (let step = 0; step < 12; step += 1) {
      const current = await stub.snapshotFor("stage");
      if (current.phase === "podium") {
        break;
      }
      const advanced = await stub.advanceRound({
        ...control(created),
        requestId: crypto.randomUUID(),
        nowMs: Date.now(),
      });
      expect(advanced.ok).toBe(true);
    }
    const podium = await stub.snapshotFor("stage");
    expect(podium.phase).toBe("podium");
    expect(podium.funFact).toBeUndefined();
    expect(await archiveRows(stub)).toBe(1);
  });

  it("skips the beat when there is nothing to say", async () => {
    const created = await createRoom();
    const stub = room(created.gameId);
    await start(stub, created);
    await finish(stub, created);
    const skipped = await stub.skipRound({
      ...control(created),
      requestId: crypto.randomUUID(),
      nowMs: Date.now(),
    });
    expect(skipped.ok).toBe(true);
    expect((await stub.snapshotFor("stage")).phase).toBe("final");
    await finish(stub, created);
    expect((await stub.snapshotFor("stage")).phase).toBe("podium");
  });

  it("lets the host leave the facts for the podium", async () => {
    const created = await createRoom();
    const stub = room(created.gameId);
    const nia = await join(stub, "Nia");
    const bea = await join(stub, "Bea");
    const cal = await join(stub, "Cal");
    await storeReports(stub, [
      [nia.playerId, "firefox"],
      [bea.playerId, "chrome"],
      [cal.playerId, "chrome"],
    ]);
    await start(stub, created);
    await finish(stub, created);
    await stub.skipRound({
      ...control(created),
      requestId: crypto.randomUUID(),
      nowMs: Date.now(),
    });
    await finish(stub, created);
    expect((await stub.snapshotFor("stage")).phase).toBe("facts");
    await finish(stub, created);
    const podium = await stub.snapshotFor("stage");
    expect(podium.phase).toBe("podium");
    expect(podium.funFact).toBeUndefined();
    expect(await archiveRows(stub)).toBe(1);
  });
});

async function pendingGameplay(stub: ReturnType<typeof room>): Promise<number> {
  return runInDurableObject(stub, async (_instance, state) => {
    const row = state.storage.sql
      .exec<{ total: number }>(
        `SELECT COUNT(*) AS total FROM schedule_job
         WHERE job_type = 'gameplay' AND status = 'pending'`,
      )
      .toArray()[0];
    return row?.total ?? 0;
  });
}

async function archiveRows(stub: ReturnType<typeof room>): Promise<number> {
  return runInDurableObject(stub, async (_instance, state) => {
    const row = state.storage.sql
      .exec<{ total: number }>(`SELECT COUNT(*) AS total FROM room_archive`)
      .toArray()[0];
    return row?.total ?? 0;
  });
}

async function storeReports(
  stub: ReturnType<typeof room>,
  rows: readonly (readonly [string, string])[],
) {
  await runInDurableObject(stub, async (_instance, state) => {
    const now = Date.now();
    for (const [playerId, browser] of rows) {
      const contextId = crypto.randomUUID();
      state.storage.sql.exec(
        `INSERT INTO device_context (
           context_id, player_id, collector_version, participating, material_hash,
           phase_generation, report_json, created_at, updated_at
         ) VALUES (?, ?, 1, 1, ?, NULL, ?, ?, ?)`,
        contextId,
        playerId,
        `report-${browser}-${playerId}`,
        reportJson(browser),
        now,
        now,
      );
      state.storage.sql.exec(
        `UPDATE player SET device_context_id = ?, device_context_version = 1 WHERE player_id = ?`,
        contextId,
        playerId,
      );
    }
  });
}

function reportJson(browser: string): string {
  return JSON.stringify({
    parserVersion: 1,
    deviceFamily: "iphone",
    classification: "reported",
    inference: "user-agent",
    osFamily: "iOS",
    osMajor: 17,
    browserFamily: browser,
    browserMajor: 120,
    screen: { width: 390, height: 844, shortEdge: 390 },
    screenGroup: "narrower",
    viewport: { width: 390, height: 800 },
    pixelRatio: 3,
    orientation: "portrait",
    input: { maxTouchPoints: 5, pointer: "coarse", hover: "none" },
    hardware: { logicalProcessors: 4, memoryGb: 4 },
    locale: { languages: ["en-GB"], timeZone: "Europe/London" },
    presentation: {
      colorScheme: "dark",
      reducedMotion: "no-preference",
      mediaDevices: true,
      webSocket: true,
    },
    network: {
      quality: "4g",
      downlinkMbps: 10,
      rttMs: 50,
      saveData: false,
      bearer: "unknown",
    },
    physical: { size: "unknown", model: "unknown" },
  });
}

async function finish(
  stub: ReturnType<typeof room>,
  created: Awaited<ReturnType<typeof createRoom>>,
) {
  const finished = await stub.finishRound({
    ...control(created),
    requestId: crypto.randomUUID(),
    nowMs: Date.now(),
  });
  if (!finished.ok) {
    throw new Error(finished.message);
  }
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

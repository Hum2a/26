import {
  env,
  evictDurableObject,
  runDurableObjectAlarm,
  runInDurableObject,
} from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { withClientApiQuery } from "./client-api-key.ts";
import { payloadDigest } from "../src/room/digest.ts";

describe("durable phase alarms", () => {
  it("receipts a stale host advance once and rejects invalid phase guards", async () => {
    const created = await createRoom();
    const stub = room(created.gameId);
    const nowMs = Date.now();
    await stub.startFixture({
      ...control(created),
      requestId: crypto.randomUUID(),
      nowMs,
      durations: { intro: 60_000, prompt: 60_000 },
    });
    const expectedPhaseGeneration = (await stub.snapshotFor("control")).phaseGeneration;
    expect(expectedPhaseGeneration).toEqual(expect.any(Number));
    const command = {
      ...control(created),
      requestId: crypto.randomUUID(),
      nowMs,
      expectedPhaseGeneration,
    };
    const first = await stub.advanceRound(command);
    expect(first.ok && first.phase).toBe("prompt");
    await evictDurableObject(stub);
    expect(await stub.advanceRound(command)).toEqual(first);
    const stale = { ...command, requestId: crypto.randomUUID() };
    const receipt = await stub.advanceRound(stale);
    expect(receipt.ok && receipt.phase).toBe("prompt");
    expect(await stub.advanceRound(stale)).toEqual(receipt);
    expect(
      (
        await stub.advanceRound({
          ...command,
          requestId: crypto.randomUUID(),
          expectedPhaseGeneration: -1,
        })
      ).ok,
    ).toBe(false);
    expect((await stub.snapshotFor("stage")).phase).toBe("prompt");
  });
  it("wakes an idle room from the saved alarm without another guest message", async () => {
    const created = await createRoom();
    const stub = room(created.gameId);
    const started = await stub.startFixture({
      ...control(created),
      requestId: crypto.randomUUID(),
      nowMs: Date.now(),
      durations: { intro: 60_000, prompt: 60_000 },
    });
    expect(started.ok).toBe(true);
    if (!started.ok) {
      return;
    }
    expect(started.phase).toBe("intro");

    const armed = await runInDurableObject(stub, async (_instance, state) =>
      state.storage.getAlarm(),
    );
    expect(armed).not.toBeNull();
    await makeDue(stub);
    await evictDurableObject(stub);
    expect(await runDurableObjectAlarm(stub)).toBe(true);
    expect((await stub.snapshotFor("stage")).phase).toBe("prompt");
  });

  it("keeps a paused phase across a restart and resumes the saved remainder", async () => {
    const created = await createRoom();
    const stub = room(created.gameId);
    const nowMs = Date.now();
    await stub.startFixture({
      ...control(created),
      requestId: crypto.randomUUID(),
      nowMs,
      durations: { intro: 60_000 },
    });
    const paused = await stub.pauseRound({
      ...control(created),
      requestId: crypto.randomUUID(),
      nowMs: nowMs + 1_000,
    });
    expect(paused.ok && paused.paused).toBe(true);

    await evictDurableObject(stub);
    const resumed = await stub.resumeRound({
      ...control(created),
      requestId: crypto.randomUUID(),
      nowMs: nowMs + 5_000,
    });
    expect(resumed.ok).toBe(true);
    if (!resumed.ok) {
      return;
    }
    expect(resumed.phase).toBe("intro");
    expect(resumed.paused).toBe(false);
    const deadline = await runInDurableObject(stub, async (_instance, state) => {
      const row = state.storage.sql
        .exec<{ due_at: number | null }>(
          `SELECT due_at FROM schedule_job WHERE status = 'pending' AND job_type = 'gameplay'`,
        )
        .toArray()[0];
      return row?.due_at ?? null;
    });
    expect(deadline).toBe(nowMs + 64_000);
  });

  it("does not advance twice when the host moves first and the alarm arrives later", async () => {
    const created = await createRoom();
    const stub = room(created.gameId);
    const nowMs = Date.now();
    await stub.startFixture({
      ...control(created),
      requestId: crypto.randomUUID(),
      nowMs,
      durations: { intro: 60_000, prompt: 120_000 },
    });
    const moved = await stub.advanceRound({
      ...control(created),
      requestId: crypto.randomUUID(),
      nowMs,
    });
    expect(moved.ok && moved.phase).toBe("prompt");
    expect(await runDurableObjectAlarm(stub)).toBe(true);
    expect((await stub.snapshotFor("stage")).phase).toBe("prompt");
  });

  it("treats a second alarm delivery as already handled", async () => {
    const created = await createRoom();
    const stub = room(created.gameId);
    await stub.startFixture({
      ...control(created),
      requestId: crypto.randomUUID(),
      nowMs: Date.now(),
      durations: { intro: 60_000, prompt: 120_000 },
    });
    await makeDue(stub);
    expect(await runDurableObjectAlarm(stub)).toBe(true);
    expect(await runDurableObjectAlarm(stub)).toBe(true);
    expect((await stub.snapshotFor("stage")).phase).toBe("prompt");
  });

  it("rejects an answer from the stored deadline before the alarm closes collection", async () => {
    const created = await createRoom();
    const stub = room(created.gameId);
    const nowMs = Date.now();
    await stub.startFixture({
      ...control(created),
      requestId: crypto.randomUUID(),
      nowMs,
      includeVote: false,
      durations: { intro: 60_000, prompt: 60_000, collect: 60_000 },
    });
    await makeDue(stub);
    expect(await runDurableObjectAlarm(stub)).toBe(true);
    await makeDue(stub);
    expect(await runDurableObjectAlarm(stub)).toBe(true);
    expect((await stub.snapshotFor("stage")).phase).toBe("collect");

    const joined = await stub.joinPlayer({
      nickname: "Amina",
      requestId: crypto.randomUUID(),
      now: new Date(nowMs).toISOString(),
    });
    expect(joined.ok).toBe(true);
    if (!joined.ok) {
      return;
    }
    await expect(
      stub.acceptFixtureAnswer({ playerId: joined.playerId, nowMs: Date.now() }),
    ).resolves.toEqual({
      ok: true,
    });
    await expect(
      stub.acceptFixtureAnswer({
        playerId: joined.playerId,
        nowMs: Date.now() + 120_000,
      }),
    ).resolves.toEqual({ ok: false, message: "That answer is too late." });
    expect((await stub.snapshotFor("stage")).phase).toBe("collect");
  });

  it("closes collection without the controller and still runs it while the stage is away", async () => {
    const created = await createRoom();
    const stub = room(created.gameId);
    const nowMs = Date.now();
    await stub.startFixture({
      ...control(created),
      requestId: crypto.randomUUID(),
      nowMs,
      durations: { intro: 60_000, prompt: 60_000, collect: 60_000, vote: 60_000 },
    });
    await makeDue(stub);
    expect(await runDurableObjectAlarm(stub)).toBe(true);
    await makeDue(stub);
    expect(await runDurableObjectAlarm(stub)).toBe(true);
    await makeDue(stub);
    expect(await runDurableObjectAlarm(stub)).toBe(true);
    const held = await stub.snapshotFor("stage");
    expect(held.phase).toBe("vote");
    expect(held.held).toBe(true);
    expect(held.deadlineAt).toBeNull();

    const response = await stub.fetch(
      socketRequest(created.gameId, controlCookie(created), "control"),
    );
    expect(response.status).toBe(101);
    response.webSocket?.accept();
    const released = await stub.snapshotFor("stage");
    expect(released.held).toBe(false);
    expect(released.phase).toBe("vote");
    expect(released.deadlineAt).not.toBeNull();
    response.webSocket?.close();

    const staged = await createRoom();
    const stageRoom = room(staged.gameId);
    await stageRoom.startFixture({
      ...control(staged),
      requestId: crypto.randomUUID(),
      nowMs: Date.now(),
      durations: { intro: 60_000, prompt: 60_000, collect: 60_000, vote: 60_000 },
    });
    const stageSocket = await stageRoom.fetch(
      socketRequest(staged.gameId, controlCookie(staged), "control"),
    );
    expect(stageSocket.status).toBe(101);
    stageSocket.webSocket?.accept();
    await makeDue(stageRoom);
    expect(await runDurableObjectAlarm(stageRoom)).toBe(true);
    await makeDue(stageRoom);
    expect(await runDurableObjectAlarm(stageRoom)).toBe(true);
    await makeDue(stageRoom);
    expect(await runDurableObjectAlarm(stageRoom)).toBe(true);
    const moving = await stageRoom.snapshotFor("stage");
    expect(moving.phase).toBe("vote");
    expect(moving.held).toBe(false);
    stageSocket.webSocket?.close();
  });

  it("drops a job insert when the storage transaction fails before the alarm is armed", async () => {
    const created = await createRoom();
    const stub = room(created.gameId);
    await runInDurableObject(stub, async (_instance, state) => {
      await expect(
        state.storage.transaction(async () => {
          state.storage.sql.exec(
            `INSERT INTO schedule_job (
              job_id, job_type, due_at, remaining_ms, scope_generation, phase_generation,
              phase, status, retry_count, payload, created_at
            ) VALUES ('job-1', 'gameplay', 1, NULL, 1, 1, 'intro', 'pending', 0, '{}', 1)`,
          );
          throw new Error("alarm failed");
        }),
      ).rejects.toThrow("alarm failed");
      const rows = state.storage.sql
        .exec<{ job_id: string }>(`SELECT job_id FROM schedule_job`)
        .toArray();
      expect(rows.map((row) => row.job_id)).toEqual(["telemetry-retention"]);
      const alarm = await state.storage.getAlarm();
      expect(alarm).not.toBeNull();
      expect(alarm ?? 0).toBeGreaterThan(Date.now());
    });
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

function controlCookie(created: Awaited<ReturnType<typeof createRoom>>): string {
  return `26_room_control=${created.control.credentialId}.${created.control.secret}`;
}

async function makeDue(stub: ReturnType<typeof room>): Promise<void> {
  await runInDurableObject(stub, async (_instance, state) => {
    state.storage.sql.exec(
      `UPDATE schedule_job SET due_at = ? WHERE status = 'pending' AND job_type = 'gameplay'`,
      Date.now() - 1,
    );
  });
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

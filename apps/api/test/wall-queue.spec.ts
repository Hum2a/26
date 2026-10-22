import { runDurableObjectAlarm, runInDurableObject } from "cloudflare:test";
import { expect, it } from "vitest";
import { wallAdvancePayload } from "../src/room/lifecycle.ts";
import { syncWall } from "../src/wall/queue.ts";
import { phone, posts, setup, upload, wallSettings, type Player, type Stub } from "./wall-support.ts";

async function send(stub: Stub, gameId: string, player: Player) {
  const photo = await upload(stub, player);
  if (!photo.ok) throw new Error(photo.message);
  const socket = await phone(stub, gameId, player);
  const ack = await socket.send({ name: "wall-post", mediaId: photo.mediaId });
  socket.socket.close();
  if (!ack.accepted) throw new Error(ack.error);
  const [post] = (await posts(stub, player.playerId)).slice(-1);
  if (!post) throw new Error("no post");
  return post;
}

function advanceJob(stub: Stub) {
  return runInDurableObject(stub, (_instance, state) =>
    state.storage.sql
      .exec<{ status: string; due_at: number | null }>(
        `SELECT status, due_at FROM schedule_job WHERE job_id = ?`,
        wallAdvancePayload,
      )
      .toArray()[0] ?? null,
  );
}

/**
 * Moves the photo on screen and its wake-up into the past, then fires the alarm.
 * An alarm set in the past may already have run by itself, so the result of
 * `runDurableObjectAlarm` is not asserted; the wall state is.
 */
async function timeUp(stub: Stub) {
  await runInDurableObject(stub, async (_instance, state) => {
    const past = Date.now() - 1;
    state.storage.sql.exec(`UPDATE wall_post SET until_at = ? WHERE status = 'showing'`, past);
    state.storage.sql.exec(
      `UPDATE schedule_job SET due_at = ? WHERE job_id = ? AND status = 'pending'`,
      past,
      wallAdvancePayload,
    );
    await state.storage.setAlarm(past);
  });
  await runDurableObjectAlarm(stub);
}

it("holds a pending photo off the wall and schedules nothing", async () => {
  const { gameId, stub, join } = await setup();
  const amina = await join("Amina");
  const post = await send(stub, gameId, amina);
  expect(post.status).toBe("pending");
  expect(await advanceJob(stub)).toBeNull();
});

it("shows an approved photo straight away in the lobby, then the next on the alarm", async () => {
  const { gameId, stub, join } = await setup();
  await wallSettings(stub, { moderation: "direct" });
  const amina = await join("Amina");
  const bilal = await join("Bilal");

  const first = await send(stub, gameId, amina);
  expect(first.status).toBe("showing");
  const job = await advanceJob(stub);
  expect(job?.status).toBe("pending");
  expect(job?.due_at).toBeGreaterThan(Date.now());

  const second = await send(stub, gameId, bilal);
  expect(second.status).toBe("queued");

  await timeUp(stub);
  const after = await posts(stub);
  expect(after.find((item) => item.postId === first.postId)?.status).toBe("shown");
  expect(after.find((item) => item.postId === second.postId)?.status).toBe("showing");
  // The alarm left a fresh wake-up for the second photo.
  expect((await advanceJob(stub))?.status).toBe("pending");

  await timeUp(stub);
  expect((await posts(stub)).every((item) => item.status === "shown")).toBe(true);
  // Nothing left to show, so nothing is due.
  expect((await advanceJob(stub))?.status).not.toBe("pending");
});

it("moves straight on when the photo on screen is withdrawn", async () => {
  const { gameId, stub, join } = await setup();
  await wallSettings(stub, { moderation: "direct" });
  const amina = await join("Amina");
  const bilal = await join("Bilal");
  const first = await send(stub, gameId, amina);
  const second = await send(stub, gameId, bilal);

  const socket = await phone(stub, gameId, amina);
  expect(await socket.send({ name: "wall-withdraw", postId: first.postId })).toEqual({
    accepted: true,
  });
  socket.socket.close();
  const after = await posts(stub);
  expect(after.find((item) => item.postId === first.postId)?.status).toBe("removed");
  expect(after.find((item) => item.postId === second.postId)?.status).toBe("showing");
});

it("waits through a question and starts at the next break", async () => {
  const { gameId, stub, join } = await setup();
  await wallSettings(stub, { moderation: "direct" });
  const amina = await join("Amina");
  await runInDurableObject(stub, (_instance, state) => {
    state.storage.sql.exec(`UPDATE room SET phase = 'collect'`);
  });
  const post = await send(stub, gameId, amina);
  expect(post.status).toBe("queued");
  expect(await advanceJob(stub)).toBeNull();

  const step = await runInDurableObject(stub, (_instance, state) => {
    state.storage.sql.exec(`UPDATE room SET phase = 'scores'`);
    return syncWall(state.storage.sql, "tick", Date.now());
  });
  expect(step.started).toBe(post.postId);
  expect((await posts(stub))[0]?.status).toBe("showing");
});

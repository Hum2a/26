import { runInDurableObject } from "cloudflare:test";
import { expect, it } from "vitest";
import { createSqlStore } from "../src/room/sql-store.ts";
import { settleTrolls, zoomPhotoFor } from "../src/troll/engine.ts";
import { phone, posts, setup, upload, type Stub } from "./wall-support.ts";

async function heldTroll(stub: Stub, kind: string, actorId: string, targetId: string) {
  const effectId = crypto.randomUUID();
  await runInDurableObject(stub, (_instance, state) => {
    const room = createSqlStore(state.storage.sql).readRoom();
    state.storage.sql.exec(
      `INSERT INTO troll_effect (
         effect_id, actor_id, target_id, kind, slot, status, question_index, phase,
         phase_generation, created_at, started_at, expires_at, refunded
       ) VALUES (?, ?, ?, ?, 'persistent', 'active', ?, 'collect', 1, ?, ?, NULL, 0)`,
      effectId,
      actorId,
      targetId,
      kind,
      room.questionIndex,
      Date.now(),
      Date.now(),
    );
  });
  return effectId;
}

/** Enters a phase and settles trolls, as a phase change does. */
async function enter(stub: Stub, phase: string) {
  await runInDurableObject(stub, (_instance, state) => {
    state.storage.sql.exec(`UPDATE room SET phase = ?`, phase);
    settleTrolls(state.storage.sql, createSqlStore(state.storage.sql).readRoom(), Date.now());
  });
}

const status = (stub: Stub, effectId: string) =>
  runInDurableObject(stub, (_instance, state) =>
    state.storage.sql
      .exec<{ status: string }>(`SELECT status FROM troll_effect WHERE effect_id = ?`, effectId)
      .toArray()[0]?.status,
  );

it("calls for a speech at the scores, once", async () => {
  const { stub, join } = await setup();
  const amina = await join("Amina");
  const bilal = await join("Bilal");
  const effectId = await heldTroll(stub, "speech", bilal.playerId, amina.playerId);
  await enter(stub, "reveal");
  expect((await stub.snapshotFor("stage")).trolls.announcement).toBeNull();
  await enter(stub, "scores");
  expect((await stub.snapshotFor("stage")).trolls.announcement).toMatchObject({
    label: "Amina, the floor is yours.",
    assetLabel: "Speech! Speech!",
  });
  expect(await status(stub, effectId)).toBe("expired");
});

it("replays the target's answer at the reveal", async () => {
  const { stub, join } = await setup();
  const amina = await join("Amina");
  const bilal = await join("Bilal");
  await heldTroll(stub, "replay", bilal.playerId, amina.playerId);
  await enter(stub, "reveal");
  expect((await stub.snapshotFor("stage")).trolls.announcement).toMatchObject({
    label: "Amina didn't answer at all.",
    assetLabel: "Instant replay",
  });
});

it("zooms only into photos the stage may show", async () => {
  const { gameId, stub, join } = await setup();
  const amina = await join("Amina");
  const zoom = () =>
    runInDurableObject(stub, (_instance, state) => zoomPhotoFor(state.storage.sql, amina.playerId));
  expect(await zoom()).toBeNull();

  const photo = await upload(stub, amina);
  if (!photo.ok) throw new Error(photo.message);
  const socket = await phone(stub, gameId, amina);
  await socket.send({ name: "wall-post", mediaId: photo.mediaId });
  socket.socket.close();
  // A pending wall photo is not for the stage yet.
  expect(await zoom()).toBeNull();
  await runInDurableObject(stub, (_instance, state) => {
    state.storage.sql.exec(`UPDATE wall_post SET status = 'shown'`);
  });
  expect(await zoom()).toBe(photo.mediaId);
  await runInDurableObject(stub, (_instance, state) => {
    state.storage.sql.exec(`UPDATE media_upload SET hidden = 1`);
  });
  expect(await zoom()).toBeNull();
  expect(await posts(stub)).toHaveLength(1);
});

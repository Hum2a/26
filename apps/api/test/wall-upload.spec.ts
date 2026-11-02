import { runInDurableObject } from "cloudflare:test";
import { expect, it } from "vitest";
import {
  wallClosedMessage,
  wallCooldownMessage,
  wallCooldownMs,
  wallFrameMessage,
  wallMediaMessage,
  wallMutedMessage,
  wallPostMissingMessage,
  wallSentMessage,
  wallWaitingMessage,
} from "../src/room/limits.ts";
import { wallMediaViewable } from "../src/wall/access.ts";
import {
  phone,
  posts,
  setup,
  upload,
  wallSettings,
  type Player,
  type Stub,
} from "./wall-support.ts";

/** Moves this player's latest post back past the cooldown. */
async function ageLatestPost(stub: Stub, playerId: string) {
  await runInDurableObject(stub, (_instance, state) => {
    state.storage.sql.exec(
      `UPDATE wall_post SET created_at = created_at - ? WHERE player_id = ?`,
      wallCooldownMs + 1_000,
      playerId,
    );
  });
}

it("sends a wall photo from the lobby, waits for approval and replays a retried post", async () => {
  const { gameId, stub, join } = await setup();
  const amina = await join("Amina");
  const voice = await upload(stub, amina, "voice");
  expect(voice.ok).toBe(false);

  const photo = await upload(stub, amina);
  if (!photo.ok) throw new Error(photo.message);
  const socket = await phone(stub, gameId, amina);
  const requestId = crypto.randomUUID();
  const post = {
    name: "wall-post",
    mediaId: photo.mediaId,
    caption: "  Happy\nbirthday   Humza!  ",
    frame: "wanted",
  };
  expect(await socket.send(post, requestId)).toEqual({ accepted: true });
  // The same request again is answered from its receipt, not posted twice.
  expect(await socket.send(post, requestId)).toEqual({ accepted: true });
  // The same photo under a new request is refused.
  expect(await socket.send(post)).toEqual({ accepted: false, error: wallSentMessage });

  const mine = await posts(stub, amina.playerId);
  expect(mine).toHaveLength(1);
  expect(mine[0]).toMatchObject({
    mediaId: photo.mediaId,
    caption: "Happy birthday Humza!",
    frame: "wanted",
    keep: true,
    status: "pending",
  });
  // A wall photo never becomes question media or a stage cue on its own.
  const stage = await stub.snapshotFor("stage");
  expect(stage.media).toEqual([]);
  expect(stage.trolls.announcement).toBeNull();
  socket.socket.close();
});

it("rejects bad frames and photos the guest does not own", async () => {
  const { gameId, stub, join } = await setup();
  const amina = await join("Amina");
  const bilal = await join("Bilal");
  const bilalPhoto = await upload(stub, bilal);
  if (!bilalPhoto.ok) throw new Error(bilalPhoto.message);
  const aminaPhoto = await upload(stub, amina);
  if (!aminaPhoto.ok) throw new Error(aminaPhoto.message);
  const socket = await phone(stub, gameId, amina);

  expect(
    await socket.send({
      name: "wall-post",
      mediaId: aminaPhoto.mediaId,
      frame: "glitter",
    }),
  ).toEqual({ accepted: false, error: wallFrameMessage });
  expect(await socket.send({ name: "wall-post", mediaId: bilalPhoto.mediaId })).toEqual(
    {
      accepted: false,
      error: wallMediaMessage,
    },
  );
  expect(await socket.send({ name: "wall-post", mediaId: "not-a-uuid" })).toEqual({
    accepted: false,
    error: wallMediaMessage,
  });
  // No frame means the default polaroid.
  expect(
    await socket.send({ name: "wall-post", mediaId: aminaPhoto.mediaId, keep: false }),
  ).toEqual({ accepted: true });
  expect((await posts(stub, amina.playerId))[0]).toMatchObject({
    frame: "polaroid",
    keep: false,
    caption: null,
  });
  socket.socket.close();
});

it("enforces the cooldown and the waiting limit", async () => {
  const { gameId, stub, join } = await setup();
  const amina = await join("Amina");
  const socket = await phone(stub, gameId, amina);

  for (let index = 0; index < 3; index += 1) {
    const photo = await upload(stub, amina);
    if (!photo.ok) throw new Error(photo.message);
    expect(await socket.send({ name: "wall-post", mediaId: photo.mediaId })).toEqual({
      accepted: true,
    });
    if (index === 0) {
      const tooSoon = await upload(stub, amina);
      expect(tooSoon).toEqual({ ok: false, message: wallCooldownMessage });
    }
    await ageLatestPost(stub, amina.playerId);
  }
  const fourth = await upload(stub, amina);
  expect(fourth).toEqual({ ok: false, message: wallWaitingMessage });
  socket.socket.close();
});

it("keeps a pending photo away from the stage and other guests", async () => {
  const { gameId, stub, join } = await setup();
  const amina = await join("Amina");
  const bilal = await join("Bilal");
  const photo = await upload(stub, amina);
  if (!photo.ok) throw new Error(photo.message);
  const socket = await phone(stub, gameId, amina);
  expect(await socket.send({ name: "wall-post", mediaId: photo.mediaId })).toEqual({
    accepted: true,
  });

  const read = (player: Player) =>
    stub.readMedia({
      mediaId: photo.mediaId,
      nowMs: Date.now(),
      guest: { playerId: player.playerId, secret: player.secret },
    });
  expect((await read(amina)).ok).toBe(true);
  expect((await read(bilal)).ok).toBe(false);

  const view = (status: string) =>
    runInDurableObject(stub, (_instance, state) => {
      state.storage.sql.exec(`UPDATE wall_post SET status = ?`, status);
      const sql = state.storage.sql;
      return {
        stage: wallMediaViewable(sql, photo.mediaId, { role: "presentation" }),
        host: wallMediaViewable(sql, photo.mediaId, { role: "control" }),
      };
    });
  expect(await view("pending")).toEqual({ stage: false, host: true });
  // The next approved photo may be fetched by the stage so it can preload it.
  expect(await view("queued")).toEqual({ stage: true, host: true });
  expect(await view("declined")).toEqual({ stage: false, host: true });
  expect(await view("showing")).toEqual({ stage: true, host: true });
  expect((await read(bilal)).ok).toBe(true);
  socket.socket.close();
});

it("lets only the owner withdraw, and a withdrawn photo cannot be fetched", async () => {
  const { gameId, stub, join } = await setup();
  const amina = await join("Amina");
  const bilal = await join("Bilal");
  const photo = await upload(stub, amina);
  if (!photo.ok) throw new Error(photo.message);
  const aminaPhone = await phone(stub, gameId, amina);
  const bilalPhone = await phone(stub, gameId, bilal);
  await aminaPhone.send({ name: "wall-post", mediaId: photo.mediaId });
  const [post] = await posts(stub, amina.playerId);
  if (!post) throw new Error("no post");

  expect(await bilalPhone.send({ name: "wall-withdraw", postId: post.postId })).toEqual(
    {
      accepted: false,
      error: wallPostMissingMessage,
    },
  );
  expect(await aminaPhone.send({ name: "wall-withdraw", postId: post.postId })).toEqual(
    {
      accepted: true,
    },
  );
  expect((await posts(stub, amina.playerId))[0]).toMatchObject({
    status: "removed",
    keep: false,
  });
  const read = await stub.readMedia({
    mediaId: photo.mediaId,
    nowMs: Date.now(),
    guest: { playerId: amina.playerId, secret: amina.secret },
  });
  expect(read.ok).toBe(false);
  expect(await aminaPhone.send({ name: "wall-withdraw", postId: post.postId })).toEqual(
    {
      accepted: false,
      error: wallPostMissingMessage,
    },
  );
  aminaPhone.socket.close();
  bilalPhone.socket.close();
});

it("refuses new photos while the wall is off or the guest is muted", async () => {
  const { stub, join } = await setup();
  const amina = await join("Amina");
  await wallSettings(stub, { enabled: 0 });
  expect(await upload(stub, amina)).toEqual({ ok: false, message: wallClosedMessage });
  await wallSettings(stub, { muted: [amina.playerId] });
  expect(await upload(stub, amina)).toEqual({ ok: false, message: wallMutedMessage });
  await wallSettings(stub, {});
  expect((await upload(stub, amina)).ok).toBe(true);
});

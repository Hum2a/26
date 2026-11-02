import { expect, it } from "vitest";
import {
  wallCooldownMessage,
  wallCooldownMs,
  wallDecidedMessage,
  wallMutedMessage,
  wallNothingShowingMessage,
  wallSettingsMessage,
} from "../src/room/limits.ts";
import { readWallSettings } from "../src/wall/store.ts";
import { runInDurableObject } from "cloudflare:test";
import { phone, posts, setup, upload, type Player, type Stub } from "./wall-support.ts";

async function send(stub: Stub, gameId: string, player: Player) {
  const photo = await upload(stub, player);
  if (!photo.ok) throw new Error(photo.message);
  const socket = await phone(stub, gameId, player);
  const ack = await socket.send({ name: "wall-post", mediaId: photo.mediaId });
  socket.socket.close();
  if (!ack.accepted) throw new Error(ack.error);
  const mine = await posts(stub, player.playerId);
  return mine[mine.length - 1]!;
}

const statusOf = async (stub: Stub, postId: string) =>
  (await posts(stub)).find((item) => item.postId === postId)?.status;

const canSee = (stub: Stub, mediaId: string, player: Player) =>
  stub
    .readMedia({
      mediaId,
      nowMs: Date.now(),
      guest: { playerId: player.playerId, secret: player.secret },
    })
    .then((result) => result.ok);

it("approves a photo onto the wall and declines another out of sight", async () => {
  const { gameId, stub, join, host } = await setup();
  const amina = await join("Amina");
  const bilal = await join("Bilal");
  const first = await send(stub, gameId, amina);
  const second = await send(stub, gameId, bilal);

  expect((await host("wall-approve", { postId: first.postId })).ok).toBe(true);
  // In the lobby an approved photo goes straight up.
  expect(await statusOf(stub, first.postId)).toBe("showing");
  expect(await canSee(stub, first.mediaId, bilal)).toBe(true);

  expect((await host("wall-decline", { postId: second.postId })).ok).toBe(true);
  expect(await statusOf(stub, second.postId)).toBe("declined");
  // A declined photo is hidden, even from its owner.
  expect(await canSee(stub, second.mediaId, bilal)).toBe(false);

  const again = await host("wall-approve", { postId: second.postId });
  expect(again).toMatchObject({ ok: false, message: wallDecidedMessage });
});

it("pulls the photo on screen, hides it everywhere and moves on", async () => {
  const { gameId, stub, join, host } = await setup();
  const amina = await join("Amina");
  const bilal = await join("Bilal");
  const first = await send(stub, gameId, amina);
  const second = await send(stub, gameId, bilal);
  await host("wall-approve", { postId: first.postId });
  await host("wall-approve", { postId: second.postId });
  expect(await statusOf(stub, second.postId)).toBe("queued");

  expect((await host("wall-pull", { postId: first.postId })).ok).toBe(true);
  expect(await statusOf(stub, first.postId)).toBe("removed");
  expect(await canSee(stub, first.mediaId, amina)).toBe(false);
  expect(await statusOf(stub, second.postId)).toBe("showing");
});

it("skips to the next photo and forces one during a question", async () => {
  const { gameId, stub, join, host } = await setup();
  const amina = await join("Amina");
  const bilal = await join("Bilal");
  expect(await host("wall-skip")).toMatchObject({
    ok: false,
    message: wallNothingShowingMessage,
  });
  const first = await send(stub, gameId, amina);
  const second = await send(stub, gameId, bilal);
  await host("wall-approve", { postId: first.postId });
  await host("wall-approve", { postId: second.postId });

  expect((await host("wall-skip")).ok).toBe(true);
  expect(await statusOf(stub, first.postId)).toBe("shown");
  expect(await statusOf(stub, second.postId)).toBe("showing");

  // During a question the wall waits, unless the host says show it now.
  const chen = await join("Chen");
  const third = await send(stub, gameId, chen);
  await runInDurableObject(stub, (_instance, state) => {
    state.storage.sql.exec(`UPDATE room SET phase = 'collect'`);
  });
  await host("wall-approve", { postId: third.postId });
  await host("wall-skip");
  expect(await statusOf(stub, third.postId)).toBe("queued");
  expect((await host("wall-next")).ok).toBe(true);
  expect(await statusOf(stub, third.postId)).toBe("showing");
});

it("changes only the settings given and rejects bad values", async () => {
  const { gameId, stub, join, host } = await setup();
  expect(
    (
      await host("wall-settings", {
        wallSettings: { moderation: "direct", showMs: 12_000 },
      })
    ).ok,
  ).toBe(true);
  const settings = await runInDurableObject(stub, (_instance, state) =>
    readWallSettings(state.storage.sql),
  );
  expect(settings).toMatchObject({
    enabled: true,
    moderation: "direct",
    placement: "breaks",
    showMs: 12_000,
  });
  for (const bad of [{ showMs: 999 }, { moderation: "yolo" }, {}, { colour: "red" }]) {
    expect(await host("wall-settings", { wallSettings: bad })).toMatchObject({
      ok: false,
      message: wallSettingsMessage,
    });
  }
  // Straight to screen: a new photo goes up with no approval.
  const amina = await join("Amina");
  const post = await send(stub, gameId, amina);
  expect(post.status).toBe("showing");
  // Switching the wall off takes it down.
  await host("wall-settings", { wallSettings: { enabled: false } });
  expect(await statusOf(stub, post.postId)).toBe("shown");
});

it("mutes a guest, declines their waiting photos, and unmutes them", async () => {
  const { gameId, stub, join, host } = await setup();
  const amina = await join("Amina");
  const waiting = await send(stub, gameId, amina);

  expect((await host("wall-mute", { playerId: amina.playerId })).ok).toBe(true);
  expect(await statusOf(stub, waiting.postId)).toBe("declined");
  expect(await upload(stub, amina)).toEqual({ ok: false, message: wallMutedMessage });

  expect((await host("wall-unmute", { playerId: amina.playerId })).ok).toBe(true);
  // Unmuting does not reset the cooldown from the photo just sent.
  expect(await upload(stub, amina)).toEqual({
    ok: false,
    message: wallCooldownMessage,
  });
  await runInDurableObject(stub, (_instance, state) => {
    state.storage.sql.exec(
      `UPDATE wall_post SET created_at = created_at - ?`,
      wallCooldownMs + 1_000,
    );
  });
  expect((await upload(stub, amina)).ok).toBe(true);
});

it("declines a kicked guest's waiting photos", async () => {
  const { gameId, stub, join, host } = await setup();
  const amina = await join("Amina");
  const waiting = await send(stub, gameId, amina);
  expect((await host("kick", { playerId: amina.playerId })).ok).toBe(true);
  expect(await statusOf(stub, waiting.postId)).toBe("declined");
});

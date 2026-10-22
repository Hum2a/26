import { expect, it } from "vitest";
import { phone, posts, setup, upload, type Player, type Stub } from "./wall-support.ts";

async function send(stub: Stub, gameId: string, player: Player, caption?: string) {
  const photo = await upload(stub, player);
  if (!photo.ok) throw new Error(photo.message);
  const socket = await phone(stub, gameId, player);
  const ack = await socket.send({ name: "wall-post", mediaId: photo.mediaId, caption });
  socket.socket.close();
  if (!ack.accepted) throw new Error(ack.error);
  const mine = await posts(stub, player.playerId);
  return mine[mine.length - 1]!;
}

it("shows a pending photo only to the host and its owner", async () => {
  const { gameId, stub, join } = await setup();
  const amina = await join("Amina");
  const bilal = await join("Bilal");
  const post = await send(stub, gameId, amina, "Secret");

  const stage = (await stub.snapshotFor("stage")).wall;
  expect(stage).toMatchObject({ enabled: true, now: null, waiting: 0, next: null });
  expect(JSON.stringify(stage)).not.toContain(post.mediaId);

  const other = (await stub.snapshotFor("guest", bilal.playerId)).wall;
  expect(other?.mine).toEqual([]);
  expect(JSON.stringify(other)).not.toContain(post.mediaId);

  const owner = (await stub.snapshotFor("guest", amina.playerId)).wall;
  expect(owner?.mine).toEqual([
    expect.objectContaining({
      postId: post.postId,
      status: "pending",
      caption: "Secret",
      position: null,
    }),
  ]);
  // Just sent, so the cooldown is running.
  expect(owner?.cooldownUntil).toBeGreaterThan(Date.now());
  expect(owner?.blocked).toBeTruthy();

  const host = (await stub.snapshotFor("control")).wall;
  expect(host?.queue).toEqual([
    expect.objectContaining({ postId: post.postId, status: "pending", nickname: "Amina" }),
  ]);
  expect(host?.settings).toEqual({ moderation: "approve", showMs: 8_000, captions: true });
});

it("gives the stage the photo on screen and the next one to preload, with queue positions", async () => {
  const { gameId, stub, join, host } = await setup();
  const amina = await join("Amina");
  const bilal = await join("Bilal");
  const chen = await join("Chen");
  const first = await send(stub, gameId, amina, "First!");
  const second = await send(stub, gameId, bilal);
  const third = await send(stub, gameId, chen);
  for (const post of [first, second, third]) {
    await host("wall-approve", { postId: post.postId });
  }

  const stage = (await stub.snapshotFor("stage")).wall;
  expect(stage?.now).toMatchObject({
    postId: first.postId,
    nickname: "Amina",
    caption: "First!",
    frame: "polaroid",
    reactions: [],
  });
  expect(stage?.waiting).toBe(2);
  expect(stage?.next).toEqual({ mediaId: second.mediaId });

  const chenView = (await stub.snapshotFor("guest", chen.playerId)).wall;
  expect(chenView?.mine?.[0]).toMatchObject({ status: "queued", position: 2 });
  expect(chenView?.now?.nickname).toBe("Amina");

  const control = (await stub.snapshotFor("control")).wall;
  expect(control?.queue?.map((item) => item.postId)).toEqual([second.postId, third.postId]);
  expect(control?.queue?.map((item) => item.position)).toEqual([1, 2]);
});

it("sends troll history to the host only", async () => {
  const { stub, join } = await setup();
  const amina = await join("Amina");
  expect((await stub.snapshotFor("control")).trollHistory).toEqual([]);
  expect((await stub.snapshotFor("stage")).trollHistory).toBeUndefined();
  expect((await stub.snapshotFor("guest", amina.playerId)).trollHistory).toBeUndefined();
});

it("leaves captions off the stage when the host turns them off", async () => {
  const { gameId, stub, join, host } = await setup();
  const amina = await join("Amina");
  const post = await send(stub, gameId, amina, "Hidden caption");
  await host("wall-settings", { wallSettings: { captions: false } });
  await host("wall-approve", { postId: post.postId });

  expect((await stub.snapshotFor("stage")).wall?.now?.caption).toBeNull();
  expect((await stub.snapshotFor("guest", amina.playerId)).wall?.now?.caption).toBe(
    "Hidden caption",
  );
  expect((await stub.snapshotFor("control")).wall?.now?.caption).toBe("Hidden caption");
});

import { runInDurableObject } from "cloudflare:test";
import { expect, it } from "vitest";
import { readArchiveDocument } from "../src/archive/document.ts";
import { phone, posts, setup, upload, type Player, type Stub } from "./wall-support.ts";

async function send(stub: Stub, gameId: string, player: Player, keep = true) {
  const photo = await upload(stub, player);
  if (!photo.ok) throw new Error(photo.message);
  const socket = await phone(stub, gameId, player);
  const ack = await socket.send({ name: "wall-post", mediaId: photo.mediaId, keep });
  socket.socket.close();
  if (!ack.accepted) throw new Error(ack.error);
  const mine = await posts(stub, player.playerId);
  return mine[mine.length - 1]!;
}

/** Marks posts as shown and moves the room to the podium, without a whole game. */
async function finish(stub: Stub, postIds: string[]) {
  await runInDurableObject(stub, (_instance, state) => {
    for (const postId of postIds) {
      state.storage.sql.exec(
        `UPDATE wall_post SET status = 'shown', shown_at = ? WHERE post_id = ?`,
        Date.now(),
        postId,
      );
    }
    state.storage.sql.exec(`UPDATE room SET phase = 'podium'`);
  });
}

it("counts reactions only for the photo on screen, with a cap per guest", async () => {
  const { gameId, stub, join, host } = await setup();
  const amina = await join("Amina");
  const bilal = await join("Bilal");
  const post = await send(stub, gameId, amina);
  const bilalPhone = await phone(stub, gameId, bilal);

  // Not on screen yet.
  expect(
    (
      await bilalPhone.send({
        name: "wall-react",
        postId: post.postId,
        reaction: "fire",
      })
    ).accepted,
  ).toBe(false);
  await host("wall-approve", { postId: post.postId });
  expect(
    (
      await bilalPhone.send({
        name: "wall-react",
        postId: post.postId,
        reaction: "fire",
      })
    ).accepted,
  ).toBe(true);
  expect(
    (
      await bilalPhone.send({
        name: "wall-react",
        postId: post.postId,
        reaction: "party",
      })
    ).accepted,
  ).toBe(false);
  const stage = (await stub.snapshotFor("stage")).wall;
  expect(stage?.now?.reactions).toEqual([{ reaction: "fire", count: 1 }]);
  bilalPhone.socket.close();
});

it("shows a podium reel of shown photos and keeps only chosen ones for the gallery", async () => {
  const { gameId, stub, join, host } = await setup();
  const amina = await join("Amina");
  const bilal = await join("Bilal");
  const chen = await join("Chen");
  const kept = await send(stub, gameId, amina, true);
  const notKept = await send(stub, gameId, bilal, false);
  const pulled = await send(stub, gameId, chen, true);
  await finish(stub, [kept.postId, notKept.postId, pulled.postId]);
  await host("wall-pull", { postId: pulled.postId });

  const reel = (await stub.snapshotFor("stage")).wall?.reel ?? [];
  expect(reel.map((item) => item.mediaId).sort()).toEqual(
    [kept.mediaId, notKept.mediaId].sort(),
  );

  const document = await runInDurableObject(stub, (_instance, state) =>
    readArchiveDocument(state.storage.sql, {
      revision: 1,
      kind: "final",
      now: Date.now(),
      includeDevices: false,
    }),
  );
  const gallery = document.media.map((item) => item.mediaId);
  expect(gallery).toContain(kept.mediaId);
  expect(gallery).not.toContain(notKept.mediaId);
  // A pulled photo is not kept: pull clears keep and hides the image.
  expect(gallery).not.toContain(pulled.mediaId);
});

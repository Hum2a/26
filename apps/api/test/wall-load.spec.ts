import { expect, it } from "vitest";
import { phone, posts, setup, upload, wallSettings } from "./wall-support.ts";

/**
 * A rush at a break: 20 guests send at once, straight to the screen. Every
 * photo is accepted exactly once, one is on screen, and the queue gives each
 * guest a single turn before anyone gets a second.
 */
it("takes a rush of photos at a break without duplicates or queue-jumping", async () => {
  const { gameId, stub, join, host } = await setup();
  await wallSettings(stub, { moderation: "direct" });
  const guests = await Promise.all(
    Array.from({ length: 20 }, (_, index) => join(`Guest ${index + 1}`)),
  );
  await Promise.all(
    guests.map(async (guest) => {
      const photo = await upload(stub, guest);
      if (!photo.ok) throw new Error(photo.message);
      const socket = await phone(stub, gameId, guest);
      const requestId = crypto.randomUUID();
      const post = { name: "wall-post", mediaId: photo.mediaId };
      // A double tap: the same request twice.
      const [first, second] = await Promise.all([
        socket.send(post, requestId),
        socket.send(post, requestId),
      ]);
      socket.socket.close();
      expect(first.accepted && second.accepted).toBe(true);
    }),
  );

  const all = await posts(stub);
  expect(all).toHaveLength(20);
  expect(new Set(all.map((item) => item.mediaId)).size).toBe(20);
  expect(all.filter((item) => item.status === "showing")).toHaveLength(1);

  const stage = (await stub.snapshotFor("stage")).wall;
  expect(stage?.waiting).toBe(19);
  // The first photo went up while the queue was empty, so it has the normal
  // time. With more than six now waiting, the next one gets the rush time.
  expect((await host("wall-skip")).ok).toBe(true);
  const next = (await stub.snapshotFor("stage")).wall;
  expect(next?.waiting).toBe(18);
  expect((next?.now?.untilAt ?? 0) - Date.now()).toBeLessThanOrEqual(5_000);

  const control = (await stub.snapshotFor("control")).wall;
  const order = control?.queue?.map((item) => item.playerId) ?? [];
  expect(new Set(order).size).toBe(order.length);
});

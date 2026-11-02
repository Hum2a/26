import { runInDurableObject } from "cloudflare:test";
import { expect, it } from "vitest";
import { acceptedKey } from "../src/media/keys.ts";
import { sampleRoomBusyMessage } from "../src/room/limits.ts";
import { sampleWallPostCount, seedSampleRoom } from "../src/room/sample.ts";
import { setup, type Stub } from "./wall-support.ts";

function media(gameId: string) {
  return Array.from({ length: sampleWallPostCount }, () => {
    const mediaId = crypto.randomUUID();
    return {
      mediaId,
      finalKey: acceptedKey(gameId, mediaId),
      contentType: "image/png",
      byteLength: 1024,
    };
  });
}

const seed = (stub: Stub, gameId: string) =>
  runInDurableObject(stub, (_instance, state) =>
    seedSampleRoom(state.storage.sql, media(gameId), Date.now()),
  );

it("fills an empty room with something for every admin page", async () => {
  const { gameId, stub } = await setup();
  expect(await seed(stub, gameId)).toBe(12);
  const host = await stub.snapshotFor("control");

  expect(host.players).toHaveLength(12);
  expect(host.trollHistory?.length).toBeGreaterThan(5);
  // Photo wall: one on screen, more queued, some waiting for approval, some shown.
  expect(host.wall?.now).not.toBeNull();
  expect(host.wall?.queue?.filter((item) => item.status === "pending")).toHaveLength(2);
  expect(host.wall?.queue?.some((item) => item.status === "queued")).toBe(true);
  expect(host.wall?.recent?.filter((item) => item.status === "shown")).toHaveLength(3);
  // Analytics: device groups are big enough, and the most loved photo has a winner.
  const highlights = (host.highlights ?? []).map((card) => card.stage).join("\n");
  expect(highlights).toContain("Most loved photo: Amina's");
  expect(highlights).toMatch(/iPhone/);
});

it("refuses a room that already has players, so a real party is never touched", async () => {
  const { gameId, stub, join } = await setup();
  await join("Real guest");
  await expect(seed(stub, gameId)).rejects.toThrow(sampleRoomBusyMessage);
  expect((await stub.snapshotFor("control")).players).toHaveLength(1);
});

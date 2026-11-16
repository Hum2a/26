import { expect, it, vi, afterEach } from "vitest";
import { readAdminRoom } from "../admin/rooms-api";
import { lookupStage } from "../live/room-api";
import { roomFixture } from "../admin/room-fixture.test-support";
afterEach(() => vi.unstubAllGlobals());
it("advertises the new course contract on both host and projector HTTP snapshot reads", async () => {
  const fetcher = vi.fn().mockImplementation(async () => Response.json(roomFixture));
  vi.stubGlobal("fetch", fetcher);
  await readAdminRoom("ABCDEFGH");
  await lookupStage("ABCDEF");
  expect(fetcher).toHaveBeenCalledTimes(2);
  for (const [, input] of fetcher.mock.calls)
    expect(new Headers(input.headers).get("x-26-kart-tracks")).toBe("2");
});

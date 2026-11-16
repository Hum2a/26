import { Hono } from "hono";
import { beforeEach, expect, it, vi } from "vitest";
vi.mock("../src/auth/routes.ts", () => ({ administratorForRequest: vi.fn() }));
import { administratorForRequest } from "../src/auth/routes.ts";
import { registerAdminContentRoutes } from "../src/room/admin-content.ts";
import { kartTrackPreview } from "@26/shared";
import { kartTracksSectionSchema } from "@26/shared";
const app = new Hono<{ Bindings: Env }>();
registerAdminContentRoutes(app);
const roomAccess = vi.fn();
const bindings = {
  APP_ENV: "staging",
  ROOM_CODE_REGISTRY: { getByName: roomAccess },
  PARTY_ROOM: { getByName: roomAccess },
} as unknown as Env;
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(administratorForRequest).mockResolvedValue({ email: "admin@example.test" });
});
it("serves validated course/mode metadata and actual selected public poses without room side effects", async () => {
  const response = await app.request(
    "https://example.com/api/admin/kart-tracks?track=party-ring-v1&slot=80&beat=recovery",
    {},
    bindings,
  );
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("no-store");
  const result = kartTracksSectionSchema.parse(await response.json());
  expect(result.selection).toEqual({
    track: "party-ring-v1",
    slot: 80,
    beat: "recovery",
  });
  expect(result.stage.participants).toHaveLength(80);
  expect(result.phone.participants).toHaveLength(1);
  expect(result.phone.participants[0]!.number).toBe(80);
  expect(JSON.stringify(result)).not.toMatch(
    /credential|email|inputUntil|lastSafe|itemsWorld|correctAnswer/,
  );
  expect(roomAccess).not.toHaveBeenCalled();
});
it("requires admin and refuses invalid track/slot/beat selections", async () => {
  for (const query of [
    "track=unknown",
    "slot=0",
    "slot=81",
    "slot=NaN",
    "beat=finish",
    "slot=1.5",
  ]) {
    expect(
      (
        await app.request(
          `https://example.com/api/admin/kart-tracks?${query}`,
          {},
          bindings,
        )
      ).status,
    ).toBe(400);
  }
  vi.mocked(administratorForRequest).mockResolvedValue(
    Response.json({ error: "unauthenticated" }, { status: 401 }),
  );
  expect(
    (await app.request("https://example.com/api/admin/kart-tracks", {}, bindings))
      .status,
  ).toBe(401);
  expect(roomAccess).not.toHaveBeenCalled();
});
it("keeps sample scores at zero and projects the actual starting/recovered pose on both courses", () => {
  for (const track of ["party-ring-v1", "mario-circuit-v1", "26-park-v1"])
    for (const slot of [1, 16, 21, 50, 80]) {
      const grid = kartTrackPreview({ track, slot, beat: "grid" }),
        recovery = kartTrackPreview({ track, slot, beat: "recovery" });
      expect(recovery.phone.participants[0]).toEqual(grid.phone.participants[0]);
      expect(recovery.stage.leaderboard.every((row) => row.points === 0)).toBe(true);
    }
});
it("rehearses real park driving with zero scores and no room, credentials or private physics", async () => {
  const response = await app.request(
    "https://example.com/api/admin/kart-tracks?track=26-park-v1&slot=80&beat=drive",
    {},
    bindings,
  );
  expect(response.status).toBe(200);
  const result = kartTracksSectionSchema.parse(await response.json());
  const grid = kartTrackPreview({ track: "26-park-v1", slot: 80 });
  expect(result.phone.elapsedMs).toBe(3000);
  expect(result.phone.participants[0]!.z).toBeLessThan(
    grid.phone.participants[0]!.z - 20,
  );
  expect(result.stage.leaderboard.every((row) => row.points === 0)).toBe(true);
  expect(JSON.stringify(result)).not.toMatch(
    /credential|inputUntil|lastSafe|itemsWorld|correctAnswer/,
  );
  expect(roomAccess).not.toHaveBeenCalled();
});

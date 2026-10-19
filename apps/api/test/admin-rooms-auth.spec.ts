import { Hono } from "hono";
import { beforeEach, expect, it, vi } from "vitest";
vi.mock("../src/auth/routes.ts", () => ({ administratorForRequest: vi.fn() }));
import { administratorForRequest } from "../src/auth/routes";
import { registerAdminRoomRoutes } from "../src/room/admin-routes";
import { registerAdminContentRoutes, adminContent } from "../src/room/admin-content";
const app = new Hono<{ Bindings: Env }>();
registerAdminRoomRoutes(app);
registerAdminContentRoutes(app);
const listRooms = vi.fn().mockResolvedValue({ rooms: [], nextCursor: null });
const bindings = {
  APP_ENV: "staging",
  ROOM_CODE_REGISTRY: { getByName: () => ({ listRooms }) },
} as unknown as Env;
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(administratorForRequest).mockResolvedValue({ email: "admin@example.test" });
});
it("requires administrator authentication for listing, detail, current and resume", async () => {
  vi.mocked(administratorForRequest).mockResolvedValue(
    Response.json({ error: "unauthenticated" }, { status: 401 }),
  );
  for (const path of [
    "",
    "/current",
    "/ABCDEFGH",
    "/ABCDEFGH/resume",
    "/ABCDEFGH/media",
    "/ABCDEFGH/media/00000000-0000-4000-8000-000000000001",
  ]) {
    const response = await app.request(
      `https://example.com/api/admin/rooms${path}`,
      {
        method: path.endsWith("resume") ? "POST" : "GET",
        headers: { origin: "https://example.com" },
      },
      bindings,
    );
    expect(response.status).toBe(401);
  }
  expect(listRooms).not.toHaveBeenCalled();
});
it("protects a read-only content projection and excludes answer/reveal fields", async () => {
  const response = await app.request(
    "https://example.com/api/admin/content",
    {},
    bindings,
  );
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(await response.json()).toEqual(adminContent());
  const content = adminContent();
  const birthday = content.packs.find((pack) => pack.id === "birthday")!;
  expect(birthday.release).toBe("draft");
  expect(birthday.questions.every((question) => question.order === null)).toBe(true);
  for (const pack of content.packs)
    for (const question of pack.questions) {
      expect(Object.keys(question).sort()).toEqual([
        "id",
        "mechanic",
        "missing",
        "order",
        "presentation",
        "prompt",
        "status",
        "title",
      ]);
      expect(question).not.toHaveProperty("correctOption");
      expect(question).not.toHaveProperty("truth");
      expect(question).not.toHaveProperty("notes");
      expect(question).not.toHaveProperty("explanation");
    }
  vi.mocked(administratorForRequest).mockResolvedValue(
    Response.json({ error: "unauthenticated" }, { status: 401 }),
  );
  expect(
    (await app.request("https://example.com/api/admin/content", {}, bindings)).status,
  ).toBe(401);
  expect(
    (
      await app.request(
        "https://example.com/api/admin/content",
        { method: "POST" },
        bindings,
      )
    ).status,
  ).toBe(404);
});
it("requires scoped operator access for preview even when another guest cookie exists", async () => {
  const mediaId = "00000000-0000-4000-8000-000000000001";
  const readMedia = vi.fn().mockResolvedValue({ ok: false, error: "not_found" });
  const mediaEnv = {
    ...bindings,
    PARTY_ROOM: { getByName: () => ({ readMedia }) },
  } as unknown as Env;
  expect(
    (
      await app.request(
        `https://example.com/api/admin/rooms/ABCDEFGH/media/${mediaId}`,
        {},
        mediaEnv,
      )
    ).status,
  ).toBe(401);
  const response = await app.request(
    `https://example.com/api/admin/rooms/ABCDEFGH/media/${mediaId}`,
    {
      headers: {
        cookie: "26_room_control=operator.secret; 26_guest=ABCDEFGH.someone.revoked",
      },
    },
    mediaEnv,
  );
  expect(response.status).toBe(404);
  expect(readMedia).toHaveBeenCalledWith({
    mediaId,
    nowMs: expect.any(Number),
    credential: { credentialId: "operator", secret: "secret", role: "control" },
  });
  expect(response.headers.get("cache-control")).toContain("no-store");
});
it("accepts an authenticated same-origin GET without Origin and bounds pagination", async () => {
  const response = await app.request(
    "https://example.com/api/admin/rooms?limit=10&cursor=12",
    {},
    bindings,
  );
  expect(response.status).toBe(200);
  expect(listRooms).toHaveBeenCalledWith({ limit: 10, before: 12 });
  expect(response.headers.get("cache-control")).toBe("no-store");
  for (const query of [
    "limit=51",
    "limit=0",
    "cursor=-1",
    "cursor=NaN",
    "cursor=9007199254740992",
  ])
    expect(
      (await app.request(`https://example.com/api/admin/rooms?${query}`, {}, bindings))
        .status,
    ).toBe(400);
});
it("rejects a cross-origin read and mutation before issuing room access", async () => {
  for (const method of ["GET", "POST"])
    expect(
      (
        await app.request(
          "https://example.com/api/admin/rooms",
          { method, headers: { origin: "https://other.example" } },
          bindings,
        )
      ).status,
    ).toBe(403);
  expect(listRooms).not.toHaveBeenCalled();
});

import { Hono } from "hono";
import { beforeEach, expect, it, vi } from "vitest";
vi.mock("../src/auth/routes.ts", () => ({ administratorForRequest: vi.fn() }));
import * as shared from "@26/shared";
import { administratorForRequest } from "../src/auth/routes";
import { registerAdminRoomRoutes } from "../src/room/admin-routes";
import { registerAdminContentRoutes, adminContent } from "../src/room/admin-content";
import { questionPacks } from "../src/questions/registry";
import { adminQuestion } from "../src/room/admin-question";
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
  const content = adminContent();
  expect(content).not.toBeNull();
  expect(await response.json()).toEqual(content);
  const birthday = content!.packs.find((pack) => pack.id === "birthday")!;
  expect(birthday.release).toBe("draft");
  expect(birthday.questions.every((question) => question.order === null)).toBe(true);
  for (const pack of content!.packs)
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
it("returns JSON 503 when administrator auth is misconfigured", async () => {
  vi.mocked(administratorForRequest).mockResolvedValue(
    Response.json(
      {
        error: "misconfigured",
        message: "Authentication is not configured for this environment.",
      },
      { status: 503 },
    ),
  );
  const response = await app.request(
    "https://example.com/api/admin/content",
    {},
    bindings,
  );
  expect(response.status).toBe(503);
  expect(await response.json()).toEqual({
    error: "misconfigured",
    message: "Authentication is not configured for this environment.",
  });
});
it("returns JSON 500 when the content projection cannot be prepared", async () => {
  const spy = vi.spyOn(shared.adminContentSchema, "safeParse").mockReturnValue({
    success: false,
    error: { issues: [{ path: ["packs"], message: "invalid" }] },
  } as never);
  try {
    const response = await app.request(
      "https://example.com/api/admin/content",
      {},
      bindings,
    );
    expect(response.status).toBe(500);
    expect(response.headers.get("content-type")).toMatch(/json/);
    expect(await response.json()).toEqual({
      error: "invalid",
      message: "That request was not accepted.",
    });
  } finally {
    spy.mockRestore();
  }
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

it("authenticates individual question details, keeps them uncached, and rejects cross-origin/guest reads", async () => {
  const path =
    "https://example.com/api/admin/content/birthday-draft/questions/favourite-pokemon";
  const response = await app.request(path, {}, bindings);
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("no-store");
  const body = shared.adminQuestionDetailSchema.parse(await response.json());
  expect(body.question.options.map((option) => option.label)).toContain("Mudkip");
  expect(body.question.answer).toEqual({ status: "recorded", lines: ["Mudkip"] });
  expect(body.question.settings).toContainEqual({ label: "Points", value: "100" });
  expect(body.question).not.toHaveProperty("correctOption");
  expect(body.question).not.toHaveProperty("truth");
  expect(
    (
      await app.request(
        path,
        { headers: { origin: "https://other.example" } },
        bindings,
      )
    ).status,
  ).toBe(403);
  vi.mocked(administratorForRequest).mockResolvedValue(
    Response.json({ error: "unauthenticated" }, { status: 401 }),
  );
  for (const cookie of [
    "",
    "26_guest=ABCDEFGH.guest.secret",
    "26_room_stage=projector.secret",
  ]) {
    vi.mocked(administratorForRequest).mockResolvedValueOnce(
      Response.json({ error: "unauthenticated" }, { status: 401 }),
    );
    const denied = await app.request(path, { headers: { cookie } }, bindings);
    expect(denied.status).toBe(401);
    expect(await denied.text()).not.toContain("Mudkip");
  }
});
it("handles missing question/pack and drafts without guessing an answer", async () => {
  for (const path of [
    "unknown-pack/questions/favourite-pokemon",
    "birthday-draft/questions/unknown-question",
  ]) {
    const response = await app.request(
      `https://example.com/api/admin/content/${path}`,
      {},
      bindings,
    );
    expect(response.status).toBe(404);
    expect(response.headers.get("cache-control")).toBe("no-store");
  }
  const response = await app.request(
    "https://example.com/api/admin/content/birthday-draft/questions/inflation-freddo",
    {},
    bindings,
  );
  const body = shared.adminQuestionDetailSchema.parse(await response.json());
  expect(body.question.status).toBe("draft");
  expect(body.question.answer.status).toBe("missing");
  expect(body.question.missing.length).toBeGreaterThan(0);
  expect(body.question.settings).toContainEqual({ label: "Minimum", value: "Not set" });
});
it("projects every catalogue mechanic without exposing raw authoring objects or media paths", () => {
  const mechanics = new Set<string>();
  for (const pack of questionPacks) {
    for (const question of pack.catalogue) {
      mechanics.add(question.kind);
      const detail = adminQuestion(pack, question);
      expect(detail, `${pack.version}/${question.id}`).not.toBeNull();
      expect(detail!.question.id).toBe(question.id);
      expect(detail!.question.answer.lines.length).toBeGreaterThan(0);
      expect(detail!.question).not.toHaveProperty("truth");
      expect(detail!.question).not.toHaveProperty("correctOption");
      for (const media of detail!.question.media) {
        expect(media).not.toHaveProperty("asset");
        expect(media).not.toHaveProperty("url");
      }
    }
  }
  expect([...mechanics].sort()).toEqual([
    "choice",
    "duel",
    "finale",
    "guess",
    "rank",
    "slider",
    "typed",
    "vote",
  ]);
});

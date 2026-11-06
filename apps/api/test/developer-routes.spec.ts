import { Hono } from "hono";
import { beforeEach, expect, it, vi } from "vitest";
vi.mock("../src/auth/routes.ts", () => ({ administratorForRequest: vi.fn() }));
import { administratorForRequest } from "../src/auth/routes.ts";
import { registerRoomRoutes } from "../src/room/routes.ts";

const app = new Hono<{ Bindings: Env }>();
registerRoomRoutes(app);
const hostAction = vi.fn();
const openBotSessions = vi.fn();
const openRehearsalPhone = vi.fn();
const env = {
  APP_ENV: "staging",
  PARTY_ROOM: {
    idFromName: (name: string) => name,
    get: () => ({ hostAction, openBotSessions, openRehearsalPhone }),
  },
} as unknown as Env;
const control = "26_room_control=00000000-0000-4000-8000-000000000001.secret";
const post = (
  path: string,
  data?: unknown,
  origin = "https://example.com",
  cookie = control,
) =>
  app.request(
    `https://example.com${path}`,
    {
      method: "POST",
      headers: { origin, cookie, "content-type": "application/json" },
      ...(data ? { body: JSON.stringify(data) } : {}),
    },
    env,
  );
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(administratorForRequest).mockResolvedValue({ email: "admin@example.test" });
  hostAction.mockResolvedValue({
    ok: true,
    phase: "lobby",
    paused: false,
    held: false,
    stateVersion: 2,
  });
  openBotSessions.mockResolvedValue({ ok: true, sessions: [] });
});
it("requires administrator, control credential and same origin for bot transport bootstrap", async () => {
  const path = "/api/rooms/ABCDEFGH/bot-sessions";
  expect((await post(path, undefined, "https://wrong.example")).status).toBe(403);
  expect(openBotSessions).not.toHaveBeenCalled();
  expect((await post(path, undefined, "https://example.com", "")).status).toBe(401);
  expect(openBotSessions).not.toHaveBeenCalled();
  vi.mocked(administratorForRequest).mockResolvedValue(
    Response.json({ error: "unauthenticated" }, { status: 401 }),
  );
  expect((await post(path)).status).toBe(401);
  expect(openBotSessions).not.toHaveBeenCalled();
  vi.mocked(administratorForRequest).mockResolvedValue({ email: "admin@example.test" });
  const response = await post(path);
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(await response.json()).toEqual({ sessions: [] });
});
it("validates bot count and sends the exact receipted command to the room", async () => {
  const command = {
    gameId: "ABCDEFGH",
    requestId: crypto.randomUUID(),
    action: "developer-bots",
    botCount: 25,
  };
  for (const botCount of [-1, 101, 1.5, "25", null]) {
    expect((await post("/api/rooms/play", { ...command, botCount })).status).toBe(400);
  }
  expect(hostAction).not.toHaveBeenCalled();
  expect((await post("/api/rooms/play", command)).status).toBe(200);
  expect(hostAction).toHaveBeenCalledWith(
    expect.objectContaining({
      requestId: command.requestId,
      action: "developer-bots",
      botCount: 25,
    }),
  );
});

it("authenticates and validates each named look before forwarding its receipted command", async () => {
  const command = {
    gameId: "ABCDEFGH",
    requestId: crypto.randomUUID(),
    action: "kart-look",
    lookPreset: "race",
  };
  expect((await post("/api/rooms/play", command, "https://wrong.example")).status).toBe(
    403,
  );
  expect(
    (await post("/api/rooms/play", command, "https://example.com", "")).status,
  ).toBe(401);
  for (const lookPreset of [undefined, null, 2, {}, "neutral", "DAYLIGHT"])
    expect((await post("/api/rooms/play", { ...command, lookPreset })).status).toBe(
      400,
    );
  expect(hostAction).not.toHaveBeenCalled();
  for (const lookPreset of ["off", "daylight", "warm", "crisp", "cool", "race"]) {
    const input = { ...command, requestId: crypto.randomUUID(), lookPreset };
    expect((await post("/api/rooms/play", input)).status).toBe(200);
    expect(hostAction).toHaveBeenLastCalledWith(
      expect.objectContaining({
        requestId: input.requestId,
        action: "kart-look",
        lookPreset,
      }),
    );
  }
});

it("authenticates and validates named gameplay handling before forwarding the host command", async () => {
  const command = {
    gameId: "ABCDEFGH",
    requestId: crypto.randomUUID(),
    action: "kart-handling",
    handlingPreset: "bounce-v1",
  };
  expect((await post("/api/rooms/play", command, "https://wrong.example")).status).toBe(
    403,
  );
  expect(
    (await post("/api/rooms/play", command, "https://example.com", "")).status,
  ).toBe(401);
  for (const handlingPreset of [undefined, null, {}, "bounce", "unknown", 3])
    expect((await post("/api/rooms/play", { ...command, handlingPreset })).status).toBe(
      400,
    );
  expect(hostAction).not.toHaveBeenCalled();
  for (const handlingPreset of ["slide-v1", "bounce-v1"]) {
    const input = { ...command, requestId: crypto.randomUUID(), handlingPreset };
    expect((await post("/api/rooms/play", input)).status).toBe(200);
    expect(hostAction).toHaveBeenLastCalledWith(
      expect.objectContaining({
        action: "kart-handling",
        handlingPreset,
        requestId: input.requestId,
      }),
    );
  }
});

it("projects a real rehearsal phone bootstrap without leaking internal receipt fields", async () => {
  const requestId = crypto.randomUUID();
  const session = {
    gameId: "ABCDEFGH",
    joinCode: "ABCDEF",
    playerId: crypto.randomUUID(),
    nickname: "Phone test",
    stateVersion: 1,
  };
  openRehearsalPhone.mockResolvedValue({
    ...session,
    ok: true,
    secret: "x".repeat(43),
    expiresAt: "private",
  });
  const response = await post("/api/rooms/ABCDEFGH/rehearsal-phone", { requestId });
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ ...session, secret: "x".repeat(43) });
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(
    (
      await post(
        "/api/rooms/ABCDEFGH/rehearsal-phone",
        { requestId },
        "https://wrong.test",
      )
    ).status,
  ).toBe(403);
});

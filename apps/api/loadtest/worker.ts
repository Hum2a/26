/**
 * Throwaway load-test Worker. Deploys the real PartyRoom to a separate Worker
 * on Aden's own Cloudflare account, so an 80-phone kart race can be measured
 * on real Cloudflare without touching staging or production.
 *
 * Every `/lt/*` call needs the `x-loadtest-token` header to match the
 * LOADTEST_TOKEN secret. Sockets (`/ws/:gameId`) are passed straight to the
 * room, which checks its own credentials. APP_ENV is "local" so the room
 * allows its kart rehearsal; there is no auth database, email or media here.
 */
import { PartyRoom } from "../src/room/party-room";
import { RoomCodeRegistry } from "../src/room/registry";
import { payloadDigest } from "../src/room/digest.ts";

export { PartyRoom, RoomCodeRegistry };

type LoadEnv = Env & { LOADTEST_TOKEN?: string };

const roomMethods = new Set([
  "startKartRehearsal",
  "advanceRound",
  "pauseRound",
  "snapshotFor",
  "diagnostics",
  "joinPlayer",
]);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

export default {
  async fetch(request: Request, env: LoadEnv): Promise<Response> {
    const url = new URL(request.url);
    const socket = /^\/ws\/([A-Za-z0-9_-]+)$/.exec(url.pathname);
    if (socket) {
      return env.PARTY_ROOM.getByName(socket[1]!).fetch(request);
    }
    if (!url.pathname.startsWith("/lt/")) return json({ error: "not found" }, 404);
    const token = env.LOADTEST_TOKEN;
    if (!token || request.headers.get("x-loadtest-token") !== token)
      return json({ error: "forbidden" }, 403);
    if (request.method !== "POST") return json({ error: "method" }, 405);
    const body = (await request.json()) as Record<string, unknown>;
    if (url.pathname === "/lt/create") {
      const created = await env.ROOM_CODE_REGISTRY.getByName("codes").createLobby({
        requestId: crypto.randomUUID(),
        digest: await payloadDigest({ action: "create" }),
        now: new Date().toISOString(),
      });
      return json(created);
    }
    if (url.pathname === "/lt/room") {
      const gameId = String(body.gameId ?? "");
      const method = String(body.method ?? "");
      if (!gameId || !roomMethods.has(method)) return json({ error: "method" }, 400);
      const stub = env.PARTY_ROOM.getByName(gameId) as unknown as Record<
        string,
        (...args: unknown[]) => Promise<unknown>
      >;
      // Use Cloudflare's clock, never the driving PC's: stamp every time field here.
      const args = ((body.args as unknown[]) ?? []).map((arg) =>
        arg && typeof arg === "object"
          ? {
              ...arg,
              ...("nowMs" in arg ? { nowMs: Date.now() } : {}),
              ...("now" in arg ? { now: new Date().toISOString() } : {}),
            }
          : arg,
      );
      return json(await stub[method]!(...args));
    }
    return json({ error: "not found" }, 404);
  },
} satisfies ExportedHandler<LoadEnv>;

import { Hono } from "hono";
import {
  apiErrorSchema,
  apiNotFoundMessage,
  healthResponseSchema,
  liveConnectionNotFoundMessage,
} from "@26/shared";
import { authFailure } from "./auth/http.ts";
import { registerAuthRoutes } from "./auth/routes";
import { registerMediaRoutes } from "./media/routes";
import { registerRoomRoutes } from "./room/routes";
import { registerAdminRoomRoutes } from "./room/admin-routes";
import { registerAdminContentRoutes } from "./room/admin-content";
import {
  rejectUnlessClientApiKey,
  requiresClientApiKey,
} from "./security/client-api-key.ts";
import { PartyRoom } from "./room/party-room";
import { RoomCodeRegistry } from "./room/registry";

export { PartyRoom, RoomCodeRegistry };

export const app = new Hono<{ Bindings: Env }>();

function jsonNotFound(message: string): Response {
  const body = apiErrorSchema.parse({
    error: "not_found",
    message,
  });
  return Response.json(body, { status: 404 });
}

app.get("/api/health", (c) => {
  const parsed = healthResponseSchema.safeParse({
    ok: true,
    service: "26-humza-website",
    environment: c.env.APP_ENV,
  });

  if (!parsed.success) {
    return Response.json(
      {
        error: "misconfigured",
        message: "APP_ENV must be local, staging, or production.",
      },
      { status: 500 },
    );
  }

  return c.json(parsed.data);
});

app.use("*", async (c, next) => {
  if (!requiresClientApiKey(c.req.path)) {
    await next();
    return;
  }
  if (rejectUnlessClientApiKey(c.req.raw, c.env)) {
    return authFailure("forbidden", 403);
  }
  await next();
});

registerAuthRoutes(app);
registerRoomRoutes(app);
registerAdminRoomRoutes(app);
registerAdminContentRoutes(app);
registerMediaRoutes(app);

// Missing API and WebSocket routes answer here. They must not call ASSETS,
// because SPA asset fallback would return index.html.
app.all("/api", () => jsonNotFound(apiNotFoundMessage));
app.all("/api/*", () => jsonNotFound(apiNotFoundMessage));
app.all("/ws", () => jsonNotFound(liveConnectionNotFoundMessage));

// Do not add /ws/* here. A second match makes Hono copy the response and
// drop the WebSocket on the upgrade.
app.notFound((c) => {
  if (c.req.path.startsWith("/ws")) {
    return jsonNotFound(liveConnectionNotFoundMessage);
  }
  if (c.req.path.startsWith("/api")) {
    return jsonNotFound(apiNotFoundMessage);
  }
  return new Response(null, { status: 404 });
});

const worker = {
  fetch(request, env, ctx) {
    return app.fetch(request, env, ctx);
  },
} satisfies ExportedHandler<Env>;

export default worker;

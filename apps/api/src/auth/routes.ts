import {
  adminSessionSchema,
  apiErrorSchema,
  apiNotFoundMessage,
  devInboxSchema,
  gameIdSchema,
  issuedCredentialSchema,
  magicLinkAcceptanceSchema,
  presentationStatusSchema,
  roomCommandStubSchema,
  roomCredentialRoleSchema,
} from "@26/shared";
import type { Hono } from "hono";
import {
  authBindingsFromEnv,
  configuredAdminEmail,
  presentBinding,
  type AuthBindings,
} from "./bindings.ts";
import { resolveAuthSecret, resolvePublicOrigin, type Auth } from "./create-auth.ts";
import type { AppDatabase } from "./create-database.ts";
import { listLocalInbox, type EmailSender } from "./create-email.ts";
import { authFailure, copyCookies, jsonData, logAuthFailure } from "./http.ts";
import { authForRequest } from "./prepare.ts";
import { sameOriginRejection } from "../credentials/cookies.ts";
import { createSqlRoomCredentialDirectory } from "../credentials/directory.ts";
import { issueRoomCredential } from "../credentials/issue.ts";
import {
  readCredentialCookie,
  serializeCredentialCookie,
} from "../credentials/cookies.ts";
import { credentialLifetimeMs, verifyRoomCredential } from "../credentials/verify.ts";

type ReadyAuth = {
  bindings: AuthBindings;
  origin: string;
  adminEmail: string;
  database: AppDatabase;
  email: EmailSender;
  auth: Auth;
};

export function registerAuthRoutes(app: Hono<{ Bindings: Env }>): void {
  app.on(["GET", "POST"], "/api/auth/*", async (c) => {
    const ready = await readyAuth(c.env, c.req.url);
    if (ready instanceof Response) {
      return ready;
    }
    return ready.auth.handler(c.req.raw);
  });

  app.get("/api/admin/session", async (c) => {
    const ready = await readyAuth(c.env, c.req.url);
    if (ready instanceof Response) {
      return ready;
    }
    const email = await readAdministrator(ready, c.req.raw);
    return jsonData(adminSessionSchema.parse({ signedIn: Boolean(email), email }));
  });

  app.post("/api/admin/magic-link", async (c) => {
    const rejected = rejectCrossSite(c.req.raw);
    if (rejected) {
      return rejected;
    }
    const ready = await readyAuth(c.env, c.req.url);
    if (ready instanceof Response) {
      return ready;
    }
    const email = await readEmailBody(c.req.raw);
    const acceptance = magicLinkAcceptanceSchema.parse({
      accepted: true,
      delivery: ready.email.kind === "local-inbox" ? "local-inbox" : "email",
    });
    if (!email || email !== ready.adminEmail) {
      return jsonData(acceptance);
    }
    const response = await ready.auth.handler(
      new Request(new URL("/api/auth/sign-in/magic-link", ready.origin), {
        method: "POST",
        headers: {
          origin: ready.origin,
          "content-type": "application/json",
        },
        body: JSON.stringify({ email }),
      }),
    );
    if (!response.ok) {
      logAuthFailure(
        new Error(`Magic link request failed with status ${response.status}`),
      );
      return authFailure("misconfigured", 503);
    }
    return jsonData(acceptance);
  });

  app.get("/api/admin/magic-link/verify", () => authFailure("invalid", 405));

  app.post("/api/admin/magic-link/verify", async (c) => {
    const rejected = rejectCrossSite(c.req.raw);
    if (rejected) {
      return rejected;
    }
    const ready = await readyAuth(c.env, c.req.url);
    if (ready instanceof Response) {
      return ready;
    }
    const token = await readTokenBody(c.req.raw);
    if (!token) {
      return authFailure("invalid", 400);
    }
    const verifyUrl = new URL("/api/auth/magic-link/verify", ready.origin);
    verifyUrl.searchParams.set("token", token);
    const response = await ready.auth.handler(
      new Request(verifyUrl, {
        headers: {
          origin: ready.origin,
          cookie: c.req.raw.headers.get("cookie") ?? "",
        },
      }),
    );
    if (!response.ok) {
      return authFailure("invalid", 400);
    }
    const email = await readVerifiedEmail(response, ready.adminEmail);
    if (!email) {
      return authFailure("invalid", 400);
    }
    return jsonData(
      adminSessionSchema.parse({ signedIn: true, email }),
      200,
      copyCookies(response),
    );
  });

  app.post("/api/admin/email-code/verify", async (c) => {
    const rejected = rejectCrossSite(c.req.raw);
    if (rejected) return rejected;
    const ready = await readyAuth(c.env, c.req.url);
    if (ready instanceof Response) return ready;
    const body = await readJson(c.req.raw);
    if (
      !body ||
      typeof body !== "object" ||
      !("email" in body) ||
      !("code" in body) ||
      typeof body.email !== "string" ||
      typeof body.code !== "string" ||
      body.email.trim().toLowerCase() !== ready.adminEmail ||
      !/^\d{6}$/.test(body.code.trim())
    ) {
      return authFailure("invalid", 400);
    }
    const headers = new Headers(c.req.raw.headers);
    headers.set("origin", ready.origin);
    headers.set("content-type", "application/json");
    const response = await ready.auth.handler(
      new Request(new URL("/api/auth/sign-in/email-otp", ready.origin), {
        method: "POST",
        headers,
        body: JSON.stringify({ email: ready.adminEmail, otp: body.code.trim() }),
      }),
    );
    if (!response.ok)
      return authFailure("invalid", response.status === 429 ? 429 : 400);
    const email = await readVerifiedEmail(response, ready.adminEmail);
    if (!email) return authFailure("invalid", 400);
    return jsonData(
      adminSessionSchema.parse({ signedIn: true, email }),
      200,
      copyCookies(response),
    );
  });

  app.post("/api/admin/sign-out", async (c) => {
    const rejected = rejectCrossSite(c.req.raw);
    if (rejected) {
      return rejected;
    }
    const ready = await readyAuth(c.env, c.req.url);
    if (ready instanceof Response) {
      return ready;
    }
    const response = await ready.auth.handler(
      new Request(new URL("/api/auth/sign-out", ready.origin), {
        method: "POST",
        headers: {
          origin: ready.origin,
          cookie: c.req.raw.headers.get("cookie") ?? "",
          "content-type": "application/json",
        },
        body: "{}",
      }),
    );
    return jsonData(
      adminSessionSchema.parse({ signedIn: false }),
      response.ok ? 200 : 400,
      copyCookies(response),
    );
  });

  app.get("/api/dev/inbox", async (c) => {
    if (c.env.APP_ENV !== "local") {
      return jsonNotFound();
    }
    const ready = await readyAuth(c.env, c.req.url);
    if (ready instanceof Response) {
      return ready;
    }
    if (ready.email.kind !== "local-inbox") {
      return jsonNotFound();
    }
    const messages = await listLocalInbox(ready.database, {
      html: c.req.query("format") !== "text",
    });
    return jsonData(devInboxSchema.parse({ messages }));
  });

  app.post("/api/admin/rooms/:roomId/credentials", async (c) => {
    const rejected = rejectCrossSite(c.req.raw);
    if (rejected) {
      return rejected;
    }
    const ready = await readyAuth(c.env, c.req.url);
    if (ready instanceof Response) {
      return ready;
    }
    const admin = await readAdministrator(ready, c.req.raw);
    if (!admin) {
      return authFailure("unauthenticated", 401);
    }
    const roomId = gameIdSchema.safeParse(c.req.param("roomId"));
    const body = await readJson(c.req.raw);
    const role = roomCredentialRoleSchema.safeParse(
      body && typeof body === "object" && "role" in body ? body.role : undefined,
    );
    if (!roomId.success || !role.success) {
      return authFailure("invalid", 400);
    }
    const issued = await issueRoomCredential({
      directory: createSqlRoomCredentialDirectory(ready.database),
      roomId: roomId.data,
      role: role.data,
      now: new Date(),
    });
    const headers = new Headers();
    headers.append(
      "set-cookie",
      serializeCredentialCookie({
        role: role.data,
        credentialId: issued.record.id,
        secret: issued.secret,
        maxAgeSeconds: Math.floor(credentialLifetimeMs(role.data) / 1000),
      }),
    );
    return jsonData(
      issuedCredentialSchema.parse({
        credentialId: issued.record.id,
        role: issued.record.role,
        expiresAt: issued.record.expiresAt,
      }),
      200,
      headers,
    );
  });

  app.post("/api/admin/rooms/:roomId/credentials/revoke", async (c) => {
    const rejected = rejectCrossSite(c.req.raw);
    if (rejected) {
      return rejected;
    }
    const ready = await readyAuth(c.env, c.req.url);
    if (ready instanceof Response) {
      return ready;
    }
    const admin = await readAdministrator(ready, c.req.raw);
    if (!admin) {
      return authFailure("unauthenticated", 401);
    }
    const roomId = gameIdSchema.safeParse(c.req.param("roomId"));
    const body = await readJson(c.req.raw);
    const credentialId =
      body &&
      typeof body === "object" &&
      "credentialId" in body &&
      typeof body.credentialId === "string"
        ? body.credentialId
        : "";
    if (!roomId.success || !credentialId) {
      return authFailure("invalid", 400);
    }
    const directory = createSqlRoomCredentialDirectory(ready.database);
    const record = await directory.get(credentialId);
    if (!record || record.roomId !== roomId.data) {
      return authFailure("invalid", 400);
    }
    await directory.revoke(credentialId, new Date().toISOString());
    return jsonData({ revoked: true });
  });

  app.post("/api/admin/rooms/:roomId/commands", async (c) => {
    const rejected = rejectCrossSite(c.req.raw);
    if (rejected) {
      return rejected;
    }
    const ready = await readyAuth(c.env, c.req.url);
    if (ready instanceof Response) {
      return ready;
    }
    const roomId = gameIdSchema.safeParse(c.req.param("roomId"));
    if (!roomId.success) {
      return authFailure("invalid", 400);
    }
    const presented = readCredentialCookie(
      c.req.raw.headers.get("cookie") ?? undefined,
      "control",
    );
    if (!presented) {
      return authFailure("unauthenticated", 401);
    }
    const record = await createSqlRoomCredentialDirectory(ready.database).get(
      presented.credentialId,
    );
    if (!record) {
      return authFailure("unauthenticated", 401);
    }
    const check = await verifyRoomCredential({
      credentialId: presented.credentialId,
      secret: presented.secret,
      record,
      now: new Date(),
      roomId: roomId.data,
      role: "control",
    });
    if (!check.ok) {
      return credentialFailure(check.reason);
    }
    return jsonData(roomCommandStubSchema.parse({ accepted: true, effect: "none" }));
  });

  app.get("/api/stage/presentation", async (c) => {
    const ready = await readyAuth(c.env, c.req.url);
    if (ready instanceof Response) {
      return ready;
    }
    const roomId = gameIdSchema.safeParse(c.req.query("roomId"));
    if (!roomId.success) {
      return authFailure("invalid", 400);
    }
    const presented = readCredentialCookie(
      c.req.raw.headers.get("cookie") ?? undefined,
      "presentation",
    );
    if (!presented) {
      return authFailure("unauthenticated", 401);
    }
    const record = await createSqlRoomCredentialDirectory(ready.database).get(
      presented.credentialId,
    );
    if (!record) {
      return authFailure("unauthenticated", 401);
    }
    const check = await verifyRoomCredential({
      credentialId: presented.credentialId,
      secret: presented.secret,
      record,
      now: new Date(),
      roomId: roomId.data,
      role: "presentation",
    });
    if (!check.ok) {
      return credentialFailure(check.reason);
    }
    return jsonData(
      presentationStatusSchema.parse({ role: "presentation", roomId: roomId.data }),
    );
  });
}

function rejectCrossSite(request: Request): Response | undefined {
  if (sameOriginRejection(request)) {
    return authFailure("forbidden", 403);
  }
  return undefined;
}

async function readyAuth(env: Env, requestUrl: string): Promise<ReadyAuth | Response> {
  const bindings = authBindingsFromEnv(env);
  const adminEmail = configuredAdminEmail(bindings);
  const origin = resolvePublicOrigin(bindings, requestUrl);
  if (!adminEmail || !resolveAuthSecret(bindings) || !origin) {
    return authFailure("misconfigured", 503);
  }
  if (bindings.APP_ENV !== "local" && !presentBinding(bindings.DATABASE_URL)) {
    return authFailure("misconfigured", 503);
  }
  try {
    const ready = await authForRequest({ ...bindings, ...env }, origin);
    return { bindings, origin, adminEmail, ...ready };
  } catch (error) {
    logAuthFailure(error);
    return authFailure("misconfigured", 503);
  }
}

function credentialFailure(
  reason: "mismatch" | "expired" | "revoked" | "wrong_role" | "wrong_room",
): Response {
  if (reason === "wrong_role" || reason === "wrong_room") {
    return authFailure("forbidden", 403);
  }
  if (reason === "expired") {
    return authFailure("expired", 401);
  }
  return authFailure("unauthenticated", 401);
}

async function readVerifiedEmail(
  response: Response,
  adminEmail: string,
): Promise<string | undefined> {
  const body: unknown = await response.json();
  if (!body || typeof body !== "object" || !("user" in body)) {
    return undefined;
  }
  const user = body.user;
  if (
    !user ||
    typeof user !== "object" ||
    !("email" in user) ||
    typeof user.email !== "string"
  ) {
    return undefined;
  }
  return user.email.toLowerCase() === adminEmail ? user.email : undefined;
}

export async function administratorForRequest(
  env: Env,
  request: Request,
): Promise<{ email: string } | Response> {
  const ready = await readyAuth(env, request.url);
  if (ready instanceof Response) {
    return ready;
  }
  try {
    const email = await readAdministrator(ready, request);
    if (!email) {
      return authFailure("unauthenticated", 401);
    }
    return { email };
  } catch (error) {
    logAuthFailure(error);
    return authFailure("misconfigured", 503);
  }
}

async function readAdministrator(
  ready: ReadyAuth,
  source: Request,
): Promise<string | undefined> {
  const headers = new Headers();
  const cookie = source.headers.get("cookie");
  if (cookie) {
    headers.set("cookie", cookie);
  }
  const response = await ready.auth.handler(
    new Request(new URL("/api/auth/get-session", ready.origin), { headers }),
  );
  if (!response.ok) {
    return undefined;
  }
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return undefined;
  }
  if (!body || typeof body !== "object" || !("user" in body)) {
    return undefined;
  }
  const user = body.user;
  if (
    !user ||
    typeof user !== "object" ||
    !("email" in user) ||
    typeof user.email !== "string"
  ) {
    return undefined;
  }
  return user.email.toLowerCase() === ready.adminEmail ? user.email : undefined;
}

async function readEmailBody(request: Request): Promise<string | undefined> {
  const body = await readJson(request);
  if (
    !body ||
    typeof body !== "object" ||
    !("email" in body) ||
    typeof body.email !== "string"
  ) {
    return undefined;
  }
  const email = body.email.trim().toLowerCase();
  return email.includes("@") ? email : undefined;
}

async function readTokenBody(request: Request): Promise<string | undefined> {
  const body = await readJson(request);
  if (
    !body ||
    typeof body !== "object" ||
    !("token" in body) ||
    typeof body.token !== "string"
  ) {
    return undefined;
  }
  const token = body.token.trim();
  return token.length > 0 ? token : undefined;
}

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return undefined;
  }
}

function jsonNotFound(): Response {
  return Response.json(
    apiErrorSchema.parse({ error: "not_found", message: apiNotFoundMessage }),
    {
      status: 404,
    },
  );
}

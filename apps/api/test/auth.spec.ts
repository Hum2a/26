import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { clientApiKeyHeader } from "@26/shared";
import { createEmail } from "../src/auth/create-email.ts";
import { openDatabase } from "../src/auth/create-database.ts";
import { ensurePrepared } from "../src/auth/prepare.ts";
import { app } from "../src/index.ts";

const roomId = "ABCDEFGH";
const adminEmail = "humzab1711@hotmail.com";
const origin = "http://example.com";

function unusedRoomNamespace<T>(): T {
  const unused = () => {
    throw new Error("Rooms are not used in auth tests.");
  };
  return {
    get: unused,
    getByName: unused,
    idFromName: unused,
    idFromString: unused,
    newUniqueId: unused,
    jurisdiction: unused,
  } as T;
}

function localEnv(id: string): Env {
  return {
    ASSETS: {
      fetch: () => Promise.resolve(new Response(null, { status: 404 })),
      connect: () => {
        throw new Error("ASSETS.connect is not used in auth tests.");
      },
    } as Fetcher,
    APP_ENV: "local",
    ADMIN_EMAIL: adminEmail,
    BETTER_AUTH_SECRET: "",
    BETTER_AUTH_URL: "",
    DATABASE_URL: "",
    RESEND_API_KEY: "",
    RESEND_FROM: "",
    R2_ACCOUNT_ID: "",
    R2_ACCESS_KEY_ID: "",
    R2_SECRET_ACCESS_KEY: "",
    EMAIL_TEST_RECIPIENT: "",
    CLIENT_API_KEY: "",
    MEDIA_BUCKET_NAME: "26-humza-media-local",
    MEDIA_BUCKET: unusedRoomNamespace<Env["MEDIA_BUCKET"]>(),
    PARTY_ROOM: unusedRoomNamespace<Env["PARTY_ROOM"]>(),
    ROOM_CODE_REGISTRY: unusedRoomNamespace<Env["ROOM_CODE_REGISTRY"]>(),
    LOCAL_DATABASE_ID: id,
  };
}

function productionEnv(): Env {
  return {
    ...localEnv("production-must-not-open"),
    APP_ENV: "production",
    CLIENT_API_KEY: "auth-test-client-key",
    ADMIN_EMAIL: "",
    LOCAL_DATABASE_ID: undefined,
  };
}

async function send(
  env: Env,
  pathName: string,
  init: { method?: string; body?: unknown; cookie?: string; origin?: string } = {},
): Promise<Response> {
  const headers = new Headers();
  // Reach the authentication route through the production client-key gate.
  if (env.CLIENT_API_KEY) headers.set(clientApiKeyHeader, env.CLIENT_API_KEY);
  if (init.origin !== "") {
    headers.set("origin", init.origin ?? origin);
    headers.set("sec-fetch-site", "same-origin");
  }
  if (init.body !== undefined) {
    headers.set("content-type", "application/json");
  }
  if (init.cookie) {
    headers.set("cookie", init.cookie);
  }
  return app.request(
    `${origin}${pathName}`,
    {
      method: init.method ?? "GET",
      headers,
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    },
    env,
  );
}

function cookiePair(response: Response, name: string): string | undefined {
  const pair = response.headers
    .getSetCookie()
    .map((value) => value.split(";")[0] ?? "")
    .find((value) => value.startsWith(`${name}=`));
  return pair;
}

describe("administrator auth", () => {
  it("sends a confirm link only for the configured administrator", async () => {
    const env = localEnv("allowlist");
    const stranger = await send(env, "/api/admin/magic-link", {
      method: "POST",
      body: { email: "guest@example.com" },
    });
    expect(stranger.status).toBe(200);
    expect(await stranger.json()).toEqual({ accepted: true, delivery: "local-inbox" });

    const inboxBefore = await send(env, "/api/dev/inbox");
    expect(await inboxBefore.json()).toEqual({ messages: [] });

    const admin = await send(env, "/api/admin/magic-link", {
      method: "POST",
      body: { email: adminEmail },
    });
    expect(admin.status).toBe(200);
    const inbox = await send(env, "/api/dev/inbox");
    const body = (await inbox.json()) as { messages: Array<{ text: string }> };
    expect(body.messages).toHaveLength(1);
    expect(body.messages[0]?.text).toContain("/admin/confirm?token=");
    expect(body.messages[0]?.text).not.toContain("/magic-link/verify");
  });

  it("does not consume a magic link when the confirm page is only opened", async () => {
    const env = localEnv("scanner");
    await send(env, "/api/admin/magic-link", {
      method: "POST",
      body: { email: adminEmail },
    });
    const inbox = (await (await send(env, "/api/dev/inbox")).json()) as {
      messages: Array<{ text: string }>;
    };
    const token = new URL(
      inbox.messages[0]?.text.match(/https?:\/\/\S+/)?.[0] ?? "",
    ).searchParams.get("token");
    expect(token).toBeTruthy();

    const opened = await send(env, `/admin/confirm?token=${token}`);
    expect(opened.status).toBe(404);
    const premature = await send(env, `/api/admin/magic-link/verify?token=${token}`);
    expect(premature.status).toBe(405);

    const confirmed = await send(env, "/api/admin/magic-link/verify", {
      method: "POST",
      body: { token },
    });
    expect(confirmed.status).toBe(200);
    expect(await confirmed.json()).toMatchObject({ signedIn: true, email: adminEmail });
    expect(
      cookiePair(confirmed, "better-auth.session_token") ??
        cookiePair(confirmed, "__Secure-better-auth.session_token"),
    ).toBeTruthy();

    const replay = await send(env, "/api/admin/magic-link/verify", {
      method: "POST",
      body: { token },
    });
    expect(replay.status).toBe(400);
  });

  it("rejects a bad token and an expired token", async () => {
    const env = localEnv("expired");
    const bad = await send(env, "/api/admin/magic-link/verify", {
      method: "POST",
      body: { token: "not-a-real-token" },
    });
    expect(bad.status).toBe(400);

    await send(env, "/api/admin/magic-link", {
      method: "POST",
      body: { email: adminEmail },
    });
    const database = await openDatabase(env);
    await database.executor.query(`update verification set "expiresAt" = $1`, [
      "2000-01-01T00:00:00.000Z",
    ]);
    const inbox = (await (await send(env, "/api/dev/inbox")).json()) as {
      messages: Array<{ text: string }>;
    };
    const token = new URL(
      inbox.messages[0]?.text.match(/https?:\/\/\S+/)?.[0] ?? "",
    ).searchParams.get("token");
    const expired = await send(env, "/api/admin/magic-link/verify", {
      method: "POST",
      body: { token },
    });
    expect(expired.status).toBe(400);
    const session = await send(env, "/api/admin/session");
    expect(await session.json()).toEqual({ signedIn: false });
  });

  it("rejects guests and keeps control separate from presentation", async () => {
    const env = localEnv("roles");
    const guest = await send(env, `/api/admin/rooms/${roomId}/commands`, {
      method: "POST",
    });
    expect(guest.status).toBe(401);

    const session = await signIn(env);
    const control = await send(env, `/api/admin/rooms/${roomId}/credentials`, {
      method: "POST",
      cookie: session,
      body: { role: "control" },
    });
    const presentation = await send(env, `/api/admin/rooms/${roomId}/credentials`, {
      method: "POST",
      cookie: session,
      body: { role: "presentation" },
    });
    expect(control.status).toBe(200);
    expect(presentation.status).toBe(200);
    const controlCookie = cookiePair(control, "26_room_control");
    const presentationCookie = cookiePair(presentation, "26_room_presentation");
    expect(controlCookie).toBeTruthy();
    expect(presentationCookie).toBeTruthy();
    expect(JSON.stringify(await control.json())).not.toContain(
      controlCookie?.split("=")[1],
    );

    const allowed = await send(env, `/api/admin/rooms/${roomId}/commands`, {
      method: "POST",
      cookie: controlCookie,
    });
    expect(allowed.status).toBe(200);
    expect(await allowed.json()).toEqual({ accepted: true, effect: "none" });

    const wrongRole = await send(env, `/api/admin/rooms/${roomId}/commands`, {
      method: "POST",
      cookie: presentationCookie?.replace("26_room_presentation=", "26_room_control="),
    });
    expect(wrongRole.status).toBe(403);

    const stage = await send(env, `/api/stage/presentation?roomId=${roomId}`, {
      cookie: presentationCookie,
    });
    expect(stage.status).toBe(200);
    expect(await stage.json()).toEqual({ role: "presentation", roomId });

    const stageWithControl = await send(
      env,
      `/api/stage/presentation?roomId=${roomId}`,
      {
        cookie: controlCookie?.replace("26_room_control=", "26_room_presentation="),
      },
    );
    expect(stageWithControl.status).toBe(403);
  });

  it("revokes a control credential and rejects it afterwards", async () => {
    const env = localEnv("revoke");
    const session = await signIn(env);
    const issued = await send(env, `/api/admin/rooms/${roomId}/credentials`, {
      method: "POST",
      cookie: session,
      body: { role: "control" },
    });
    const issuedBody = (await issued.json()) as { credentialId: string };
    const controlCookie = cookiePair(issued, "26_room_control");
    const revoked = await send(env, `/api/admin/rooms/${roomId}/credentials/revoke`, {
      method: "POST",
      cookie: session,
      body: { credentialId: issuedBody.credentialId },
    });
    expect(revoked.status).toBe(200);
    const again = await send(env, `/api/admin/rooms/${roomId}/credentials/revoke`, {
      method: "POST",
      cookie: session,
      body: { credentialId: issuedBody.credentialId },
    });
    expect(again.status).toBe(200);
    const command = await send(env, `/api/admin/rooms/${roomId}/commands`, {
      method: "POST",
      cookie: controlCookie,
    });
    expect(command.status).toBe(401);
  });

  it("rejects an expired room credential from the stored verifier", async () => {
    const env = localEnv("credential-expiry");
    const session = await signIn(env);
    const issued = await send(env, `/api/admin/rooms/${roomId}/credentials`, {
      method: "POST",
      cookie: session,
      body: { role: "control" },
    });
    const issuedBody = (await issued.json()) as { credentialId: string };
    const database = await openDatabase(env);
    await database.executor.query(
      `update room_credential set expires_at = $1 where id = $2`,
      ["2000-01-01T00:00:00.000Z", issuedBody.credentialId],
    );
    const command = await send(env, `/api/admin/rooms/${roomId}/commands`, {
      method: "POST",
      cookie: cookiePair(issued, "26_room_control"),
    });
    expect(command.status).toBe(401);
    expect(await command.json()).toMatchObject({ error: "expired" });
  });

  it("rejects a cross-site mutation", async () => {
    const env = localEnv("csrf");
    const response = await send(env, "/api/admin/magic-link", {
      method: "POST",
      origin: "https://evil.example",
      body: { email: adminEmail },
    });
    expect(response.status).toBe(403);
  });

  it("does not offer public registration or a production inbox", async () => {
    const env = localEnv("signup");
    const signup = await send(env, "/api/auth/sign-up/email", {
      method: "POST",
      body: { email: "guest@example.com", password: "not-used-here", name: "Guest" },
    });
    expect(signup.ok).toBe(false);

    const production = productionEnv();
    const inbox = await send(production, "/api/dev/inbox");
    expect(inbox.status).toBe(404);
    const session = await send(production, "/api/admin/session");
    expect(session.status).toBe(503);
  });

  it("uses the local inbox only in local development", async () => {
    const env = localEnv("email-adapter");
    const database = await openDatabase(env);
    await ensurePrepared(env, database, { seed: false, devInbox: true });
    const local = createEmail({ APP_ENV: "local", ADMIN_EMAIL: adminEmail }, database);
    expect(local.kind).toBe("local-inbox");
    await local.send({ to: adminEmail, subject: "Sign in to 26", text: "confirm" });
    const rows = await database.executor.query(`select recipient from dev_inbox`);
    expect(rows).toHaveLength(1);

    const production = createEmail(
      { APP_ENV: "production", ADMIN_EMAIL: adminEmail },
      database,
    );
    expect(production.kind).toBe("unconfigured");
    await expect(
      production.send({ to: adminEmail, subject: "Sign in to 26", text: "confirm" }),
    ).rejects.toThrow("Email delivery is not configured.");
  });

  it("keeps server auth out of the web source", () => {
    const webSrc = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      "../../web/src",
    );
    const forbidden = [
      "internalAdapter",
      "create-auth",
      "better-auth/db",
      "local-development-only-not-a-deployed-secret",
    ];
    for (const file of walk(webSrc)) {
      const source = readFileSync(file, "utf8");
      for (const needle of forbidden) {
        expect(source, file).not.toContain(needle);
      }
    }
  });
});

async function signIn(env: Env): Promise<string> {
  await send(env, "/api/admin/magic-link", {
    method: "POST",
    body: { email: adminEmail },
  });
  const inbox = (await (await send(env, "/api/dev/inbox")).json()) as {
    messages: Array<{ text: string }>;
  };
  const token = new URL(
    inbox.messages[0]?.text.match(/https?:\/\/\S+/)?.[0] ?? "",
  ).searchParams.get("token");
  const confirmed = await send(env, "/api/admin/magic-link/verify", {
    method: "POST",
    body: { token },
  });
  expect(confirmed.status).toBe(200);
  const session = confirmed.headers
    .getSetCookie()
    .map((value) => value.split(";")[0])
    .join("; ");
  expect(session).not.toBe("");
  return session;
}

function walk(directory: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(directory)) {
    const fullPath = path.join(directory, entry);
    if (statSync(fullPath).isDirectory()) {
      files.push(...walk(fullPath));
    } else if (fullPath.endsWith(".ts") || fullPath.endsWith(".tsx")) {
      files.push(fullPath);
    }
  }
  return files;
}

import { clientApiKeyHeader, clientApiKeyQueryParam } from "@26/shared";
import { describe, expect, it } from "vitest";
import { app } from "../src/index.ts";
import {
  readClientApiKey,
  rejectUnlessClientApiKey,
  requiresClientApiKey,
} from "../src/security/client-api-key.ts";

function testEnv(overrides: Partial<Env> = {}): Env {
  return {
    APP_ENV: "local",
    ADMIN_EMAIL: "humzab1711@hotmail.com",
    BETTER_AUTH_SECRET: "",
    BETTER_AUTH_URL: "",
    CLIENT_API_KEY: "",
    DATABASE_URL: "",
    RESEND_API_KEY: "",
    RESEND_FROM: "",
    R2_ACCOUNT_ID: "",
    R2_ACCESS_KEY_ID: "",
    R2_SECRET_ACCESS_KEY: "",
    EMAIL_TEST_RECIPIENT: "",
    MEDIA_BUCKET_NAME: "26-humza-media-local",
    ASSETS: {
      fetch: () => Promise.resolve(new Response(null, { status: 404 })),
      connect: () => {
        throw new Error("ASSETS.connect is not used in client API key tests.");
      },
    } as Fetcher,
    MEDIA_BUCKET: {} as Env["MEDIA_BUCKET"],
    PARTY_ROOM: {} as Env["PARTY_ROOM"],
    ROOM_CODE_REGISTRY: {} as Env["ROOM_CODE_REGISTRY"],
    ...overrides,
  };
}

describe("client API key", () => {
  it("scopes protection to API and WebSocket routes except health and auth", () => {
    expect(requiresClientApiKey("/api/health")).toBe(false);
    expect(requiresClientApiKey("/api/auth/session")).toBe(false);
    expect(requiresClientApiKey("/api/rooms")).toBe(true);
    expect(requiresClientApiKey("/ws/ABCDEFGH")).toBe(true);
  });

  it("reads the key from a header or query parameter", () => {
    const header = new Request("http://example.com/api/rooms", {
      headers: { [clientApiKeyHeader]: "header-key" },
    });
    const query = new Request(
      `http://example.com/ws/ABCDEFGH?${clientApiKeyQueryParam}=query-key`,
    );
    expect(readClientApiKey(header)).toBe("header-key");
    expect(readClientApiKey(query)).toBe("query-key");
  });

  it("skips local checks when the binding is unset", () => {
    const request = new Request("http://example.com/api/rooms");
    expect(rejectUnlessClientApiKey(request, testEnv())).toBe(false);
  });

  it("rejects staging requests without the configured key", async () => {
    const response = await app.fetch(
      new Request("http://example.com/api/rooms", {
        method: "POST",
        headers: { origin: "http://example.com", "content-type": "application/json" },
        body: JSON.stringify({ requestId: crypto.randomUUID() }),
      }),
      testEnv({ APP_ENV: "staging", CLIENT_API_KEY: "staging-key" }),
    );
    expect(response.status).toBe(403);
  });

  it("accepts a matching header on protected routes", async () => {
    const response = await app.fetch(
      new Request("http://example.com/api/rooms/session", {
        headers: { [clientApiKeyHeader]: "local-key" },
      }),
      testEnv({ CLIENT_API_KEY: "local-key" }),
    );
    expect(response.status).not.toBe(403);
  });
});

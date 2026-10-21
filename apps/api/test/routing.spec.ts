import path from "node:path";
import { fileURLToPath } from "node:url";
import { createTestHarness, type TestHarness } from "wrangler";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { apiNotFoundMessage, liveConnectionNotFoundMessage } from "@26/shared";
import {
  withClientApiKeyHeaders,
  withClientApiQuery,
} from "./client-api-key-values.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

let server: TestHarness;

beforeAll(async () => {
  server = createTestHarness({
    root,
    workers: [
      {
        config: {
          name: "26-humza-website-test",
          main: "./src/index.ts",
          compatibility_date: "2026-09-22",
          vars: { APP_ENV: "local", CLIENT_API_KEY: "" },
          assets: {
            binding: "ASSETS",
            directory: "./test/fixtures/assets",
            not_found_handling: "single-page-application",
            run_worker_first: ["/api", "/api/*", "/ws", "/ws/*"],
          },
        },
      },
    ],
  });
  await server.listen();
});

afterAll(async () => {
  await server.close();
});

describe("routes that must not return the SPA shell", () => {
  it("returns JSON when a browser navigates to a missing API route", async () => {
    const response = await server.fetch("http://example.com/api/missing", {
      headers: withClientApiKeyHeaders({ "Sec-Fetch-Mode": "navigate" }),
    });
    const text = await response.text();

    expect(response.status).toBe(404);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(text).toContain(apiNotFoundMessage);
    expect(text).not.toContain("FIXTURE_SPA_SHELL");
  });

  it("returns JSON for a WebSocket upgrade", async () => {
    const response = await server.fetch(withClientApiQuery("http://example.com/ws"), {
      headers: withClientApiKeyHeaders({
        Upgrade: "websocket",
        Connection: "Upgrade",
        "Sec-Fetch-Mode": "navigate",
      }),
    });
    const text = await response.text();

    expect(response.status).toBe(404);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(text).toContain(liveConnectionNotFoundMessage);
    expect(text).not.toContain("FIXTURE_SPA_SHELL");
  });

  it("returns JSON for a nested WebSocket path", async () => {
    const response = await server.fetch(
      withClientApiQuery("http://example.com/ws/room"),
      {
        headers: withClientApiKeyHeaders(),
      },
    );
    const text = await response.text();

    expect(response.headers.get("content-type")).toContain("application/json");
    expect(text).toContain(liveConnectionNotFoundMessage);
    expect(text).not.toContain("FIXTURE_SPA_SHELL");
  });

  it("still serves the SPA shell for a page navigation", async () => {
    const response = await server.fetch("http://example.com/host", {
      headers: { "Sec-Fetch-Mode": "navigate" },
    });

    expect(response.status).toBe(200);
    expect(await response.text()).toContain("FIXTURE_SPA_SHELL");
  });
});

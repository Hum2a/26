import { env } from "cloudflare:workers";
import { createExecutionContext, waitOnExecutionContext } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { healthResponseSchema } from "@26/shared";
import worker from "../src/index";

const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;

describe("health", () => {
  it("reads APP_ENV from the worker binding", async () => {
    const ctx = createExecutionContext();
    const response = await worker.fetch(
      new IncomingRequest("http://example.com/api/health"),
      env,
      ctx,
    );
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(200);
    const body: unknown = await response.json();
    expect(healthResponseSchema.parse(body)).toEqual({
      ok: true,
      service: "26-humza-website",
      environment: env.APP_ENV,
    });
    expect(env.APP_ENV).toBe("staging");
  });
});

import { expect, it } from "vitest";
import { adminSessionCacheSeconds, adminSessionOptions } from "../src/auth/create-auth";

it("caches the admin session briefly so host commands rarely need the database", () => {
  expect(adminSessionCacheSeconds).toBeGreaterThan(0);
  // A revoked session stays valid for at most this long.
  expect(adminSessionCacheSeconds).toBeLessThanOrEqual(300);
  expect(adminSessionOptions).toEqual({
    cookieCache: { enabled: true, maxAge: adminSessionCacheSeconds },
  });
});

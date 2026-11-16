import { expect, it } from "vitest";
import {
  controlCredentialTtlMs,
  credentialLifetimeMs,
  presentationCredentialTtlMs,
} from "../src/credentials/verify";

it("keeps the live desk and the projector authorised for a whole party night", () => {
  const hour = 60 * 60 * 1000;
  expect(credentialLifetimeMs("control")).toBe(controlCredentialTtlMs);
  expect(credentialLifetimeMs("presentation")).toBe(presentationCredentialTtlMs);
  expect(controlCredentialTtlMs).toBeGreaterThanOrEqual(8 * hour);
  expect(presentationCredentialTtlMs).toBeGreaterThanOrEqual(12 * hour);
  // Still bounded: a forgotten tab does not stay a host for days.
  expect(presentationCredentialTtlMs).toBeLessThanOrEqual(24 * hour);
});

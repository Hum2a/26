import { describe, expect, it } from "vitest";
import {
  commandRateLimit,
  draftRateLimit,
  takeToken,
  type RateBucket,
} from "@26/shared";

function drain(
  limit: typeof commandRateLimit,
  count: number,
  at: (i: number) => number,
) {
  let bucket: RateBucket | undefined;
  let allowed = 0;
  for (let i = 0; i < count; i += 1) {
    const result = takeToken(bucket, limit, at(i));
    bucket = result.bucket;
    if (result.allowed) allowed += 1;
  }
  return { allowed, bucket };
}

describe("token bucket", () => {
  it("allows a burst up to capacity, then refuses until it refills", () => {
    const { allowed, bucket } = drain(commandRateLimit, 50, () => 1_000);
    expect(allowed).toBe(commandRateLimit.capacity);
    expect(takeToken(bucket, commandRateLimit, 1_000).allowed).toBe(false);
    expect(takeToken(bucket, commandRateLimit, 1_400).allowed).toBe(true);
  });

  it("never locks a phone out for the rest of the game", () => {
    // Two hours of one command every two seconds, the old lifetime cap was 100.
    const { allowed } = drain(commandRateLimit, 3_600, (i) => i * 2_000);
    expect(allowed).toBe(3_600);
  });

  it("keeps up with a phone typing a draft five times a second", () => {
    const { allowed } = drain(draftRateLimit, 300, (i) => i * 200);
    expect(allowed).toBe(300);
  });

  it("does not let a clock step backwards mint tokens", () => {
    const { bucket } = drain(commandRateLimit, commandRateLimit.capacity, () => 5_000);
    expect(takeToken(bucket, commandRateLimit, 1_000).allowed).toBe(false);
  });
});

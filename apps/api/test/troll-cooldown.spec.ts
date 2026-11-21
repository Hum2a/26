import { describe, expect, it } from "vitest";
import { trollCooldown, trollCooldownMs } from "@26/shared";

describe("troll cooldown", () => {
  it("is ready before a guest has sent a troll", () => {
    expect(trollCooldown({ lastSentAt: null, now: 5_000 })).toEqual({
      ready: true,
      until: null,
      remainingMs: 0,
    });
  });

  it("refuses inside the window and counts down from the stored send time", () => {
    expect(trollCooldown({ lastSentAt: 10_000, now: 10_000 })).toEqual({
      ready: false,
      until: 10_000 + trollCooldownMs,
      remainingMs: trollCooldownMs,
    });
    expect(
      trollCooldown({ lastSentAt: 10_000, now: 10_000 + trollCooldownMs - 1 }),
    ).toEqual({
      ready: false,
      until: 10_000 + trollCooldownMs,
      remainingMs: 1,
    });
  });

  it("is ready again exactly when the window ends", () => {
    expect(
      trollCooldown({ lastSentAt: 10_000, now: 10_000 + trollCooldownMs }),
    ).toEqual({
      ready: true,
      until: null,
      remainingMs: 0,
    });
  });

  it("takes an injected window and never reads the wall clock", () => {
    expect(trollCooldown({ lastSentAt: 0, now: 500, cooldownMs: 1_000 })).toEqual({
      ready: false,
      until: 1_000,
      remainingMs: 500,
    });
    expect(trollCooldown({ lastSentAt: 0, now: 1_000, cooldownMs: 1_000 }).ready).toBe(
      true,
    );
  });

  it("keeps the default window a named, sensible length", () => {
    expect(trollCooldownMs).toBe(90_000);
  });
});

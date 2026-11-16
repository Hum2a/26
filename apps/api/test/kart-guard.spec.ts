import { expect, it, vi } from "vitest";
import { PartyRoom } from "../src/room/party-room.ts";
import { kartInputSchema, kartNeutral } from "@26/shared";

it("refuses practice lap or record claims in the room's driving intent", () => {
  const intent = { raceId: "race", sequence: 1, ...kartNeutral };
  for (const claim of [
    { lapTimeMs: 1 },
    { laps: 3 },
    { trial: { finished: true } },
    { record: { totalMs: 1 } },
  ])
    expect(kartInputSchema.safeParse({ ...intent, ...claim }).success).toBe(false);
});

it("keeps handling choice and stun/cooldown authority out of a guest's normal driving intent", () => {
  const intent = { raceId: "race", sequence: 1, ...kartNeutral };
  expect(kartInputSchema.safeParse(intent).success).toBe(true);
  for (const extra of [
    { handlingPreset: "bounce-v1" },
    { handling: "slide-v1" },
    { stunMs: 0 },
    { impactCooldownMs: 0 },
  ])
    expect(kartInputSchema.safeParse({ ...intent, ...extra }).success).toBe(false);
});

it.each(["staging", "production"])(
  "refuses to start the local kart fixture in %s even for an authorised controller",
  async (APP_ENV) => {
    const exec = vi.fn();
    const ctx = {
      blockConcurrencyWhile: vi.fn(),
      storage: { sql: { exec } },
    } as unknown as DurableObjectState;
    const instance = new PartyRoom(ctx, { APP_ENV } as Env);
    // Isolate the environment boundary. The actual credential and phase flow are tested in workerd.
    vi.spyOn(
      instance as unknown as { requireControl: () => Promise<{ ok: true }> },
      "requireControl",
    ).mockResolvedValue({ ok: true });
    const result = await instance.startKartRehearsal({
      credentialId: "fixture-control",
      secret: "fixture-secret",
      requestId: crypto.randomUUID(),
      nowMs: 1000,
    });
    expect(result).toEqual({
      ok: false,
      error: "forbidden",
      message: "Kart rehearsal is available only in local development.",
    });
    expect(exec).not.toHaveBeenCalled();
  },
);

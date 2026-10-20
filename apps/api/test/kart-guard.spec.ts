import { expect, it, vi } from "vitest";
import { PartyRoom } from "../src/room/party-room.ts";

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

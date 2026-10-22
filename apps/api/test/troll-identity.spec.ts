import { runInDurableObject } from "cloudflare:test";
import { expect, it } from "vitest";
import { sillyNameFor } from "../src/troll/engine.ts";
import { setup, type Stub } from "./wall-support.ts";

/** Starts an identity troll directly, as the engine would once accepted. */
async function startTroll(stub: Stub, kind: string, actorId: string, targetId: string) {
  const effectId = crypto.randomUUID();
  await runInDurableObject(stub, (_instance, state) => {
    state.storage.sql.exec(
      `INSERT INTO troll_effect (
         effect_id, actor_id, target_id, kind, slot, status, question_index, phase,
         phase_generation, created_at, started_at, expires_at, refunded
       ) VALUES (?, ?, ?, ?, 'transient', 'active', 0, 'lobby', 1, ?, ?, NULL, 0)`,
      effectId,
      actorId,
      targetId,
      kind,
      Date.now(),
      Date.now(),
    );
  });
  return effectId;
}

async function end(stub: Stub, effectId: string) {
  await runInDurableObject(stub, (_instance, state) => {
    state.storage.sql.exec(`UPDATE troll_effect SET status = 'expired' WHERE effect_id = ?`, effectId);
  });
}

const nameOn = async (stub: Stub, playerId: string) =>
  (await stub.snapshotFor("stage")).players.find((player) => player.playerId === playerId)?.nickname;

it("shows a silly name on every screen while it runs, then the real name", async () => {
  const { stub, join } = await setup();
  const amina = await join("Amina");
  const bilal = await join("Bilal");
  const effectId = await startTroll(stub, "temp-nickname", bilal.playerId, amina.playerId);
  expect(await nameOn(stub, amina.playerId)).toBe(sillyNameFor(effectId));
  expect(await nameOn(stub, bilal.playerId)).toBe("Bilal");
  await end(stub, effectId);
  expect(await nameOn(stub, amina.playerId)).toBe("Amina");
});

it("shows Guest 14 while it runs", async () => {
  const { stub, join } = await setup();
  const amina = await join("Amina");
  const bilal = await join("Bilal");
  const effectId = await startTroll(stub, "guest-14", bilal.playerId, amina.playerId);
  expect(await nameOn(stub, amina.playerId)).toBe("Guest 14");
  await end(stub, effectId);
  expect(await nameOn(stub, amina.playerId)).toBe("Amina");
});

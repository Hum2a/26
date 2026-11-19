import { env, runInDurableObject } from "cloudflare:test";
import { expect, it } from "vitest";
import { payloadDigest } from "../src/room/digest.ts";
import { createSqlStore } from "../src/room/sql-store.ts";
import { preparePlayShared, projectPlay } from "../src/questions/multiple-choice.ts";

// One race projection per broadcast must give every phone exactly what its own
// projection gave. 80 separate projections at the race start overloaded the
// room on the 19 November 2026 staging rehearsal.
it("gives each phone and the stage the same kart view from one shared race projection", async () => {
  const { stub, players } = await setup(["Amina", "Bilal", "Chidi", "Dana"]);
  await runInDurableObject(stub, (_instance, state) => {
    const sql = state.storage.sql;
    const room = createSqlStore(sql).readRoom();
    const shared = preparePlayShared(sql, room);
    expect(shared?.kart?.race.drivers).toHaveLength(players.length);
    for (const playerId of players) {
      const alone = projectPlay(sql, room, "guest", playerId, false);
      const together = projectPlay(sql, room, "guest", playerId, false, shared);
      expect(together).toEqual(alone);
      expect(together?.kart?.selfPlayerId).toBe(playerId);
    }
    for (const audience of ["stage", "control"] as const)
      expect(projectPlay(sql, room, audience, undefined, false, shared)).toEqual(
        projectPlay(sql, room, audience, undefined, false),
      );
  });
});

async function setup(names: string[]) {
  // Keep automatic wall-clock alarms in the future; the test reads state only.
  const now = Date.now() + 60_000,
    created = await env.ROOM_CODE_REGISTRY.getByName("codes").createLobby({
      requestId: crypto.randomUUID(),
      digest: await payloadDigest({ action: "create" }),
      now: new Date(now).toISOString(),
    });
  if (!created.ok) throw new Error(created.message);
  const room = created.result,
    stub = env.PARTY_ROOM.getByName(room.gameId);
  const players: string[] = [];
  for (const nickname of names) {
    const p = await stub.joinPlayer({
      nickname,
      requestId: crypto.randomUUID(),
      now: new Date(now).toISOString(),
    });
    if (!p.ok) throw new Error(p.message);
    players.push(p.playerId);
  }
  const credential = {
    credentialId: room.control.credentialId,
    secret: room.control.secret,
  };
  expect(
    (
      await stub.startKartRehearsal({
        ...credential,
        requestId: crypto.randomUUID(),
        nowMs: now,
      })
    ).ok,
  ).toBe(true);
  // First quiz question through to the kart intro, where the grid is frozen.
  for (let n = 1; n <= 5; n++)
    expect(
      (
        await stub.advanceRound({
          ...credential,
          requestId: crypto.randomUUID(),
          nowMs: now + n,
        })
      ).ok,
    ).toBe(true);
  expect((await stub.snapshotFor("stage")).play?.question.kind).toBe("kart");
  return { stub, players };
}

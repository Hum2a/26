import { env, evictDurableObject, runInDurableObject } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { phone, type Player } from "./wall-support.ts";
import { payloadDigest } from "../src/room/digest.ts";
import { createSqlStore } from "../src/room/sql-store.ts";
import { writeRoundState } from "../src/questions/round-state.ts";

/*
 * Public vote and Misattributed quote guests' written answers on the stage at
 * the reveal. A host-hidden answer must never reach a screen through them:
 * not when the troll is chosen, not when the line is written, and not when a
 * stored cue is replayed to a reconnecting screen.
 */

type Created = Awaited<ReturnType<typeof createRoom>>;
type Stub = ReturnType<typeof room>;

describe("trolls never quote a host-hidden answer", () => {
  it("hide before selection: Misattributed only quotes answers still on screen", async () => {
    const { created, stub, players } = await demoRoom(["Amina", "Bilal", "Chen"]);
    await reach(stub, created, "toast", "collect");
    await write(stub, created, players.Amina!, "Visible toast line");
    await write(stub, created, players.Bilal!, "Secret toast line");
    expect((await host(stub, created, "exclude", players.Bilal!)).ok).toBe(true);
    await troll(stub, "misattributed", players.Amina!, players.Chen!);
    await reach(stub, created, "toast", "vote");
    await reach(stub, created, "toast", "reveal");
    expect(await announced(stub)).toBe('Chen wrote "Visible toast line".');
    await expectNowhere(stub, players, /secret toast line/i, "Bilal");
  }, 60_000);

  it("hide after selection: a vote cast for an answer hidden later is not shown", async () => {
    const { created, stub, players } = await demoRoom(["Amina", "Bilal", "Chen"]);
    await reach(stub, created, "toast", "collect");
    await write(stub, created, players.Amina!, "Visible toast line");
    await write(stub, created, players.Bilal!, "Secret toast line");
    // The troll is chosen while every answer is still on screen.
    await troll(stub, "public-vote", players.Amina!, players.Chen!);
    await troll(stub, "misattributed", players.Bilal!, players.Amina!);
    await reach(stub, created, "toast", "vote");
    const card = (
      await stub.snapshotFor("guest", players.Chen!.playerId)
    ).play?.ballot?.cards.find((c) => c.label === "Secret toast line");
    if (!card) throw new Error("Bilal's card should be on the ballot.");
    await ballot(stub, created, players.Chen!, card.id);
    // Hidden after the troll was chosen and after the vote was cast.
    expect((await host(stub, created, "exclude", players.Bilal!)).ok).toBe(true);
    await reach(stub, created, "toast", "reveal");
    const lines = await cueLines(stub);
    expect(lines).toContain("Chen's vote stays a secret this time.");
    expect(lines).toContain("Amina wrote nothing at all. Suspicious.");
    await expectNowhere(stub, players, /secret toast line/i, "Bilal");
  }, 60_000);

  it("restore: an answer the host brings back can be quoted again", async () => {
    const { created, stub, players } = await demoRoom(["Amina", "Bilal", "Chen"]);
    await reach(stub, created, "toast", "collect");
    await write(stub, created, players.Bilal!, "Restored toast line");
    expect((await host(stub, created, "exclude", players.Bilal!)).ok).toBe(true);
    await troll(stub, "misattributed", players.Amina!, players.Chen!);
    expect((await host(stub, created, "include", players.Bilal!)).ok).toBe(true);
    await reach(stub, created, "toast", "vote");
    await reach(stub, created, "toast", "reveal");
    expect(await announced(stub)).toBe('Chen wrote "Restored toast line".');
  }, 60_000);

  it("no eligible answers: safe lines, and the round carries on", async () => {
    const { created, stub, players } = await demoRoom(["Amina", "Bilal"]);
    await reach(stub, created, "toast", "collect");
    await write(stub, created, players.Bilal!, "Only toast line");
    expect((await host(stub, created, "exclude", players.Bilal!)).ok).toBe(true);
    await troll(stub, "misattributed", players.Bilal!, players.Amina!);
    await troll(stub, "public-vote", players.Bilal!, players.Amina!);
    await reach(stub, created, "toast", "vote");
    await reach(stub, created, "toast", "reveal");
    const lines = await cueLines(stub);
    expect(lines).toContain("Amina wrote nothing at all. Suspicious.");
    expect(lines).toContain("Amina didn't vote. Coward.");
    await expectNowhere(stub, players, /only toast line/i, "Bilal");
    // The round still moves on.
    await reach(stub, created, "toast", "scores");
  }, 60_000);

  it("replay and reconnect: a stored cue is checked again before it is shown", async () => {
    const { created, stub, players } = await demoRoom(["Amina", "Bilal", "Chen"]);
    await reach(stub, created, "toast", "collect");
    await write(stub, created, players.Bilal!, "Cached toast line");
    await troll(stub, "misattributed", players.Amina!, players.Chen!);
    await reach(stub, created, "toast", "vote");
    await reach(stub, created, "toast", "reveal");
    expect(await announced(stub)).toBe('Chen wrote "Cached toast line".');
    // The answer becomes hidden while the cue is still stored and playing
    // (the room refuses this at the reveal, so it is written directly).
    await runInDurableObject(stub, (_instance, state) => {
      writeRoundState(state.storage.sql, "toast", "hidden-authors", [
        players.Bilal!.playerId,
      ]);
    });
    await evictDurableObject(stub);
    expect(await announced(stub)).toBe("Chen wrote nothing at all. Suspicious.");
    // Only the troll payload is checked here: writing the hidden list directly
    // skips the vote's own reveal, which the room's real Hide also updates.
    for (const audience of ["stage", "control"] as const)
      expect(JSON.stringify((await stub.snapshotFor(audience)).trolls)).not.toMatch(
        /cached toast line/i,
      );
    // Restoring brings the quote back on the next read.
    await runInDurableObject(stub, (_instance, state) => {
      writeRoundState(state.storage.sql, "toast", "hidden-authors", []);
    });
    expect(await announced(stub)).toBe('Chen wrote "Cached toast line".');
    // The host's own moderation view still shows the answer.
    expect(JSON.stringify(await stub.snapshotFor("control"))).toContain(
      "Cached toast line",
    );
  }, 60_000);
});

/* ---------- helpers ---------- */

async function troll(stub: Stub, kind: string, actor: Player, target: Player) {
  await runInDurableObject(stub, (_instance, state) => {
    const room = createSqlStore(state.storage.sql).readRoom();
    state.storage.sql.exec(
      `INSERT INTO troll_effect (
         effect_id, actor_id, target_id, kind, slot, status, question_index, phase,
         phase_generation, created_at, started_at, expires_at, refunded
       ) VALUES (?, ?, ?, ?, 'persistent', 'active', ?, 'collect', ?, ?, ?, NULL, 0)`,
      crypto.randomUUID(),
      actor.playerId,
      target.playerId,
      kind,
      room.questionIndex,
      room.phaseGeneration,
      Date.now(),
      Date.now(),
    );
  });
}

async function announced(stub: Stub) {
  return (await stub.snapshotFor("stage")).trolls.announcement?.label;
}

/** Every troll line written for the stage so far, as the stage would see each. */
async function cueLines(stub: Stub) {
  const seen: string[] = [];
  for (let step = 0; step < 6; step += 1) {
    const label = await announced(stub);
    if (!label || seen.includes(label)) break;
    seen.push(label);
    // Move the stage on to the next queued cue, as the host's Dismiss does.
    await runInDurableObject(stub, (_instance, state) => {
      const sql = state.storage.sql;
      const playing = sql
        .exec<{ cue_id: string }>(
          `SELECT cue_id FROM stage_cue WHERE status = 'playing'`,
        )
        .toArray()[0];
      if (!playing) return;
      sql.exec(`UPDATE stage_cue SET status = 'done' WHERE cue_id = ?`, playing.cue_id);
      const next = sql
        .exec<{ cue_id: string }>(
          `SELECT cue_id FROM stage_cue WHERE status = 'queued' ORDER BY created_at, rowid LIMIT 1`,
        )
        .toArray()[0];
      if (next)
        sql.exec(
          `UPDATE stage_cue SET status = 'playing', started_at = ? WHERE cue_id = ?`,
          Date.now(),
          next.cue_id,
        );
    });
  }
  return seen;
}

/**
 * The hidden text is on no public screen, after a reload as well. The only
 * phone that may still show it is its author's own, which shows its owner
 * what they wrote.
 */
async function expectNowhere(
  stub: Stub,
  players: Partial<Record<string, Player>>,
  pattern: RegExp,
  author: string,
) {
  for (let pass = 0; pass < 2; pass += 1) {
    expect(JSON.stringify(await stub.snapshotFor("stage"))).not.toMatch(pattern);
    const showing: string[] = [];
    for (const [name, player] of Object.entries(players))
      if (
        pattern.test(JSON.stringify(await stub.snapshotFor("guest", player!.playerId)))
      )
        showing.push(name);
    expect(showing.filter((name) => name !== author)).toEqual([]);
    await evictDurableObject(stub);
  }
}

async function write(stub: Stub, created: Created, player: Player, body: string) {
  const socket = await phone(stub, created.gameId, player);
  expect((await socket.send({ name: "text", body })).accepted).toBe(true);
  socket.socket.close();
}

async function ballot(
  stub: Stub,
  created: Created,
  player: Player,
  candidateId: string,
) {
  const socket = await phone(stub, created.gameId, player);
  expect((await socket.send({ name: "ballot", candidateId })).accepted).toBe(true);
  socket.socket.close();
}

async function demoRoom<T extends string>(names: readonly T[]) {
  const created = await createRoom();
  const stub = room(created.gameId);
  expect(
    (
      await stub.startDemo({
        ...control(created),
        requestId: crypto.randomUUID(),
        nowMs: Date.now(),
      })
    ).ok,
  ).toBe(true);
  const players: Partial<Record<T, Player>> = {};
  for (const name of names) {
    const joined = await stub.joinPlayer({
      nickname: name,
      requestId: crypto.randomUUID(),
      now: new Date().toISOString(),
    });
    if (!joined.ok) throw new Error(joined.message);
    players[name] = joined;
  }
  return { created, stub, players };
}

function host(
  stub: Stub,
  created: Created,
  action: "include" | "exclude",
  player: Player,
) {
  return stub.hostAction({
    ...control(created),
    requestId: crypto.randomUUID(),
    nowMs: Date.now(),
    action,
    playerId: player.playerId,
  });
}

async function reach(stub: Stub, created: Created, questionId: string, phase: string) {
  for (let step = 0; step < 48; step += 1) {
    const snapshot = await stub.snapshotFor("stage");
    if (snapshot.play?.question.id === questionId && snapshot.phase === phase) return;
    const moved = await stub.advanceRound({
      ...control(created),
      requestId: crypto.randomUUID(),
      nowMs: Date.now(),
    });
    if (!moved.ok) throw new Error(moved.message);
  }
  throw new Error(`The room did not reach ${questionId} ${phase}.`);
}

async function createRoom() {
  const created = await env.ROOM_CODE_REGISTRY.getByName("codes").createLobby({
    requestId: crypto.randomUUID(),
    digest: await payloadDigest({ action: "create" }),
    now: new Date().toISOString(),
  });
  if (!created.ok) throw new Error(created.message);
  return created.result;
}

function room(gameId: string) {
  return env.PARTY_ROOM.get(env.PARTY_ROOM.idFromName(gameId));
}

function control(created: Created) {
  return { credentialId: created.control.credentialId, secret: created.control.secret };
}

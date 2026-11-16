import { env, evictDurableObject, runInDurableObject } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import type { LobbySnapshot, PlaySnapshot } from "@26/shared";
import { phone, type Player } from "./wall-support.ts";
import { payloadDigest } from "../src/room/digest.ts";
import {
  answerBlockedMessage,
  answerDuplicateMessage,
  ballotUnknownMessage,
  moderationClosedMessage,
  moderationFlowMessage,
  moderationNotShownMessage,
  shortlistClosedMessage,
} from "../src/room/limits.ts";
import { toPlayable } from "../src/questions/authoring.ts";
import { birthdayPack } from "../src/questions/packs/birthday/manifest.ts";
import type { Question } from "../src/questions/definition.ts";
import { writeRoundState } from "../src/questions/round-state.ts";
import { acceptTypedAnswer, typedScores } from "../src/questions/typed.ts";
import { createSqlStore } from "../src/room/sql-store.ts";
import { phasesForQuestion } from "../src/questions/vote.ts";
import { readStatsSource } from "../src/stats/source.ts";

// Slur fixtures are ROT13-encoded so the test does not spell them out.
const rot13 = (text: string) =>
  text.replace(/[a-zA-Z]/g, (c) => {
    const base = c <= "Z" ? 65 : 97;
    return String.fromCharCode(((c.charCodeAt(0) - base + 13) % 26) + base);
  });
const slurAnswer = rot13("Gung'f n puvax gbnfg");

type Created = Awaited<ReturnType<typeof createRoom>>;
type Stub = ReturnType<typeof room>;

describe("written answer screening", () => {
  it("refuses a slur without storing or echoing it, then takes a cheeky answer", async () => {
    const { created, stub, players } = await demoRoom(["Amina"]);
    await reach(stub, created, "toast", "collect");
    const amina = await phone(stub, created.gameId, players.Amina!);
    const refused = await amina.send({ name: "text", body: slurAnswer });
    expect(refused).toEqual({ accepted: false, error: answerBlockedMessage });
    expect(refused.error).not.toContain(slurAnswer);
    // Still open: the same phone can send something else.
    expect(
      (await amina.send({ name: "text", body: "Humza's mum, obviously. Cheers!" }))
        .accepted,
    ).toBe(true);
    amina.socket.close();
    await runInDurableObject(stub, (_instance, state) => {
      const sql = state.storage.sql;
      const stored = JSON.stringify([
        sql.exec("SELECT * FROM text_response").toArray(),
        sql.exec("SELECT * FROM receipt").toArray(),
        sql.exec("SELECT * FROM audit").toArray(),
        sql.exec("SELECT * FROM developer_event").toArray(),
      ]);
      expect(stored).not.toContain(slurAnswer);
      expect(stored).toContain("Humza's mum, obviously. Cheers!");
    });
  });

  it("screens typed answers the same way and keeps their crude jokes", async () => {
    const { stub, players } = await scriptRoom("common-password", "collect");
    const q = birthdayQuestion("common-password");
    if (q.kind !== "typed") throw new Error("A typed round was expected.");
    await runInDurableObject(stub, (_instance, state) => {
      const sql = state.storage.sql;
      const store = createSqlStore(sql);
      const now = Date.now();
      expect(acceptTypedAnswer(sql, store, players[0]!, slurAnswer, now, q)).toEqual({
        ok: false,
        message: answerBlockedMessage,
      });
      expect(
        acceptTypedAnswer(sql, store, players[0]!, "shit123 obviously", now, q).ok,
      ).toBe(true);
    });
  });
});

describe("host moderation on an all-answer vote", () => {
  it("hides duplicates, ignores and restores existing ballots, and settles at the reveal", async () => {
    const { created, stub, players } = await demoRoom([
      "Amina",
      "Bilal",
      "Chen",
      "Dara",
    ]);
    await reach(stub, created, "toast", "collect");
    for (const [name, body] of [
      ["Amina", "Cheers Amina"],
      ["Bilal", "Same line"],
      ["Chen", "same   LINE"],
      ["Dara", "Cheers Dara"],
    ] as const) {
      const socket = await phone(stub, created.gameId, players[name]!);
      expect((await socket.send({ name: "text", body })).accepted).toBe(true);
      socket.socket.close();
    }

    // Only the host credential can moderate; the stage's and a guest's cannot.
    const stageTry = await stub.hostAction({
      credentialId: created.presentation.credentialId,
      secret: created.presentation.secret,
      requestId: crypto.randomUUID(),
      nowMs: Date.now(),
      action: "exclude",
      playerId: players.Bilal!.playerId,
    });
    expect(stageTry.ok).toBe(false);
    const dara = players.Dara as Player & { credentialId?: string };
    const guestTry = await stub.hostAction({
      credentialId: dara.credentialId ?? dara.playerId,
      secret: dara.secret,
      requestId: crypto.randomUUID(),
      nowMs: Date.now(),
      action: "exclude",
      playerId: players.Bilal!.playerId,
    });
    expect(guestTry.ok).toBe(false);
    expect(included(await stub.snapshotFor("control"))).toEqual({
      Amina: true,
      Bilal: true,
      Chen: true,
      Dara: true,
    });

    // Excluding one line hides its duplicate too; nothing is deleted.
    expect((await host(stub, created, "exclude", players.Bilal!)).ok).toBe(true);
    expect(included(await stub.snapshotFor("control"))).toEqual({
      Amina: true,
      Bilal: false,
      Chen: false,
      Dara: true,
    });
    expect(await count(stub, "text_response")).toBe(4);

    await reach(stub, created, "toast", "vote");
    expect(labels(await stub.snapshotFor("guest", players.Amina!.playerId))).toEqual(
      expect.arrayContaining(["Cheers Dara"]),
    );
    for (const audience of ["stage", "guest"] as const) {
      const view = await stub.snapshotFor(audience, players.Amina!.playerId);
      expect(JSON.stringify(view)).not.toMatch(/same line/i);
    }
    // The host still sees the hidden text, so it can be restored.
    expect(JSON.stringify(await stub.snapshotFor("control"))).toContain("Same line");

    // Restoring either duplicate brings the pair back while votes are open.
    expect((await host(stub, created, "include", players.Chen!)).ok).toBe(true);
    const restored = await stub.snapshotFor("guest", players.Amina!.playerId);
    // Amina's ballot lists her own card too (shown, not selectable).
    expect(labels(restored).sort()).toEqual(
      ["Cheers Amina", "Cheers Dara", "Same line", "same   LINE"].sort(),
    );
    const bilalCard = restored.play?.ballot?.cards.find((c) => c.label === "Same line");
    const aminaCard = (
      await stub.snapshotFor("guest", players.Dara!.playerId)
    ).play?.ballot?.cards.find((c) => c.label === "Cheers Amina");
    if (!bilalCard || !aminaCard) throw new Error("The cards were not restored.");
    expect(bilalCard.selectable).toBe(true);

    // Amina and Chen vote for Bilal's line; Dara votes for Amina's.
    for (const [name, card] of [
      ["Amina", bilalCard.id],
      ["Chen", bilalCard.id],
      ["Dara", aminaCard.id],
    ] as const) {
      const socket = await phone(stub, created.gameId, players[name]!);
      expect((await socket.send({ name: "ballot", candidateId: card })).accepted).toBe(
        true,
      );
      socket.socket.close();
    }

    // Excluding it again: its two ballots stay stored but stop counting.
    expect((await host(stub, created, "exclude", players.Bilal!)).ok).toBe(true);
    const amina = await phone(stub, created.gameId, players.Amina!);
    expect(
      (await amina.send({ name: "ballot", candidateId: aminaCard.id })).error,
    ).toBe(answerDuplicateMessage);
    amina.socket.close();
    const bilal = await phone(stub, created.gameId, players.Bilal!);
    expect(
      (await bilal.send({ name: "ballot", candidateId: bilalCard.id })).error,
    ).toBe(ballotUnknownMessage);
    bilal.socket.close();
    expect(
      (await stub.snapshotFor("guest", players.Amina!.playerId)).play?.selfBallot,
    ).toEqual({ candidateId: bilalCard.id });
    expect(await count(stub, "vote_ballot")).toBe(3);

    // It survives the room being evicted and reloaded.
    await evictDurableObject(stub);
    expect(included(await stub.snapshotFor("control"))).toMatchObject({
      Bilal: false,
      Chen: false,
    });

    await reach(stub, created, "toast", "reveal");
    const reveal = await stub.snapshotFor("stage");
    if (reveal.play?.reveal?.kind !== "vote") throw new Error("No vote reveal.");
    expect(reveal.play.reveal.winners.map((w) => w.label)).toEqual(["Cheers Amina"]);
    expect(JSON.stringify(reveal)).not.toMatch(/same line/i);
    expect(points(reveal, "Amina")).toBe(60);
    expect(points(reveal, "Bilal")).toBe(0);
    const settled = (await stub.scoreRecord()).total;

    // The reveal is settled: moderation is refused and scores do not move.
    for (const action of ["include", "exclude"] as const) {
      const late = await host(stub, created, action, players.Bilal!);
      expect(late.ok).toBe(false);
      if (!late.ok) expect(late.message).toBe(moderationClosedMessage);
    }
    expect((await stub.scoreRecord()).total).toBe(settled);
    expect((await stub.rescoreCurrent()).total).toBe(settled);

    // Results and archive highlights never see the excluded line.
    await runInDurableObject(stub, (_instance, state) => {
      const answers = readStatsSource(state.storage.sql).answers;
      expect(answers.some((a) => /same line/i.test(a.optionLabel))).toBe(false);
      expect(answers.some((a) => a.optionLabel === "Cheers Amina")).toBe(true);
    });
  }, 60_000);

  it("leaves an empty ballot with no winner when every line is hidden", async () => {
    const { created, stub, players } = await demoRoom(["Amina", "Bilal"]);
    await reach(stub, created, "toast", "collect");
    for (const name of ["Amina", "Bilal"] as const) {
      const socket = await phone(stub, created.gameId, players[name]!);
      expect(
        (await socket.send({ name: "text", body: `${name}'s line` })).accepted,
      ).toBe(true);
      socket.socket.close();
      expect((await host(stub, created, "exclude", players[name]!)).ok).toBe(true);
    }
    await reach(stub, created, "toast", "vote");
    expect(
      (await stub.snapshotFor("guest", players.Amina!.playerId)).play?.ballot,
    ).toMatchObject({ total: 0, reason: "empty", cards: [] });
    await reach(stub, created, "toast", "reveal");
    const reveal = await stub.snapshotFor("stage");
    if (reveal.play?.reveal?.kind !== "vote") throw new Error("No vote reveal.");
    expect(reveal.play.reveal.winnerCount).toBe(0);
    expect((await stub.scoreRecord()).total).toBe(0);
  }, 30_000);

  it("keeps shortlist curation as it was", async () => {
    const { created, stub, players } = await demoRoom(["Amina"]);
    await reach(stub, created, "picks", "collect");
    const socket = await phone(stub, created.gameId, players.Amina!);
    expect((await socket.send({ name: "text", body: "Kept line" })).accepted).toBe(
      true,
    );
    socket.socket.close();
    expect(included(await stub.snapshotFor("control"))).toEqual({ Amina: false });
    expect((await host(stub, created, "include", players.Amina!)).ok).toBe(true);
    expect(included(await stub.snapshotFor("control"))).toEqual({ Amina: true });
    await reach(stub, created, "picks", "vote");
    const late = await host(stub, created, "exclude", players.Amina!);
    expect(late.ok).toBe(false);
    if (!late.ok) expect(late.message).toBe(shortlistClosedMessage);
  }, 30_000);

  it("refuses to change a bracket vote once voting has started", async () => {
    const { stub, players } = await scriptRoom("heathrow-search-query", "vote");
    await runInDurableObject(stub, (_instance, state) => {
      const sql = state.storage.sql;
      sql.exec(
        `INSERT INTO text_response (player_id, question_id, body, received_at, deadline_at)
         VALUES (?, 'heathrow-search-query', 'how to look busy', 1, 2)`,
        players[0]!,
      );
      sql.exec(
        `INSERT INTO vote_freeze (question_id, seed, truth_id, frozen_at)
         VALUES ('heathrow-search-query', 'seed', NULL, 1)`,
      );
    });
    const refused = await scriptHost(stub, "exclude", players[0]!);
    expect(refused.ok).toBe(false);
    if (!refused.ok) expect(refused.message).toBe(moderationFlowMessage);
  });
});

describe("host moderation on a typed commonness reveal", () => {
  it("hides an answer's text from the reveal, keeps its score and restores it", async () => {
    const { stub, players } = await scriptRoom("common-password", "collect");
    const q = birthdayQuestion("common-password");
    if (q.kind !== "typed") throw new Error("A typed round was expected.");
    await runInDurableObject(stub, (_instance, state) => {
      const sql = state.storage.sql;
      const store = createSqlStore(sql);
      const now = Date.now();
      for (const [index, body] of ["hunter2", "HUNTER2", "letmein"].entries())
        expect(acceptTypedAnswer(sql, store, players[index]!, body, now, q).ok).toBe(
          true,
        );
    });
    // Hiding one hides its duplicate; the room's host credential is required.
    expect((await scriptHost(stub, "exclude", players[1]!)).ok).toBe(true);
    await runInDurableObject(stub, (_instance, state) => {
      const sql = state.storage.sql;
      typedScores(sql, q, Date.now());
      sql.exec("UPDATE room SET phase = 'reveal'");
    });
    for (const audience of ["stage", "guest"] as const) {
      const view = await stub.snapshotFor(audience, players[2]!);
      expect(JSON.stringify(view)).not.toMatch(/hunter2/i);
      expect(JSON.stringify(view.play?.reveal)).toContain("letmein");
    }
    const hostView = await stub.snapshotFor("control");
    expect(hostView.play?.hostResponses?.map((row) => row.included)).toEqual([
      false,
      false,
      true,
    ]);
    // Scores are not rewritten by hiding.
    await runInDurableObject(stub, (_instance, state) => {
      const rows = state.storage.sql
        .exec<{ points: number }>(
          "SELECT points FROM score_ledger WHERE question_id = 'common-password' AND points > 0",
        )
        .toArray();
      expect(rows).toHaveLength(2);
    });
    await evictDurableObject(stub);
    expect(JSON.stringify(await stub.snapshotFor("stage"))).not.toMatch(/hunter2/i);
    expect((await scriptHost(stub, "include", players[0]!)).ok).toBe(true);
    expect(JSON.stringify((await stub.snapshotFor("stage")).play?.reveal)).toContain(
      "hunter2",
    );
  });

  it("explains that an ordinary typed question shows no answers to hide", async () => {
    const typed = birthdayPack.catalogue
      .map((q) => toPlayable(q))
      .find((q) => q?.kind === "typed" && q.scoring !== "commonness");
    if (!typed) throw new Error("The birthday pack needs an ordinary typed question.");
    const { stub, players } = await scriptRoom(typed.id, "collect");
    const refused = await scriptHost(stub, "exclude", players[0]!);
    expect(refused.ok).toBe(false);
    if (!refused.ok) expect(refused.message).toBe(moderationNotShownMessage);
  });
});

/* ---------- helpers ---------- */

function birthdayQuestion(id: string): Question {
  const q = toPlayable(birthdayPack.catalogue.find((item) => item.id === id));
  if (!q) throw new Error(`${id} must be ready.`);
  return q;
}

const scriptCredentials = new WeakMap<Stub, Created>();

/** A room whose current question is one birthday question, at `phase`. */
async function scriptRoom(id: string, phase: string) {
  const created = await createRoom();
  const stub = room(created.gameId);
  scriptCredentials.set(stub, created);
  const players: string[] = [];
  for (const nickname of ["Amina", "Bilal", "Cara"]) {
    players.push((await join(stub, nickname)).playerId);
  }
  const q = birthdayQuestion(id);
  await runInDurableObject(stub, (_instance, state) => {
    const sql = state.storage.sql;
    writeRoundState(sql, "__pack", "birthday-script", {
      version: "moderation-test",
      revision: 1,
      questions: [q],
    });
    sql.exec(
      `UPDATE room SET question_set_version = 'moderation-test', question_index = 0`,
    );
    // An open round, as the party-polish room spec sets one up.
    const store = createSqlStore(sql);
    const now = Date.now();
    const current = store.readRoom();
    store.writeRoom({
      ...current,
      phase: phase as typeof current.phase,
      phaseGeneration: 10,
      paused: false,
      hold: null,
      controllerPresent: true,
      stagePresent: true,
      roundId: "moderation-test",
      questionCount: 1,
      phases: phasesForQuestion(q),
      durations: {
        collect: q.collectMs,
        vote: q.kind === "vote" ? q.voteMs : 20_000,
        reveal: 12_000,
        scores: 10_000,
      },
    });
    store.saveJob({
      jobId: `${phase}-${q.id}`,
      jobType: "gameplay",
      dueAt: now + q.collectMs,
      remainingMs: null,
      scopeGeneration: current.scopeGeneration,
      phaseGeneration: 10,
      phase: phase as typeof current.phase,
      status: "pending",
      retryCount: 0,
      payload: "",
      createdAt: now,
    });
  });
  return { stub, players };
}

function scriptHost(stub: Stub, action: "include" | "exclude", playerId: string) {
  const created = scriptCredentials.get(stub)!;
  return stub.hostAction({
    ...control(created),
    requestId: crypto.randomUUID(),
    nowMs: Date.now(),
    action,
    playerId,
  });
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
  for (const name of names) players[name] = await join(stub, name);
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

function included(snapshot: LobbySnapshot) {
  return Object.fromEntries(
    (snapshot.play?.hostResponses ?? []).map((row) => [row.nickname, row.included]),
  );
}

function labels(snapshot: LobbySnapshot) {
  return (snapshot.play?.ballot?.cards ?? []).map((card) => card.label);
}

function points(snapshot: { play: PlaySnapshot | null }, nickname: string) {
  return snapshot.play?.standings?.find((row) => row.nickname === nickname)?.points;
}

function count(stub: Stub, table: string) {
  return runInDurableObject(
    stub,
    (_instance, state) =>
      state.storage.sql
        .exec<{ total: number }>(`SELECT COUNT(*) AS total FROM ${table}`)
        .toArray()[0]?.total ?? 0,
  );
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

async function join(stub: Stub, nickname: string): Promise<Player> {
  const joined = await stub.joinPlayer({
    nickname,
    requestId: crypto.randomUUID(),
    now: new Date().toISOString(),
  });
  if (!joined.ok) throw new Error(joined.message);
  return joined;
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

import { env, evictDurableObject, runInDurableObject } from "cloudflare:test";
import { expect, it } from "vitest";
import { payloadDigest } from "../src/room/digest.ts";
import { createSqlStore } from "../src/room/sql-store.ts";
import { toPlayable } from "../src/questions/authoring.ts";
import { completeAWordle } from "../src/questions/packs/birthday/complete-a-wordle.ts";
import {
  acceptWordleGuess,
  readWordleBoard,
  wordleScores,
  wordleProgress,
} from "../src/questions/wordle.ts";
import { projectSpecial } from "../src/questions/multiple-choice.ts";

it("persists each board, isolates guests, restores after eviction and scores only once", async () => {
  const created = await env.ROOM_CODE_REGISTRY.getByName("codes").createLobby({
    requestId: crypto.randomUUID(),
    digest: await payloadDigest({ action: "create" }),
    now: new Date().toISOString(),
  });
  if (!created.ok) throw new Error(created.message);
  const stub = env.PARTY_ROOM.getByName(created.result.gameId);
  const first = await stub.joinPlayer({
    nickname: "Amina",
    requestId: crypto.randomUUID(),
    now: new Date().toISOString(),
  });
  const second = await stub.joinPlayer({
    nickname: "Bilal",
    requestId: crypto.randomUUID(),
    now: new Date().toISOString(),
  });
  if (!first.ok || !second.ok) throw new Error("Guests must join");
  const question = toPlayable(completeAWordle);
  if (question?.kind !== "wordle") throw new Error("Wordle must be ready");
  const now = Date.now();
  await runInDurableObject(stub, async (_instance, state) => {
    const sql = state.storage.sql,
      store = createSqlStore(sql);
    const clock = {
      ...store.readRoom(),
      phase: "collect" as const,
      paused: false,
      hold: null,
      questionCount: 1,
    };
    store.writeRoom(clock);
    store.saveJob({
      jobId: "wordle-test",
      jobType: "gameplay",
      dueAt: now + 120_000,
      remainingMs: null,
      scopeGeneration: clock.scopeGeneration,
      phaseGeneration: clock.phaseGeneration,
      phase: "collect",
      status: "pending",
      retryCount: 0,
      payload: "",
      createdAt: now,
    });
    expect(
      acceptWordleGuess(sql, store, first.playerId, "ZZZZZ", now, question).ok,
    ).toBe(false);
    expect(readWordleBoard(sql, first.playerId, question.id).guesses).toHaveLength(0);
    state.storage.transactionSync(() => {
      expect(
        acceptWordleGuess(sql, store, first.playerId, "APPLE", now, question),
      ).toEqual({ ok: true });
    });
    expect(
      acceptWordleGuess(sql, store, first.playerId, "APPLE", now + 1, question).ok,
    ).toBe(false);
    expect(wordleProgress(sql, question.id)).toEqual({
      responseCount: 1,
      solvedCount: 0,
      finishedCount: 0,
    });
    expect(
      projectSpecial(sql, clock, "guest", first.playerId, question, false)?.selfAnswer,
    ).toMatchObject({ guesses: [{ word: "APPLE" }] });
    const other = projectSpecial(sql, clock, "guest", second.playerId, question, false);
    expect(other?.selfAnswer).toMatchObject({ guesses: [], status: "playing" });
    for (const role of ["stage", "control"] as const) {
      const snapshot = projectSpecial(
        sql,
        clock,
        role,
        first.playerId,
        question,
        false,
      );
      expect(snapshot?.selfAnswer).toBeNull();
      expect(snapshot?.reveal).toBeNull();
      expect(snapshot?.hostResponses ?? []).toEqual([]);
      expect(JSON.stringify(snapshot?.question)).not.toContain("VULGY");
      expect(JSON.stringify(snapshot)).not.toContain("APPLE");
    }
    store.writeRoom({ ...clock, paused: true });
    expect(
      acceptWordleGuess(sql, store, first.playerId, "VULGY", now, question).ok,
    ).toBe(false);
    store.writeRoom({ ...clock, hold: "controller" });
    expect(
      acceptWordleGuess(sql, store, first.playerId, "VULGY", now, question).ok,
    ).toBe(false);
    store.writeRoom(clock);
    expect(
      acceptWordleGuess(sql, store, first.playerId, "VULGY", now + 120_000, question)
        .ok,
    ).toBe(false);
  });
  await evictDurableObject(stub);
  await runInDurableObject(stub, async (_instance, state) => {
    const sql = state.storage.sql,
      store = createSqlStore(sql);
    expect(readWordleBoard(sql, first.playerId, question.id).guesses).toHaveLength(1);
    expect(
      acceptWordleGuess(sql, store, first.playerId, "VULGY", now + 2, question),
    ).toEqual({ ok: true });
    expect(readWordleBoard(sql, first.playerId, question.id).status).toBe("won");
    expect(wordleProgress(sql, question.id).finishedCount).toBe(1);
    wordleScores(sql, question, now + 3);
    wordleScores(sql, question, now + 4);
    expect(
      sql
        .exec(
          `SELECT points FROM score_ledger WHERE question_id = ? ORDER BY points DESC`,
          question.id,
        )
        .toArray(),
    ).toEqual([{ points: 100 }, { points: 0 }]);
    const reveal = projectSpecial(
      sql,
      { ...store.readRoom(), phase: "reveal" },
      "stage",
      undefined,
      question,
      true,
    );
    expect(reveal?.reveal).toEqual({
      kind: "wordle",
      answer: "VULGY",
      responseCount: 1,
      solvedCount: 1,
    });
    expect(reveal?.selfAnswer).toBeNull();
  });
});

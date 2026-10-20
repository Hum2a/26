import { env, evictDurableObject, runInDurableObject } from "cloudflare:test";
import { expect, it } from "vitest";
import { payloadDigest } from "../src/room/digest.ts";
import { createSqlStore } from "../src/room/sql-store.ts";
import { advance, onAlarm, type GameStore } from "../src/room/lifecycle.ts";
import { toPlayable } from "../src/questions/authoring.ts";
import { birthdayPack } from "../src/questions/packs/birthday/manifest.ts";
import type { Question } from "../src/questions/definition.ts";
import { acceptTypedAnswer, typedScores, typedReveal } from "../src/questions/typed.ts";
import { acceptEstimate, sliderScores, sliderReveal } from "../src/questions/slider.ts";
import { acceptMultiple, checkedChoices } from "../src/questions/multiple.ts";
import { pointsFor } from "../src/questions/multiple-choice.ts";
import {
  acceptText,
  acceptBallot,
  ballotPlayFields,
  freezeVote,
  nextBallotPhase,
  phasesForQuestion,
  scoreBallotQuestion,
} from "../src/questions/vote.ts";
import { readRoundState } from "../src/questions/round-state.ts";
import type { PartyVoteFlow } from "../../../packages/shared/src/party-scoring.ts";

function question(id: string): Question {
  const q = toPlayable(birthdayPack.catalogue.find((q) => q.id === id));
  if (!q) throw new Error(`${id} must be ready`);
  return q;
}

async function setup() {
  const created = await env.ROOM_CODE_REGISTRY.getByName("codes").createLobby({
    requestId: crypto.randomUUID(),
    digest: await payloadDigest({ action: "create" }),
    now: new Date().toISOString(),
  });
  if (!created.ok) throw new Error(created.message);
  const stub = env.PARTY_ROOM.getByName(created.result.gameId);
  const players: string[] = [];
  for (const nickname of ["Amina", "Bilal", "Cara", "Dev"]) {
    const joined = await stub.joinPlayer({
      nickname,
      requestId: crypto.randomUUID(),
      now: new Date().toISOString(),
    });
    if (!joined.ok) throw new Error(joined.message);
    players.push(joined.playerId);
  }
  return { stub, players };
}

function collect(sql: SqlStorage, q: Question, now: number): GameStore {
  const store = createSqlStore(sql);
  const room = {
    ...store.readRoom(),
    phase: "collect" as const,
    phaseGeneration: 10,
    paused: false,
    hold: null,
    controllerPresent: true,
    stagePresent: true,
    roundId: "party-polish",
    questionCount: 1,
    phases: phasesForQuestion(q),
    durations: {
      collect: q.collectMs,
      vote: q.kind === "vote" ? q.voteMs : 20_000,
      reveal: 12_000,
      scores: 10_000,
    },
  };
  store.writeRoom(room);
  store.saveJob({
    jobId: `collect-${q.id}`,
    jobType: "gameplay",
    dueAt: now + q.collectMs,
    remainingMs: null,
    scopeGeneration: room.scopeGeneration,
    phaseGeneration: room.phaseGeneration,
    phase: "collect",
    status: "pending",
    retryCount: 0,
    payload: "",
    createdAt: now,
  });
  return store;
}

it("persists password matches, scores ties once and freezes the result across eviction", async () => {
  const { stub, players } = await setup();
  const q = question("common-password");
  if (q.kind !== "typed") throw new Error("Typed round");
  const now = Date.now();
  await runInDurableObject(stub, (_instance, state) => {
    const sql = state.storage.sql,
      store = collect(sql, q, now);
    state.storage.transactionSync(() => {
      expect(acceptTypedAnswer(sql, store, players[0]!, " PASSWORD ", now, q).ok).toBe(
        true,
      );
      expect(acceptTypedAnswer(sql, store, players[1]!, "password", now, q).ok).toBe(
        true,
      );
      expect(acceptTypedAnswer(sql, store, players[2]!, "unique", now, q).ok).toBe(
        true,
      );
      expect(acceptTypedAnswer(sql, store, players[0]!, "changed", now, q).ok).toBe(
        false,
      );
      typedScores(sql, q, now + 1);
      typedScores(sql, q, now + 2);
    });
    expect(typedReveal(sql, q, false, false)).toBeNull();
    expect(
      sql
        .exec<{ points: number }>("SELECT points FROM score_ledger ORDER BY rowid")
        .toArray()
        .map((r) => r.points),
    ).toEqual([100, 100, 0, 0]);
    expect(typedReveal(sql, q, true, false)).toMatchObject({
      groups: [
        { body: "password", count: 2, points: 100 },
        { body: "unique", count: 1, points: 0 },
      ],
    });
  });
  await runInDurableObject(stub, (_instance, state) => {
    state.storage.sql.exec("UPDATE schema_meta SET version = 13 WHERE id = 1");
  });
  await evictDurableObject(stub);
  await runInDurableObject(stub, (_instance, state) => {
    const sql = state.storage.sql;
    expect(
      sql.exec<{ version: number }>("SELECT version FROM schema_meta").toArray()[0]
        ?.version,
    ).toBe(14);
    sql.exec(
      "UPDATE player SET revoked_at = ? WHERE player_id = ?",
      new Date().toISOString(),
      players[0]!,
    );
    typedScores(sql, q, now + 3);
    expect(typedReveal(sql, q, true, false)?.groups?.[0]).toMatchObject({
      count: 2,
      points: 100,
    });
    expect(
      sql.exec<{ n: number }>("SELECT COUNT(*) n FROM score_ledger").toArray()[0]?.n,
    ).toBe(4);
  });
});

it("persists exact-set choices and rejects forged, duplicate or paused submissions", async () => {
  const { stub, players } = await setup();
  const q = question("christianity-branches");
  if (q.kind !== "choice" || q.outcome.kind !== "multiple")
    throw new Error("Multiple round");
  const now = Date.now();
  await runInDurableObject(stub, (_instance, state) => {
    const sql = state.storage.sql,
      store = collect(sql, q, now);
    expect(checkedChoices(q, '["ranters","ranters"]')).toBeNull();
    expect(checkedChoices(q, '["forged"]')).toBeNull();
    expect(checkedChoices(q, "bad-json")).toBeNull();
    store.writeRoom({ ...store.readRoom(), paused: true });
    expect(
      acceptMultiple(
        sql,
        store,
        players[0]!,
        JSON.stringify(q.outcome.kind === "multiple" ? q.outcome.optionIds : []),
        now,
        q,
      ).ok,
    ).toBe(false);
    store.writeRoom({ ...store.readRoom(), paused: false });
    const body = '["ranters","muggletonians","the-jumpers"]';
    expect(acceptMultiple(sql, store, players[0]!, body, now, q).ok).toBe(true);
    expect(acceptMultiple(sql, store, players[0]!, body, now, q).ok).toBe(false);
    const row = sql
      .exec<{ option_id: string }>("SELECT option_id FROM choice_answer")
      .toArray()[0]!;
    expect(
      pointsFor(q, {
        optionId: row.option_id,
        receivedAt: now,
        deadlineAt: now + 20_000,
      }).points,
    ).toBe(100);
    expect(
      pointsFor(q, { optionId: "ranters", receivedAt: now, deadlineAt: now + 20_000 })
        .points,
    ).toBe(0);
    expect(
      pointsFor(q, {
        optionId: q.options.map((o) => o.id).join(","),
        receivedAt: now,
        deadlineAt: now + 20_000,
      }).points,
    ).toBe(0);
  });
  await evictDurableObject(stub);
  await runInDurableObject(stub, (_instance, state) =>
    expect(
      state.storage.sql.exec("SELECT option_id FROM choice_answer").toArray(),
    ).toHaveLength(1),
  );
});

it("awards only the highest underbid and freezes consensus across later revocations", async () => {
  for (const id of ["guess-tab-soho-pint", "dial-pop-culture"]) {
    const { stub, players } = await setup();
    const q = question(id);
    if (q.kind !== "slider") throw new Error("Estimate round");
    const now = Date.now(),
      values = q.scoring === "under" ? [7.29, 7.29, 7.31] : [0, 40, 100];
    await runInDurableObject(stub, (_instance, state) => {
      const sql = state.storage.sql,
        store = collect(sql, q, now);
      for (const [i, value] of values.entries())
        expect(acceptEstimate(sql, store, players[i]!, value, now, q).ok).toBe(true);
      expect(acceptEstimate(sql, store, players[3]!, 1000000, now, q).ok).toBe(false);
      sliderScores(sql, q, now + 1);
      sliderScores(sql, q, now + 2);
      expect(sliderReveal(sql, q, false, false)).toBeNull();
      expect(
        sql
          .exec<{ points: number }>("SELECT points FROM score_ledger ORDER BY rowid")
          .toArray()
          .map((r) => r.points),
      ).toEqual(q.scoring === "under" ? [100, 100, 0, 0] : [60, 100, 40, 0]);
    });
    await evictDurableObject(stub);
    await runInDurableObject(stub, (_instance, state) => {
      const sql = state.storage.sql;
      sql.exec(
        "UPDATE player SET revoked_at = ? WHERE player_id = ?",
        new Date().toISOString(),
        players[1]!,
      );
      sliderScores(sql, q, now + 3);
      expect(sliderReveal(sql, q, true, false)?.truth).toBe(
        q.scoring === "under" ? 7.3 : 40,
      );
    });
  }
});

it.each(["dating-exit-excuse", "heathrow-search-query"])(
  "%s persists successive ballots and rejects stale epochs after recovery",
  async (id) => {
    const { stub, players } = await setup();
    const q = question(id);
    if (q.kind !== "vote" || !q.flow) throw new Error("Flow round");
    const now = Date.now();
    await runInDurableObject(stub, (_instance, state) => {
      const sql = state.storage.sql,
        store = collect(sql, q, now);
      for (const [i, player] of players.entries())
        expect(
          acceptText(sql, store, player, `Fictional line ${i + 1}`, now, q).ok,
        ).toBe(true);
      const clock = store.readRoom();
      store.writeRoom({
        ...clock,
        phase: "vote",
        phaseGeneration: clock.phaseGeneration + 1,
      });
      store.saveJob({
        ...store.jobs().find((j) => j.jobType === "gameplay" && j.phase === "collect")!,
        jobId: `vote-${q.id}`,
        phase: "vote",
        phaseGeneration: clock.phaseGeneration + 1,
        dueAt: now + q.voteMs,
      });
      freezeVote(sql, q, now);
      const view = ballotPlayFields(
        sql,
        q,
        store.readRoom(),
        "guest",
        players[0],
        false,
      );
      expect(view.reveal).toBeNull();
      expect(view.ballot.epoch).toBe(0);
      if (q.flow?.kind === "tournament") {
        expect(view.ballot.cards).toHaveLength(2);
        expect(
          ballotPlayFields(
            sql,
            q,
            store.readRoom(),
            "stage",
            undefined,
            false,
          ).ballot.cards.map((c) => c.id),
        ).toEqual(view.ballot.cards.map((c) => c.id));
      }
      const choice = view.ballot.cards.find((c) => c.selectable)!;
      expect(acceptBallot(sql, store, players[0]!, choice.id, now, q, 99).ok).toBe(
        false,
      );
      expect(acceptBallot(sql, store, players[0]!, choice.id, now, q, 0)).toEqual({
        ok: true,
      });
      expect(acceptBallot(sql, store, players[0]!, choice.id, now, q, 0).ok).toBe(
        false,
      );
    });
    await evictDurableObject(stub);
    await runInDurableObject(stub, (_instance, state) => {
      const sql = state.storage.sql,
        base = createSqlStore(sql);
      const store: GameStore = {
        ...base,
        nextPhaseOverride: (room) => nextBallotPhase(sql, q, room),
        onEnterPhase: (room) => {
          if (room.phase === "vote") freezeVote(sql, q, now);
          if (room.phase === "reveal") scoreBallotQuestion(sql, q, now);
        },
      };
      expect(
        ballotPlayFields(sql, q, store.readRoom(), "guest", players[0], false)
          .selfBallot,
      ).not.toBeNull();
      expect(advance(store, now + 1)).toBe(true);
      expect(store.readRoom().phase).toBe("vote");
      const next = ballotPlayFields(
        sql,
        q,
        store.readRoom(),
        "guest",
        players[0],
        false,
      );
      expect(next.ballot.epoch).toBe(1);
      expect(next.selfBallot).toBeNull();
      const choice = next.ballot.cards.find((c) => c.selectable)!;
      expect(acceptBallot(sql, store, players[0]!, choice.id, now + 2, q, 0).ok).toBe(
        false,
      );
      expect(acceptBallot(sql, store, players[0]!, choice.id, now + 2, q, 1).ok).toBe(
        true,
      );
      for (let n = 0; n < 10 && store.readRoom().phase === "vote"; n++) {
        const due = store
          .jobs()
          .find(
            (j) =>
              j.phaseGeneration === store.readRoom().phaseGeneration &&
              j.status === "pending" &&
              j.jobType === "gameplay",
          )!.dueAt!;
        onAlarm(store, due);
      }
      expect(store.readRoom().phase).toBe("reveal");
      expect(readRoundState<PartyVoteFlow>(sql, q.id, "vote-flow")?.finished).toBe(
        true,
      );
      scoreBallotQuestion(sql, q, now + 10);
      expect(
        sql
          .exec<{ n: number }>(
            "SELECT COUNT(*) n FROM score_ledger WHERE question_id = ?",
            q.id,
          )
          .toArray()[0]?.n,
      ).toBe(4);
      const reveal = ballotPlayFields(
        sql,
        q,
        store.readRoom(),
        "stage",
        undefined,
        true,
      ).reveal;
      expect(reveal).not.toBeNull();
      if (q.flow?.kind === "awards")
        expect(reveal).toHaveProperty(
          "awards",
          expect.arrayContaining([
            expect.objectContaining({ label: "Most Smooth" }),
            expect.objectContaining({ label: "Most Brutal" }),
            expect.objectContaining({ label: "Instantly Causes a Scene" }),
          ]),
        );
    });
  },
);

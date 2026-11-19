import { env, evictDurableObject, runInDurableObject } from "cloudflare:test";
import { expect, it } from "vitest";
import { payloadDigest } from "../src/room/digest.ts";
import { createSqlStore } from "../src/room/sql-store.ts";
import { advance, onAlarm, type GameStore } from "../src/room/lifecycle.ts";
import { toPlayable } from "../src/questions/authoring.ts";
import { birthdayPack } from "../src/questions/packs/birthday/manifest.ts";
import type { VoteQuestion } from "../src/questions/definition.ts";
import {
  acceptBallot,
  acceptText,
  ballotPlayFields,
  freezeVote,
  nextBallotPhase,
  phasesForQuestion,
  scoreBallotQuestion,
  stretchPhoneRound,
} from "../src/questions/vote.ts";
import { readRoundState } from "../src/questions/round-state.ts";
import type { PartyVoteFlow } from "../../../packages/shared/src/party-scoring.ts";

function heathrow(): VoteQuestion {
  const q = toPlayable(
    birthdayPack.catalogue.find((item) => item.id === "heathrow-search-query"),
  );
  if (q?.kind !== "vote" || q.flow?.kind !== "tournament" || !q.flow.heat)
    throw new Error("heathrow-search-query must be a tournament with a phone round");
  return q;
}

async function join(
  stub: DurableObjectStub<import("../src/room/party-room.ts").PartyRoom>,
  nickname: string,
) {
  const joined = await stub.joinPlayer({
    nickname,
    requestId: crypto.randomUUID(),
    now: new Date().toISOString(),
  });
  if (!joined.ok) throw new Error(joined.message);
  return joined.playerId;
}

async function setup(count: number) {
  const created = await env.ROOM_CODE_REGISTRY.getByName("codes").createLobby({
    requestId: crypto.randomUUID(),
    digest: await payloadDigest({ action: "create" }),
    now: new Date().toISOString(),
  });
  if (!created.ok) throw new Error(created.message);
  const stub = env.PARTY_ROOM.getByName(created.result.gameId);
  const players: string[] = [];
  for (let i = 0; i < count; i++) players.push(await join(stub, `Guest ${i + 1}`));
  return { stub, players };
}

function roomStore(sql: SqlStorage, q: VoteQuestion): GameStore {
  const base = createSqlStore(sql);
  return {
    ...base,
    nextPhaseOverride: (room) => nextBallotPhase(sql, q, room),
    onEnterPhase: (room, at) => {
      if (room.phase === "vote") {
        freezeVote(sql, q, at);
        stretchPhoneRound(sql, base, q, at);
      }
      if (room.phase === "reveal") scoreBallotQuestion(sql, q, at);
    },
  };
}

it("runs a phone round of private pairs, then a knockout of the best eight", async () => {
  const q = heathrow();
  const heat = (q.flow as { heat: { finalists: number; pairs: number; ms: number } })
    .heat;
  const { stub, players } = await setup(12);
  const now = Date.now();

  await runInDurableObject(stub, (_instance, state) => {
    const sql = state.storage.sql;
    const store = roomStore(sql, q);
    const room = {
      ...store.readRoom(),
      phase: "collect" as const,
      phaseGeneration: 10,
      paused: false,
      hold: null,
      controllerPresent: true,
      stagePresent: true,
      roundId: "phone-round",
      questionCount: 1,
      phases: phasesForQuestion(q),
      durations: {
        collect: q.collectMs,
        vote: q.voteMs,
        reveal: 12_000,
        scores: 10_000,
      },
    };
    store.writeRoom(room);
    store.saveJob({
      jobId: "collect",
      jobType: "gameplay",
      dueAt: now + q.collectMs,
      remainingMs: null,
      scopeGeneration: room.scopeGeneration,
      phaseGeneration: room.phaseGeneration,
      phase: "collect",
      status: "pending",
      retryCount: 0,
      payload: "collect",
      createdAt: now,
    });
    for (const [i, player] of players.entries())
      expect(
        acceptText(sql, store, player, `Fictional search ${i + 1}`, now, q).ok,
      ).toBe(true);
    // The collect timer closes the phase, which opens the phone round.
    onAlarm(store, now + q.collectMs);
  });

  await runInDurableObject(stub, (_instance, state) => {
    const sql = state.storage.sql;
    const store = roomStore(sql, q);
    expect(store.readRoom().phase).toBe("vote");
    const flow = readRoundState<PartyVoteFlow>(sql, q.id, "vote-flow")!;
    expect(flow.heat).toEqual({ pairs: heat.pairs, finalists: heat.finalists });
    const timer = store
      .jobs()
      .find(
        (j) =>
          j.jobType === "gameplay" &&
          j.status === "pending" &&
          j.phaseGeneration === store.readRoom().phaseGeneration,
      )!;
    expect(timer.dueAt! - timer.createdAt).toBe(heat.ms);

    const stage = ballotPlayFields(sql, q, store.readRoom(), "stage", undefined, false);
    expect(stage.ballot.cards).toEqual([]);
    expect(stage.ballot.total).toBe(12);
    expect(stage.ballot.reason).toBe("open");
    expect(stage.ballot.label).toBe("Phone round");
    expect(stage.ballot.heat).toEqual({
      done: 0,
      total: 12 * heat.pairs,
      finalists: 8,
    });

    const first = ballotPlayFields(
      sql,
      q,
      store.readRoom(),
      "guest",
      players[0],
      false,
    );
    expect(first.ballot.epoch).toBe(0);
    expect(first.ballot.label).toBe(`Phone round · pair 1 of ${heat.pairs}`);
    expect(first.ballot.cards).toHaveLength(2);
    expect(first.ballot.cards.every((c) => c.selectable && !c.own)).toBe(true);
    expect(first.selfBallot).toBeNull();
    const pick = first.ballot.cards[0]!.id;
    const other = first.ballot.cards[1]!.id;
    // Wrong pair number, then a card outside this phone's pair.
    expect(acceptBallot(sql, store, players[0]!, pick, now + 1, q, 1).ok).toBe(false);
    const outsider = stage.ballot.total
      ? sql
          .exec<{ candidate_id: string }>(
            "SELECT candidate_id FROM vote_candidate WHERE question_id = ? AND candidate_id NOT IN (?, ?) LIMIT 1",
            q.id,
            pick,
            other,
          )
          .toArray()[0]!.candidate_id
      : "";
    expect(acceptBallot(sql, store, players[0]!, outsider, now + 1, q, 0).ok).toBe(
      false,
    );
    expect(acceptBallot(sql, store, players[0]!, pick, now + 1, q, 0)).toEqual({
      ok: true,
    });
    // The same pair again is stale: this phone has moved on.
    expect(acceptBallot(sql, store, players[0]!, pick, now + 1, q, 0).ok).toBe(false);
    const second = ballotPlayFields(
      sql,
      q,
      store.readRoom(),
      "guest",
      players[0],
      false,
    );
    expect(second.ballot.epoch).toBe(1);
    expect(second.ballot.heat).toEqual({ done: 1, total: heat.pairs, finalists: 8 });
  });

  // The plan and the votes survive the object restarting mid-round.
  await evictDurableObject(stub);
  const late = await join(stub, "Late Guest");

  await runInDurableObject(stub, (_instance, state) => {
    const sql = state.storage.sql;
    const store = roomStore(sql, q);
    const lateView = ballotPlayFields(sql, q, store.readRoom(), "guest", late, false);
    expect(lateView.ballot.reason).toBe("late");
    expect(lateView.ballot.cards).toEqual([]);

    for (const player of players) {
      for (;;) {
        const view = ballotPlayFields(sql, q, store.readRoom(), "guest", player, false);
        if (view.selfBallot) break;
        const card = view.ballot.cards.find((c) => c.selectable)!;
        expect(
          acceptBallot(sql, store, player, card.id, now + 2, q, view.ballot.epoch).ok,
        ).toBe(true);
      }
    }
    const done = ballotPlayFields(sql, q, store.readRoom(), "guest", players[3], false);
    expect(done.ballot.label).toBe(`Phone round · all ${heat.pairs} done`);
    expect(done.ballot.epoch).toBe(heat.pairs - 1);
    expect(done.submissionCount).toBe(12 * heat.pairs);
    expect(
      acceptBallot(
        sql,
        store,
        players[3]!,
        done.ballot.cards[0]!.id,
        now + 3,
        q,
        heat.pairs - 1,
      ).ok,
    ).toBe(false);

    // The host closes the phone round; the best eight go to the knockout.
    expect(advance(store, now + 4)).toBe(true);
    expect(store.readRoom().phase).toBe("vote");
    const flow = readRoundState<PartyVoteFlow>(sql, q.id, "vote-flow")!;
    expect(flow.heat).toBeUndefined();
    expect(flow.offset).toBe(heat.pairs);
    expect(flow.results[0]!.winners).toHaveLength(8);
    const timer = store
      .jobs()
      .find(
        (j) =>
          j.jobType === "gameplay" &&
          j.status === "pending" &&
          j.phaseGeneration === store.readRoom().phaseGeneration,
      )!;
    // Knockout matches keep the ordinary vote length.
    expect(timer.dueAt! - timer.createdAt).toBe(q.voteMs);
    const match = ballotPlayFields(sql, q, store.readRoom(), "stage", undefined, false);
    expect(match.ballot.epoch).toBe(heat.pairs);
    expect(match.ballot.label).toBe("The final 8 · match 1 of 7");
    expect(match.ballot.cards).toHaveLength(2);

    for (let n = 0; n < 12 && store.readRoom().phase === "vote"; n++) {
      const view = ballotPlayFields(
        sql,
        q,
        store.readRoom(),
        "guest",
        players[0],
        false,
      );
      const card = view.ballot.cards.find((c) => c.selectable);
      if (card)
        expect(
          acceptBallot(sql, store, players[0]!, card.id, now + 5, q, view.ballot.epoch)
            .ok,
        ).toBe(true);
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
    const finished = readRoundState<PartyVoteFlow>(sql, q.id, "vote-flow")!;
    expect(finished.finished).toBe(true);
    expect(finished.winners).toHaveLength(1);
    expect(finished.results[0]!.winners).toContain(finished.winners[0]);
    expect(finished.results.map((r) => r.label).slice(1)).toEqual(
      Array.from({ length: 7 }, (_, i) => `Match ${i + 1}`),
    );
    const points = sql
      .exec<{ points: number }>(
        "SELECT points FROM score_ledger WHERE question_id = ?",
        q.id,
      )
      .toArray()
      .map((row) => row.points)
      .sort((a, b) => b - a);
    expect(points[0]).toBe(q.points);
    expect(points.filter((p) => p > 0)).toHaveLength(1);
  });
});

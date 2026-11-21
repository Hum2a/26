import { env, evictDurableObject, runInDurableObject } from "cloudflare:test";
import { expect, it } from "vitest";
import { createGameStore } from "../src/questions/multiple-choice.ts";
import { onAlarm, submissionGate } from "../src/room/lifecycle.ts";
import { withClientApiQuery } from "./client-api-key.ts";

async function startQuestion(id: string) {
  const registry = env.ROOM_CODE_REGISTRY.getByName("codes");
  const order = await registry.birthdayOrder();
  const saved = await registry.updateBirthdayOrder(
    { requestId: crypto.randomUUID(), expectedRevision: order.revision, ids: [id] },
    Date.now(),
  );
  if ("error" in saved) throw new Error(saved.message);
  const now = Date.now();
  const made = await registry.createLobby({
    requestId: crypto.randomUUID(),
    digest: "round",
    now: new Date(now).toISOString(),
  });
  if (!made.ok) throw new Error(made.message);
  const stub = env.PARTY_ROOM.getByName(made.result.gameId);
  const guest = await stub.joinPlayer({
    nickname: "Rehearsal guest",
    requestId: crypto.randomUUID(),
    now: new Date(now).toISOString(),
  });
  if (!guest.ok) throw new Error(guest.message);
  const control = {
    credentialId: made.result.control.credentialId,
    secret: made.result.control.secret,
  };
  expect(
    (
      await stub.startBirthday({
        ...control,
        requestId: crypto.randomUUID(),
        nowMs: now,
      })
    ).ok,
  ).toBe(true);
  const advance = () =>
    stub.advanceRound({ ...control, requestId: crypto.randomUUID(), nowMs: now + 1 });
  return { stub, guest, advance, control, now };
}

it("holds listening, reading and standings for a cue, then opens the full answer window", async () => {
  const { stub, advance, control, now } = await startQuestion("car-name");
  for (const phase of ["intro", "prompt"] as const) {
    expect(await stub.snapshotFor("guest")).toMatchObject({ phase, deadlineAt: null });
    await runInDurableObject(stub, (_instance, state) => {
      const store = createGameStore(state.storage.sql);
      expect(
        store.jobs().some((job) => job.phase === phase && job.status === "pending"),
      ).toBe(false);
      // An existing room may still have a phase alarm from before manual pacing.
      const room = store.readRoom();
      store.saveJob({
        jobId: `old:${phase}`,
        jobType: "gameplay",
        payload: phase,
        scopeGeneration: room.scopeGeneration,
        phaseGeneration: room.phaseGeneration,
        retryCount: 0,
        phase,
        status: "pending",
        remainingMs: null,
        dueAt: now,
        createdAt: now,
      });
      onAlarm(store, now + 120_000);
      expect(store.readRoom().phase).toBe(phase);
      expect(submissionGate(store, now + 120_000)).toEqual({
        ok: false,
        reason: "phase",
      });
    });
    if (phase === "intro") await advance();
  }
  const readyAt = now + 120_000;
  await stub.advanceRound({
    ...control,
    requestId: crypto.randomUUID(),
    nowMs: readyAt,
  });
  const collect = await stub.snapshotFor("guest");
  expect(collect.phase).toBe("collect");
  expect(collect.deadlineAt).toBeGreaterThan(readyAt);
  await runInDurableObject(stub, (_instance, state) => {
    const store = createGameStore(state.storage.sql);
    expect(collect.deadlineAt).toBe(readyAt + store.readRoom().durations.collect!);
    expect(submissionGate(store, readyAt)).toEqual({ ok: true });
  });
  await stub.advanceRound({
    ...control,
    requestId: crypto.randomUUID(),
    nowMs: readyAt + 1,
  });
  await stub.advanceRound({
    ...control,
    requestId: crypto.randomUUID(),
    nowMs: readyAt + 2,
  });
  expect(await stub.snapshotFor("stage")).toMatchObject({
    phase: "scores",
    deadlineAt: null,
  });
  await stub.advanceRound({
    ...control,
    requestId: crypto.randomUUID(),
    nowMs: readyAt + 3,
  });
  expect((await stub.snapshotFor("stage")).phase).toBe("final");
});

it("reveals options durably one at a time, withholds future labels and opens answering afterwards", async () => {
  const { stub, advance, control, now } = await startQuestion("favourite-genre");
  await advance();
  let view = await stub.snapshotFor("stage");
  expect(view.phase).toBe("prompt");
  expect(view.play?.question).toMatchObject({
    options: [],
    optionSequence: { shown: 0, total: 4 },
  });
  expect(JSON.stringify(view)).not.toContain("Screaming goat sounds");
  const request = { ...control, requestId: crypto.randomUUID(), nowMs: now + 2 };
  await stub.advanceRound(request);
  await stub.advanceRound(request);
  await evictDurableObject(stub);
  view = await stub.snapshotFor("stage");
  expect(view.play?.question).toMatchObject({ optionSequence: { shown: 1, total: 4 } });
  await runInDurableObject(stub, (_instance, state) => {
    expect(
      state.storage.sql
        .exec(
          "SELECT job_id FROM schedule_job WHERE status = 'pending' AND phase = 'prompt'",
        )
        .toArray(),
    ).toHaveLength(0);
  });
  for (let i = 0; i < 3; i++) await advance();
  expect((await stub.snapshotFor("stage")).phase).toBe("prompt");
  await advance();
  expect((await stub.snapshotFor("stage")).phase).toBe("collect");
});

it("creates chess on manual advance and settles once under the actual question id", async () => {
  const { stub, guest, advance } = await startQuestion("chess-battle");
  await advance();
  await advance();
  const playing = await stub.snapshotFor("guest", guest.playerId);
  expect(playing.phase).toBe("collect");
  expect(playing.play?.chess).toMatchObject({
    status: "in-progress",
    playerTimeMs: 60000,
  });
  expect(playing.deadlineAt! - playing.serverNow).toBeGreaterThan(100000);
  const stage = await stub.snapshotFor("stage");
  expect(stage.play?.chess).not.toHaveProperty("fen");
  await advance();
  await runInDurableObject(stub, (_instance, state) => {
    expect(
      state.storage.sql.exec("SELECT question_id FROM score_ledger").toArray(),
    ).toEqual([{ question_id: "chess-battle" }]);
    expect(
      state.storage.sql
        .exec("SELECT game_id FROM chess_game WHERE status = 'in-progress'")
        .toArray(),
    ).toHaveLength(0);
  });
  await advance();
  await runInDurableObject(stub, (_instance, state) =>
    expect(
      state.storage.sql.exec("SELECT question_id FROM score_ledger").toArray(),
    ).toHaveLength(1),
  );
});

it("plays a live chess round over WebSocket: human move, bot reply, pause guard, resign and final standings", async () => {
  const { stub, guest, advance, control, now } = await startQuestion("chess-battle");
  await advance(); // prompt
  await advance(); // collect

  const initial = await stub.snapshotFor("guest", guest.playerId);
  const chessStart = initial.play?.chess;
  if (!chessStart || !("gameId" in chessStart)) {
    throw new Error("Expected chess guest snapshot");
  }

  const response = await stub.fetch(
    new Request(
      withClientApiQuery(`http://example.com/ws/${guest.gameId}?role=guest`),
      {
        headers: {
          Upgrade: "websocket",
          Connection: "Upgrade",
          Origin: "http://example.com",
          Cookie: `26_guest=${guest.gameId}.${guest.playerId}.${guest.secret}`,
        },
      },
    ),
  );
  const socket = response.webSocket!;
  socket.accept();

  const sendChess = (
    payload:
      | {
          name: "chess-move";
          gameId: string;
          from: string;
          to: string;
          positionRevision: number;
        }
      | { name: "chess-resign"; gameId: string },
  ) => {
    const requestId = crypto.randomUUID();
    return new Promise<{ accepted: boolean; error?: string }>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error("Timed out waiting for ack")),
        5000,
      );
      const onMessage = (event: MessageEvent) => {
        const message = JSON.parse(String(event.data)) as {
          kind?: string;
          requestId?: string;
          accepted?: boolean;
          error?: string;
        };
        if (message.kind === "ack" && message.requestId === requestId) {
          clearTimeout(timer);
          socket.removeEventListener("message", onMessage);
          resolve({ accepted: message.accepted === true, error: message.error });
        }
      };
      socket.addEventListener("message", onMessage);
      socket.send(JSON.stringify({ kind: "command", requestId, ...payload }));
    });
  };

  // Human move: 1. e4
  const move1 = await sendChess({
    name: "chess-move",
    gameId: chessStart.gameId,
    from: "e2",
    to: "e4",
    positionRevision: chessStart.positionRevision,
  });
  expect(move1).toEqual({ accepted: true, error: undefined });

  const afterE4 = await stub.snapshotFor("guest", guest.playerId);
  expect(afterE4.play?.chess).toMatchObject({
    sideToMove: "black",
    plyCount: 1,
    positionRevision: chessStart.positionRevision + 1,
  });

  // Bot move: 1... d5
  const bot1 = await sendChess({
    name: "chess-move",
    gameId: chessStart.gameId,
    from: "d7",
    to: "d5",
    positionRevision: chessStart.positionRevision + 1,
  });
  expect(bot1).toEqual({ accepted: true, error: undefined });

  // Human capture: 2. exd5 (scores 1 point)
  const move2 = await sendChess({
    name: "chess-move",
    gameId: chessStart.gameId,
    from: "e4",
    to: "d5",
    positionRevision: chessStart.positionRevision + 2,
  });
  expect(move2).toEqual({ accepted: true, error: undefined });

  // Pause refuses moves even with the post-pause positionRevision
  await stub.pauseRound({
    ...control,
    requestId: crypto.randomUUID(),
    nowMs: now + 50,
  });
  const pausedSnap = await stub.snapshotFor("guest", guest.playerId);
  const pausedRev =
    pausedSnap.play?.chess && "positionRevision" in pausedSnap.play.chess
      ? pausedSnap.play.chess.positionRevision
      : -1;
  const pausedMove = await sendChess({
    name: "chess-move",
    gameId: chessStart.gameId,
    from: "d8",
    to: "d5",
    positionRevision: pausedRev,
  });
  expect(pausedMove.accepted).toBe(false);

  // Resume and resign: keeps captured pawn point
  await stub.resumeRound({
    ...control,
    requestId: crypto.randomUUID(),
    nowMs: now + 100,
  });
  const resignAck = await sendChess({
    name: "chess-resign",
    gameId: chessStart.gameId,
  });
  expect(resignAck).toEqual({ accepted: true, error: undefined });
  socket.close();

  const resigned = await stub.snapshotFor("guest", guest.playerId);
  expect(resigned.play?.chess).toMatchObject({
    status: "resignation",
    isGameOver: true,
    capturedPoints: 1,
    score: 1,
  });

  // Reveal and scores attach standings and selfStanding
  await advance(); // reveal
  await advance(); // scores
  const stageScores = await stub.snapshotFor("stage");
  expect(stageScores.phase).toBe("scores");
  expect(stageScores.play?.standings).toEqual([
    { place: 1, nickname: "Rehearsal guest", points: 1 },
  ]);
  const guestScores = await stub.snapshotFor("guest", guest.playerId);
  expect(guestScores.play?.selfAward).toBe(1);
  expect(guestScores.play?.selfStanding).toEqual({
    place: 1,
    points: 1,
    players: 1,
  });
});

it("removes retired rounds from old saved orders without changing already-frozen games", async () => {
  const registry = env.ROOM_CODE_REGISTRY.getByName("codes");
  await runInDurableObject(registry, (_instance, state) =>
    state.storage.sql.exec(
      "INSERT INTO pack_order (id, payload) VALUES ('birthday', ?) ON CONFLICT(id) DO UPDATE SET payload = excluded.payload",
      JSON.stringify({
        revision: 7,
        ids: ["who-said-it-empathy", "trolley-your-mum", "car-name", "kart-sprint"],
        updatedAt: 1000,
        history: [],
      }),
    ),
  );
  expect(await registry.birthdayOrder()).toMatchObject({
    revision: 7,
    ids: ["car-name", "kart-sprint"],
  });
});

it("adds the bracket rounds and best-dressed back to older saved orders, but leaves later host saves alone", async () => {
  const registry = env.ROOM_CODE_REGISTRY.getByName("codes");
  const save = (ids: string[], updatedAt: number | null) =>
    runInDurableObject(registry, (_instance, state) =>
      state.storage.sql.exec(
        "INSERT INTO pack_order (id, payload) VALUES ('birthday', ?) ON CONFLICT(id) DO UPDATE SET payload = excluded.payload",
        JSON.stringify({ revision: 4, ids, updatedAt, history: [] }),
      ),
    );
  const old = [
    "car-name",
    "mock-election",
    "trolley-problem",
    "guess-airport-lounge",
    "property-price-roulette",
    "kart-sprint",
  ];
  await save(old, Date.UTC(2026, 10, 19, 21, 0));
  const restored = await registry.birthdayOrder();
  expect(restored.ids).toEqual([
    "car-name",
    "mock-election",
    "apology-video-auction",
    "trolley-problem",
    "guess-airport-lounge",
    "heathrow-search-query",
    "property-price-roulette",
    "kart-sprint",
    "best-dressed",
  ]);
  expect(restored.revision).toBe(4);

  await save(old, null);
  expect((await registry.birthdayOrder()).ids).toEqual(restored.ids);

  await save(old, Date.UTC(2026, 10, 20, 12, 0));
  expect((await registry.birthdayOrder()).ids).toEqual([...old, "best-dressed"]);

  await save(old, Date.UTC(2026, 10, 21, 15, 0));
  expect((await registry.birthdayOrder()).ids).toEqual(old);

  const nearlyFull = [...old, ...Array.from({ length: 73 }, () => "car-name")];
  await save(nearlyFull, Date.UTC(2026, 10, 19, 21, 0));
  const capped = (await registry.birthdayOrder()).ids;
  expect(capped).toHaveLength(80);
  expect(capped.slice(0, 3)).toEqual([
    "car-name",
    "mock-election",
    "apology-video-auction",
  ]);
  expect(capped).not.toContain("heathrow-search-query");
  expect(capped).not.toContain("best-dressed");
});

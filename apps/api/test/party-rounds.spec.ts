import { env, evictDurableObject, runInDurableObject } from "cloudflare:test";
import { expect, it } from "vitest";

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

it("adds the bracket rounds back to orders saved before the phone round, but not to later ones", async () => {
  const registry = env.ROOM_CODE_REGISTRY.getByName("codes");
  const save = (ids: string[], updatedAt: number) =>
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
  ]);
  expect(restored.revision).toBe(4);

  await save(old, Date.UTC(2026, 10, 20, 12, 0));
  expect((await registry.birthdayOrder()).ids).toEqual(old);
});

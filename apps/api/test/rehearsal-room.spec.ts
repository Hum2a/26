import { env, evictDurableObject, runInDurableObject } from "cloudflare:test";
import { expect, it } from "vitest";
import { withClientApiQuery } from "./client-api-key.ts";
import { defaultRehearsalConfig } from "@26/shared";
import { payloadDigest } from "../src/room/digest.ts";
import { createGameStore } from "../src/questions/multiple-choice.ts";
import { onAlarm, notePresence } from "../src/room/lifecycle.ts";
import { recordRehearsalEvent } from "../src/developer/rehearsal.ts";

async function setup(configure = true, extra = {}) {
  const created = await env.ROOM_CODE_REGISTRY.getByName("codes").createLobby({
    requestId: crypto.randomUUID(),
    digest: await payloadDigest({ action: "create" }),
    now: new Date().toISOString(),
  });
  if (!created.ok) throw new Error(created.message);
  const stub = env.PARTY_ROOM.getByName(created.result.gameId);
  const control = {
    credentialId: created.result.control.credentialId,
    secret: created.result.control.secret,
  };
  const command = (action: string, fields = {}) => ({
    ...control,
    action,
    requestId: crypto.randomUUID(),
    nowMs: Date.now(),
    ...fields,
  });
  if (configure)
    expect(
      (
        await stub.hostAction(
          command("developer-configure", {
            rehearsalConfig: { ...defaultRehearsalConfig, botCount: 4, ...extra },
          }),
        )
      ).ok,
    ).toBe(true);
  return { stub, control, command };
}
it("creates a persistent isolated rehearsal, validates again and keeps host tools private", async () => {
  const { stub, command } = await setup(false);
  const input = command("developer-configure", {
    rehearsalConfig: { ...defaultRehearsalConfig, botCount: 0 },
  });
  expect((await stub.hostAction({ ...input, secret: "wrong" })).ok).toBe(false);
  const first = await stub.hostAction(input);
  expect(first.ok).toBe(true);
  await evictDurableObject(stub);
  expect(await stub.hostAction(input)).toEqual(first);
  const host = await stub.snapshotFor("control");
  expect(host.developerTools?.rehearsal?.config.pack).toBe("demo");
  expect(
    host.developerTools?.rehearsal?.events.filter((e) => e.kind === "host"),
  ).toHaveLength(2);
  for (const audience of ["guest", "stage"] as const) {
    const snapshot = await stub.snapshotFor(audience);
    expect(snapshot.developerTools).toBeUndefined();
    expect(snapshot.rehearsalRevision).toBe(1);
    expect(JSON.stringify(snapshot)).not.toContain("stopOnFailure");
  }
  expect(
    (
      await stub.hostAction(
        command("developer-configure", {
          rehearsalConfig: { ...defaultRehearsalConfig, beatMs: -1 },
        }),
      )
    ).ok,
  ).toBe(false);
});
it.each([
  ["developer-run", {}],
  ["developer-stop", {}],
  ["developer-jump", { questionIndex: 1 }],
  ["developer-repeat", {}],
  ["developer-scenario", { scenario: "disconnect" }],
  ["developer-scenario", { scenario: "late-join" }],
  ["developer-scenario", { scenario: "host-loss" }],
])(
  "%s succeeds in rehearsal, refuses an ordinary room, and replays once",
  async (action, fields) => {
    const { stub, command } = await setup();
    const input = command(action, fields);
    const first = await stub.hostAction(input);
    expect(first.ok).toBe(true);
    const before = (await stub.snapshotFor("control")).developerTools?.rehearsal;
    expect(await stub.hostAction(input)).toEqual(first);
    const after = (await stub.snapshotFor("control")).developerTools?.rehearsal;
    expect(after?.revision).toBe(before?.revision);
    expect(after?.events).toEqual(before?.events);
    expect((await stub.hostAction({ ...input, secret: "wrong" })).ok).toBe(false);
    const ordinary = await setup(false);
    expect((await ordinary.stub.hostAction(ordinary.command(action, fields))).ok).toBe(
      false,
    );
  },
);
it("repeats a question without retaining its old points or clearing another question", async () => {
  const { stub, command } = await setup();
  await stub.hostAction(command("developer-jump", { questionIndex: 0 }));
  const snapshot = await stub.snapshotFor("control"),
    player = snapshot.players[0]!,
    id = snapshot.play!.question.id;
  await runInDurableObject(stub, (_instance, state) => {
    for (const qid of [id, "another-question"])
      state.storage.sql.exec(
        `INSERT INTO score_ledger (question_id,player_id,points,detail,created_at) VALUES (?,?,100,'test',?)`,
        qid,
        player.playerId,
        Date.now(),
      );
  });
  const repeat = command("developer-repeat");
  expect((await stub.hostAction(repeat)).ok).toBe(true);
  const rows = await runInDurableObject(stub, (_instance, state) =>
    state.storage.sql
      .exec<{ question_id: string }>(`SELECT question_id FROM score_ledger`)
      .toArray(),
  );
  expect(rows.map((r) => r.question_id)).toEqual(["another-question"]);
  expect(await stub.hostAction(repeat)).toMatchObject({ ok: true });
  expect(
    (await stub.hostAction(command("developer-jump", { questionIndex: 999 }))).ok,
  ).toBe(false);
});
it("runs on the existing durable alarm, pauses at reveals and never queues a rehearsal archive", async () => {
  const { stub, command } = await setup(true, { botCount: 0, pauseAtReveal: true });
  const input = command("developer-run");
  await stub.hostAction(input);
  await runInDurableObject(stub, (_instance, state) => {
    const store = createGameStore(state.storage.sql);
    notePresence(store, { controller: true, stage: true }, input.nowMs);
    onAlarm(store, input.nowMs + 1001);
  });
  expect((await stub.snapshotFor("control")).phase).toBe("prompt");
  for (
    let step = 0;
    step < 5 && (await stub.snapshotFor("control")).phase !== "reveal";
    step++
  )
    await stub.advanceRound(command("advance"));
  const reveal = await stub.snapshotFor("control");
  expect(reveal.paused).toBe(true);
  expect(reveal.developerTools?.rehearsal?.runner).toBe("paused");
  await stub.hostAction(command("developer-stop"));
  for (
    let step = 0;
    step < 160 && (await stub.snapshotFor("control")).phase !== "podium";
    step++
  )
    await stub.advanceRound(command("advance"));
  const archives = await runInDurableObject(stub, (_instance, state) =>
    state.storage.sql.exec(`SELECT * FROM room_archive`).toArray(),
  );
  expect(archives).toHaveLength(0);
});
it("records bounded diagnostic history without answer bodies and pauses on a refused command", async () => {
  const { stub, command } = await setup(true, { botCount: 0 });
  await stub.hostAction(command("developer-run"));
  await runInDurableObject(stub, (_instance, state) => {
    for (let i = 0; i < 205; i++)
      recordRehearsalEvent(state.storage.sql, {
        kind: "answer",
        detail: "Answer accepted",
        status: "accepted",
        now: Date.now(),
      });
    recordRehearsalEvent(state.storage.sql, {
      kind: "answer",
      detail: "This phase is not accepting answers.",
      status: "refused",
      now: Date.now(),
    });
  });
  const rehearsal = (await stub.snapshotFor("control")).developerTools!.rehearsal!;
  expect(rehearsal.events).toHaveLength(200);
  expect(rehearsal.runner).toBe("paused");
  expect(rehearsal.checks.find((check) => check.id === "refusals")?.status).toBe(
    "fail",
  );
});

it("arms a deadline burst only during collection and persists scenario replays", async () => {
  const { stub, command } = await setup();
  expect(
    (
      await stub.hostAction(
        command("developer-scenario", { scenario: "deadline-burst" }),
      )
    ).ok,
  ).toBe(false);
  await stub.hostAction(command("developer-jump", { questionIndex: 0 }));
  for (
    let step = 0;
    step < 6 && (await stub.snapshotFor("control")).phase !== "collect";
    step++
  )
    await stub.advanceRound(command("advance"));
  const input = command("developer-scenario", { scenario: "deadline-burst" });
  const result = await stub.hostAction(input);
  expect(result.ok).toBe(true);
  expect(await stub.hostAction(input)).toEqual(result);
  const test = (await stub.snapshotFor("control")).developerTools!.rehearsal!;
  expect(test.scenario).toEqual({
    name: "deadline-burst",
    at: input.nowMs,
    leadMs: 250,
  });
  expect(test.config.autoAnswers).toBe(false);
});
it("creates a replayable isolated real phone identity with scoped transport and no public credential", async () => {
  const { stub, control } = await setup(true, { botCount: 0 });
  const input = { ...control, nowMs: Date.now(), requestId: crypto.randomUUID() };
  expect((await stub.openRehearsalPhone({ ...input, secret: "wrong" })).ok).toBe(false);
  const first = await stub.openRehearsalPhone(input);
  expect(first.ok).toBe(true);
  if (!first.ok) throw new Error(first.message);
  expect(await stub.openRehearsalPhone(input)).toEqual(first);
  const response = await stub.fetch(
    new Request(
      withClientApiQuery(`https://example.com/ws/${first.gameId}?role=guest`),
      {
        headers: {
          Upgrade: "websocket",
          Origin: "https://example.com",
          "sec-websocket-protocol": `26-bot.${first.playerId}.${first.secret}`,
        },
      },
    ),
  );
  expect(response.status).toBe(101);
  response.webSocket!.accept();
  response.webSocket!.close();
  const player = await runInDurableObject(
    stub,
    (_instance, state) =>
      state.storage.sql
        .exec<{ client_class: string }>(
          `SELECT client_class FROM player WHERE player_id=?`,
          first.playerId,
        )
        .toArray()[0],
  );
  expect(player?.client_class).toBe("test");
  expect(JSON.stringify(await stub.snapshotFor("stage"))).not.toContain(first.secret);
});

it("lets a delayed alarm advance before considering its old deadline stuck", async () => {
  const { stub, command } = await setup(true, { botCount: 0 });
  const input = command("developer-run");
  await stub.hostAction(input);
  await runInDurableObject(stub, (_instance, state) => {
    const store = createGameStore(state.storage.sql);
    notePresence(store, { controller: true, stage: true }, input.nowMs);
    onAlarm(store, input.nowMs + 30000);
  });
  const snapshot = await stub.snapshotFor("control");
  expect(snapshot.phase).toBe("prompt");
  expect(snapshot.developerTools?.rehearsal?.runner).toBe("running");
});
it("keeps an isolated pack frozen when ordinary start commands are used", async () => {
  const { stub, command } = await setup(true, { botCount: 0 });
  expect((await stub.startDemo(command("start"))).ok).toBe(false);
  expect((await stub.snapshotFor("control")).phase).toBe("lobby");
});

it("pauses an unattended runner and cancels its repeated wakeups", async () => {
  const { stub, command } = await setup(true, { botCount: 0 });
  const input = command("developer-run");
  await stub.hostAction(input);
  await runInDurableObject(stub, (_instance, state) =>
    onAlarm(createGameStore(state.storage.sql), input.nowMs + 30000),
  );
  const snapshot = await stub.snapshotFor("control");
  expect(snapshot.paused).toBe(true);
  expect(snapshot.developerTools?.rehearsal?.runner).toBe("paused");
  const jobs = await runInDurableObject(stub, (_instance, state) =>
    state.storage.sql
      .exec(
        `SELECT job_id FROM schedule_job WHERE job_id='developer-runner' AND status='pending'`,
      )
      .toArray(),
  );
  expect(jobs).toHaveLength(0);
  const gameplay = await runInDurableObject(stub, (_instance, state) =>
    state.storage.sql
      .exec(
        `SELECT job_id FROM schedule_job WHERE job_type='gameplay' AND status='pending' AND remaining_ms IS NOT NULL`,
      )
      .toArray(),
  );
  expect(gameplay.length).toBeGreaterThan(0);
});

import { env, evictDurableObject, runInDurableObject } from "cloudflare:test";
import { expect, it } from "vitest";
import {
  analyticsTrendsSchema,
  normaliseDeviceReport,
  roomAnalyticsSchema,
} from "@26/shared";
import { withClientApiQuery } from "./client-api-key.ts";
import { payloadDigest } from "../src/room/digest.ts";

type Stub = ReturnType<typeof env.PARTY_ROOM.getByName>;
type Player = { gameId: string; playerId: string; secret: string };

const iphoneAgent =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const androidAgent =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36";

async function setup() {
  const created = await env.ROOM_CODE_REGISTRY.getByName("codes").createLobby({
    requestId: crypto.randomUUID(),
    digest: await payloadDigest({ action: "create" }),
    now: new Date().toISOString(),
  });
  if (!created.ok) throw new Error(created.message);
  const room = created.result;
  const stub = env.PARTY_ROOM.getByName(room.gameId);
  const control = {
    credentialId: room.control.credentialId,
    secret: room.control.secret,
  };
  return { gameId: room.gameId, stub, control };
}

async function join(stub: Stub, nickname: string, agent: string): Promise<Player> {
  const joined = await stub.joinPlayer({
    nickname,
    requestId: crypto.randomUUID(),
    now: new Date().toISOString(),
  });
  if (!joined.ok) throw new Error(joined.message);
  const report = normaliseDeviceReport({
    userAgent: agent,
    colorScheme: agent === iphoneAgent ? "dark" : "light",
    screen: { width: 390, height: 844 },
    languages: ["en-GB"],
    timeZone: "Europe/London",
  });
  // Stands in for the phone's telemetry report, so answers carry a device.
  await runInDurableObject(stub, (_instance, state) => {
    const contextId = crypto.randomUUID();
    state.storage.sql.exec(
      `INSERT INTO device_context (context_id, player_id, collector_version, participating,
         material_hash, phase_generation, report_json, created_at, updated_at)
       VALUES (?, ?, 1, 1, 'test', NULL, ?, ?, ?)`,
      contextId,
      joined.playerId,
      JSON.stringify(report),
      Date.now(),
      Date.now(),
    );
    state.storage.sql.exec(
      `UPDATE player SET device_context_id = ? WHERE player_id = ?`,
      contextId,
      joined.playerId,
    );
  });
  return joined;
}

async function untilPhase(
  stub: Stub,
  control: { credentialId: string; secret: string },
  phase: string,
) {
  for (let step = 0; step < 8; step += 1) {
    if ((await stub.snapshotFor("stage")).phase === phase) return;
    const moved = await stub.advanceRound({
      ...control,
      requestId: crypto.randomUUID(),
      nowMs: Date.now(),
    });
    if (!moved.ok) throw new Error(moved.message);
  }
  throw new Error(`The room did not reach ${phase}.`);
}

async function answer(stub: Stub, gameId: string, player: Player, optionId: string) {
  const response = await stub.fetch(
    new Request(withClientApiQuery(`http://example.com/ws/${gameId}?role=guest`), {
      headers: {
        Upgrade: "websocket",
        Connection: "Upgrade",
        Origin: "http://example.com",
        Cookie: `26_guest=${player.gameId}.${player.playerId}.${player.secret}`,
      },
    }),
  );
  const socket = response.webSocket!;
  socket.accept();
  const requestId = crypto.randomUUID();
  const accepted = await new Promise<boolean>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("No acknowledgement.")), 5_000);
    socket.addEventListener("message", (event: MessageEvent) => {
      const message = JSON.parse(String(event.data)) as {
        kind?: string;
        requestId?: string;
        accepted?: boolean;
      };
      if (message.kind === "ack" && message.requestId === requestId) {
        clearTimeout(timer);
        resolve(message.accepted === true);
      }
    });
    socket.send(
      JSON.stringify({ kind: "command", requestId, name: "answer", optionId }),
    );
  });
  socket.close();
  return accepted;
}

async function revealedRoom() {
  const { gameId, stub, control } = await setup();
  const iphones: Player[] = [];
  const androids: Player[] = [];
  for (let index = 0; index < 4; index += 1) {
    iphones.push(await join(stub, `Apple${index}`, iphoneAgent));
    androids.push(await join(stub, `Droid${index}`, androidAgent));
  }
  await stub.startDemo({
    ...control,
    requestId: crypto.randomUUID(),
    nowMs: Date.now(),
  });
  await untilPhase(stub, control, "collect");
  const play = (await stub.snapshotFor("stage")).play;
  if (play?.question.kind !== "choice") throw new Error("Expected a choice question");
  const [first, second] = play.question.options;
  for (const player of iphones) {
    expect(await answer(stub, gameId, player, first!.id)).toBe(true);
  }
  for (const player of androids) {
    expect(await answer(stub, gameId, player, second!.id)).toBe(true);
  }
  // No trends while answers are still open.
  expect((await stub.snapshotFor("stage")).trends).toBeUndefined();
  await untilPhase(stub, control, "reveal");
  return { gameId, stub, control, iphones, androids, firstLabel: first!.label };
}

it("reads named accepted choices and reconstructed trends after a restart only with room control", async () => {
  const { stub, control, iphones, androids, firstLabel } = await revealedRoom();
  const auth = { ...control, nowMs: Date.now() };
  await evictDurableObject(stub);
  expect((await stub.adminAnalytics({ ...auth, secret: "incorrect" })).ok).toBe(false);
  const result = await stub.adminAnalytics(auth);
  if (!result.ok) throw new Error("Analytics read failed");
  const room = roomAnalyticsSchema.parse(JSON.parse(result.json));
  const question = room.questions.find((item) => item.state === "current")!;
  expect(room.players).toHaveLength(8);
  expect(room.answers).toHaveLength(8);
  expect(room.answers).toContainEqual(
    expect.objectContaining({
      playerId: iphones[0]!.playerId,
      label: firstLabel,
      questionId: question.id,
      deviceContextId: expect.any(String),
      receivedAt: expect.any(Number),
      deadlineAt: expect.any(Number),
    }),
  );
  expect(
    room.answers.find((row) => row.playerId === androids[0]!.playerId)?.label,
  ).not.toBe(firstLabel);
  expect(room.scores).toHaveLength(8);
  const trendResult = await stub.adminAnalytics({ ...auth, questionId: question.id });
  if (!trendResult.ok) throw new Error("Trends read failed");
  expect(analyticsTrendsSchema.parse(JSON.parse(trendResult.json))).toMatchObject({
    source: "reconstructed",
    responses: 8,
    classified: 8,
  });
  for (const audience of ["stage", "guest"] as const) {
    expect(await stub.snapshotFor(audience)).not.toHaveProperty("answers");
  }
});

it("keeps mechanic details and repeated ballots for guests, including hidden answers and unknown question IDs", async () => {
  const { stub, control } = await setup();
  const guest = await join(stub, "QuizGuest", iphoneAgent);
  const testPhone = await join(stub, "TestPhone", iphoneAgent);
  await runInDurableObject(stub, (_room, state) => {
    const { sql } = state.storage;
    sql.exec(
      "UPDATE player SET client_class = 'test' WHERE player_id = ?",
      testPhone.playerId,
    );
    sql.exec(
      "UPDATE player SET revoked_at = '2026-11-21T21:00:00.000Z' WHERE player_id = ?",
      guest.playerId,
    );
    sql.exec(
      "INSERT INTO text_response (player_id, question_id, body, received_at, deadline_at) VALUES (?, 'vote-example', 'Hidden entry', 1, 2)",
      guest.playerId,
    );
    sql.exec(
      "INSERT INTO round_state (question_id, state_key, payload) VALUES ('vote-example', 'hidden-authors', ?)",
      JSON.stringify([guest.playerId]),
    );
    sql.exec(
      "INSERT INTO vote_candidate (question_id, candidate_id, label, eligible, included, position) VALUES ('vote-example', 'candidate-one', 'First choice', 1, 1, 1)",
    );
    sql.exec(
      "INSERT INTO vote_ballot (player_id, question_id, candidate_id, received_at, deadline_at) VALUES (?, 'vote-example:heat:0', 'candidate-one', 3, 8), (?, 'vote-example:ballot:1', 'candidate-one', 6, 8)",
      guest.playerId,
      guest.playerId,
    );
    sql.exec(
      "INSERT INTO round_response (player_id, question_id, kind, payload, received_at, deadline_at) VALUES (?, 'old-map', 'map-guess', '{\"lat\":51.5,\"lng\":-0.1}', 4, 8), (?, 'old-map', 'map-guess', '{\"lat\":0,\"lng\":0}', 5, 8)",
      guest.playerId,
      testPhone.playerId,
    );
  });
  const result = await stub.adminAnalytics({ ...control, nowMs: Date.now() });
  if (!result.ok) throw new Error("Analytics read failed");
  const data = roomAnalyticsSchema.parse(JSON.parse(result.json));
  expect(data.players).toMatchObject([
    { id: guest.playerId, removedAt: "2026-11-21T21:00:00.000Z" },
  ]);
  expect(data.questions.map((question) => question.id)).toEqual([
    "vote-example",
    "old-map",
  ]);
  expect(
    data.answers.map((answer) => [answer.kind, answer.label, answer.hidden]),
  ).toEqual([
    ["entry", "Hidden entry", true],
    ["ballot", "Phone pair 1 · First choice", false],
    ["map-guess", "51.5, -0.1", false],
    ["ballot", "Stage ballot 2 · First choice", false],
  ]);
});

it("shows answer trends on the stage, a phone's own lines, and the full set to the host only", async () => {
  const { stub, iphones, firstLabel } = await revealedRoom();
  const stage = await stub.snapshotFor("stage");
  expect(stage.trends?.responses).toBe(8);
  expect(stage.trends?.cards.length).toBeGreaterThan(1);
  const platform = stage.trends?.cards.find((card) => card.facet === "platform");
  expect(`${platform?.headline} ${platform?.detail}`).toContain("iPhone");
  // Device and behaviour cards never name a guest.
  for (const card of stage.trends?.cards ?? []) {
    if (card.tone === "device" || card.tone === "behaviour") {
      expect(`${card.headline} ${card.detail}`).not.toMatch(/Apple\d|Droid\d/);
    }
  }
  expect(stage.selfTrends).toBeUndefined();
  expect(stage.trendControl).toBeUndefined();

  const phone = await stub.snapshotFor("guest", iphones[0]!.playerId);
  expect(phone.trends).toBeUndefined();
  expect(phone.trendControl).toBeUndefined();
  // Every iPhone made the same pick, so the phone's tribe line is unanimous.
  expect(
    phone.selfTrends?.lines.some((line) =>
      /^(100% of your fellow iPhone users (agreed with you|got it right)|0% of your fellow iPhone users got it right)\.$/.test(
        line.text,
      ),
    ),
  ).toBe(true);

  const host = await stub.snapshotFor("control");
  expect(host.trendControl?.current?.responses).toBe(8);
  expect(host.trendControl?.current?.classified).toBe(8);
  expect(host.trendControl?.current?.cards.some((card) => card.onStage)).toBe(true);
  expect(
    host.trendControl?.current?.cards.some((card) =>
      card.detail.includes(`iPhone users picked ${firstLabel}`),
    ),
  ).toBe(true);
});

it("switches trends off the stage and phones, refuses bad requests, and replays", async () => {
  const { stub, control, iphones } = await revealedRoom();
  const hideStage = {
    ...control,
    action: "trends-stage-hidden",
    requestId: crypto.randomUUID(),
    nowMs: Date.now(),
  };
  expect((await stub.hostAction({ ...hideStage, secret: "incorrect" })).ok).toBe(false);
  const first = await stub.hostAction(hideStage);
  expect(first.ok).toBe(true);
  expect((await stub.snapshotFor("stage")).trends).toBeUndefined();
  // Phones keep their lines: the switches are separate.
  expect(
    (await stub.snapshotFor("guest", iphones[0]!.playerId)).selfTrends,
  ).toBeDefined();
  await evictDurableObject(stub);
  expect(await stub.hostAction(hideStage)).toEqual(first);
  expect((await stub.snapshotFor("control")).trendControl?.history).toHaveLength(1);

  const hidePhones = await stub.hostAction({
    ...control,
    action: "trends-phones-hidden",
    requestId: crypto.randomUUID(),
    nowMs: Date.now(),
  });
  expect(hidePhones.ok).toBe(true);
  expect(
    (await stub.snapshotFor("guest", iphones[0]!.playerId)).selfTrends,
  ).toBeUndefined();
  const host = await stub.snapshotFor("control");
  expect(host.trendControl?.stage).toBe("hidden");
  expect(host.trendControl?.phones).toBe("hidden");

  expect(
    (
      await stub.hostAction({
        ...control,
        action: "trends-stage-shown",
        requestId: crypto.randomUUID(),
        nowMs: -1,
      })
    ).ok,
  ).toBe(false);
});

it("adds the trend columns to a room created before them", async () => {
  const { stub } = await setup();
  await runInDurableObject(stub, (_instance, state) => {
    const sql = state.storage.sql;
    for (const column of [
      "trend_stage",
      "trend_phones",
      "trend_hidden",
      "trend_history",
    ]) {
      sql.exec(`ALTER TABLE room DROP COLUMN ${column}`);
    }
    sql.exec("UPDATE schema_meta SET version = 15 WHERE id = 1");
  });
  await evictDurableObject(stub);
  const host = await stub.snapshotFor("control");
  expect(host.trendControl?.stage).toBe("shown");
  await runInDurableObject(stub, (_instance, state) => {
    expect(
      state.storage.sql
        .exec<{ version: number }>("SELECT version FROM schema_meta")
        .toArray()[0]?.version,
    ).toBe(16);
  });
});

it("hides one card, refuses hiding it twice, and restores it", async () => {
  const { stub, control } = await revealedRoom();
  const onStage = (await stub.snapshotFor("stage")).trends?.cards ?? [];
  const target = onStage[1]!;
  const hide = {
    ...control,
    action: "trends-card-hide",
    trendCardId: target.id,
    requestId: crypto.randomUUID(),
    nowMs: Date.now(),
  };
  expect((await stub.hostAction(hide)).ok).toBe(true);
  expect(
    (await stub.snapshotFor("stage")).trends?.cards.map((card) => card.id),
  ).not.toContain(target.id);
  const hostCard = (
    await stub.snapshotFor("control")
  ).trendControl?.current?.cards.find((card) => card.id === target.id);
  expect(hostCard?.hidden).toBe(true);
  const again = await stub.hostAction({ ...hide, requestId: crypto.randomUUID() });
  expect(again.ok).toBe(false);
  expect(
    (
      await stub.hostAction({
        ...control,
        action: "trends-card-hide",
        requestId: crypto.randomUUID(),
        nowMs: Date.now(),
      })
    ).ok,
  ).toBe(false);
  expect(
    (
      await stub.hostAction({
        ...control,
        action: "trends-card-restore",
        trendCardId: target.id,
        requestId: crypto.randomUUID(),
        nowMs: Date.now(),
      })
    ).ok,
  ).toBe(true);
  expect(
    (await stub.snapshotFor("stage")).trends?.cards.map((card) => card.id),
  ).toContain(target.id);
});

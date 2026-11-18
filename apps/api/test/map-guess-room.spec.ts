import { env, evictDurableObject, runInDurableObject } from "cloudflare:test";
import { expect, it } from "vitest";
import { withClientApiQuery } from "./client-api-key.ts";
import { mapGuessQuestion, toPlayable } from "../src/questions/authoring.ts";
import { preparePlayShared } from "../src/questions/multiple-choice.ts";
import { createSqlStore } from "../src/room/sql-store.ts";
import { writeRoundState } from "../src/questions/round-state.ts";

it("locks map pins once, replays receipts, restores a pin after eviction and reveals the location only after scoring", async () => {
  const made = await env.ROOM_CODE_REGISTRY.getByName("codes").createLobby({
    requestId: crypto.randomUUID(),
    digest: "map-guess-room-fixture",
    now: new Date().toISOString(),
  });
  if (!made.ok) throw new Error(made.message);
  const room = env.PARTY_ROOM.getByName(made.result.gameId);
  const guest = await room.joinPlayer({
    nickname: "Map guest",
    requestId: crypto.randomUUID(),
    now: new Date().toISOString(),
  });
  if (!guest.ok) throw new Error(guest.message);
  const control = {
    credentialId: made.result.control.credentialId,
    secret: made.result.control.secret,
  };
  expect(
    (
      await room.startDemo({
        ...control,
        requestId: crypto.randomUUID(),
        nowMs: Date.now(),
      })
    ).ok,
  ).toBe(true);
  // Explicit isolated test fixture; no answer key is invented for the real draft.
  const pin = { lat: 14, lng: 18 };
  const authored = mapGuessQuestion({
    id: "map-fixture",
    title: "Map fixture",
    prompt: "Where are we?",
    attribution: "live",
    target: { known: { ...pin, label: "Fixture location" } },
    media: [
      {
        kind: "image",
        name: "question",
        required: true,
        asset: "/assets/questions/map-fixture/fixture.jpg",
        credit: "Test",
      },
    ],
  });
  const question = toPlayable(authored, false);
  if (!question || question.kind !== "map-guess")
    throw new Error("Missing map fixture");
  expect(question.collectMs).toBe(40_000);
  const advance = () =>
    room.advanceRound({
      ...control,
      requestId: crypto.randomUUID(),
      nowMs: Date.now(),
    });
  await runInDurableObject(room, (_instance, state) => {
    const version = "birthday-map-fixture";
    writeRoundState(state.storage.sql, "__pack", "birthday-script", {
      version,
      questions: [question],
      revision: 0,
    });
    state.storage.sql.exec(
      "UPDATE room SET question_set_version = ?, question_count = 1, question_index = 0, collect_windows_json = ?",
      version,
      JSON.stringify([question.collectMs]),
    );
  });
  await evictDurableObject(room);
  await advance();
  await advance();
  const before = await room.snapshotFor("stage");
  expect(before.phase).toBe("collect");
  expect(before.play?.question).toMatchObject({ kind: "map-guess" });
  expect(before.play?.reveal).toBeNull();
  expect(JSON.stringify(before)).not.toContain("Fixture location");
  const response = await room.fetch(
    new Request(
      withClientApiQuery(`http://example.com/ws/${made.result.gameId}?role=guest`),
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
  await next(socket, (message) => message.kind === "snapshot");
  const send = (guess: typeof pin, requestId = crypto.randomUUID()) => {
    const reply = next(
      socket,
      (message) => message.kind === "ack" && message.requestId === requestId,
    );
    socket.send(
      JSON.stringify({ kind: "command", name: "map-pin", requestId, pin: guess }),
    );
    return reply;
  };
  expect((await send({ lat: 91, lng: 18 })).accepted).toBe(false);
  await room.pauseRound({
    ...control,
    requestId: crypto.randomUUID(),
    nowMs: Date.now(),
  });
  expect((await send(pin)).accepted).toBe(false);
  await room.resumeRound({
    ...control,
    requestId: crypto.randomUUID(),
    nowMs: Date.now(),
  });
  const requestId = crypto.randomUUID();
  expect((await send(pin, requestId)).accepted).toBe(true);
  expect((await send(pin, requestId)).accepted).toBe(true);
  expect((await send(pin)).accepted).toBe(false);
  expect(
    (await room.snapshotFor("control")).play?.hostResponses?.[0]?.summary,
  ).toContain("14.0000, 18.0000");
  expect((await room.snapshotFor("stage")).play?.liveSample).toEqual(["Map guest"]);
  const setVoterDisplay = (action: string) =>
    room.hostAction({
      ...control,
      action,
      requestId: crypto.randomUUID(),
      nowMs: Date.now(),
    });
  expect((await setVoterDisplay("voters-hidden")).ok).toBe(true);
  expect((await room.snapshotFor("stage")).play?.liveSample).toBeNull();
  expect((await room.snapshotFor("guest", guest.playerId)).play?.liveSample).toBeNull();
  await runInDurableObject(room, (_instance, state) => {
    const sql = state.storage.sql;
    expect(
      preparePlayShared(sql, createSqlStore(sql).readRoom())?.special?.liveSample,
    ).toBeNull();
  });
  expect((await setVoterDisplay("voters-question")).ok).toBe(true);
  socket.close();
  await evictDurableObject(room);
  expect((await room.snapshotFor("guest", guest.playerId)).play?.selfAnswer).toEqual({
    kind: "map-guess",
    pin,
  });
  await advance();
  const result = await room.snapshotFor("guest", guest.playerId);
  expect(result.play?.selfAward).toBe(100);
  expect(result.play?.reveal).toMatchObject({
    kind: "map-guess",
    target: pin,
    pins: [],
    closest: [],
  });
  const stage = await room.snapshotFor("stage");
  expect(stage.play?.hostResponses).toBeUndefined();
  expect(stage.play?.selfAnswer).toBeNull();
  expect(stage.play?.reveal).toMatchObject({
    kind: "map-guess",
    pins: [pin],
    closest: [{ nickname: "Map guest", distanceKm: 0 }],
  });
  const scored = await room.scoreRecord();
  expect(scored.rows).toBe(1);
  expect(await room.rescoreCurrent()).toEqual(scored);
});

function next(
  socket: WebSocket,
  predicate: (message: Record<string, unknown>) => boolean,
): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.removeEventListener("message", receive);
      reject(new Error("No map reply"));
    }, 5000);
    function receive(event: MessageEvent) {
      const message = JSON.parse(String(event.data)) as Record<string, unknown>;
      if (predicate(message)) {
        clearTimeout(timer);
        socket.removeEventListener("message", receive);
        resolve(message);
      }
    }
    socket.addEventListener("message", receive);
  });
}

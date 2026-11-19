import { env, evictDurableObject, runInDurableObject } from "cloudflare:test";
import { expect, it } from "vitest";
import { withClientApiQuery } from "./client-api-key.ts";
import { toPlayable } from "../src/questions/authoring.ts";
import { makeEdOrHumza } from "../src/questions/packs/birthday/ed-or-humza.ts";
import { writeRoundState } from "../src/questions/round-state.ts";

it("persists and replays a 40-quote submission, restores it after eviction and settles once without exposing other lists", async () => {
  const made = await env.ROOM_CODE_REGISTRY.getByName("codes").createLobby({
    requestId: crypto.randomUUID(),
    digest: "bucket-room-fixture",
    now: new Date().toISOString(),
  });
  if (!made.ok) throw new Error(made.message);
  const room = env.PARTY_ROOM.getByName(made.result.gameId);
  const guest = await room.joinPlayer({
    nickname: "Sorting guest",
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
  // Explicit isolated 40-quote fixture; not the party list.
  const authored = makeEdOrHumza(
    Array.from({ length: 40 }, (_, i) => ({
      id: `quote-${i}`,
      quote: `Stand-in quotation ${i + 1}`,
      speaker: i % 2 ? ("ed" as const) : ("humza" as const),
    })),
  );
  const question = toPlayable(authored, false);
  if (!question || question.kind !== "rank") throw new Error("Missing sorting fixture");
  const advance = () =>
    room.advanceRound({
      ...control,
      requestId: crypto.randomUUID(),
      nowMs: Date.now(),
    });
  await runInDurableObject(room, (_instance, state) => {
    const version = "birthday-bucket-fixture";
    writeRoundState(state.storage.sql, "__pack", "birthday-script", {
      version,
      questions: [question],
      revision: 0,
    });
    state.storage.sql.exec(
      "UPDATE room SET question_set_version = ?, question_count = 1, question_index = 0, collect_windows_json = ?",
      version,
      JSON.stringify([120000]),
    );
  });
  await evictDurableObject(room);
  await advance();
  await advance();
  const before = await room.snapshotFor("stage");
  expect(before.phase).toBe("collect");
  expect(before.play?.question).toMatchObject({ input: "buckets" });
  expect(before.play?.reveal).toBeNull();
  expect(JSON.stringify(before)).not.toContain('"truth"');
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
  const placements = question.truth.flatMap((group) =>
    group.itemIds.map((itemId) => ({ itemId, tierId: group.tierId })),
  );
  const send = (entries: typeof placements, requestId = crypto.randomUUID()) => {
    const reply = next(
      socket,
      (message) => message.kind === "ack" && message.requestId === requestId,
    );
    socket.send(
      JSON.stringify({ kind: "command", name: "rank", requestId, placements: entries }),
    );
    return reply;
  };
  expect((await send(placements.slice(1))).accepted).toBe(false);
  await room.pauseRound({
    ...control,
    requestId: crypto.randomUUID(),
    nowMs: Date.now(),
  });
  expect((await send(placements)).accepted).toBe(false);
  await room.resumeRound({
    ...control,
    requestId: crypto.randomUUID(),
    nowMs: Date.now(),
  });
  const requestId = crypto.randomUUID();
  expect((await send(placements, requestId)).accepted).toBe(true);
  expect((await send(placements, requestId)).accepted).toBe(true);
  expect((await send(placements)).accepted).toBe(false);
  expect(
    (await room.snapshotFor("control")).play?.hostResponses?.[0]?.summary,
  ).toContain("40 quotes assigned");
  socket.close();
  await evictDurableObject(room);
  expect((await room.snapshotFor("guest", guest.playerId)).play?.selfAnswer).toEqual({
    kind: "rank",
    placements,
  });
  await advance();
  const result = await room.snapshotFor("guest", guest.playerId);
  expect(result.play?.selfAward).toBe(80);
  expect(result.play?.reveal).toMatchObject({ kind: "rank", rankings: [] });
  const stage = await room.snapshotFor("stage");
  expect(stage.play?.hostResponses).toBeUndefined();
  expect(stage.play?.selfAnswer).toBeNull();
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
      reject(new Error("No sorting reply"));
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

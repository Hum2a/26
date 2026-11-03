import { env, runInDurableObject } from "cloudflare:test";
import { expect, it } from "vitest";
import { withClientApiQuery } from "./client-api-key.ts";
import { payloadDigest } from "../src/room/digest.ts";
import { readRaid } from "../src/questions/push-luck.ts";

it("freezes the Raid before anyone bails, banks a bail and settles holders at the reveal", async () => {
  const registry = env.ROOM_CODE_REGISTRY.getByName("codes");
  const current = await registry.birthdayOrder();
  const saved = await registry.updateBirthdayOrder(
    {
      requestId: crypto.randomUUID(),
      expectedRevision: current.revision,
      ids: ["cursed-search-history", "kart-sprint"],
    },
    1000,
  );
  if ("error" in saved) throw new Error(saved.message);
  const created = await registry.createLobby({
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
  const bailer = await stub.joinPlayer({
    nickname: "Bailer",
    requestId: crypto.randomUUID(),
    now: new Date().toISOString(),
  });
  const holder = await stub.joinPlayer({
    nickname: "Holder",
    requestId: crypto.randomUUID(),
    now: new Date().toISOString(),
  });
  if (!bailer.ok || !holder.ok) throw new Error("Join failed.");
  const started = await stub.startBirthday({
    ...control,
    requestId: crypto.randomUUID(),
    nowMs: Date.now(),
  });
  expect(started.ok).toBe(true);

  await reach(stub, control, "collect");
  const raid = await runInDurableObject(stub, (_instance, state) =>
    readRaid(state.storage.sql, "cursed-search-history"),
  );
  expect([2, 3, 4, null]).toContain(raid);

  const open = await stub.snapshotFor("guest", bailer.playerId);
  expect(open.play?.question).toMatchObject({
    kind: "choice",
    outcome: "push",
    push: { lineMs: 6_000, banks: [100, 250, 450, 700] },
  });
  expect(JSON.stringify(open)).not.toContain("raidAfter");

  const socket = await connect(stub, created.result.gameId, bailer);
  const requestId = crypto.randomUUID();
  socket.send(
    JSON.stringify({ kind: "command", name: "answer", requestId, optionId: "bail" }),
  );
  const ack = await nextMatching(
    socket,
    (message) => message.kind === "ack" && message.requestId === requestId,
  );
  expect(ack.accepted).toBe(true);
  socket.close();
  const locked = await stub.snapshotFor("guest", bailer.playerId);
  expect(locked.play?.selfAnswer).toEqual({
    kind: "choice",
    optionId: "bail",
    pushLine: 0,
  });

  await reach(stub, control, "reveal");
  const bailed = await stub.snapshotFor("guest", bailer.playerId);
  expect(bailed.play?.reveal).toMatchObject({
    kind: "choice",
    outcome: "push",
    raidAfter: raid,
    tally: [{ optionId: "bail", count: 1 }],
  });
  // A bail in the first seconds always beats the earliest Raid (after line 2).
  expect(bailed.play?.selfAward).toBe(100);
  const held = await stub.snapshotFor("guest", holder.playerId);
  expect(held.play?.selfAward).toBe(raid === null ? 700 : 0);
});

type RoomStub = ReturnType<typeof env.PARTY_ROOM.getByName>;

async function reach(
  stub: RoomStub,
  control: { credentialId: string; secret: string },
  phase: string,
) {
  for (let step = 0; step < 20; step += 1) {
    const snapshot = await stub.snapshotFor("stage");
    if (
      snapshot.play?.question.id === "cursed-search-history" &&
      snapshot.phase === phase
    )
      return;
    const moved = await stub.advanceRound({
      ...control,
      requestId: crypto.randomUUID(),
      nowMs: Date.now(),
    });
    if (!moved.ok) throw new Error(moved.message);
  }
  throw new Error(`The room did not reach ${phase}.`);
}

async function connect(
  stub: RoomStub,
  gameId: string,
  joined: { gameId: string; playerId: string; secret: string },
) {
  const response = await stub.fetch(
    new Request(withClientApiQuery(`http://example.com/ws/${gameId}?role=guest`), {
      headers: {
        Upgrade: "websocket",
        Connection: "Upgrade",
        Origin: "http://example.com",
        Cookie: `26_guest=${joined.gameId}.${joined.playerId}.${joined.secret}`,
      },
    }),
  );
  const socket = response.webSocket;
  if (!socket) throw new Error("The room did not return a socket.");
  socket.accept();
  return socket;
}

function nextMatching(
  socket: WebSocket,
  match: (message: Record<string, unknown>) => boolean,
): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("No matching message.")), 5_000);
    socket.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data)) as Record<string, unknown>;
      if (match(message)) {
        clearTimeout(timer);
        resolve(message);
      }
    });
  });
}

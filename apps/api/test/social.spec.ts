import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { withClientApiQuery } from "./client-api-key.ts";
import { removedSessionMessage } from "@26/shared";
import { payloadDigest } from "../src/room/digest.ts";
import {
  nicknameTakenMessage,
  reactionClosedMessage,
  reactionLimitMessage,
  reactionSelfMessage,
} from "../src/room/limits.ts";

describe("lobby reactions and host controls", () => {
  it("caps name votes and replays a tap without a second vote", async () => {
    const created = await createRoom();
    const stub = room(created.gameId);
    const voter = await join(stub, "Amina");
    const targets = [];
    for (let index = 1; index <= 11; index += 1) {
      targets.push(await join(stub, `Guest ${index}`));
    }
    const socket = await connect(stub, created.gameId, guestCookie(voter));
    await nextMatching(socket, (message) => message.kind === "snapshot");

    const firstId = crypto.randomUUID();
    const firstTarget = targets[0]?.playerId ?? "";
    await react(socket, firstId, firstTarget, "like");
    await react(socket, firstId, firstTarget, "like");
    let cloud = (await stub.snapshotFor("guest", voter.playerId)).cloud;
    expect(cloud.find((name) => name.playerId === firstTarget)?.likes).toBe(1);

    await react(socket, crypto.randomUUID(), firstTarget, "like");
    cloud = (await stub.snapshotFor("guest", voter.playerId)).cloud;
    expect(cloud.find((name) => name.playerId === firstTarget)?.likes).toBe(0);

    await react(socket, crypto.randomUUID(), firstTarget, "like");
    const replaced = await react(socket, crypto.randomUUID(), firstTarget, "dislike");
    expect(replaced.accepted).toBe(true);
    cloud = (await stub.snapshotFor("guest", voter.playerId)).cloud;
    const first = cloud.find((name) => name.playerId === firstTarget);
    expect(first?.likes).toBe(0);
    expect(first?.dislikes).toBe(1);

    for (let index = 1; index <= 9; index += 1) {
      const voted = await react(
        socket,
        crypto.randomUUID(),
        targets[index]?.playerId ?? "",
        "like",
      );
      expect(voted.accepted).toBe(true);
    }
    const blocked = await react(
      socket,
      crypto.randomUUID(),
      targets[10]?.playerId ?? "",
      "like",
    );
    expect(blocked.accepted).toBe(false);
    expect(blocked.error).toBe(reactionLimitMessage);

    const self = await react(socket, crypto.randomUUID(), voter.playerId, "like");
    expect(self.error).toBe(reactionSelfMessage);

    const stage = await stub.snapshotFor("stage");
    expect(stage.selfReactions).toBeUndefined();
    expect(JSON.stringify(stage.cloud)).not.toContain("reaction");
    const mine = await stub.snapshotFor("guest", voter.playerId);
    expect(mine.selfReactions?.length).toBe(10);

    const revealed = await stub.hostAction({
      ...control(created),
      requestId: crypto.randomUUID(),
      nowMs: Date.now(),
      action: "reveal-names",
    });
    expect(revealed.ok).toBe(true);
    expect((await stub.scoreRecord()).rows).toBe(0);
    expect((await stub.snapshotFor("stage")).namesReveal?.disliked[0]?.nickname).toBe(
      "Guest 1",
    );

    await stub.startDemo({
      ...control(created),
      requestId: crypto.randomUUID(),
      nowMs: Date.now(),
    });
    const closed = await react(socket, crypto.randomUUID(), firstTarget, "like");
    expect(closed.error).toBe(reactionClosedMessage);
    expect((await stub.snapshotFor("stage")).namesReveal).toBeNull();
  });

  it("keeps player ids when nicknames collide or swap", async () => {
    const created = await createRoom();
    const stub = room(created.gameId);
    const amina = await join(stub, "Amina");
    const bilal = await join(stub, "Bilal");
    const taken = await stub.joinPlayer({
      nickname: "amina",
      requestId: crypto.randomUUID(),
      now: new Date().toISOString(),
    });
    expect(taken.ok).toBe(false);
    if (!taken.ok) {
      expect(taken.message).toBe(nicknameTakenMessage);
    }
    const rename = await stub.hostAction({
      ...control(created),
      requestId: crypto.randomUUID(),
      nowMs: Date.now(),
      action: "rename",
      playerId: bilal.playerId,
      nickname: "Amina",
    });
    expect(rename.ok).toBe(false);
    const swapped = await stub.hostAction({
      ...control(created),
      requestId: crypto.randomUUID(),
      nowMs: Date.now(),
      action: "swap",
      playerId: amina.playerId,
      otherPlayerId: bilal.playerId,
    });
    expect(swapped.ok).toBe(true);
    const players = (await stub.snapshotFor("stage")).players;
    expect(players.find((player) => player.playerId === amina.playerId)?.nickname).toBe(
      "Bilal",
    );
    expect(players.find((player) => player.playerId === bilal.playerId)?.nickname).toBe(
      "Amina",
    );
  });

  it("shows a reveal again without scoring it twice", async () => {
    const created = await createRoom();
    const stub = room(created.gameId);
    const amina = await join(stub, "Amina");
    await stub.startDemo({
      ...control(created),
      requestId: crypto.randomUUID(),
      nowMs: Date.now(),
    });
    await untilPhase(stub, created, "collect");
    await answer(stub, created.gameId, amina, "circle");
    await untilPhase(stub, created, "reveal");
    const before = await stub.scoreRecord();
    const nonce = (await stub.snapshotFor("stage")).revealNonce;
    const again = await stub.hostAction({
      ...control(created),
      requestId: crypto.randomUUID(),
      nowMs: Date.now(),
      action: "rereveal",
    });
    expect(again.ok).toBe(true);
    const after = await stub.scoreRecord();
    expect(after).toEqual(before);
    expect((await stub.snapshotFor("stage")).revealNonce).toBe(nonce + 1);
    expect((await stub.snapshotFor("stage")).phase).toBe("reveal");

    const duplicateId = crypto.randomUUID();
    const adjustment = {
      ...control(created),
      requestId: duplicateId,
      nowMs: Date.now(),
      action: "adjust",
      playerId: amina.playerId,
      points: 25,
      reason: "Desk fix for the round",
    };
    expect((await stub.hostAction(adjustment)).ok).toBe(true);
    expect((await stub.hostAction(adjustment)).ok).toBe(true);
    const scored = await stub.scoreRecord();
    expect(scored).toEqual(before);
    const controlView = await stub.snapshotFor("control");
    const stageView = await stub.snapshotFor("stage");
    expect(
      controlView.adjustments?.filter((row) => row.reason === "Desk fix for the round"),
    ).toHaveLength(1);
    expect(JSON.stringify(stageView)).not.toContain("Desk fix for the round");
    expect(stageView.connections).toBeUndefined();
    expect(controlView.connections).toBeDefined();
    expect(
      controlView.play?.standings?.find((row) => row.nickname === "Amina")?.points,
    ).toBe((before.total ?? 0) + 25);
  });

  it("revokes a kicked phone immediately", async () => {
    const created = await createRoom();
    const stub = room(created.gameId);
    const amina = await join(stub, "Amina");
    const socket = await connect(stub, created.gameId, guestCookie(amina));
    const removed = nextMatching(socket, (message) => message.kind === "replaced");
    const kicked = await stub.hostAction({
      ...control(created),
      requestId: crypto.randomUUID(),
      nowMs: Date.now(),
      action: "kick",
      playerId: amina.playerId,
    });
    expect(kicked.ok).toBe(true);
    expect((await removed).message).toBe(removedSessionMessage);
    expect(
      (await stub.fetch(socketRequest(created.gameId, guestCookie(amina)))).status,
    ).toBe(401);

    const recovered = await stub.hostAction({
      ...control(created),
      requestId: crypto.randomUUID(),
      nowMs: Date.now(),
      action: "recover",
      playerId: amina.playerId,
    });
    expect(recovered.ok).toBe(true);
    if (recovered.ok) {
      expect(recovered.transferCode).toHaveLength(8);
    }
    expect(
      (await stub.fetch(socketRequest(created.gameId, guestCookie(amina)))).status,
    ).toBe(401);
    expect(
      (await stub.snapshotFor("stage")).players.some(
        (player) => player.playerId === amina.playerId,
      ),
    ).toBe(true);
  });

  it("lets a late joiner start at zero without resetting the room", async () => {
    const created = await createRoom();
    const stub = room(created.gameId);
    const amina = await join(stub, "Amina");
    await stub.startDemo({
      ...control(created),
      requestId: crypto.randomUUID(),
      nowMs: Date.now(),
    });
    await untilPhase(stub, created, "collect");
    await answer(stub, created.gameId, amina, "circle");
    await untilPhase(stub, created, "scores");
    const earned = (await stub.snapshotFor("guest", amina.playerId)).play?.selfStanding
      ?.points;
    expect(earned).toBeGreaterThan(0);
    await untilPhase(stub, created, "collect");
    const before = await stub.snapshotFor("stage");
    const bilal = await join(stub, "Bilal");
    const after = await stub.snapshotFor("guest", bilal.playerId);
    expect(after.phase).toBe("collect");
    expect(after.play?.question.index).toBe(before.play?.question.index);
    expect(after.play?.selfStanding?.points).toBe(0);
    expect(
      (await stub.snapshotFor("guest", amina.playerId)).play?.selfStanding?.points,
    ).toBe(earned);
  });

  it("keeps unrevealed answers out of the public snapshot", async () => {
    const created = await createRoom();
    const stub = room(created.gameId);
    const amina = await join(stub, "Amina");
    const bilal = await join(stub, "Bilal");
    await stub.startDemo({
      ...control(created),
      requestId: crypto.randomUUID(),
      nowMs: Date.now(),
    });
    await untilPhase(stub, created, "collect");
    await answer(stub, created.gameId, amina, "circle");
    await answer(stub, created.gameId, bilal, "square");

    const guest = await stub.snapshotFor("guest", amina.playerId);
    const stage = await stub.snapshotFor("stage");
    const host = await stub.snapshotFor("control");
    expect(guest.play?.question.attribution).toBe("after");
    expect(guest.play?.attributions).toBeNull();
    expect(guest.play?.liveSample).toBeNull();
    expect(guest.play?.hostAnswers).toBeUndefined();
    expect(stage.play?.hostAnswers).toBeUndefined();
    expect(JSON.stringify(stage.play)).not.toContain(amina.playerId);
    expect(JSON.stringify(guest.play)).not.toContain(bilal.playerId);
    expect(host.play?.hostAnswers?.map((row) => row.optionId).sort()).toEqual([
      "circle",
      "square",
    ]);

    await untilPhase(stub, created, "reveal");
    const revealed = await stub.snapshotFor("stage");
    expect(
      revealed.play?.attributions?.find((row) => row.optionId === "circle")?.nicknames,
    ).toEqual(["Amina"]);
    const hidden = await stub.hostAction({
      ...control(created),
      requestId: crypto.randomUUID(),
      nowMs: Date.now(),
      action: "hide",
    });
    expect(hidden.ok).toBe(true);
    const hiddenStage = await stub.snapshotFor("stage");
    expect(hiddenStage.stageHidden).toBe(true);
    expect(hiddenStage.play).toBeNull();
    expect((await stub.snapshotFor("guest", amina.playerId)).play?.reveal).toEqual({
      kind: "choice",
      correctOptionId: "circle",
    });
    expect((await stub.snapshotFor("control")).play?.reveal).toEqual({
      kind: "choice",
      correctOptionId: "circle",
    });
    expect(
      (
        await stub.hostAction({
          ...control(created),
          requestId: crypto.randomUUID(),
          nowMs: Date.now(),
          action: "show",
        })
      ).ok,
    ).toBe(true);

    await untilPhase(stub, created, "collect");
    const neverCollect = await stub.snapshotFor("stage");
    expect(neverCollect.play?.question.attribution).toBe("never");
    await answer(stub, created.gameId, amina, "blue");
    await untilPhase(stub, created, "reveal");
    const neverReveal = await stub.snapshotFor("stage");
    expect(neverReveal.play?.attributions).toBeNull();
    expect(JSON.stringify(neverReveal.play)).not.toContain(amina.playerId);
    expect(
      (await stub.snapshotFor("control")).play?.hostAnswers?.some(
        (row) => row.playerId === amina.playerId && row.optionId === "blue",
      ),
    ).toBe(true);

    await untilPhase(stub, created, "collect");
    const live = await stub.snapshotFor("stage");
    expect(live.play?.question.attribution).toBe("live");
    await answer(stub, created.gameId, bilal, "twenty-six");
    const sample = await stub.snapshotFor("stage");
    expect(sample.play?.liveSample).toEqual(["Bilal"]);
    expect(sample.play?.attributions).toBeNull();
    expect(sample.play?.hostAnswers).toBeUndefined();
    expect(JSON.stringify(sample.play?.liveSample)).not.toContain("twenty-six");
  });

  it("fills a local lobby with enough names for the projector", async () => {
    const created = await createRoom();
    const seeded = await room(created.gameId).seedDemoCloud({
      ...control(created),
      nowMs: Date.now(),
      target: 75,
    });
    expect(seeded.ok).toBe(true);
    if (seeded.ok) {
      expect(seeded.count).toBeGreaterThanOrEqual(75);
    }
    expect(
      (await room(created.gameId).snapshotFor("stage")).cloud.length,
    ).toBeGreaterThanOrEqual(75);
  });
});

async function join(stub: ReturnType<typeof room>, nickname: string) {
  const joined = await stub.joinPlayer({
    nickname,
    requestId: crypto.randomUUID(),
    now: new Date().toISOString(),
  });
  if (!joined.ok) {
    throw new Error(joined.message);
  }
  return joined;
}

async function react(
  socket: WebSocket,
  requestId: string,
  targetId: string,
  reaction: "like" | "dislike",
) {
  socket.send(
    JSON.stringify({ kind: "command", name: "react", requestId, targetId, reaction }),
  );
  const message = await nextMatching(
    socket,
    (item) => item.kind === "ack" && item.requestId === requestId,
  );
  return {
    accepted: message.accepted === true,
    error: typeof message.error === "string" ? message.error : undefined,
  };
}

async function answer(
  stub: ReturnType<typeof room>,
  gameId: string,
  player: { gameId: string; playerId: string; secret: string },
  optionId: string,
) {
  const socket = await connect(stub, gameId, guestCookie(player));
  await nextMatching(socket, (message) => message.kind === "snapshot");
  socket.send(
    JSON.stringify({
      kind: "command",
      name: "answer",
      requestId: crypto.randomUUID(),
      optionId,
    }),
  );
  await nextMatching(
    socket,
    (message) => message.kind === "ack" && message.accepted === true,
  );
  socket.close();
}

async function untilPhase(
  stub: ReturnType<typeof room>,
  created: Awaited<ReturnType<typeof createRoom>>,
  phase: string,
) {
  for (let step = 0; step < 12; step += 1) {
    const snapshot = await stub.snapshotFor("stage");
    if (snapshot.phase === phase) {
      return;
    }
    const moved = await stub.advanceRound({
      ...control(created),
      requestId: crypto.randomUUID(),
      nowMs: Date.now(),
    });
    if (!moved.ok) {
      throw new Error(moved.message);
    }
  }
  throw new Error(`The room did not reach ${phase}.`);
}

async function createRoom() {
  const created = await env.ROOM_CODE_REGISTRY.getByName("codes").createLobby({
    requestId: crypto.randomUUID(),
    digest: await payloadDigest({ action: "create" }),
    now: new Date().toISOString(),
  });
  if (!created.ok) {
    throw new Error(created.message);
  }
  return created.result;
}

function room(gameId: string) {
  return env.PARTY_ROOM.get(env.PARTY_ROOM.idFromName(gameId));
}

function control(created: Awaited<ReturnType<typeof createRoom>>) {
  return {
    credentialId: created.control.credentialId,
    secret: created.control.secret,
  };
}

function guestCookie(joined: {
  gameId: string;
  playerId: string;
  secret: string;
}): string {
  return `26_guest=${joined.gameId}.${joined.playerId}.${joined.secret}`;
}

function socketRequest(gameId: string, cookie: string): Request {
  return new Request(withClientApiQuery(`http://example.com/ws/${gameId}?role=guest`), {
    headers: {
      Upgrade: "websocket",
      Connection: "Upgrade",
      Origin: "http://example.com",
      Cookie: cookie,
    },
  });
}

async function connect(
  stub: ReturnType<typeof room>,
  gameId: string,
  cookie: string,
): Promise<WebSocket> {
  const response = await stub.fetch(socketRequest(gameId, cookie));
  expect(response.status).toBe(101);
  const socket = response.webSocket;
  if (!socket) {
    throw new Error("The room did not return a socket.");
  }
  socket.accept();
  return socket;
}

function nextMatching(
  socket: WebSocket,
  predicate: (message: Record<string, unknown>) => boolean,
): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.removeEventListener("message", onMessage);
      reject(new Error("Timed out waiting for a socket message."));
    }, 5_000);
    function onMessage(event: MessageEvent) {
      const message = JSON.parse(String(event.data)) as Record<string, unknown>;
      if (!predicate(message)) {
        return;
      }
      clearTimeout(timer);
      socket.removeEventListener("message", onMessage);
      resolve(message);
    }
    socket.addEventListener("message", onMessage);
  });
}

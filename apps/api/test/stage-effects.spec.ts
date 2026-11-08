import { env, evictDurableObject } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { withClientApiQuery } from "./client-api-key.ts";
import { payloadDigest } from "../src/room/digest.ts";
import {
  trollAttributionMessage,
  trollMissingMessage,
  trollVoiceMessage,
} from "../src/room/limits.ts";

describe("stage effects", () => {
  it("broadcasts one live draft to the stage and drops it on disconnect, refresh, and skip", async () => {
    const created = await createRoom();
    const stub = room(created.gameId);
    const amina = await join(stub, "Amina");
    const bilal = await join(stub, "Bilal");
    const chen = await join(stub, "Chen");
    await start(stub, created);
    await skipTo(stub, created, "colour");
    await reach(stub, created, "colour", "collect");
    const denied = await connect(stub, created.gameId, guestCookie(amina));
    await nextMatching(denied, (message) => message.kind === "snapshot");
    expect(
      (
        await send(denied, {
          name: "troll",
          effect: "typing",
          targetId: bilal.playerId,
        })
      ).error,
    ).toBe(trollAttributionMessage);
    denied.close();

    await skipTo(stub, created, "candles");
    await reach(stub, created, "candles", "collect");
    const actor = await connect(stub, created.gameId, guestCookie(amina));
    await nextMatching(actor, (message) => message.kind === "snapshot");
    expect(
      (await send(actor, { name: "troll", effect: "typing", targetId: bilal.playerId }))
        .accepted,
    ).toBe(true);
    const queued = await connect(stub, created.gameId, guestCookie(chen));
    await nextMatching(queued, (message) => message.kind === "snapshot");
    expect(
      (
        await send(queued, {
          name: "troll",
          effect: "typing",
          targetId: amina.playerId,
        })
      ).accepted,
    ).toBe(true);
    const effects = (await stub.snapshotFor("control")).hostEffects ?? [];
    expect(
      effects.filter(
        (effect) => effect.label === "Live typing" && effect.status === "active",
      ),
    ).toHaveLength(1);
    expect(
      effects.some(
        (effect) => effect.label === "Live typing" && effect.status === "queued",
      ),
    ).toBe(true);

    const target = await connect(stub, created.gameId, guestCookie(bilal));
    await nextMatching(target, (message) => message.kind === "snapshot");
    target.send(
      JSON.stringify({ kind: "command", name: "draft", text: "stage-only-draft" }),
    );
    await expect
      .poll(async () => (await stub.snapshotFor("stage")).draft?.text)
      .toBe("stage-only-draft");
    const stage = await stub.snapshotFor("stage");
    expect(stage.draft).toEqual({ nickname: "Bilal", text: "stage-only-draft" });
    expect(
      JSON.stringify(await stub.snapshotFor("guest", amina.playerId)),
    ).not.toContain("stage-only-draft");
    expect(JSON.stringify(await stub.snapshotFor("control"))).not.toContain(
      "stage-only-draft",
    );
    expect("adjustments" in stage).toBe(false);
    expect("hostEffects" in stage).toBe(false);

    target.close();
    await expect
      .poll(async () => (await stub.snapshotFor("stage")).draft)
      .toBeUndefined();
    const returned = await connect(stub, created.gameId, guestCookie(bilal));
    await nextMatching(returned, (message) => message.kind === "snapshot");
    returned.send(JSON.stringify({ kind: "command", name: "draft", text: "back" }));
    await expect
      .poll(async () => (await stub.snapshotFor("stage")).draft?.text)
      .toBe("back");
    returned.send(JSON.stringify({ kind: "command", name: "draft", text: "" }));
    await expect
      .poll(async () => (await stub.snapshotFor("stage")).draft)
      .toBeUndefined();

    await evictDurableObject(stub);
    const afterRefresh = await stub.snapshotFor("stage");
    expect(afterRefresh.draft).toBeUndefined();
    expect(
      (await stub.snapshotFor("control")).hostEffects?.some(
        (effect) => effect.label === "Live typing" && effect.status === "active",
      ),
    ).toBe(true);
    await skipTo(stub, created, "letters");
    expect(
      (await stub.snapshotFor("control")).hostEffects?.some(
        (effect) => effect.label === "Live typing",
      ),
    ).toBe(false);
    actor.close();
    queued.close();
    returned.close();
  });

  it("keeps a theme song across questions and plays one cue per score reveal", async () => {
    const created = await createRoom();
    const stub = room(created.gameId);
    const amina = await join(stub, "Amina");
    const bilal = await join(stub, "Bilal");
    const chen = await join(stub, "Chen");
    await start(stub, created);
    await skipTo(stub, created, "colour");
    await reach(stub, created, "colour", "collect");
    const aminaSocket = await connect(stub, created.gameId, guestCookie(amina));
    await nextMatching(aminaSocket, (message) => message.kind === "snapshot");
    expect(
      (
        await send(aminaSocket, {
          name: "troll",
          effect: "double",
          targetId: bilal.playerId,
        })
      ).accepted,
    ).toBe(true);
    const chenSocket = await connect(stub, created.gameId, guestCookie(chen));
    await nextMatching(chenSocket, (message) => message.kind === "snapshot");
    expect(
      (
        await send(chenSocket, {
          name: "troll",
          effect: "theme",
          targetId: bilal.playerId,
        })
      ).accepted,
    ).toBe(true);
    const queuedTheme = (await stub.snapshotFor("control")).hostEffects ?? [];
    expect(
      queuedTheme.some(
        (effect) => effect.label === "Double or nothing" && effect.status === "active",
      ),
    ).toBe(true);
    expect(
      queuedTheme.some(
        (effect) => effect.label === "Theme song" && effect.status === "queued",
      ),
    ).toBe(true);
    aminaSocket.close();
    chenSocket.close();

    const fresh = await createRoom();
    const themeRoom = room(fresh.gameId);
    const host = await join(themeRoom, "Amina");
    const target = await join(themeRoom, "Bilal");
    await start(themeRoom, fresh);
    await skipTo(themeRoom, fresh, "colour");
    await reach(themeRoom, fresh, "colour", "collect");
    const socket = await connect(themeRoom, fresh.gameId, guestCookie(host));
    await nextMatching(socket, (message) => message.kind === "snapshot");
    expect(
      (
        await send(socket, {
          name: "troll",
          effect: "theme",
          targetId: target.playerId,
        })
      ).accepted,
    ).toBe(true);
    expect(
      (await themeRoom.snapshotFor("stage")).trolls.announcement?.audioAsset,
    ).toBeUndefined();
    await reach(themeRoom, fresh, "colour", "scores");
    const first = (await themeRoom.snapshotFor("stage")).trolls.announcement;
    expect(first?.audioAsset).toBe("/assets/theme-song.mp3");
    expect(first?.label).toContain("Bilal");
    await themeRoom.pauseRound({
      ...control(fresh),
      requestId: crypto.randomUUID(),
      nowMs: Date.now(),
    });
    await themeRoom.resumeRound({
      ...control(fresh),
      requestId: crypto.randomUUID(),
      nowMs: Date.now(),
    });
    expect((await themeRoom.snapshotFor("stage")).trolls.announcement?.cueId).toBe(
      first?.cueId,
    );
    await skipTo(themeRoom, fresh, "candles");
    expect(
      (await themeRoom.snapshotFor("control")).hostEffects?.some(
        (effect) => effect.label === "Theme song" && effect.status === "active",
      ),
    ).toBe(true);
    await reach(themeRoom, fresh, "candles", "scores");
    const second = (await themeRoom.snapshotFor("stage")).trolls.announcement;
    expect(second?.audioAsset).toBe("/assets/theme-song.mp3");
    expect(second?.cueId).not.toBe(first?.cueId);
    socket.close();
  });

  it("holds a voice clip until the reveal and drops it if the question is skipped", async () => {
    const created = await createRoom();
    const stub = room(created.gameId);
    const amina = await join(stub, "Amina");
    const bilal = await join(stub, "Bilal");
    await start(stub, created);
    await skipTo(stub, created, "candles");
    await reach(stub, created, "candles", "collect");
    const missing = await connect(stub, created.gameId, guestCookie(amina));
    await nextMatching(missing, (message) => message.kind === "snapshot");
    expect(
      (
        await send(missing, {
          name: "troll",
          effect: "voice",
          targetId: bilal.playerId,
        })
      ).error,
    ).toBe(trollVoiceMessage);
    const mediaId = await acceptVoice(stub, amina);
    expect(
      (
        await send(missing, {
          name: "troll",
          effect: "voice",
          targetId: bilal.playerId,
          mediaId,
        })
      ).accepted,
    ).toBe(true);
    expect((await stub.snapshotFor("stage")).trolls.announcement?.mediaKind).not.toBe(
      "voice",
    );
    await reach(stub, created, "candles", "reveal");
    expect((await stub.snapshotFor("stage")).trolls.announcement).toMatchObject({
      mediaId,
      mediaKind: "voice",
    });
    missing.close();

    const skipped = await createRoom();
    const other = room(skipped.gameId);
    const player = await join(other, "Amina");
    const mate = await join(other, "Bilal");
    await start(other, skipped);
    await skipTo(other, skipped, "candles");
    await reach(other, skipped, "candles", "collect");
    const clip = await acceptVoice(other, player);
    const voice = await connect(other, skipped.gameId, guestCookie(player));
    await nextMatching(voice, (message) => message.kind === "snapshot");
    expect(
      (
        await send(voice, {
          name: "troll",
          effect: "voice",
          targetId: mate.playerId,
          mediaId: clip,
        })
      ).accepted,
    ).toBe(true);
    await skipTo(other, skipped, "letters");
    expect((await other.snapshotFor("stage")).trolls.announcement?.mediaId).not.toBe(
      clip,
    );
    voice.close();
  });

  it("drops a fourth cue and captions an accepted photo", async () => {
    const created = await createRoom();
    const stub = room(created.gameId);
    const players = [];
    for (const nickname of ["Amina", "Bilal", "Chen", "Dana"]) {
      players.push(await join(stub, nickname));
    }
    await start(stub, created);
    await skipTo(stub, created, "colour");
    await reach(stub, created, "colour", "prompt");
    for (const [index, player] of players.entries()) {
      const socket = await connect(stub, created.gameId, guestCookie(player));
      await nextMatching(socket, (message) => message.kind === "snapshot");
      const target = players[(index + 1) % players.length];
      if (!target) {
        throw new Error("The sponsor target is missing.");
      }
      expect(
        (
          await send(socket, {
            name: "troll",
            effect: "sponsor",
            targetId: target.playerId,
          })
        ).accepted,
      ).toBe(true);
      socket.close();
    }
    // A sponsor break opens with its jingle on the stage.
    expect((await stub.snapshotFor("stage")).trolls.announcement?.audioAsset).toBe(
      "/assets/trolls/12_sponsor-break_ad-jingle.mp3",
    );
    for (let step = 0; step < 3; step += 1) {
      expect(
        (
          await stub.hostAction({
            ...control(created),
            requestId: crypto.randomUUID(),
            nowMs: Date.now(),
            action: "dismiss-cue",
          })
        ).ok,
      ).toBe(true);
    }
    const extra = await stub.hostAction({
      ...control(created),
      requestId: crypto.randomUUID(),
      nowMs: Date.now(),
      action: "dismiss-cue",
    });
    expect(extra.ok).toBe(false);
    if (extra.ok) {
      return;
    }
    expect(extra.message).toBe(trollMissingMessage);

    const photo = await acceptPhoto(stub, players[0]);
    expect((await stub.snapshotFor("stage")).trolls.announcement).toMatchObject({
      mediaId: photo,
      mediaKind: "photo",
      assetLabel: "Demo caption",
    });
  });
});

async function acceptVoice(
  stub: ReturnType<typeof room>,
  player: { playerId: string; secret: string },
) {
  const reserved = await stub.reserveMedia({
    playerId: player.playerId,
    secret: player.secret,
    requestId: crypto.randomUUID(),
    kind: "voice",
    nowMs: Date.now(),
  });
  if (!reserved.ok) {
    throw new Error(reserved.message);
  }
  const claimed = await stub.claimMedia({
    playerId: player.playerId,
    secret: player.secret,
    uploadId: reserved.uploadId,
    nowMs: Date.now(),
  });
  if (!claimed.ok) {
    throw new Error(claimed.message);
  }
  await stub.stageMedia({
    uploadId: reserved.uploadId,
    byteLength: 100,
    width: null,
    height: null,
    durationMs: 1000,
    contentType: "audio/wav",
  });
  const committed = await stub.commitMedia({ uploadId: reserved.uploadId });
  if (!committed.ok) {
    throw new Error(committed.message);
  }
  return committed.mediaId;
}

async function acceptPhoto(
  stub: ReturnType<typeof room>,
  player: { playerId: string; secret: string } | undefined,
) {
  if (!player) {
    throw new Error("The photo player is missing.");
  }
  const reserved = await stub.reserveMedia({
    playerId: player.playerId,
    secret: player.secret,
    requestId: crypto.randomUUID(),
    kind: "photo",
    nowMs: Date.now(),
  });
  if (!reserved.ok) {
    throw new Error(reserved.message);
  }
  const claimed = await stub.claimMedia({
    playerId: player.playerId,
    secret: player.secret,
    uploadId: reserved.uploadId,
    nowMs: Date.now(),
  });
  if (!claimed.ok) {
    throw new Error(claimed.message);
  }
  await stub.stageMedia({
    uploadId: reserved.uploadId,
    byteLength: 100,
    width: 2,
    height: 2,
    durationMs: null,
    contentType: "image/jpeg",
  });
  const committed = await stub.commitMedia({ uploadId: reserved.uploadId });
  if (!committed.ok) {
    throw new Error(committed.message);
  }
  return committed.mediaId;
}

async function start(
  stub: ReturnType<typeof room>,
  created: Awaited<ReturnType<typeof createRoom>>,
) {
  const started = await stub.startDemo({
    ...control(created),
    requestId: crypto.randomUUID(),
    nowMs: Date.now(),
  });
  if (!started.ok) {
    throw new Error(started.message);
  }
}

async function skipTo(
  stub: ReturnType<typeof room>,
  created: Awaited<ReturnType<typeof createRoom>>,
  questionId: string,
) {
  for (let step = 0; step < 8; step += 1) {
    const snapshot = await stub.snapshotFor("stage");
    if (snapshot.play?.question.id === questionId) {
      return;
    }
    const moved = await stub.skipRound({
      ...control(created),
      requestId: crypto.randomUUID(),
      nowMs: Date.now(),
    });
    if (!moved.ok) {
      throw new Error(moved.message);
    }
  }
  throw new Error(`The room did not skip to ${questionId}.`);
}

async function reach(
  stub: ReturnType<typeof room>,
  created: Awaited<ReturnType<typeof createRoom>>,
  questionId: string,
  phase: string,
) {
  for (let step = 0; step < 8; step += 1) {
    const snapshot = await stub.snapshotFor("stage");
    if (snapshot.play?.question.id === questionId && snapshot.phase === phase) {
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
  throw new Error(`The room did not reach ${questionId} ${phase}.`);
}

async function send(
  socket: WebSocket,
  command: { name: "troll"; effect: string; targetId: string; mediaId?: string },
) {
  const requestId = crypto.randomUUID();
  socket.send(JSON.stringify({ kind: "command", requestId, ...command }));
  const message = await nextMatching(
    socket,
    (item) => item.kind === "ack" && item.requestId === requestId,
  );
  return message as { accepted?: boolean; error?: string; message?: string };
}

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

async function connect(
  stub: ReturnType<typeof room>,
  gameId: string,
  cookie: string,
): Promise<WebSocket> {
  const response = await stub.fetch(
    new Request(withClientApiQuery(`http://example.com/ws/${gameId}?role=guest`), {
      headers: {
        Upgrade: "websocket",
        Connection: "Upgrade",
        Origin: "http://example.com",
        Cookie: cookie,
      },
    }),
  );
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

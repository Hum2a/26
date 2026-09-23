import { env, evictDurableObject } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { withClientApiQuery } from "./client-api-key.ts";
import type { PlaySnapshot } from "@26/shared";
import { payloadDigest } from "../src/room/digest.ts";
import {
  answerClosedMessage,
  answerDuplicateMessage,
  answerPausedMessage,
  ballotClosedMessage,
  ballotLateJoinMessage,
  ballotSelfMessage,
  ballotUnknownMessage,
  ballotWithdrawnMessage,
  featureClosedMessage,
  shortlistClosedMessage,
  textInvalidMessage,
} from "../src/room/limits.ts";

describe("room-wide voting", () => {
  it("freezes one tally, keeps card order, and scores ties and a named guess", async () => {
    const created = await createRoom();
    const stub = room(created.gameId);
    expect(
      (
        await stub.startDemo({
          ...control(created),
          requestId: crypto.randomUUID(),
          nowMs: Date.now(),
        })
      ).ok,
    ).toBe(true);
    const amina = await join(stub, "Amina");
    const bilal = await join(stub, "Bilal");
    const chen = await join(stub, "Chen");
    await reach(stub, created, "toast", "collect");

    const earlyInclude = await stub.hostAction({
      ...control(created),
      requestId: crypto.randomUUID(),
      nowMs: Date.now(),
      action: "include",
      playerId: amina.playerId,
    });
    expect(earlyInclude.ok).toBe(false);
    if (!earlyInclude.ok) {
      expect(earlyInclude.message).toBe(shortlistClosedMessage);
    }

    const aminaSocket = await connect(stub, created.gameId, guestCookie(amina));
    await nextMatching(aminaSocket, (message) => message.kind === "snapshot");
    for (const body of ["", "   ", "line\nbreak", "x".repeat(81), 4]) {
      const rejected = await send(aminaSocket, { name: "text", body });
      expect(rejected.accepted).toBe(false);
      expect(rejected.error).toBe(textInvalidMessage);
    }
    expect(
      (await send(aminaSocket, { name: "text", body: "Cheers Amina" })).accepted,
    ).toBe(true);
    expect(
      (await send(aminaSocket, { name: "text", body: "Cheers Amina" })).error,
    ).toBe(answerDuplicateMessage);
    expect(
      (await send(aminaSocket, { name: "ballot", candidateId: crypto.randomUUID() }))
        .error,
    ).toBe(ballotClosedMessage);
    aminaSocket.close();

    const bilalSocket = await connect(stub, created.gameId, guestCookie(bilal));
    await nextMatching(bilalSocket, (message) => message.kind === "snapshot");
    expect(
      (await send(bilalSocket, { name: "text", body: "Cheers Bilal" })).accepted,
    ).toBe(true);
    bilalSocket.close();

    const dara = await join(stub, "Dara");
    const daraSocket = await connect(stub, created.gameId, guestCookie(dara));
    await nextMatching(daraSocket, (message) => message.kind === "snapshot");
    expect(
      (await send(daraSocket, { name: "text", body: "Cheers Dara" })).accepted,
    ).toBe(true);
    daraSocket.close();

    await reach(stub, created, "toast", "vote");
    const voting = await connect(stub, created.gameId, guestCookie(amina));
    await nextMatching(voting, (message) => message.kind === "snapshot");
    expect((await send(voting, { name: "text", body: "Too late" })).error).toBe(
      answerClosedMessage,
    );
    const open = await stub.snapshotFor("guest", amina.playerId);
    const cards = ballotCards(open.play);
    expect(cards.map((card) => card.author)).toEqual([null, null, null]);
    expect(JSON.stringify(open)).not.toContain("truthNickname");
    const order = cards.map((card) => card.id);
    const own = cards.find((card) => card.label === "Cheers Amina");
    const bilalCard = cards.find((card) => card.label === "Cheers Bilal");
    const daraCard = cards.find((card) => card.label === "Cheers Dara");
    if (!own || !bilalCard || !daraCard) {
      throw new Error("The ballot did not freeze every line.");
    }
    expect(own.own).toBe(true);
    expect(own.selectable).toBe(false);
    expect((await send(voting, { name: "ballot", candidateId: own.id })).error).toBe(
      ballotSelfMessage,
    );
    expect(
      (await send(voting, { name: "ballot", candidateId: crypto.randomUUID() })).error,
    ).toBe(ballotUnknownMessage);

    expect(
      (
        await stub.hostAction({
          ...control(created),
          requestId: crypto.randomUUID(),
          nowMs: Date.now(),
          action: "kick",
          playerId: dara.playerId,
        })
      ).ok,
    ).toBe(true);
    const afterKick = ballotCards(
      (await stub.snapshotFor("guest", amina.playerId)).play,
    );
    expect(afterKick.map((card) => card.id)).toEqual(order);
    expect(afterKick.find((card) => card.id === daraCard.id)?.selectable).toBe(false);
    expect(
      (await send(voting, { name: "ballot", candidateId: daraCard.id })).error,
    ).toBe(ballotWithdrawnMessage);

    const requestId = crypto.randomUUID();
    const accepted = await send(
      voting,
      { name: "ballot", candidateId: bilalCard.id },
      requestId,
    );
    expect(accepted.accepted).toBe(true);
    expect(
      (await send(voting, { name: "ballot", candidateId: bilalCard.id }, requestId))
        .accepted,
    ).toBe(true);
    voting.close();
    await evictDurableObject(stub);
    const restored = await stub.snapshotFor("guest", amina.playerId);
    expect(restored.play?.selfBallot).toEqual({ candidateId: bilalCard.id });
    expect(restored.play?.selfAward).toBeNull();
    expect(ballotCards(restored.play).map((card) => card.id)).toEqual(order);

    const again = await connect(stub, created.gameId, guestCookie(amina));
    await nextMatching(again, (message) => message.kind === "snapshot");
    expect(
      (await send(again, { name: "ballot", candidateId: bilalCard.id })).error,
    ).toBe(answerDuplicateMessage);
    again.close();

    const bilalVote = await connect(stub, created.gameId, guestCookie(bilal));
    await nextMatching(bilalVote, (message) => message.kind === "snapshot");
    const bilalCards = ballotCards(
      (await stub.snapshotFor("guest", bilal.playerId)).play,
    );
    const aminaCard = bilalCards.find((card) => card.label === "Cheers Amina");
    if (!aminaCard) {
      throw new Error("Bilal cannot see Amina's line.");
    }
    expect(
      (await send(bilalVote, { name: "ballot", candidateId: aminaCard.id })).accepted,
    ).toBe(true);
    bilalVote.close();
    expect(
      ballotCards((await stub.snapshotFor("guest", amina.playerId)).play).map(
        (card) => card.id,
      ),
    ).toEqual(order);

    expect(
      (
        await stub.pauseRound({
          ...control(created),
          requestId: crypto.randomUUID(),
          nowMs: Date.now(),
        })
      ).ok,
    ).toBe(true);
    const chenSocket = await connect(stub, created.gameId, guestCookie(chen));
    await nextMatching(chenSocket, (message) => message.kind === "snapshot");
    expect(
      (await send(chenSocket, { name: "ballot", candidateId: aminaCard.id })).error,
    ).toBe(answerPausedMessage);
    chenSocket.close();
    expect(
      (
        await stub.resumeRound({
          ...control(created),
          requestId: crypto.randomUUID(),
          nowMs: Date.now(),
        })
      ).ok,
    ).toBe(true);

    const esha = await join(stub, "Esha");
    const eshaSocket = await connect(stub, created.gameId, guestCookie(esha));
    await nextMatching(eshaSocket, (message) => message.kind === "snapshot");
    expect(
      (await send(eshaSocket, { name: "ballot", candidateId: bilalCard.id })).error,
    ).toBe(ballotLateJoinMessage);
    eshaSocket.close();

    await reach(stub, created, "toast", "reveal");
    const revealed = await stub.snapshotFor("stage");
    expect(revealed.play?.reveal?.kind).toBe("vote");
    if (revealed.play?.reveal?.kind !== "vote") {
      throw new Error("The toast reveal was missing.");
    }
    expect(revealed.play.reveal.winnerCount).toBe(2);
    expect(revealed.play.reveal.cards.some((card) => card.author === "Amina")).toBe(
      true,
    );
    expect(points(revealed, "Amina")).toBe(60);
    expect(points(revealed, "Bilal")).toBe(60);
    expect((await stub.scoreRecord()).total).toBe(120);
    const scored = await stub.rescoreCurrent();
    expect(await stub.rescoreCurrent()).toEqual(scored);
    await evictDurableObject(stub);
    expect((await stub.scoreRecord()).total).toBe(120);

    const featured = await stub.hostAction({
      ...control(created),
      requestId: crypto.randomUUID(),
      nowMs: Date.now(),
      action: "feature",
      candidateId: own.id,
    });
    expect(featured.ok).toBe(true);
    const curated = await stub.snapshotFor("stage");
    if (curated.play?.reveal?.kind !== "vote") {
      throw new Error("The curated reveal was missing.");
    }
    expect(curated.play.reveal.featured).toBe(true);
    expect(curated.play.reveal.cards.map((card) => card.id)).toEqual([own.id]);
    expect(curated.play.reveal.winnerCount).toBe(2);
    expect((await stub.scoreRecord()).total).toBe(120);
    expect((await stub.rescoreCurrent()).total).toBe(120);

    await reach(stub, created, "picks", "collect");
    const picksAmina = await connect(stub, created.gameId, guestCookie(amina));
    await nextMatching(picksAmina, (message) => message.kind === "snapshot");
    expect(
      (await send(picksAmina, { name: "text", body: "Spare Amina" })).accepted,
    ).toBe(true);
    picksAmina.close();
    const picksBilal = await connect(stub, created.gameId, guestCookie(bilal));
    await nextMatching(picksBilal, (message) => message.kind === "snapshot");
    expect(
      (await send(picksBilal, { name: "text", body: "Spare Bilal" })).accepted,
    ).toBe(true);
    picksBilal.close();
    const beforeShortlist = await stub.snapshotFor("control");
    expect(beforeShortlist.play?.hostResponses?.map((row) => row.included)).toEqual([
      false,
      false,
    ]);
    expect(
      (
        await stub.hostAction({
          ...control(created),
          requestId: crypto.randomUUID(),
          nowMs: Date.now(),
          action: "feature",
          candidateId: "not-a-card",
        })
      ).ok,
    ).toBe(false);
    const featureEarly = await stub.hostAction({
      ...control(created),
      requestId: crypto.randomUUID(),
      nowMs: Date.now(),
      action: "feature",
      candidateId: "c0123456789",
    });
    expect(featureEarly.ok).toBe(false);
    if (!featureEarly.ok) {
      expect(featureEarly.message).toBe(featureClosedMessage);
    }
    expect(
      (
        await stub.hostAction({
          ...control(created),
          requestId: crypto.randomUUID(),
          nowMs: Date.now(),
          action: "include",
          playerId: bilal.playerId,
        })
      ).ok,
    ).toBe(true);
    const shortlist = await stub.snapshotFor("control");
    expect(
      shortlist.play?.hostResponses?.find((row) => row.nickname === "Bilal")?.included,
    ).toBe(true);
    expect(
      shortlist.play?.hostResponses?.find((row) => row.nickname === "Amina")?.included,
    ).toBe(false);

    await reach(stub, created, "picks", "vote");
    const picksVote = await stub.snapshotFor("guest", amina.playerId);
    expect(picksVote.play?.ballot?.total).toBe(1);
    expect(picksVote.play?.ballot?.cards.map((card) => card.label)).toEqual([
      "Spare Bilal",
    ]);
    const picksSocket = await connect(stub, created.gameId, guestCookie(amina));
    await nextMatching(picksSocket, (message) => message.kind === "snapshot");
    const spare = picksVote.play?.ballot?.cards[0];
    if (!spare) {
      throw new Error("The shortlist was empty.");
    }
    expect(
      (await send(picksSocket, { name: "ballot", candidateId: spare.id })).accepted,
    ).toBe(true);
    picksSocket.close();
    await evictDurableObject(stub);
    expect((await stub.snapshotFor("guest", amina.playerId)).play?.selfBallot).toEqual({
      candidateId: spare.id,
    });

    await reach(stub, created, "picks", "reveal");
    const picksReveal = await stub.snapshotFor("stage");
    if (picksReveal.play?.reveal?.kind !== "vote") {
      throw new Error("The shortlist reveal was missing.");
    }
    expect(picksReveal.play.reveal.cards.every((card) => card.author === null)).toBe(
      true,
    );
    expect(picksReveal.play.reveal.cards.every((card) => card.voters === null)).toBe(
      true,
    );
    expect(points(picksReveal, "Bilal")).toBe(100);
    expect(points(picksReveal, "Amina")).toBe(60);
    expect((await stub.scoreRecord()).total).toBe(160);

    await reach(stub, created, "who", "collect");
    const guessOpen = await stub.snapshotFor("guest", amina.playerId);
    expect(JSON.stringify(guessOpen)).not.toContain("truthNickname");
    expect(JSON.stringify(guessOpen)).not.toContain("truthLabel");
    const roster = ballotCards(guessOpen.play);
    expect(roster.find((card) => card.label === "Bilal")?.id).toBe(bilal.playerId);
    expect(roster.find((card) => card.own)?.selectable).toBe(false);
    const guessBilal = await connect(stub, created.gameId, guestCookie(bilal));
    await nextMatching(guessBilal, (message) => message.kind === "snapshot");
    expect(
      (await send(guessBilal, { name: "ballot", candidateId: bilal.playerId })).error,
    ).toBe(ballotSelfMessage);
    expect(
      (await send(guessBilal, { name: "ballot", candidateId: amina.playerId }))
        .accepted,
    ).toBe(true);
    guessBilal.close();
    const guessAmina = await connect(stub, created.gameId, guestCookie(amina));
    await nextMatching(guessAmina, (message) => message.kind === "snapshot");
    expect(
      (await send(guessAmina, { name: "ballot", candidateId: bilal.playerId }))
        .accepted,
    ).toBe(true);
    guessAmina.close();
    const guessChen = await connect(stub, created.gameId, guestCookie(chen));
    await nextMatching(guessChen, (message) => message.kind === "snapshot");
    expect(
      (await send(guessChen, { name: "ballot", candidateId: amina.playerId })).accepted,
    ).toBe(true);
    guessChen.close();
    const beforeGuess = points(await stub.snapshotFor("stage"), "Amina");

    await reach(stub, created, "who", "reveal");
    const guessed = await stub.snapshotFor("stage");
    if (guessed.play?.reveal?.kind !== "guess") {
      throw new Error("The guess reveal was missing.");
    }
    expect(guessed.play.reveal.truthLabel).toBe("Bilal");
    expect(points(guessed, "Amina")).toBe((beforeGuess ?? 0) + 80);
    expect(points(guessed, "Bilal")).toBe(100);
    expect(points(guessed, "Chen")).toBe(0);
    expect((await stub.scoreRecord()).total).toBe(240);
    const finalScore = await stub.rescoreCurrent();
    expect(await stub.rescoreCurrent()).toEqual(finalScore);
    await evictDurableObject(stub);
    expect(
      (await stub.snapshotFor("guest", amina.playerId)).play?.selfBallot?.candidateId,
    ).toBe(bilal.playerId);
    expect((await stub.scoreRecord()).total).toBe(240);
  }, 60_000);

  it("keeps an empty shortlist and every submitted line", async () => {
    const created = await createRoom();
    const stub = room(created.gameId);
    expect(
      (
        await stub.startDemo({
          ...control(created),
          requestId: crypto.randomUUID(),
          nowMs: Date.now(),
        })
      ).ok,
    ).toBe(true);
    const amina = await join(stub, "Amina");
    for (let step = 0; step < 6; step += 1) {
      expect(
        (
          await stub.skipRound({
            ...control(created),
            requestId: crypto.randomUUID(),
            nowMs: Date.now(),
          })
        ).ok,
      ).toBe(true);
    }
    await reach(stub, created, "picks", "collect");
    const socket = await connect(stub, created.gameId, guestCookie(amina));
    await nextMatching(socket, (message) => message.kind === "snapshot");
    expect((await send(socket, { name: "text", body: "Kept line" })).accepted).toBe(
      true,
    );
    socket.close();
    await reach(stub, created, "picks", "vote");
    const vote = await stub.snapshotFor("guest", amina.playerId);
    expect(vote.play?.ballot).toMatchObject({ total: 0, reason: "empty", cards: [] });
    const host = await stub.snapshotFor("control");
    expect(host.play?.hostResponses).toEqual([
      expect.objectContaining({
        nickname: "Amina",
        summary: "Kept line",
        included: false,
      }),
    ]);
    const late = await stub.hostAction({
      ...control(created),
      requestId: crypto.randomUUID(),
      nowMs: Date.now(),
      action: "include",
      playerId: amina.playerId,
    });
    expect(late.ok).toBe(false);
    if (!late.ok) {
      expect(late.message).toBe(shortlistClosedMessage);
    }
  });

  it("writes no score when a vote question is skipped before the reveal", async () => {
    const created = await createRoom();
    const stub = room(created.gameId);
    expect(
      (
        await stub.startDemo({
          ...control(created),
          requestId: crypto.randomUUID(),
          nowMs: Date.now(),
        })
      ).ok,
    ).toBe(true);
    const amina = await join(stub, "Amina");
    for (let step = 0; step < 5; step += 1) {
      expect(
        (
          await stub.skipRound({
            ...control(created),
            requestId: crypto.randomUUID(),
            nowMs: Date.now(),
          })
        ).ok,
      ).toBe(true);
    }
    await reach(stub, created, "toast", "collect");
    const socket = await connect(stub, created.gameId, guestCookie(amina));
    await nextMatching(socket, (message) => message.kind === "snapshot");
    expect((await send(socket, { name: "text", body: "Skipped line" })).accepted).toBe(
      true,
    );
    socket.close();
    expect((await stub.scoreRecord()).rows).toBe(0);
    expect(
      (
        await stub.skipRound({
          ...control(created),
          requestId: crypto.randomUUID(),
          nowMs: Date.now(),
        })
      ).ok,
    ).toBe(true);
    expect((await stub.snapshotFor("stage")).play?.question.id).toBe("picks");
    expect((await stub.scoreRecord()).rows).toBe(0);
  });
});

function ballotCards(play: PlaySnapshot | null | undefined) {
  return play?.ballot?.cards ?? [];
}

function points(
  snapshot: { play: PlaySnapshot | null },
  nickname: string,
): number | undefined {
  return snapshot.play?.standings?.find((row) => row.nickname === nickname)?.points;
}

async function reach(
  stub: ReturnType<typeof room>,
  created: Awaited<ReturnType<typeof createRoom>>,
  questionId: string,
  phase: string,
) {
  for (let step = 0; step < 48; step += 1) {
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
  command: { name: "text"; body: unknown } | { name: "ballot"; candidateId: unknown },
  requestId = crypto.randomUUID(),
) {
  socket.send(JSON.stringify({ kind: "command", requestId, ...command }));
  return nextMatching(
    socket,
    (message) => message.kind === "ack" && message.requestId === requestId,
  );
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

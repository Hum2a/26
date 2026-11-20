import { env, runInDurableObject } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { withClientApiQuery } from "./client-api-key.ts";
import { toPlayable } from "../src/questions/authoring.ts";
import { bestDressed } from "../src/questions/packs/birthday/best-dressed.ts";
import { birthdayPack } from "../src/questions/packs/birthday/manifest.ts";
import { validatePack } from "../src/questions/validate.ts";
import { adminQuestion } from "../src/room/admin-question.ts";
import { questionPreview } from "../src/room/question-preview.ts";

function room(gameId: string) {
  return env.PARTY_ROOM.get(env.PARTY_ROOM.idFromName(gameId));
}

function guestCookie(joined: {
  gameId: string;
  playerId: string;
  secret: string;
}): string {
  return `26_guest=${joined.gameId}.${joined.playerId}.${joined.secret}`;
}

async function connectGuest(
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
  if (!socket) throw new Error("Expected a guest socket.");
  const initial = nextMatching(socket, (message) => message.kind === "snapshot");
  socket.accept();
  await initial;
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
      if (!predicate(message)) return;
      clearTimeout(timer);
      socket.removeEventListener("message", onMessage);
      resolve(message);
    }
    socket.addEventListener("message", onMessage);
  });
}

function sendCommand(
  socket: WebSocket,
  payload: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const requestId = crypto.randomUUID();
  const ack = nextMatching(
    socket,
    (message) => message.kind === "ack" && message.requestId === requestId,
  );
  socket.send(JSON.stringify({ kind: "command", requestId, ...payload }));
  return ack;
}

describe("best dressed round", () => {
  it("sits at the end of the birthday order after kart-sprint and exposes clean admin details", () => {
    expect(birthdayPack.order.slice(-2)).toEqual(["kart-sprint", "best-dressed"]);
    expect(validatePack(birthdayPack).filter((i) => i.level === "error")).toEqual([]);
    expect(toPlayable(bestDressed)).toMatchObject({
      id: "best-dressed",
      kind: "guess",
      roster: "room",
      scoring: "majority",
      award: "nominees",
      selfVote: "allowed",
      points: 100,
      collectMs: 30_000,
    });
    const detail = adminQuestion(birthdayPack, bestDressed);
    expect(detail?.question.settings).toEqual(
      expect.arrayContaining([
        { label: "Award", value: "nominees" },
        { label: "Self vote", value: "allowed" },
      ]),
    );
    expect(detail?.question.answer.lines).toContain(
      "Most-voted player receives the full points; each tied winner receives the full points (not split).",
    );
    const preview = questionPreview(birthdayPack, bestDressed);
    expect(preview.interactive).toBe(true);
    expect(preview.question).toMatchObject({
      kind: "guess",
      award: "nominees",
      selfVote: "allowed",
    });
  });

  it("lets every guest vote (including self-votes) and awards points to the most-voted nominee", async () => {
    const registry = env.ROOM_CODE_REGISTRY.getByName("codes");
    const order = await registry.birthdayOrder();
    const saved = await registry.updateBirthdayOrder(
      {
        requestId: crypto.randomUUID(),
        expectedRevision: order.revision,
        ids: ["best-dressed"],
      },
      Date.now(),
    );
    if ("error" in saved) throw new Error(saved.message);
    const now = Date.now();
    const made = await registry.createLobby({
      requestId: crypto.randomUUID(),
      digest: "best-dressed-test",
      now: new Date(now).toISOString(),
    });
    if (!made.ok) throw new Error(made.message);
    const stub = room(made.result.gameId);
    const control = {
      credentialId: made.result.control.credentialId,
      secret: made.result.control.secret,
    };

    const amina = await stub.joinPlayer({
      nickname: "Amina",
      requestId: crypto.randomUUID(),
      now: new Date(now).toISOString(),
    });
    const bilal = await stub.joinPlayer({
      nickname: "Bilal",
      requestId: crypto.randomUUID(),
      now: new Date(now).toISOString(),
    });
    const chen = await stub.joinPlayer({
      nickname: "Chen",
      requestId: crypto.randomUUID(),
      now: new Date(now).toISOString(),
    });
    if (!amina.ok || !bilal.ok || !chen.ok) throw new Error("Failed to join players.");

    expect(
      (
        await stub.startBirthday({
          ...control,
          requestId: crypto.randomUUID(),
          nowMs: now,
        })
      ).ok,
    ).toBe(true);
    // intro -> prompt -> collect
    await stub.advanceRound({
      ...control,
      requestId: crypto.randomUUID(),
      nowMs: now + 1,
    });
    await stub.advanceRound({
      ...control,
      requestId: crypto.randomUUID(),
      nowMs: now + 2,
    });

    const aminaSnap = await stub.snapshotFor("guest", amina.playerId);
    expect(aminaSnap.phase).toBe("collect");
    expect(aminaSnap.play?.question).toMatchObject({
      id: "best-dressed",
      kind: "guess",
      award: "nominees",
      selfVote: "allowed",
    });
    // All three players are selectable, including Amina's own card.
    expect(aminaSnap.play?.ballot?.cards.every((c) => c.selectable)).toBe(true);

    const aminaSock = await connectGuest(stub, made.result.gameId, guestCookie(amina));
    const bilalSock = await connectGuest(stub, made.result.gameId, guestCookie(bilal));
    const chenSock = await connectGuest(stub, made.result.gameId, guestCookie(chen));

    try {
      // Amina self-votes for Amina; Bilal votes for Amina; Chen votes for Bilal.
      expect(
        (
          await sendCommand(aminaSock, {
            name: "ballot",
            candidateId: amina.playerId,
          })
        ).accepted,
      ).toBe(true);
      expect(
        (
          await sendCommand(bilalSock, {
            name: "ballot",
            candidateId: amina.playerId,
          })
        ).accepted,
      ).toBe(true);
      expect(
        (
          await sendCommand(chenSock, {
            name: "ballot",
            candidateId: bilal.playerId,
          })
        ).accepted,
      ).toBe(true);
    } finally {
      aminaSock.close();
      bilalSock.close();
      chenSock.close();
    }

    // collect -> reveal
    await stub.advanceRound({
      ...control,
      requestId: crypto.randomUUID(),
      nowMs: now + 3,
    });

    const aminaReveal = await stub.snapshotFor("guest", amina.playerId);
    const bilalReveal = await stub.snapshotFor("guest", bilal.playerId);
    const chenReveal = await stub.snapshotFor("guest", chen.playerId);
    expect(aminaReveal.phase).toBe("reveal");
    // Amina (most-voted nominee) receives 100 points; Bilal (who voted for Amina) gets 0.
    expect(aminaReveal.play?.selfAward).toBe(100);
    expect(bilalReveal.play?.selfAward).toBe(0);
    expect(chenReveal.play?.selfAward).toBe(0);

    const stageReveal = await stub.snapshotFor("stage");
    expect(stageReveal.play?.reveal).toMatchObject({
      kind: "guess",
      totalBallots: 3,
      winnerCount: 1,
      winners: [{ id: amina.playerId, label: "Amina" }],
    });
    if (stageReveal.play?.reveal?.kind === "guess") {
      expect(stageReveal.play.reveal.cards.every((c) => c.author === null)).toBe(true);
    }

    await runInDurableObject(stub, (_instance, state) => {
      const ledger = state.storage.sql
        .exec<{ player_id: string; points: number; detail: string }>(
          `SELECT player_id, points, detail FROM score_ledger WHERE question_id = 'best-dressed'`,
        )
        .toArray();
      expect(ledger.find((r) => r.player_id === amina.playerId)).toMatchObject({
        points: 100,
        detail: "win",
      });
      expect(ledger.find((r) => r.player_id === bilal.playerId)).toMatchObject({
        points: 0,
        detail: "miss",
      });
    });
  });
});

import { env, runInDurableObject } from "cloudflare:test";
import { encode } from "jpeg-js";
import { describe, expect, it } from "vitest";
import { withClientApiQuery } from "./client-api-key.ts";
import { finaliseUpload, type MediaBook } from "../src/media/finalise.ts";
import { localJpegPhoto } from "../src/media/photo.ts";
import { memoryObjectStore } from "../src/media/store.ts";
import { payloadDigest } from "../src/room/digest.ts";

const guestCount = positive(process.env.LOAD_GUESTS, 75);
const uploadCount = positive(process.env.LOAD_UPLOADS, 8);

describe("synthetic room load", () => {
  it("runs a 75-guest burst, uploads, reconnects, and a full round soak", async () => {
    const created = await createRoom();
    const stub = room(created.gameId);
    const players: { gameId: string; playerId: string; secret: string }[] = [];
    for (let index = 0; index < guestCount; index += 15) {
      const batch = await Promise.all(
        Array.from({ length: Math.min(15, guestCount - index) }, (_, offset) =>
          join(stub, `Load ${index + offset + 1}`),
        ),
      );
      players.push(...batch);
    }
    expect(players).toHaveLength(guestCount);
    const sockets = [];
    for (const player of players) {
      const socket = await connect(stub, created.gameId, guestCookie(player));
      await nextMatching(socket, (message) => message.kind === "snapshot", 15_000);
      sockets.push(socket);
    }

    const started = await stub.startDemo({
      ...control(created),
      requestId: crypto.randomUUID(),
      nowMs: Date.now(),
    });
    expect(started.ok).toBe(true);
    await reach(stub, created, "shape", "collect");
    const hidden = JSON.stringify(await stub.snapshotFor("stage"));
    expect(hidden).not.toContain("correctOptionId");
    expect(hidden).not.toContain("truthNickname");
    expect(hidden).not.toContain("demo-answer-key-v1");

    const stageSocket = await connect(
      stub,
      created.gameId,
      presentationCookie(created),
      "stage",
    );
    const stageFrames = collectSnapshots(stageSocket);
    await nextMatching(stageSocket, (message) => message.kind === "snapshot", 15_000);
    const clock = await stub.snapshotFor("stage");
    const remainingMs =
      clock.deadlineAt === null ? 0 : Math.max(0, clock.deadlineAt - clock.serverNow);
    const samples = await burst(sockets, () => ({
      name: "answer",
      optionId: "circle",
    }));
    const burstMs = Math.max(...samples.map((sample) => sample.ms));
    const accepted = samples.filter((sample) => sample.accepted).length;
    const errors = samples.length - accepted;
    expect(samples.find((sample) => !sample.accepted)?.error ?? "").toBe("");
    expect(errors).toBe(0);
    expect(accepted).toBe(guestCount);
    await expect
      .poll(() => stageFrames.at(-1)?.play?.submissionCount, { timeout: 15_000 })
      .toBe(guestCount);

    const stageBegan = performance.now();
    const during = await stub.snapshotFor("stage");
    const stageMs = performance.now() - stageBegan;
    expect(during.play?.submissionCount).toBe(guestCount);
    expect(during.players).toHaveLength(guestCount);
    const timerLatenessMs = await phaseLateness(
      stub,
      "shape",
      "collect",
      clock.deadlineAt,
    );

    await reach(stub, created, "candles", "collect");
    const typed = await oneAck(sockets[1]!, {
      name: "troll",
      effect: "typing",
      targetId: players[0]!.playerId,
    });
    expect(typed.error ?? "").toBe("");
    expect(typed.accepted).toBe(true);
    const draft = "typing from the first phone";
    sockets[0]?.send(JSON.stringify({ kind: "command", name: "draft", text: draft }));
    let seenDraft = false;
    for (let attempt = 0; attempt < 20 && !seenDraft; attempt += 1) {
      const stage = await stub.snapshotFor("stage");
      seenDraft = stage.draft?.text === draft;
    }
    expect(seenDraft).toBe(true);

    await reach(stub, created, "who", "collect");
    const voteClock = await stub.snapshotFor("stage");
    const voteSamples = await burst(sockets, (index) => ({
      name: "ballot",
      candidateId: players[index === 0 ? 1 : 0]!.playerId,
    }));
    const voteBurstMs = Math.max(...voteSamples.map((sample) => sample.ms));
    const voteErrors = voteSamples.filter((sample) => !sample.accepted).length;
    expect(voteSamples.find((sample) => !sample.accepted)?.error ?? "").toBe("");
    expect(voteErrors).toBe(0);

    const reconnects = [];
    for (const socket of sockets.slice(0, 8)) {
      socket.close();
    }
    for (const player of players.slice(0, 8)) {
      const socket = await connect(stub, created.gameId, guestCookie(player));
      await nextMatching(socket, (message) => message.kind === "snapshot");
      reconnects.push(socket);
    }
    expect(reconnects).toHaveLength(8);
    const firstSummary = await stub.readGameplayContext(players[0]!.playerId);
    expect(firstSummary.connection?.socketOpens).toBe(2);
    expect(firstSummary.connection?.reconnects).toBe(1);

    const store = memoryObjectStore();
    const uploads = await Promise.all(
      players.slice(0, uploadCount).map(async (player) => {
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
        await store.put(reserved.tempKey, tinyJpeg(), {
          contentType: "image/jpeg",
          ifNoneMatch: false,
        });
        return finaliseUpload({
          book: book(stub, player),
          store,
          uploadId: reserved.uploadId,
          playerId: player.playerId,
          nowMs: Date.now(),
          photo: localJpegPhoto,
        });
      }),
    );
    expect(uploads.every((upload) => upload.ok)).toBe(true);

    for (const socket of [stageSocket, ...sockets, ...reconnects]) {
      socket.close();
    }

    await reach(stub, created, "finale", "podium");
    const counts = await sizes(stub);
    const summary = {
      environment: "cloudflare vitest local durable object, not production",
      guests: guestCount,
      uploads: uploadCount,
      burstMs: Math.round(burstMs),
      ackMs: {
        p50: percentile(
          samples.map((sample) => sample.ms),
          50,
        ),
        p95: percentile(
          samples.map((sample) => sample.ms),
          95,
        ),
        p99: percentile(
          samples.map((sample) => sample.ms),
          99,
        ),
      },
      voteBurstMs: Math.round(voteBurstMs),
      voteAckMs: {
        p50: percentile(
          voteSamples.map((sample) => sample.ms),
          50,
        ),
        p95: percentile(
          voteSamples.map((sample) => sample.ms),
          95,
        ),
        p99: percentile(
          voteSamples.map((sample) => sample.ms),
          99,
        ),
      },
      errors,
      voteErrors,
      collectRemainingMsAtBurst: Math.round(remainingMs),
      voteRemainingMsAtBurst: Math.round(
        voteClock.deadlineAt === null
          ? 0
          : Math.max(0, voteClock.deadlineAt - voteClock.serverNow),
      ),
      timerLatenessMs,
      reconnectsCompleted: reconnects.length,
      stageSnapshotMs: Math.round(stageMs),
      counts,
    };
    console.info(`LOAD ${JSON.stringify(summary)}`);
    expect(timerLatenessMs).toEqual(expect.any(Number));
    expect(counts.players).toBe(guestCount);
    expect(counts.choiceAnswers).toBe(guestCount);
    expect(counts.ballots).toBe(guestCount);
    expect(counts.media).toBe(uploadCount);
    expect(counts.receipts).toBeGreaterThanOrEqual(guestCount);
    expect((await stub.snapshotFor("stage")).phase).toBe("podium");
  }, 180_000);
});

function positive(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

async function burst(
  sockets: WebSocket[],
  command: (index: number) => Record<string, unknown>,
): Promise<{ ms: number; accepted: boolean; error: string }[]> {
  return Promise.all(
    sockets.map(async (socket, index) => {
      const requestId = crypto.randomUUID();
      const began = performance.now();
      const pending = nextMatching(
        socket,
        (message) => message.kind === "ack" && message.requestId === requestId,
        20_000,
      );
      socket.send(JSON.stringify({ kind: "command", requestId, ...command(index) }));
      const ack = await pending;
      return {
        ms: performance.now() - began,
        accepted: ack.accepted === true,
        error: typeof ack.error === "string" ? ack.error : "",
      };
    }),
  );
}

async function oneAck(socket: WebSocket, command: Record<string, unknown>) {
  const [sample] = await burst([socket], () => command);
  if (!sample) {
    throw new Error("The command was not acknowledged.");
  }
  return sample;
}

function collectSnapshots(
  socket: WebSocket,
): { play?: { submissionCount?: number } }[] {
  const seen: { play?: { submissionCount?: number } }[] = [];
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(String(event.data)) as {
      kind?: string;
      snapshot?: { play?: { submissionCount?: number } };
    };
    if (message.kind === "snapshot" && message.snapshot) {
      seen.push(message.snapshot);
    }
  });
  return seen;
}

async function phaseLateness(
  stub: ReturnType<typeof room>,
  questionId: string,
  phase: string,
  deadlineAt: number | null,
): Promise<number | null> {
  if (deadlineAt === null) {
    return null;
  }
  const waitUntil = Date.now() + 40_000;
  while (Date.now() < waitUntil) {
    const snapshot = await stub.snapshotFor("stage");
    if (snapshot.play?.question.id !== questionId || snapshot.phase !== phase) {
      return Math.max(0, snapshot.serverNow - deadlineAt);
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  return null;
}

function percentile(samples: number[], rank: number): number {
  const sorted = [...samples].sort((left, right) => left - right);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil((rank / 100) * sorted.length) - 1),
  );
  return Math.round(sorted[index] ?? 0);
}

function tinyJpeg(): Uint8Array {
  const data = new Uint8Array(2 * 2 * 4);
  data[3] = 255;
  return encode({ data, width: 2, height: 2 }, 80).data;
}

function book(
  stub: ReturnType<typeof room>,
  player: { playerId: string; secret: string },
): MediaBook {
  return {
    claimUpload: (input) => stub.claimMedia({ ...input, secret: player.secret }),
    rememberSource: (uploadId, etag) => stub.rememberMediaSource(uploadId, etag),
    clearPrepared: (uploadId) => stub.clearMediaSource(uploadId),
    stageUpload: (input) => stub.stageMedia(input),
    commitUpload: (input) => stub.commitMedia(input),
    releaseUpload: (uploadId) => stub.releaseMedia(uploadId),
    rejectUpload: (uploadId, message) => stub.rejectMedia(uploadId, message),
  };
}

async function reach(
  stub: ReturnType<typeof room>,
  created: Awaited<ReturnType<typeof createRoom>>,
  questionId: string,
  phase: string,
) {
  for (let step = 0; step < 80; step += 1) {
    const snapshot = await stub.snapshotFor("stage");
    if (
      (questionId === "finale" && phase === "podium" && snapshot.phase === "podium") ||
      (snapshot.play?.question.id === questionId && snapshot.phase === phase)
    ) {
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

function presentationCookie(created: Awaited<ReturnType<typeof createRoom>>) {
  return `26_room_presentation=${created.presentation.credentialId}.${created.presentation.secret}`;
}

function guestCookie(joined: { gameId: string; playerId: string; secret: string }) {
  return `26_guest=${joined.gameId}.${joined.playerId}.${joined.secret}`;
}

async function connect(
  stub: ReturnType<typeof room>,
  gameId: string,
  cookie: string,
  role: "guest" | "stage" = "guest",
): Promise<WebSocket> {
  const response = await stub.fetch(
    new Request(withClientApiQuery(`http://example.com/ws/${gameId}?role=${role}`), {
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
  timeoutMs = 5_000,
): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.removeEventListener("message", onMessage);
      reject(new Error("Timed out waiting for a socket message."));
    }, timeoutMs);
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

async function sizes(stub: ReturnType<typeof room>) {
  return runInDurableObject(stub, async (_instance, state) => {
    function total(sql: string): number {
      return state.storage.sql.exec<{ total: number }>(sql).toArray()[0]?.total ?? 0;
    }
    return {
      players: total(`SELECT COUNT(*) AS total FROM player`),
      choiceAnswers: total(`SELECT COUNT(*) AS total FROM choice_answer`),
      ballots: total(`SELECT COUNT(*) AS total FROM vote_ballot`),
      receipts: total(`SELECT COUNT(*) AS total FROM receipt`),
      media: total(
        `SELECT COUNT(*) AS total FROM media_upload WHERE status = 'accepted'`,
      ),
      jobs: total(`SELECT COUNT(*) AS total FROM schedule_job`),
    };
  });
}

import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { withClientApiQuery } from "./client-api-key.ts";
import { payloadDigest } from "../src/room/digest.ts";

/**
 * Realtime fan-out harness. Run with `npm run load:realtime`.
 * LOAD_SIZES (default 8,30,80) and LOAD_KART_MS (default 6000) tune it.
 * Results print as `LOAD-REALTIME {json}` lines for docs/verification-report.md.
 * This is a local workerd measurement, not production.
 */
const settings = env as unknown as Record<string, string | undefined>;
const sizes = (settings.LOAD_SIZES ?? "8,30,80")
  .split(",")
  .map((value) => Number(value.trim()))
  .filter((value) => Number.isInteger(value) && value > 0 && value <= 80);
const kartMs = positive(settings.LOAD_KART_MS, 6_000);
// Phone control rate during the race. 0 sends no controls, which isolates the tick cost.
const inputHz = Math.max(0, Math.min(20, Number(settings.LOAD_INPUT_HZ ?? "10") || 0));

describe("realtime fan-out", () => {
  it("measures each room size through an answer burst and a live kart race", async () => {
    const results = [];
    for (const size of sizes) {
      results.push(await measure(size));
    }
    for (const result of results) {
      console.log(`LOAD-REALTIME ${JSON.stringify(result)}`);
    }
    expect(results.every((result) => result.race.stageKartUpdates > 0)).toBe(true);
  }, 600_000);
});

async function measure(size: number) {
  const created = await createRoom();
  const stub = env.PARTY_ROOM.getByName(created.gameId);
  const players = [];
  for (let index = 0; index < size; index += 1) {
    players.push(await join(stub, `Load ${index + 1}`));
  }
  const guests: Peer[] = [];
  for (const player of players) {
    guests.push(await connect(stub, created.gameId, guestCookie(player), "guest"));
  }
  const stage = await connect(
    stub,
    created.gameId,
    credentialCookie(created, "presentation"),
    "stage",
  );
  const control = await connect(
    stub,
    created.gameId,
    credentialCookie(created, "control"),
    "control",
  );

  const started = await stub.startKartRehearsal({
    ...credential(created),
    requestId: crypto.randomUUID(),
    nowMs: Date.now(),
  });
  expect(started.ok).toBe(true);

  await reach(
    stub,
    created,
    (snapshot) =>
      snapshot.phase === "collect" && snapshot.play?.question.kind !== "kart",
  );
  const answerSamples = await Promise.all(
    guests.map((peer) => peer.command({ name: "answer", optionId: "circle" })),
  );
  expect(answerSamples.every((sample) => sample.accepted)).toBe(true);

  await reach(
    stub,
    created,
    (snapshot) =>
      snapshot.phase === "collect" && snapshot.play?.question.kind === "kart",
  );
  const raceId = (await stub.snapshotFor("stage")).play?.kart?.raceId;
  expect(raceId).toEqual(expect.any(String));
  for (const peer of [...guests, stage, control]) peer.reset();

  const began = Date.now();
  let sequence = 1;
  const drive = setInterval(
    () => {
      if (inputHz === 0) return;
      sequence += 1;
      for (const [index, peer] of guests.entries()) {
        peer.raw({
          kind: "command",
          name: "kart-input",
          requestId: crypto.randomUUID(),
          input: {
            raceId,
            sequence,
            steer: index % 3 === 0 ? 0.24 : -0.1,
            gas: true,
            brake: false,
            drift: false,
          },
        });
      }
    },
    inputHz === 0 ? 1000 : Math.round(1000 / inputHz),
  );
  await new Promise((resolve) => setTimeout(resolve, kartMs));
  clearInterval(drive);
  const raceSeconds = (Date.now() - began) / 1000;

  const diagnostics = await stub.diagnostics({
    ...credential(created),
    nowMs: Date.now(),
  });
  if (!diagnostics.ok) throw new Error(diagnostics.message);
  const guestBytes = guests.map((peer) => peer.bytes / raceSeconds);
  const guestGaps = guests.flatMap((peer) => gaps(peer.kartAt));
  const summary = {
    environment: "cloudflare vitest local durable object, not production",
    guests: size,
    answerAckMs: {
      p50: percentile(
        answerSamples.map((sample) => sample.ms),
        50,
      ),
      p95: percentile(
        answerSamples.map((sample) => sample.ms),
        95,
      ),
      max: Math.round(Math.max(...answerSamples.map((sample) => sample.ms))),
    },
    race: {
      seconds: Number(raceSeconds.toFixed(1)),
      stageKartUpdates: stage.kartAt.length,
      stageKartUpdatesPerSecond: Number((stage.kartAt.length / raceSeconds).toFixed(1)),
      stageGapMs: spread(gaps(stage.kartAt)),
      stageKBPerSecond: Number((stage.bytes / 1024 / raceSeconds).toFixed(1)),
      controlKBPerSecond: Number((control.bytes / 1024 / raceSeconds).toFixed(1)),
      guestGapMs: spread(guestGaps),
      guestKBPerSecondMean: Number(
        (
          guestBytes.reduce((sum, value) => sum + value, 0) /
          guestBytes.length /
          1024
        ).toFixed(2),
      ),
      fullSnapshotsToGuests: guests.reduce((sum, peer) => sum + peer.snapshots, 0),
    },
    server: diagnostics.report.realtime,
  };
  for (const peer of [...guests, stage, control]) peer.close();
  return summary;
}

type Peer = {
  bytes: number;
  snapshots: number;
  kartAt: number[];
  reset(): void;
  raw(body: Record<string, unknown>): void;
  command(body: Record<string, unknown>): Promise<{ ms: number; accepted: boolean }>;
  close(): void;
};

async function connect(
  stub: DurableObjectStub<import("../src/room/party-room.ts").PartyRoom>,
  gameId: string,
  cookie: string,
  role: "guest" | "stage" | "control",
): Promise<Peer> {
  const response = await stub.fetch(
    new Request(
      withClientApiQuery(`http://example.com/ws/${gameId}?role=${role}&patches=1`),
      {
        headers: {
          Upgrade: "websocket",
          Connection: "Upgrade",
          Origin: "http://example.com",
          Cookie: cookie,
        },
      },
    ),
  );
  expect(response.status).toBe(101);
  const socket = response.webSocket;
  if (!socket) throw new Error("The room did not return a socket.");
  socket.accept();
  const waiting = new Map<
    string,
    { began: number; resolve: (accepted: boolean) => void }
  >();
  const peer: Peer = {
    bytes: 0,
    snapshots: 0,
    kartAt: [],
    reset() {
      peer.bytes = 0;
      peer.snapshots = 0;
      peer.kartAt = [];
    },
    raw(body) {
      socket.send(JSON.stringify(body));
    },
    command(body) {
      const requestId = crypto.randomUUID();
      return new Promise((resolve) => {
        const began = Date.now();
        waiting.set(requestId, {
          began,
          resolve: (accepted) => resolve({ ms: Date.now() - began, accepted }),
        });
        socket.send(JSON.stringify({ kind: "command", requestId, ...body }));
      });
    },
    close() {
      socket.close();
    },
  };
  socket.addEventListener("message", (event) => {
    const text = String(event.data);
    peer.bytes += text.length;
    if (text === "pong") return;
    const message = JSON.parse(text) as {
      kind?: string;
      requestId?: string;
      accepted?: boolean;
      snapshot?: { play?: { kart?: unknown } | null };
    };
    if (message.kind === "ack" && message.requestId) {
      waiting.get(message.requestId)?.resolve(message.accepted === true);
      waiting.delete(message.requestId);
    }
    if (message.kind === "snapshot") peer.snapshots += 1;
    if (
      message.kind === "kart" ||
      (message.kind === "patch" &&
        Boolean(
          (message as { set?: { play?: { kart?: unknown } } }).set?.play?.kart,
        )) ||
      (message.kind === "snapshot" && message.snapshot?.play?.kart)
    ) {
      peer.kartAt.push(Date.now());
    }
  });
  return peer;
}

async function reach(
  stub: DurableObjectStub<import("../src/room/party-room.ts").PartyRoom>,
  created: Awaited<ReturnType<typeof createRoom>>,
  done: (snapshot: Awaited<ReturnType<typeof stub.snapshotFor>>) => boolean,
): Promise<void> {
  for (let step = 0; step < 40; step += 1) {
    const snapshot = await stub.snapshotFor("stage");
    if (done(snapshot)) return;
    const moved = await stub.advanceRound({
      ...credential(created),
      requestId: crypto.randomUUID(),
      nowMs: Date.now(),
    });
    if (!moved.ok) throw new Error(moved.message);
  }
  throw new Error("The room did not reach the expected phase.");
}

function gaps(times: number[]): number[] {
  return times.slice(1).map((time, index) => time - times[index]!);
}

function spread(samples: number[]) {
  return {
    p50: percentile(samples, 50),
    p95: percentile(samples, 95),
    max: samples.length > 0 ? Math.max(...samples) : 0,
  };
}

function percentile(samples: number[], rank: number): number {
  const sorted = [...samples].sort((left, right) => left - right);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil((rank / 100) * sorted.length) - 1),
  );
  return Math.round(sorted[index] ?? 0);
}

function positive(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

async function join(
  stub: DurableObjectStub<import("../src/room/party-room.ts").PartyRoom>,
  nickname: string,
) {
  const joined = await stub.joinPlayer({
    nickname,
    requestId: crypto.randomUUID(),
    now: new Date().toISOString(),
  });
  if (!joined.ok) throw new Error(joined.message);
  return joined;
}

async function createRoom() {
  const created = await env.ROOM_CODE_REGISTRY.getByName("codes").createLobby({
    requestId: crypto.randomUUID(),
    digest: await payloadDigest({ action: "create" }),
    now: new Date().toISOString(),
  });
  if (!created.ok) throw new Error(created.message);
  return created.result;
}

function credential(created: Awaited<ReturnType<typeof createRoom>>) {
  return { credentialId: created.control.credentialId, secret: created.control.secret };
}

function credentialCookie(
  created: Awaited<ReturnType<typeof createRoom>>,
  role: "control" | "presentation",
): string {
  const value = role === "control" ? created.control : created.presentation;
  return `26_room_${role}=${value.credentialId}.${value.secret}`;
}

function guestCookie(joined: { gameId: string; playerId: string; secret: string }) {
  return `26_guest=${joined.gameId}.${joined.playerId}.${joined.secret}`;
}

// Drives N simulated phones against the throwaway load-test Worker and measures
// what the stage receives. Same scenario as apps/api/test/realtime-load.spec.ts
// (rehearsal quiz answer burst, then the ring-track kart race), over the internet.
//
//   LOADTEST_URL=https://kart-loadtest-26.<sub>.workers.dev \
//   LOADTEST_TOKEN=... LOAD_SIZES=80 LOAD_INPUT_HZ=10 LOAD_STAGGER=1 \
//   node apps/api/loadtest/drive.mjs
//
// The token is read from the environment and never printed.
import WebSocket from "ws";

const base = process.env.LOADTEST_URL;
const token = process.env.LOADTEST_TOKEN;
if (!base || !token) throw new Error("Set LOADTEST_URL and LOADTEST_TOKEN.");
const size = Number(process.env.LOAD_SIZES ?? "80");
const inputHz = Math.max(0, Math.min(20, Number(process.env.LOAD_INPUT_HZ ?? "10")));
const stagger = process.env.LOAD_STAGGER === "1";
const kartMs = Number(process.env.LOAD_KART_MS ?? "10000");
const origin = new URL(base).origin;

async function call(path, body) {
  const response = await fetch(`${origin}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-loadtest-token": token },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`${path} ${response.status}`);
  return response.json();
}
const room = (gameId, method, ...args) => call("/lt/room", { gameId, method, args });
const cred = (created) => ({
  credentialId: created.control.credentialId,
  secret: created.control.secret,
});
const ask = (created) => ({
  ...cred(created),
  requestId: crypto.randomUUID(),
  nowMs: 0,
});

function connect(gameId, cookie, role) {
  return new Promise((resolve, reject) => {
    const url = `${origin.replace(/^http/, "ws")}/ws/${gameId}?role=${role}&patches=1`;
    const socket = new WebSocket(url, { headers: { Cookie: cookie, Origin: origin } });
    const waiting = new Map();
    const peer = {
      bytes: 0,
      kartAt: [],
      moving: new Set(),
      reset() {
        peer.bytes = 0;
        peer.kartAt = [];
        peer.moving.clear();
      },
      raw: (body) => socket.readyState === 1 && socket.send(JSON.stringify(body)),
      command(body) {
        const requestId = crypto.randomUUID();
        const began = Date.now();
        return new Promise((done) => {
          waiting.set(requestId, (accepted) =>
            done({ ms: Date.now() - began, accepted }),
          );
          socket.send(JSON.stringify({ kind: "command", requestId, ...body }));
        });
      },
      close: () => socket.close(),
    };
    socket.on("open", () => resolve(peer));
    socket.on("error", reject);
    socket.on("message", (data) => {
      const text = data.toString();
      peer.bytes += Buffer.byteLength(text);
      if (text === "pong") return;
      const message = JSON.parse(text);
      const race =
        message.kart ?? message.snapshot?.play?.kart ?? message.set?.play?.kart;
      for (const driver of race?.participants ?? [])
        if ((driver.speed ?? 0) > 0) peer.moving.add(driver.playerId);
      if (message.kind === "ack" && message.requestId) {
        waiting.get(message.requestId)?.(message.accepted === true);
        waiting.delete(message.requestId);
      }
      if (
        message.kind === "kart" ||
        (message.kind === "patch" && message.set?.play?.kart) ||
        (message.kind === "snapshot" && message.snapshot?.play?.kart)
      )
        peer.kartAt.push(Date.now());
    });
  });
}

async function reach(gameId, created, done) {
  for (let step = 0; step < 40; step += 1) {
    if (done(await room(gameId, "snapshotFor", "stage"))) return;
    const moved = await room(gameId, "advanceRound", ask(created));
    if (!moved.ok) throw new Error(moved.message);
  }
  throw new Error("The room did not reach the expected phase.");
}

const gaps = (times) => times.slice(1).map((time, index) => time - times[index]);
function percentile(samples, rank) {
  const sorted = [...samples].sort((a, b) => a - b);
  return Math.round(
    sorted[
      Math.min(
        sorted.length - 1,
        Math.max(0, Math.ceil((rank / 100) * sorted.length) - 1),
      )
    ] ?? 0,
  );
}

const created = (await call("/lt/create", {})).result;
const gameId = created.gameId;
const players = [];
for (let index = 0; index < size; index += 1) {
  const joined = await room(gameId, "joinPlayer", {
    nickname: `Load ${index + 1}`,
    requestId: crypto.randomUUID(),
    now: "",
  });
  if (!joined.ok) throw new Error(joined.message);
  players.push(joined);
}
const guests = [];
for (const player of players)
  guests.push(
    await connect(
      gameId,
      `26_guest=${player.gameId}.${player.playerId}.${player.secret}`,
      "guest",
    ),
  );
const stage = await connect(
  gameId,
  `26_room_presentation=${created.presentation.credentialId}.${created.presentation.secret}`,
  "stage",
);
const started = await room(gameId, "startKartRehearsal", ask(created));
if (!started.ok) throw new Error(started.message);
await reach(
  gameId,
  created,
  (s) => s.phase === "collect" && s.play?.question.kind !== "kart",
);
const answers = await Promise.all(
  guests.map((peer) => peer.command({ name: "answer", optionId: "circle" })),
);
await reach(
  gameId,
  created,
  (s) => s.phase === "collect" && s.play?.question.kind === "kart",
);
const raceId = (await room(gameId, "snapshotFor", "stage")).play?.kart?.raceId;
for (const peer of [...guests, stage]) peer.reset();

const began = Date.now();
let sequence = 1;
const drive = setInterval(
  () => {
    if (inputHz === 0) return;
    sequence += 1;
    const tick = sequence;
    const intervalMs = 1000 / inputHz;
    guests.forEach((peer, index) => {
      const fire = () =>
        peer.raw({
          kind: "command",
          name: "kart-input",
          requestId: crypto.randomUUID(),
          input: {
            raceId,
            sequence: tick,
            steer: index % 3 === 0 ? 0.24 : -0.1,
            gas: true,
            brake: false,
            drift: false,
          },
        });
      if (stagger) setTimeout(fire, (index * intervalMs) / guests.length);
      else fire();
    });
  },
  inputHz === 0 ? 1000 : Math.round(1000 / inputHz),
);
await new Promise((resolve) => setTimeout(resolve, kartMs));
clearInterval(drive);
const seconds = (Date.now() - began) / 1000;
const diagnostics = await room(gameId, "diagnostics", { ...cred(created), nowMs: 0 });
const series = diagnostics.ok ? (diagnostics.report.realtime?.series ?? []) : [];
const late = series.find((entry) => entry.name === "tick:lateMs");
const over = series.find((entry) => entry.name === "tick:late>250");
const stageGaps = gaps(stage.kartAt);
const result = {
  environment:
    "real Cloudflare, throwaway Worker on Aden's account, driven from home PC",
  guests: size,
  inputHz,
  stagger,
  answerAckMs: {
    p50: percentile(
      answers.map((a) => a.ms),
      50,
    ),
    p95: percentile(
      answers.map((a) => a.ms),
      95,
    ),
  },
  answersAccepted: answers.filter((a) => a.accepted).length,
  race: {
    seconds: Number(seconds.toFixed(1)),
    movingRacers: stage.moving.size,
    stageKartUpdatesPerSecond: Number((stage.kartAt.length / seconds).toFixed(1)),
    stageGapMs: {
      p50: percentile(stageGaps, 50),
      p95: percentile(stageGaps, 95),
      max: stageGaps.length ? Math.max(...stageGaps) : 0,
    },
    guestKBPerSecondMean: Number(
      (
        guests.reduce((sum, p) => sum + p.bytes, 0) /
        guests.length /
        1024 /
        seconds
      ).toFixed(2),
    ),
  },
  tickLateMs: late
    ? {
        ticks: late.total,
        meanMs: Math.round(late.totalBytes / late.total),
        over250: over?.total ?? 0,
      }
    : null,
  diagnosticsOk: diagnostics.ok === true,
};
await room(gameId, "pauseRound", ask(created));
for (const peer of [...guests, stage]) peer.close();
console.log(`LOAD-CLOUD ${JSON.stringify(result)}`);
process.exit(0);

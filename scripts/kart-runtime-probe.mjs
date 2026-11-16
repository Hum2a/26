import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import WebSocket, { WebSocketServer } from "ws";

if (process.env.CLOUDFLARE_ENV)
  throw new Error("Runtime probes are isolated local tests only.");
const runtime = process.argv[2];
assert.ok(["vite", "vitest"].includes(runtime), "Choose vite or vitest runtime");
const storage = process.argv[3] ?? "ephemeral";
assert.ok(["ephemeral", "disk"].includes(storage), "Choose ephemeral or disk storage");
const transport = process.argv[4] ?? "direct";
assert.ok(
  ["direct", "bridge"].includes(transport),
  "Choose direct or bridge transport",
);
const root = fileURLToPath(new URL("../", import.meta.url));
const inspector = process.argv[5] === "inspector";
const sql = process.argv[6] === "sql";
const protocol = process.argv[7] ?? "basic";
assert.ok(
  [
    "basic",
    "attachments",
    "auto-response",
    "auto-response-sync",
    "combined",
    "barrier",
  ].includes(protocol),
);
const fixture = await import("../apps/api/test/browser/runtime-probe.js");
for (const environment of ["staging", "production"]) {
  const response = fixture.default.fetch(new Request("http://localhost/health"), {
    APP_ENV: environment,
    PROBE_LOCAL_ONLY: "1",
  });
  assert.equal(
    response.status,
    503,
    "The test fixture must refuse deployed environments",
  );
}
const runtimeRequire = createRequire(
  import.meta.resolve(
    `@cloudflare/${runtime === "vite" ? "vite-plugin" : "vitest-plugin"}`,
  ),
);
// Execute the already-locked package API; do not read installed dependency files.
const { Miniflare, coupleWebSocket } = runtimeRequire("miniflare");
const mf = new Miniflare({
  host: "127.0.0.1",
  port: 0,
  ...(inspector ? { inspectorPort: 9229, inspectorHost: "127.0.0.1" } : {}),
  cf: false,
  ...(storage === "disk"
    ? {
        resourcePersistencePath:
          root + "artifacts/kart-runtime-storage/" + randomUUID(),
      }
    : {}),
  workers: [
    {
      config: {
        name: "local-transport-probe",
        compatibilityDate: "2026-09-22",
        manifest: {
          mainModule: "probe.js",
          modules: {
            "probe.js": {
              type: "esm",
              contents: await readFile(
                root + "apps/api/test/browser/runtime-probe.js",
                "utf8",
              ),
            },
          },
        },
        env: {
          ROOM: {
            type: "durable-object",
            worker: "local-transport-probe",
            exportName: "ProbeRoom",
          },
          PROBE_LOCAL_ONLY: { type: "text", value: "1" },
          APP_ENV: { type: "text", value: "local" },
          PROBE_SQL: { type: "text", value: sql ? "1" : "0" },
          PROBE_PROTOCOL: { type: "text", value: protocol },
        },
        exports: { ProbeRoom: { type: "durable-object", storage: "sqlite" } },
      },
      dev: {
        unsafeEphemeralDurableObjects: storage === "ephemeral",
        unsafeInspectorProxy: inspector,
      },
    },
  ],
});
const sockets = [];
let interval;
let bridge;
let bridgeSockets;
const result = {
  fixtureVersion: 2,
  runtime,
  storage,
  transport,
  inspector,
  sql,
  protocol,
  pongs: 0,
  scope:
    "Minimal local external TCP/WebSocket + hibernating DO/alarm fixture; no application, auth, Vite or GPU; not game capacity",
  population: 50,
  configuredInputHz: 10,
  configuredFrameBytes: 1024,
  sent: 0,
  received: 0,
  distinctSending: 0,
  maxTick: 0,
  health: [],
  stop: null,
  error: null,
  bridgeErrors: [],
  stage: "starting",
};
try {
  let origin = new URL(await mf.ready);
  assert.equal(origin.hostname, "127.0.0.1");
  if (transport === "bridge") {
    const workerOrigin = origin;
    bridgeSockets = new WebSocketServer({ noServer: true });
    bridge = createServer(async (request, response) => {
      try {
        const chunks = [];
        for await (const chunk of request) chunks.push(chunk);
        const forwarded = await mf.dispatchFetch(new URL(request.url, workerOrigin), {
          method: request.method,
          ...(chunks.length ? { body: Buffer.concat(chunks) } : {}),
        });
        const bytes = Buffer.from(await forwarded.arrayBuffer());
        response.writeHead(forwarded.status, Object.fromEntries(forwarded.headers));
        response.end(bytes);
      } catch (error) {
        result.bridgeErrors.push({
          path: request.url,
          error: String(error),
          cause: String(error.cause ?? ""),
        });
        if (!response.headersSent) response.writeHead(502).end();
        else response.destroy();
      }
    });
    bridge.on("upgrade", async (request, socket, head) => {
      try {
        const response = await mf.dispatchFetch(new URL(request.url, workerOrigin), {
          headers: { Upgrade: "websocket" },
        });
        assert.equal(response.status, 101);
        bridgeSockets.handleUpgrade(request, socket, head, (upgraded) => {
          void coupleWebSocket(upgraded, response.webSocket).catch(() =>
            upgraded.terminate(),
          );
        });
      } catch {
        socket.destroy();
      }
    });
    await new Promise((resolve) => bridge.listen(0, "127.0.0.1", resolve));
    origin = new URL(`http://127.0.0.1:${bridge.address().port}`);
  }
  const socketUrl = new URL("/socket", origin);
  result.stage = "opening-sockets";
  socketUrl.protocol = "ws:";
  async function request(path, method = "GET") {
    const began = performance.now();
    const response = await fetch(new URL(path, origin), {
      method,
      ...(method === "POST" ? { body: "{}" } : {}),
      signal: AbortSignal.timeout(5000),
    });
    const body = await response.json();
    assert.equal(response.status, 200);
    return { milliseconds: Math.round(performance.now() - began), body };
  }
  for (let start = 0; start < 50; start += 4) {
    await Promise.all(
      Array.from(
        { length: Math.min(4, 50 - start) },
        () =>
          new Promise((resolve, reject) => {
            const socket = new WebSocket(socketUrl);
            sockets.push(socket);
            const timer = setTimeout(
              () => reject(new Error("Probe socket open timed out")),
              5000,
            );
            socket.on("message", (data) => {
              if (String(data) === "pong") {
                result.pongs++;
                return;
              }
              const frame = JSON.parse(String(data));
              result.received++;
              result.maxTick = Math.max(result.maxTick, frame.tick);
            });
            socket.once("error", (error) => {
              clearTimeout(timer);
              reject(error);
            });
            socket.once("open", () => {
              clearTimeout(timer);
              resolve();
            });
          }),
      ),
    );
  }
  result.stage = "starting-alarm";
  await request("/start", "POST");
  result.stage = "driving";
  const sending = new Set();
  interval = setInterval(() => {
    for (const socket of sockets)
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(
          JSON.stringify({ sequence: result.sent++, gas: true, steer: -0.1 }),
        );
        sending.add(socket);
      }
    result.distinctSending = sending.size;
  }, 100);
  for (let sample = 0; sample < 10; sample++) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    if (["auto-response", "auto-response-sync", "combined"].includes(protocol))
      for (const socket of sockets)
        if (socket.readyState === WebSocket.OPEN) socket.send("ping");
    result.health.push(await request("/health"));
  }
  result.stage = "stopping";
  result.stop = await request("/stop", "POST");
  assert.equal(result.distinctSending, 50);
  assert.ok(
    result.maxTick >= 10,
    "The runtime must continue broadcasting during traffic",
  );
  assert.ok(result.stop.body.inputs > 0, "Inputs must reach the object");
  if (sql) assert.equal(result.stop.body.sqlRows, 50);
  if (["attachments", "combined"].includes(protocol)) {
    assert.ok(result.stop.body.attachmentReads >= 50);
    assert.ok(result.stop.body.attachmentWrites > 50);
  }
  if (["auto-response", "auto-response-sync", "combined"].includes(protocol))
    assert.ok(result.pongs >= 50);
  result.stage = "complete";
} catch (error) {
  result.error = String(error);
  process.exitCode = 1;
} finally {
  clearInterval(interval);
  for (const socket of sockets) socket.terminate();
  if (bridge) {
    for (const socket of bridgeSockets.clients) socket.terminate();
    bridge.closeAllConnections();
    await new Promise((resolve) => bridge.close(resolve));
  }
  await mkdir(root + "artifacts/kart-fix-checks", { recursive: true });
  await writeFile(
    root +
      `artifacts/kart-fix-checks/runtime-probe-${runtime}-${storage}-${transport}${inspector ? "-inspector" : ""}${sql ? "-sql" : ""}${protocol === "basic" ? "" : "-" + protocol}.json`,
    JSON.stringify(result, null, 2) + "\n",
  );
  console.log("KART-RUNTIME-PROBE " + JSON.stringify(result));
  await mf.dispose();
}

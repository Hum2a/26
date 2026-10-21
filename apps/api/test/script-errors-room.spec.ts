import { env } from "cloudflare:test";
import { expect, it } from "vitest";
import { withClientApiQuery } from "./client-api-key.ts";
import { payloadDigest } from "../src/room/digest.ts";

it("shows a phone's reported script errors on room health, redacted", async () => {
  const created = await env.ROOM_CODE_REGISTRY.getByName("codes").createLobby({
    requestId: crypto.randomUUID(),
    digest: await payloadDigest({ action: "create" }),
    now: new Date().toISOString(),
  });
  if (!created.ok) throw new Error(created.message);
  const room = created.result;
  const stub = env.PARTY_ROOM.getByName(room.gameId);
  const joined = await stub.joinPlayer({
    nickname: "Amina",
    requestId: crypto.randomUUID(),
    now: new Date().toISOString(),
  });
  if (!joined.ok) throw new Error(joined.message);
  const response = await stub.fetch(
    new Request(withClientApiQuery(`http://example.com/ws/${room.gameId}?role=guest`), {
      headers: {
        Upgrade: "websocket",
        Connection: "Upgrade",
        Origin: "http://example.com",
        Cookie: `26_guest=${joined.gameId}.${joined.playerId}.${joined.secret}`,
      },
    }),
  );
  const socket = response.webSocket!;
  socket.accept();
  const requestId = crypto.randomUUID();
  const acked = new Promise<void>((resolve) => {
    socket.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data)) as {
        kind?: string;
        requestId?: string;
      };
      if (message.kind === "ack" && message.requestId === requestId) resolve();
    });
  });
  socket.send(
    JSON.stringify({
      kind: "command",
      requestId,
      name: "connection",
      rttMs: [40],
      submissionRetries: 0,
      uploadAttempts: 0,
      uploadFailures: 0,
      uploadDurationMs: 0,
      scriptErrors: 2,
      lastScriptError: "abc123: Cannot read x for amina@example.test",
    }),
  );
  await acked;
  const report = await stub.diagnostics({
    credentialId: room.control.credentialId,
    secret: room.control.secret,
    nowMs: Date.now(),
  });
  if (!report.ok) throw new Error(report.message);
  expect(report.report.scriptErrors?.total).toBe(2);
  const [first] = report.report.scriptErrors?.recent ?? [];
  expect(first?.nickname).toBe("Amina");
  expect(first?.message).toContain("Cannot read x");
  expect(first?.message).not.toContain("amina@example.test");
  socket.close();
});

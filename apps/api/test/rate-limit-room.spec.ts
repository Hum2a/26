import { env } from "cloudflare:test";
import { expect, it } from "vitest";
import { withClientApiQuery } from "./client-api-key.ts";
import { payloadDigest } from "../src/room/digest.ts";
import { messageLimitMessage } from "../src/room/limits.ts";

it("lets a phone answer after a long run of drafts, and throttles a burst without a lifetime cap", async () => {
  const created = await env.ROOM_CODE_REGISTRY.getByName("codes").createLobby({
    requestId: crypto.randomUUID(),
    digest: await payloadDigest({ action: "create" }),
    now: new Date().toISOString(),
  });
  if (!created.ok) throw new Error(created.message);
  const room = created.result;
  const stub = env.PARTY_ROOM.getByName(room.gameId);
  const joined = await stub.joinPlayer({
    nickname: "Typist",
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
  const acks = new Map<string, { accepted: boolean; error?: string }>();
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(String(event.data)) as {
      kind?: string;
      requestId?: string;
      accepted?: boolean;
      error?: string;
    };
    if (message.kind === "ack" && message.requestId) {
      acks.set(message.requestId, {
        accepted: message.accepted === true,
        ...(message.error ? { error: message.error } : {}),
      });
    }
  });

  // The old lifetime counter rejected everything after 100 messages, drafts included.
  for (let i = 0; i < 150; i += 1) {
    socket.send(JSON.stringify({ kind: "command", name: "draft", text: `draft ${i}` }));
  }
  const after = crypto.randomUUID();
  socket.send(JSON.stringify({ kind: "command", requestId: after, name: "snapshot" }));
  await expect.poll(() => acks.get(after)?.accepted, { timeout: 5_000 }).toBe(true);

  const burst = Array.from({ length: 60 }, () => crypto.randomUUID());
  for (const requestId of burst) {
    socket.send(JSON.stringify({ kind: "command", requestId, name: "snapshot" }));
  }
  await expect
    .poll(() => burst.every((id) => acks.has(id)), { timeout: 10_000 })
    .toBe(true);
  const refused = burst.filter((id) => acks.get(id)?.error === messageLimitMessage);
  expect(refused.length).toBeGreaterThan(0);
  expect(refused.length).toBeLessThan(burst.length);
  socket.close();
});

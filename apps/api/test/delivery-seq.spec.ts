import { env, evictDurableObject } from "cloudflare:test";
import { expect, it } from "vitest";
import { withClientApiQuery } from "./client-api-key.ts";
import { payloadDigest } from "../src/room/digest.ts";

async function openGuest() {
  const created = await env.ROOM_CODE_REGISTRY.getByName("codes").createLobby({
    requestId: crypto.randomUUID(),
    digest: await payloadDigest({ action: "create" }),
    now: new Date().toISOString(),
  });
  if (!created.ok) throw new Error(created.message);
  const stub = env.PARTY_ROOM.getByName(created.result.gameId);
  const joined = await stub.joinPlayer({
    nickname: "Counter",
    requestId: crypto.randomUUID(),
    now: new Date().toISOString(),
  });
  if (!joined.ok) throw new Error(joined.message);
  const connect = async () => {
    const response = await stub.fetch(
      new Request(
        withClientApiQuery(`http://example.com/ws/${created.result.gameId}?role=guest`),
        {
          headers: {
            Upgrade: "websocket",
            Connection: "Upgrade",
            Origin: "http://example.com",
            Cookie: `26_guest=${joined.gameId}.${joined.playerId}.${joined.secret}`,
          },
        },
      ),
    );
    const socket = response.webSocket!;
    socket.accept();
    const seqs: number[] = [];
    socket.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data)) as { deliverySeq?: number };
      if (typeof message.deliverySeq === "number") seqs.push(message.deliverySeq);
    });
    return { socket, seqs };
  };
  return { stub, connect };
}

it("numbers deliveries in strictly increasing order, across a room eviction", async () => {
  const { stub, connect } = await openGuest();
  const { socket, seqs } = await connect();
  for (let i = 0; i < 40; i++)
    socket.send(
      JSON.stringify({
        kind: "command",
        requestId: crypto.randomUUID(),
        name: "snapshot",
      }),
    );
  await expect.poll(() => seqs.length, { timeout: 10_000 }).toBeGreaterThanOrEqual(40);
  for (let i = 1; i < seqs.length; i++) expect(seqs[i]!).toBeGreaterThan(seqs[i - 1]!);
  const before = seqs.at(-1)!;
  await evictDurableObject(stub);
  socket.send(
    JSON.stringify({
      kind: "command",
      requestId: crypto.randomUUID(),
      name: "snapshot",
    }),
  );
  await expect.poll(() => seqs.at(-1)! > before, { timeout: 10_000 }).toBe(true);
  socket.close();
});

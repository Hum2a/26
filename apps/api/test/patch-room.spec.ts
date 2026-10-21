import { env } from "cloudflare:test";
import { expect, it } from "vitest";
import { withClientApiQuery } from "./client-api-key.ts";
import { payloadDigest } from "../src/room/digest.ts";

type Message = Record<string, unknown> & { kind?: string };

async function setup() {
  const created = await env.ROOM_CODE_REGISTRY.getByName("codes").createLobby({
    requestId: crypto.randomUUID(),
    digest: await payloadDigest({ action: "create" }),
    now: new Date().toISOString(),
  });
  if (!created.ok) throw new Error(created.message);
  const room = created.result;
  return { room, stub: env.PARTY_ROOM.getByName(room.gameId) };
}

async function join(stub: Awaited<ReturnType<typeof setup>>["stub"], nickname: string) {
  const joined = await stub.joinPlayer({
    nickname,
    requestId: crypto.randomUUID(),
    now: new Date().toISOString(),
  });
  if (!joined.ok) throw new Error(joined.message);
  return joined;
}

async function connect(
  stub: Awaited<ReturnType<typeof setup>>["stub"],
  gameId: string,
  player: { gameId: string; playerId: string; secret: string },
  query: string,
) {
  const response = await stub.fetch(
    new Request(
      withClientApiQuery(`http://example.com/ws/${gameId}?role=guest${query}`),
      {
        headers: {
          Upgrade: "websocket",
          Connection: "Upgrade",
          Origin: "http://example.com",
          Cookie: `26_guest=${player.gameId}.${player.playerId}.${player.secret}`,
        },
      },
    ),
  );
  const socket = response.webSocket!;
  socket.accept();
  const inbox: Message[] = [];
  socket.addEventListener("message", (event) => {
    const text = String(event.data);
    if (text !== "pong") inbox.push(JSON.parse(text) as Message);
  });
  return { socket, inbox };
}

function apply(view: Record<string, unknown>, patch: Message): Record<string, unknown> {
  const next: Record<string, unknown> = { ...view, ...(patch.set as object) };
  for (const key of patch.unset as string[]) delete next[key];
  return next;
}

function withoutClock(snapshot: Record<string, unknown>) {
  const rest = { ...snapshot };
  delete rest.serverNow;
  return rest;
}

it("sends patches that rebuild the same view as a full snapshot, and resumes after a reconnect", async () => {
  const { room, stub } = await setup();
  const amina = await join(stub, "Amina");
  const phone = await connect(stub, room.gameId, amina, "&patches=1");
  await expect.poll(() => phone.inbox.find((m) => m.kind === "snapshot")).toBeTruthy();
  const first = phone.inbox.find((m) => m.kind === "snapshot")!;
  expect(first.view).toEqual(expect.any(String));
  let view = first.snapshot as Record<string, unknown>;
  let viewId = first.view as string;

  await join(stub, "Bilal");
  const hasPlayers = (m: Message) =>
    m.kind === "patch" && Object.keys(m.set as object).includes("players");
  await expect.poll(() => phone.inbox.some(hasPlayers)).toBe(true);
  // A fan-out already queued by Amina's join may arrive first. Each patch must
  // chain from the view before it, and applying them in order must match the room.
  for (const patch of phone.inbox.filter((m) => m.kind === "patch")) {
    expect(patch.base).toBe(viewId);
    view = apply(view, patch);
    viewId = patch.view as string;
  }
  const patch = phone.inbox.find(hasPlayers)!;
  expect(JSON.stringify(patch).length).toBeLessThan(JSON.stringify(first).length);
  const truth = await stub.snapshotFor("guest", amina.playerId);
  expect(withoutClock(view)).toEqual(
    withoutClock(truth as unknown as Record<string, unknown>),
  );

  phone.socket.close();
  const again = await connect(
    stub,
    room.gameId,
    amina,
    `&patches=1&since=${encodeURIComponent(viewId)}`,
  );
  await expect
    .poll(() => again.inbox.find((m) => m.kind === "patch" || m.kind === "snapshot"))
    .toBeTruthy();
  const resumed = again.inbox.find((m) => m.kind === "patch" || m.kind === "snapshot")!;
  expect(resumed.kind).toBe("patch");
  expect(resumed.base).toBe(viewId);
  expect(Object.keys(resumed.set as object)).not.toContain("players");
  again.socket.close();
});

it("keeps sending full snapshots to a screen that did not ask for patches", async () => {
  const { room, stub } = await setup();
  const amina = await join(stub, "Amina");
  const phone = await connect(stub, room.gameId, amina, "");
  await expect.poll(() => phone.inbox.length).toBeGreaterThan(0);
  await join(stub, "Bilal");
  await expect
    .poll(() => phone.inbox.filter((m) => m.kind === "snapshot").length)
    .toBeGreaterThanOrEqual(2);
  expect(phone.inbox.some((m) => m.kind === "patch")).toBe(false);
  phone.socket.close();
});

it("ignores a stale resume id and sends a full snapshot", async () => {
  const { room, stub } = await setup();
  const amina = await join(stub, "Amina");
  const phone = await connect(stub, room.gameId, amina, "&patches=1&since=old.1");
  await expect.poll(() => phone.inbox.length).toBeGreaterThan(0);
  expect(phone.inbox[0]!.kind).toBe("snapshot");
  phone.socket.close();
});

import { env, evictDurableObject } from "cloudflare:test";
import { expect, it } from "vitest";
import { payloadDigest } from "../src/room/digest.ts";
import { withClientApiQuery } from "./client-api-key.ts";

async function setup() {
  const created = await env.ROOM_CODE_REGISTRY.getByName("codes").createLobby({
    requestId: crypto.randomUUID(),
    digest: await payloadDigest({ action: "create" }),
    now: new Date().toISOString(),
  });
  if (!created.ok) throw new Error(created.message);
  const stub = env.PARTY_ROOM.getByName(created.result.gameId);
  const control = {
    credentialId: created.result.control.credentialId,
    secret: created.result.control.secret,
  };
  const command = (action: string, fields = {}) =>
    stub.hostAction({
      ...control,
      action,
      requestId: crypto.randomUUID(),
      nowMs: Date.now(),
      ...fields,
    });
  const join = (nickname: string) =>
    stub.joinPlayer({
      nickname,
      requestId: crypto.randomUUID(),
      now: new Date().toISOString(),
    });
  return { stub, control, command, join };
}

it("persists host entry control, replays without changing it and keeps reconnect/transfer available", async () => {
  const { stub, control, command, join } = await setup();
  const player = await join("Amina");
  if (!player.ok) throw new Error(player.message);
  const close = {
    ...control,
    action: "close-joining",
    requestId: crypto.randomUUID(),
    nowMs: Date.now(),
  };
  expect((await stub.hostAction({ ...close, secret: "wrong" })).ok).toBe(false);
  expect((await stub.snapshotFor("control")).admission?.open).toBe(true);
  const closed = await stub.hostAction(close);
  expect(closed.ok).toBe(true);
  await evictDurableObject(stub);
  expect((await stub.snapshotFor("control")).admission).toMatchObject({
    open: false,
    history: [{ open: false, at: close.nowMs }],
  });
  expect(await join("Bilal")).toMatchObject({
    ok: false,
    message: expect.stringContaining("closed joining"),
  });
  expect(
    (
      await stub.resumeGuest({
        playerId: player.playerId,
        secret: player.secret,
        now: new Date().toISOString(),
      })
    ).ok,
  ).toBe(true);
  const code = await stub.issueTransfer({
    playerId: player.playerId,
    requestId: crypto.randomUUID(),
    now: new Date().toISOString(),
  });
  if (!code.ok) throw new Error(code.message);
  expect(
    (
      await stub.redeemTransfer({
        code: code.code,
        requestId: crypto.randomUUID(),
        now: new Date().toISOString(),
      })
    ).ok,
  ).toBe(true);
  expect((await command("open-joining")).ok).toBe(true);
  expect(await stub.hostAction(close)).toEqual(closed);
  expect((await stub.snapshotFor("control")).admission?.open).toBe(true);
  expect((await stub.hostAction({ ...close, action: "open-joining" })).ok).toBe(false);
  expect((await join("Bilal")).ok).toBe(true);
  expect((await stub.snapshotFor("stage")).admission).toBeUndefined();
  expect((await stub.snapshotFor("guest", player.playerId)).admission).toBeUndefined();
});

it("revokes outstanding transfer codes on removal and when issuing a replacement", async () => {
  const { stub, command, join } = await setup();
  const player = await join("Amina");
  if (!player.ok) throw new Error(player.message);
  const issue = () =>
    stub.issueTransfer({
      playerId: player.playerId,
      requestId: crypto.randomUUID(),
      now: new Date().toISOString(),
    });
  const redeem = (code: string) =>
    stub.redeemTransfer({
      code,
      requestId: crypto.randomUUID(),
      now: new Date().toISOString(),
    });
  expect(
    (
      await command("adjust", {
        playerId: player.playerId,
        points: 37,
        reason: "Recovery rehearsal",
      })
    ).ok,
  ).toBe(true);
  const old = await issue(),
    replacement = await issue();
  if (!old.ok || !replacement.ok) throw new Error("Transfer issue failed");
  expect((await redeem(old.code)).ok).toBe(false);
  expect((await command("kick", { playerId: player.playerId })).ok).toBe(true);
  expect((await redeem(replacement.code)).ok).toBe(false);
  const recovery = await command("recover", { playerId: player.playerId });
  expect(recovery.ok).toBe(true);
  if (!recovery.ok || !recovery.transferCode) throw new Error("Recovery failed");
  expect((await redeem(replacement.code)).ok).toBe(false);
  expect((await redeem(recovery.transferCode)).ok).toBe(true);
  expect(
    (await stub.snapshotFor("control")).adminPlayers?.find(
      (p) => p.playerId === player.playerId,
    )?.points,
  ).toBe(37);
  expect(
    (
      await stub.resumeGuest({
        playerId: player.playerId,
        secret: player.secret,
        now: new Date().toISOString(),
      })
    ).ok,
  ).toBe(false);
});

it.each(["open-joining", "close-joining"])(
  "authorises and replays %s without undoing a later decision",
  async (action) => {
    const { stub, control, command } = await setup();
    const opposite = action === "open-joining" ? "close-joining" : "open-joining";
    await command(opposite);
    const input = {
      ...control,
      action,
      nowMs: Date.now(),
      requestId: crypto.randomUUID(),
    };
    expect((await stub.hostAction({ ...input, secret: "wrong" })).ok).toBe(false);
    const accepted = await stub.hostAction(input);
    expect(accepted.ok).toBe(true);
    expect((await stub.snapshotFor("control")).admission?.open).toBe(
      action === "open-joining",
    );
    await command(opposite);
    expect(await stub.hostAction(input)).toEqual(accepted);
    expect((await stub.snapshotFor("control")).admission?.open).toBe(
      opposite === "open-joining",
    );
  },
);

it("refuses a recovery nickname collision with an actionable message and no partial recovery", async () => {
  const { stub, command, join } = await setup();
  const original = await join("Amina");
  if (!original.ok) throw new Error(original.message);
  await command("kick", { playerId: original.playerId });
  const replacement = await join("Amina");
  if (!replacement.ok) throw new Error(replacement.message);
  expect(await command("recover", { playerId: original.playerId })).toMatchObject({
    ok: false,
    message: expect.stringContaining("Rename the active player"),
  });
  expect(
    (await stub.snapshotFor("control")).adminPlayers?.find(
      (p) => p.playerId === original.playerId,
    )?.removed,
  ).toBe(true);
  await command("rename", { playerId: replacement.playerId, nickname: "Mina" });
  expect((await command("recover", { playerId: original.playerId })).ok).toBe(true);
});

it("does not disconnect a recovered phone when an old removal is retried", async () => {
  const { stub, control, command, join } = await setup();
  const player = await join("Amina");
  if (!player.ok) throw new Error(player.message);
  const kick = {
    ...control,
    action: "kick",
    playerId: player.playerId,
    requestId: crypto.randomUUID(),
    nowMs: Date.now(),
  };
  const removed = await stub.hostAction(kick);
  expect(removed.ok).toBe(true);
  const recovered = await command("recover", { playerId: player.playerId });
  if (!recovered.ok || !recovered.transferCode) throw new Error("Recovery failed");
  const moved = await stub.redeemTransfer({
    code: recovered.transferCode,
    requestId: crypto.randomUUID(),
    now: new Date().toISOString(),
  });
  if (!moved.ok) throw new Error(moved.message);
  const response = await stub.fetch(
    new Request(
      withClientApiQuery(`http://example.com/ws/${moved.gameId}?role=guest`),
      {
        headers: {
          Upgrade: "websocket",
          Connection: "Upgrade",
          Origin: "http://example.com",
          Cookie: `26_guest=${moved.gameId}.${moved.playerId}.${moved.secret}`,
        },
      },
    ),
  );
  expect(response.status).toBe(101);
  const socket = response.webSocket!;
  socket.accept();
  await message(socket, (data) => data.includes('"snapshot"'));
  expect(await stub.hostAction(kick)).toEqual(removed);
  const pong = message(socket, (data) => data === "pong");
  socket.send("ping");
  expect(await pong).toBe("pong");
  socket.close();
});

function message(
  socket: WebSocket,
  matches: (data: string) => boolean,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.removeEventListener("message", receive);
      reject(new Error("No socket response"));
    }, 5_000);
    function receive(event: MessageEvent) {
      const data = String(event.data);
      if (!matches(data)) return;
      clearTimeout(timer);
      socket.removeEventListener("message", receive);
      resolve(data);
    }
    socket.addEventListener("message", receive);
  });
}

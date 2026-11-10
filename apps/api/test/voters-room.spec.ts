import { env, evictDurableObject, runInDurableObject } from "cloudflare:test";
import { encode } from "jpeg-js";
import { expect, it } from "vitest";
import { withClientApiQuery } from "./client-api-key.ts";
import { finaliseUpload, type MediaBook } from "../src/media/finalise.ts";
import { localJpegPhoto } from "../src/media/photo.ts";
import { memoryObjectStore } from "../src/media/store.ts";
import { hideUpload } from "../src/media/records.ts";
import { payloadDigest } from "../src/room/digest.ts";
import { avatarClearedMessage, avatarPhotoMessage } from "../src/room/limits.ts";

type Stub = ReturnType<typeof env.PARTY_ROOM.getByName>;
type Player = { gameId: string; playerId: string; secret: string };

async function setup() {
  const created = await env.ROOM_CODE_REGISTRY.getByName("codes").createLobby({
    requestId: crypto.randomUUID(),
    digest: await payloadDigest({ action: "create" }),
    now: new Date().toISOString(),
  });
  if (!created.ok) throw new Error(created.message);
  const room = created.result;
  const stub = env.PARTY_ROOM.getByName(room.gameId);
  const join = async (nickname: string): Promise<Player> => {
    const joined = await stub.joinPlayer({
      nickname,
      requestId: crypto.randomUUID(),
      now: new Date().toISOString(),
    });
    if (!joined.ok) throw new Error(joined.message);
    return joined;
  };
  const control = {
    credentialId: room.control.credentialId,
    secret: room.control.secret,
  };
  return { gameId: room.gameId, stub, join, control };
}

async function untilPhase(
  stub: Stub,
  control: { credentialId: string; secret: string },
  phase: string,
) {
  for (let step = 0; step < 8; step += 1) {
    if ((await stub.snapshotFor("stage")).phase === phase) return;
    const moved = await stub.advanceRound({
      ...control,
      requestId: crypto.randomUUID(),
      nowMs: Date.now(),
    });
    if (!moved.ok) throw new Error(moved.message);
  }
  throw new Error(`The room did not reach ${phase}.`);
}

async function connect(stub: Stub, gameId: string, player: Player) {
  const response = await stub.fetch(
    new Request(withClientApiQuery(`http://example.com/ws/${gameId}?role=guest`), {
      headers: {
        Upgrade: "websocket",
        Connection: "Upgrade",
        Origin: "http://example.com",
        Cookie: `26_guest=${player.gameId}.${player.playerId}.${player.secret}`,
      },
    }),
  );
  const socket = response.webSocket!;
  socket.accept();
  const command = (body: Record<string, unknown>) =>
    new Promise<{ accepted: boolean; error?: string }>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("No acknowledgement.")), 5_000);
      const onMessage = (event: MessageEvent) => {
        const message = JSON.parse(String(event.data)) as {
          kind?: string;
          requestId?: string;
          accepted?: boolean;
          error?: string;
        };
        if (message.kind === "ack" && message.requestId === body.requestId) {
          clearTimeout(timer);
          socket.removeEventListener("message", onMessage);
          resolve({
            accepted: message.accepted === true,
            ...(message.error ? { error: message.error } : {}),
          });
        }
      };
      socket.addEventListener("message", onMessage);
      socket.send(JSON.stringify({ kind: "command", ...body }));
    });
  return {
    socket,
    avatar: (requestId: string, mediaId: unknown) =>
      command({ requestId, name: "avatar", mediaId }),
    answer: (optionId: string) =>
      command({ requestId: crypto.randomUUID(), name: "answer", optionId }),
  };
}

async function uploadFace(stub: Stub, player: Player) {
  const reserved = await stub.reserveMedia({
    playerId: player.playerId,
    secret: player.secret,
    requestId: crypto.randomUUID(),
    kind: "photo",
    purpose: "face",
    nowMs: Date.now(),
  });
  if (!reserved.ok) throw new Error(reserved.message);
  const store = memoryObjectStore();
  await store.put(reserved.tempKey, tinyJpeg(), {
    contentType: "image/jpeg",
    ifNoneMatch: false,
  });
  const final = await finaliseUpload({
    book: book(stub, player),
    store,
    uploadId: reserved.uploadId,
    playerId: player.playerId,
    nowMs: Date.now(),
    photo: localJpegPhoto,
  });
  if (!final.ok) throw new Error(final.message);
  return final.mediaId;
}

it("draws picks for the stage and host only, from the reveal of an `after` question", async () => {
  const { gameId, stub, join, control } = await setup();
  const amina = await join("Amina");
  const bilal = await join("Bilal");
  await stub.startDemo({
    ...control,
    requestId: crypto.randomUUID(),
    nowMs: Date.now(),
  });
  await untilPhase(stub, control, "collect");

  const aminaPhone = await connect(stub, gameId, amina);
  const bilalPhone = await connect(stub, gameId, bilal);
  const stagePlay = (await stub.snapshotFor("stage")).play;
  if (stagePlay?.question.kind !== "choice")
    throw new Error("Expected a choice question");
  // The first demo question keeps its picks until the reveal.
  expect(stagePlay.question.attribution).toBe("after");
  const [first, second] = stagePlay.question.options;
  expect((await aminaPhone.answer(first!.id)).accepted).toBe(true);
  expect((await bilalPhone.answer(second!.id)).accepted).toBe(true);
  expect((await stub.snapshotFor("stage")).play?.voters).toBeNull();

  await untilPhase(stub, control, "reveal");
  for (const audience of ["stage", "control"] as const) {
    const voters = (await stub.snapshotFor(audience)).play?.voters;
    expect(voters?.find((row) => row.optionId === first!.id)?.playerIds).toEqual([
      amina.playerId,
    ]);
    expect(voters?.find((row) => row.optionId === second!.id)?.playerIds).toEqual([
      bilal.playerId,
    ]);
  }
  // Phones never receive other players' picks, nor the host's switch.
  const guest = await stub.snapshotFor("guest", amina.playerId);
  expect(guest.play?.voters).toBeUndefined();
  expect(guest.voterDisplay).toBeUndefined();
  expect((await stub.snapshotFor("stage")).voterDisplay).toBeUndefined();
  aminaPhone.socket.close();
  bilalPhone.socket.close();
});

it("hides picks room-wide from the host switch, refuses bad credentials, and replays", async () => {
  const { gameId, stub, join, control } = await setup();
  const amina = await join("Amina");
  await stub.startDemo({
    ...control,
    requestId: crypto.randomUUID(),
    nowMs: Date.now(),
  });
  await untilPhase(stub, control, "collect");
  const phone = await connect(stub, gameId, amina);
  const play = (await stub.snapshotFor("stage")).play;
  if (play?.question.kind !== "choice") throw new Error("Expected a choice question");
  expect((await phone.answer(play.question.options[0]!.id)).accepted).toBe(true);
  await untilPhase(stub, control, "reveal");
  expect((await stub.snapshotFor("stage")).play?.voters).not.toBeNull();
  expect((await stub.snapshotFor("stage")).play?.attributions).not.toBeNull();

  const hide = {
    ...control,
    action: "voters-hidden",
    requestId: crypto.randomUUID(),
    nowMs: Date.now(),
  };
  expect((await stub.hostAction({ ...hide, secret: "incorrect" })).ok).toBe(false);
  const first = await stub.hostAction(hide);
  expect(first.ok).toBe(true);
  // Hidden means no names anywhere on a screen: not the board, not the name lists.
  for (const view of [
    await stub.snapshotFor("stage"),
    await stub.snapshotFor("guest", amina.playerId),
  ]) {
    expect(view.play?.voters ?? null).toBeNull();
    expect(view.play?.attributions).toBeNull();
    expect(view.play?.liveSample).toBeNull();
  }
  const host = await stub.snapshotFor("control");
  expect(host.voterDisplay?.mode).toBe("hidden");
  expect(host.voterDisplay?.history).toHaveLength(1);

  await evictDurableObject(stub);
  expect(await stub.hostAction(hide)).toEqual(first);
  expect((await stub.snapshotFor("control")).voterDisplay?.history).toHaveLength(1);

  const show = await stub.hostAction({
    ...control,
    action: "voters-question",
    requestId: crypto.randomUUID(),
    nowMs: Date.now(),
  });
  expect(show.ok).toBe(true);
  expect((await stub.snapshotFor("stage")).play?.voters).not.toBeNull();
  expect(
    (
      await stub.hostAction({
        ...control,
        action: "voters-hidden",
        requestId: crypto.randomUUID(),
        nowMs: -1,
      })
    ).ok,
  ).toBe(false);
  phone.socket.close();
});

it("sets, refuses, replays and removes a guest's profile photo", async () => {
  const { gameId, stub, join } = await setup();
  const amina = await join("Amina");
  const bilal = await join("Bilal");
  const face = await uploadFace(stub, amina);
  const bilalFace = await uploadFace(stub, bilal);
  const phone = await connect(stub, gameId, amina);

  const requestId = crypto.randomUUID();
  expect(await phone.avatar(requestId, face)).toEqual({ accepted: true });
  // The same request again comes from its receipt.
  expect(await phone.avatar(requestId, face)).toEqual({ accepted: true });
  const mine = (await stub.snapshotFor("stage")).players.find(
    (player) => player.playerId === amina.playerId,
  );
  expect(mine?.avatarMediaId).toBe(face);
  // A guest with no driver photo races with their profile photo.
  expect(mine?.driver?.faceMediaId).toBe(face);

  expect(await phone.avatar(crypto.randomUUID(), bilalFace)).toEqual({
    accepted: false,
    error: avatarPhotoMessage,
  });
  expect(await phone.avatar(crypto.randomUUID(), "not-a-photo")).toEqual({
    accepted: false,
    error: avatarPhotoMessage,
  });

  expect(await phone.avatar(crypto.randomUUID(), null)).toEqual({ accepted: true });
  expect(
    (await stub.snapshotFor("stage")).players.find(
      (player) => player.playerId === amina.playerId,
    )?.avatarMediaId,
  ).toBeUndefined();

  // Hiding the photo in Media takes it off every screen too.
  expect(await phone.avatar(crypto.randomUUID(), face)).toEqual({ accepted: true });
  await runInDurableObject(stub, (_instance, state) => {
    hideUpload(state.storage.sql, face);
  });
  expect(
    (await stub.snapshotFor("guest", bilal.playerId)).players.find(
      (player) => player.playerId === amina.playerId,
    )?.avatarMediaId,
  ).toBeUndefined();
  phone.socket.close();
});

it("lets the host remove a profile photo, refuses when there is none, and replays", async () => {
  const { gameId, stub, join, control } = await setup();
  const amina = await join("Amina");
  const face = await uploadFace(stub, amina);
  const phone = await connect(stub, gameId, amina);
  expect(await phone.avatar(crypto.randomUUID(), face)).toEqual({ accepted: true });
  expect((await stub.snapshotFor("control")).voterDisplay?.avatars).toBe(1);

  const clear = {
    ...control,
    action: "avatar-clear",
    playerId: amina.playerId,
    requestId: crypto.randomUUID(),
    nowMs: Date.now(),
  };
  const first = await stub.hostAction(clear);
  expect(first.ok).toBe(true);
  const after = await stub.snapshotFor("control");
  expect(
    after.players.find((player) => player.playerId === amina.playerId)?.avatarMediaId,
  ).toBeUndefined();
  expect(after.voterDisplay?.avatars).toBe(0);
  expect(await stub.hostAction(clear)).toEqual(first);

  // The removed photo is hidden, so it cannot simply be chosen again.
  expect(await phone.avatar(crypto.randomUUID(), face)).toEqual({
    accepted: false,
    error: avatarPhotoMessage,
  });
  const again = await stub.hostAction({ ...clear, requestId: crypto.randomUUID() });
  expect(again.ok).toBe(false);
  expect("message" in again ? again.message : "").toBe(avatarClearedMessage);
  phone.socket.close();
});

function tinyJpeg(): Uint8Array {
  const data = new Uint8Array(2 * 2 * 4);
  data[3] = 255;
  return encode({ data, width: 2, height: 2 }, 80).data;
}

function book(stub: Stub, player: Player): MediaBook {
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

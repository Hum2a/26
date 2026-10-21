import { env, runInDurableObject } from "cloudflare:test";
import { encode } from "jpeg-js";
import { expect, it } from "vitest";
import { driverStyles } from "@26/shared";
import { withClientApiQuery } from "./client-api-key.ts";
import { finaliseUpload, type MediaBook } from "../src/media/finalise.ts";
import { localJpegPhoto } from "../src/media/photo.ts";
import { memoryObjectStore } from "../src/media/store.ts";
import { hideUpload } from "../src/media/records.ts";
import { payloadDigest } from "../src/room/digest.ts";
import {
  driverFaceMessage,
  driverStyleMessage,
  mediaClosedMessage,
} from "../src/room/limits.ts";

type Stub = ReturnType<typeof env.PARTY_ROOM.getByName>;
type Player = { gameId: string; playerId: string; secret: string };

async function setup() {
  const created = await env.ROOM_CODE_REGISTRY.getByName("codes").createLobby({
    requestId: crypto.randomUUID(),
    digest: await payloadDigest({ action: "create" }),
    now: new Date().toISOString(),
  });
  if (!created.ok) throw new Error(created.message);
  const stub = env.PARTY_ROOM.getByName(created.result.gameId);
  const join = async (nickname: string): Promise<Player> => {
    const joined = await stub.joinPlayer({
      nickname,
      requestId: crypto.randomUUID(),
      now: new Date().toISOString(),
    });
    if (!joined.ok) throw new Error(joined.message);
    return joined;
  };
  return { gameId: created.result.gameId, stub, join };
}

async function uploadFace(
  stub: Stub,
  player: Player,
  purpose: "face" | "round" = "face",
) {
  const reserved = await stub.reserveMedia({
    playerId: player.playerId,
    secret: player.secret,
    requestId: crypto.randomUUID(),
    kind: "photo",
    purpose,
    nowMs: Date.now(),
  });
  if (!reserved.ok) return reserved;
  const store = memoryObjectStore();
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
  return {
    socket,
    send(requestId: string, style: unknown, faceMediaId: unknown) {
      return new Promise<{ accepted: boolean; error?: string }>((resolve) => {
        const onMessage = (event: MessageEvent) => {
          const message = JSON.parse(String(event.data)) as {
            kind?: string;
            requestId?: string;
            accepted?: boolean;
            error?: string;
          };
          if (message.kind === "ack" && message.requestId === requestId) {
            socket.removeEventListener("message", onMessage);
            resolve({
              accepted: message.accepted === true,
              ...(message.error ? { error: message.error } : {}),
            });
          }
        };
        socket.addEventListener("message", onMessage);
        socket.send(
          JSON.stringify({
            kind: "command",
            requestId,
            name: "driver",
            style,
            faceMediaId,
          }),
        );
      });
    },
  };
}

it("takes a face photo in the lobby but keeps question photos closed, and never lists faces as question media", async () => {
  const { stub, join } = await setup();
  const amina = await join("Amina");
  const round = await uploadFace(stub, amina, "round");
  expect(round.ok).toBe(false);
  expect("message" in round ? round.message : "").toBe(mediaClosedMessage);

  const face = await uploadFace(stub, amina);
  expect(face.ok).toBe(true);
  const snapshot = await stub.snapshotFor("stage");
  expect(snapshot.media).toEqual([]);
});

it("saves a chosen driver with a face, rejects bad choices, replays retries and drops a hidden face", async () => {
  const { gameId, stub, join } = await setup();
  const amina = await join("Amina");
  const bilal = await join("Bilal");
  const face = await uploadFace(stub, amina);
  if (!face.ok) throw new Error(face.message);
  const bilalFace = await uploadFace(stub, bilal);
  if (!bilalFace.ok) throw new Error(bilalFace.message);

  const phone = await connect(stub, gameId, amina);
  const requestId = crypto.randomUUID();
  expect(await phone.send(requestId, "party", face.mediaId)).toEqual({
    accepted: true,
  });
  // The same request again is answered from its receipt, not applied twice.
  expect(await phone.send(requestId, "party", face.mediaId)).toEqual({
    accepted: true,
  });

  const stage = await stub.snapshotFor("stage");
  const mine = stage.players.find((player) => player.playerId === amina.playerId);
  expect(mine?.driver).toEqual({ style: "party", faceMediaId: face.mediaId });

  expect(await phone.send(crypto.randomUUID(), "unicorn", null)).toEqual({
    accepted: false,
    error: driverStyleMessage,
  });
  expect(await phone.send(crypto.randomUUID(), "royal", bilalFace.mediaId)).toEqual({
    accepted: false,
    error: driverFaceMessage,
  });

  await runInDurableObject(stub, (_instance, state) => {
    hideUpload(state.storage.sql, face.mediaId);
  });
  const hidden = await stub.snapshotFor("stage");
  expect(
    hidden.players.find((player) => player.playerId === amina.playerId)?.driver,
  ).toEqual({
    style: "party",
  });
  phone.socket.close();
});

it("gives a guest who has not chosen a stable default driver", async () => {
  const { stub, join } = await setup();
  await join("Amina");
  await join("Bilal");
  const players = (await stub.snapshotFor("stage")).players;
  expect(players.map((player) => player.driver?.style)).toEqual([
    driverStyles[0].id,
    driverStyles[1].id,
  ]);
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

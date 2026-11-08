import {
  evictDurableObject,
  runDurableObjectAlarm,
  runInDurableObject,
} from "cloudflare:test";
import { expect, it } from "vitest";
import { withClientApiQuery } from "./client-api-key.ts";
import { wallAdvancePayload } from "../src/room/lifecycle.ts";
import { wallImageReportMessage } from "../src/room/limits.ts";
import { wallFailedShowMs } from "../src/wall/moderation.ts";
import {
  phone,
  posts,
  setup,
  upload,
  wallSettings,
  type Player,
  type Stub,
} from "./wall-support.ts";

type Room = Awaited<ReturnType<typeof setup>>;

async function post(stub: Stub, gameId: string, player: Player) {
  const photo = await upload(stub, player);
  if (!photo.ok) throw new Error(photo.message);
  const socket = await phone(stub, gameId, player);
  const ack = await socket.send({ name: "wall-post", mediaId: photo.mediaId });
  socket.socket.close();
  if (!ack.accepted) throw new Error(ack.error);
  const [latest] = (await posts(stub, player.playerId)).slice(-1);
  if (!latest) throw new Error("The post was not stored.");
  return latest.postId;
}

/** The projector's socket, signed in with the room's presentation credential. */
async function screen(room: Room, role: "stage" | "host") {
  const credential = role === "stage" ? room.presentation : room.control;
  const cookie =
    role === "stage"
      ? `26_room_presentation=${credential.credentialId}.${credential.secret}`
      : `26_room_control=${credential.credentialId}.${credential.secret}`;
  const response = await room.stub.fetch(
    new Request(
      withClientApiQuery(
        `http://example.com/ws/${room.gameId}?role=${role === "stage" ? "stage" : "control"}`,
      ),
      {
        headers: { Upgrade: "websocket", Origin: "http://example.com", Cookie: cookie },
      },
    ),
  );
  expect(response.status).toBe(101);
  const socket = response.webSocket!;
  socket.accept();
  return {
    socket,
    report(postId: unknown) {
      const requestId = crypto.randomUUID();
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
            resolve({ accepted: message.accepted === true, error: message.error });
          }
        };
        socket.addEventListener("message", onMessage);
        socket.send(
          JSON.stringify({
            kind: "command",
            requestId,
            name: "wall-image-failed",
            postId,
          }),
        );
      });
    },
  };
}

function showing(stub: Stub) {
  return runInDurableObject(
    stub,
    (_instance, state) =>
      state.storage.sql
        .exec<{ post_id: string; shown_at: number; until_at: number }>(
          `SELECT post_id, shown_at, until_at FROM wall_post WHERE status = 'showing'`,
        )
        .toArray()[0] ?? null,
  );
}

function advanceDue(stub: Stub) {
  return runInDurableObject(
    stub,
    (_instance, state) =>
      state.storage.sql
        .exec<{ due_at: number | null }>(
          `SELECT due_at FROM schedule_job WHERE job_id = ? AND status = 'pending'`,
          wallAdvancePayload,
        )
        .toArray()[0]?.due_at ?? null,
  );
}

/** Lets the shortened deadline pass and fires the room's own wall alarm. */
async function deadlinePasses(stub: Stub) {
  await runInDurableObject(stub, async (_instance, state) => {
    const past = Date.now() - 1;
    state.storage.sql.exec(
      `UPDATE wall_post SET until_at = ? WHERE status = 'showing'`,
      past,
    );
    state.storage.sql.exec(
      `UPDATE schedule_job SET due_at = ? WHERE job_id = ? AND status = 'pending'`,
      past,
      wallAdvancePayload,
    );
    await state.storage.setAlarm(past);
  });
  await runDurableObjectAlarm(stub);
}

it("moves a broken photo on through the normal rotation, once, after a short card", async () => {
  const room = await setup();
  await wallSettings(room.stub, { moderation: "direct" });
  const amina = await room.join("Amina");
  const bilal = await room.join("Bilal");
  const aminaPost = await post(room.stub, room.gameId, amina);
  const bilalPost = await post(room.stub, room.gameId, bilal);
  const before = await showing(room.stub);
  expect(before?.post_id).toBe(aminaPost);
  const fullEnd = before!.until_at;

  const stage = await screen(room, "stage");
  expect(await stage.report(aminaPost)).toEqual({ accepted: true });
  const shortened = await showing(room.stub);
  // Still the same photo, now ending two seconds after it started, never sooner.
  expect(shortened?.post_id).toBe(aminaPost);
  expect(shortened!.until_at).toBeLessThan(fullEnd);
  expect(shortened!.until_at).toBeGreaterThanOrEqual(
    shortened!.shown_at + wallFailedShowMs,
  );
  expect(await advanceDue(room.stub)).toBe(shortened!.until_at);

  // A repeat is ignored and changes nothing.
  expect(await stage.report(aminaPost)).toEqual({
    accepted: false,
    error: wallImageReportMessage,
  });
  expect((await showing(room.stub))!.until_at).toBe(shortened!.until_at);

  // The room's own alarm moves on to the next photo, at its full time.
  await deadlinePasses(room.stub);
  const next = await showing(room.stub);
  expect(next?.post_id).toBe(bilalPost);
  expect(next!.until_at - next!.shown_at).toBeGreaterThan(wallFailedShowMs);
  expect(
    (await posts(room.stub, amina.playerId)).find((p) => p.postId === aminaPost)
      ?.status,
  ).toBe("shown");

  // A late report for the photo that already left cannot skip the new one.
  expect((await stage.report(aminaPost)).accepted).toBe(false);
  expect((await showing(room.stub))!.until_at).toBe(next!.until_at);

  // The next photo is broken too: it still gets its two-second card.
  expect((await stage.report(bilalPost)).accepted).toBe(true);
  const second = await showing(room.stub);
  expect(second!.until_at).toBeGreaterThanOrEqual(second!.shown_at + wallFailedShowMs);
  stage.socket.close();
});

it("refuses reports from guests, the host screen and for posts that are not showing", async () => {
  const room = await setup();
  await wallSettings(room.stub, { moderation: "direct" });
  const amina = await room.join("Amina");
  const aminaPost = await post(room.stub, room.gameId, amina);
  const fullEnd = (await showing(room.stub))!.until_at;

  const guest = await phone(room.stub, room.gameId, amina);
  expect(
    (await guest.send({ name: "wall-image-failed", postId: aminaPost })).accepted,
  ).toBe(false);
  guest.socket.close();

  const hostScreen = await screen(room, "host");
  expect((await hostScreen.report(aminaPost)).accepted).toBe(false);
  hostScreen.socket.close();

  const stage = await screen(room, "stage");
  for (const postId of [crypto.randomUUID(), "not-a-post", 42, null]) {
    expect((await stage.report(postId)).accepted).toBe(false);
  }
  stage.socket.close();
  expect((await showing(room.stub))!.until_at).toBe(fullEnd);
});

it("lets the host skip a reported photo, and the next one keeps its full time", async () => {
  const room = await setup();
  await wallSettings(room.stub, { moderation: "direct" });
  const amina = await room.join("Amina");
  const bilal = await room.join("Bilal");
  const aminaPost = await post(room.stub, room.gameId, amina);
  const bilalPost = await post(room.stub, room.gameId, bilal);
  const stage = await screen(room, "stage");
  expect((await stage.report(aminaPost)).accepted).toBe(true);
  // The host does not have to wait for the short card.
  expect((await room.host("wall-skip")).ok).toBe(true);
  const next = await showing(room.stub);
  expect(next?.post_id).toBe(bilalPost);
  expect(next!.until_at - next!.shown_at).toBeGreaterThan(wallFailedShowMs);
  // The skipped photo's late report changes nothing.
  expect((await stage.report(aminaPost)).accepted).toBe(false);
  expect((await showing(room.stub))!.until_at).toBe(next!.until_at);
  stage.socket.close();
});

it("ends cleanly when the last photo is broken, and ignores reports with the wall off", async () => {
  const room = await setup();
  await wallSettings(room.stub, { moderation: "direct" });
  const amina = await room.join("Amina");
  const aminaPost = await post(room.stub, room.gameId, amina);
  const stage = await screen(room, "stage");
  expect((await stage.report(aminaPost)).accepted).toBe(true);
  await deadlinePasses(room.stub);
  // Empty queue: nothing on screen and no wake-up left behind.
  expect(await showing(room.stub)).toBeNull();
  expect(await advanceDue(room.stub)).toBeNull();
  expect((await stage.report(aminaPost)).accepted).toBe(false);

  // A new photo, then the host switches the wall off: a report has nothing to end.
  const bilal = await room.join("Bilal");
  const bilalPost = await post(room.stub, room.gameId, bilal);
  expect((await showing(room.stub))?.post_id).toBe(bilalPost);
  expect(
    (await room.host("wall-settings", { wallSettings: { enabled: false } })).ok,
  ).toBe(true);
  expect(await showing(room.stub)).toBeNull();
  expect((await stage.report(bilalPost)).accepted).toBe(false);
  expect(await advanceDue(room.stub)).toBeNull();
  stage.socket.close();
});

it("keeps one shortened deadline across a projector reconnect and an eviction", async () => {
  const room = await setup();
  await wallSettings(room.stub, { moderation: "direct" });
  const amina = await room.join("Amina");
  const bilal = await room.join("Bilal");
  const aminaPost = await post(room.stub, room.gameId, amina);
  await post(room.stub, room.gameId, bilal);
  const first = await screen(room, "stage");
  expect((await first.report(aminaPost)).accepted).toBe(true);
  first.socket.close();
  const shortened = (await showing(room.stub))!.until_at;

  // A reconnected projector sees the same photo fail again: a repeat, ignored.
  const again = await screen(room, "stage");
  expect((await again.report(aminaPost)).accepted).toBe(false);
  again.socket.close();
  expect((await showing(room.stub))!.until_at).toBe(shortened);

  // Storage, the wake-up and every snapshot agree, before and after eviction.
  for (const step of ["before", "after"]) {
    if (step === "after") await evictDurableObject(room.stub);
    expect((await showing(room.stub))?.post_id).toBe(aminaPost);
    expect((await showing(room.stub))!.until_at).toBe(shortened);
    expect(await advanceDue(room.stub)).toBe(shortened);
    for (const audience of ["stage", "control"] as const) {
      const wall = (await room.stub.snapshotFor(audience)).wall;
      expect(wall?.now?.postId).toBe(aminaPost);
      expect(wall?.now?.untilAt).toBe(shortened);
    }
  }
});

it("tells the host which photo could not be displayed, and nobody else", async () => {
  const room = await setup();
  await wallSettings(room.stub, { moderation: "direct" });
  const amina = await room.join("Amina");
  const bilal = await room.join("Bilal");
  const aminaPost = await post(room.stub, room.gameId, amina);
  const bilalPost = await post(room.stub, room.gameId, bilal);
  const stage = await screen(room, "stage");
  expect((await stage.report(aminaPost)).accepted).toBe(true);
  stage.socket.close();
  // The host's view marks the photo on screen; no other view mentions it.
  expect((await room.stub.snapshotFor("control")).wall?.now).toMatchObject({
    postId: aminaPost,
    displayFailed: true,
  });
  for (const view of [
    await room.stub.snapshotFor("stage"),
    await room.stub.snapshotFor("guest", amina.playerId),
    await room.stub.snapshotFor("guest", bilal.playerId),
  ])
    expect(JSON.stringify(view)).not.toContain("displayFailed");
  // Once it has moved on, the host's history keeps the mark; the healthy one has none.
  await deadlinePasses(room.stub);
  await deadlinePasses(room.stub);
  const recent = (await room.stub.snapshotFor("control")).wall?.recent ?? [];
  expect(recent.find((item) => item.postId === aminaPost)?.displayFailed).toBe(true);
  expect(
    recent.find((item) => item.postId === bilalPost)?.displayFailed,
  ).toBeUndefined();
  // It survives eviction.
  await evictDurableObject(room.stub);
  expect(
    (await room.stub.snapshotFor("control")).wall?.recent?.find(
      (item) => item.postId === aminaPost,
    )?.displayFailed,
  ).toBe(true);
});

it("marks a photo that fails as it is already ending, once, without moving its end", async () => {
  const room = await setup();
  await wallSettings(room.stub, { moderation: "direct" });
  const amina = await room.join("Amina");
  const aminaPost = await post(room.stub, room.gameId, amina);
  // Started half a second ago and ends in one: sooner than the two-second card.
  await runInDurableObject(room.stub, (_instance, state) => {
    state.storage.sql.exec(
      `UPDATE wall_post SET shown_at = ?, until_at = ? WHERE status = 'showing'`,
      Date.now() - 500,
      Date.now() + 1_000,
    );
  });
  const end = (await showing(room.stub))!.until_at;
  const stage = await screen(room, "stage");
  expect((await stage.report(aminaPost)).accepted).toBe(true);
  expect((await showing(room.stub))!.until_at).toBe(end);
  expect((await room.stub.snapshotFor("control")).wall?.now?.displayFailed).toBe(true);
  // A repeat stays harmless.
  expect((await stage.report(aminaPost)).accepted).toBe(false);
  expect((await showing(room.stub))!.until_at).toBe(end);
  stage.socket.close();
});

it("still moves a broken photo on while the round is paused", async () => {
  const room = await setup();
  await wallSettings(room.stub, { moderation: "direct" });
  // Corner placement keeps the wall running during a question.
  expect(
    (await room.host("wall-settings", { wallSettings: { placement: "corner" } })).ok,
  ).toBe(true);
  const amina = await room.join("Amina");
  const bilal = await room.join("Bilal");
  const credential = {
    credentialId: room.control.credentialId,
    secret: room.control.secret,
  };
  expect(
    (
      await room.stub.startDemo({
        ...credential,
        requestId: crypto.randomUUID(),
        nowMs: Date.now(),
      })
    ).ok,
  ).toBe(true);
  for (let step = 0; step < 12; step += 1) {
    if ((await room.stub.snapshotFor("stage")).phase === "collect") break;
    await room.stub.advanceRound({
      ...credential,
      requestId: crypto.randomUUID(),
      nowMs: Date.now(),
    });
  }
  expect((await room.stub.snapshotFor("stage")).phase).toBe("collect");
  expect(
    (
      await room.stub.pauseRound({
        ...credential,
        requestId: crypto.randomUUID(),
        nowMs: Date.now(),
      })
    ).ok,
  ).toBe(true);
  expect((await room.stub.snapshotFor("stage")).paused).toBe(true);
  const aminaPost = await post(room.stub, room.gameId, amina);
  const bilalPost = await post(room.stub, room.gameId, bilal);
  expect((await showing(room.stub))?.post_id).toBe(aminaPost);
  const stage = await screen(room, "stage");
  expect((await stage.report(aminaPost)).accepted).toBe(true);
  stage.socket.close();
  // The wall's own background alarm runs during a pause, as it always has.
  await deadlinePasses(room.stub);
  const next = await showing(room.stub);
  expect(next?.post_id).toBe(bilalPost);
  expect(next!.until_at - next!.shown_at).toBeGreaterThan(wallFailedShowMs);
  expect((await room.stub.snapshotFor("stage")).paused).toBe(true);
});

it("ignores a projector in another room reporting this room's photo", async () => {
  const room = await setup();
  const other = await setup();
  await wallSettings(room.stub, { moderation: "direct" });
  const amina = await room.join("Amina");
  const aminaPost = await post(room.stub, room.gameId, amina);
  const fullEnd = (await showing(room.stub))!.until_at;
  const otherStage = await screen(other, "stage");
  expect((await otherStage.report(aminaPost)).accepted).toBe(false);
  otherStage.socket.close();
  expect((await showing(room.stub))!.until_at).toBe(fullEnd);
  // This room's projector credential does not open the other room either.
  const crossed = await room.stub.fetch(
    new Request(withClientApiQuery(`http://example.com/ws/${room.gameId}?role=stage`), {
      headers: {
        Upgrade: "websocket",
        Origin: "http://example.com",
        Cookie: `26_room_presentation=${other.presentation.credentialId}.${other.presentation.secret}`,
      },
    }),
  );
  expect(crossed.status).not.toBe(101);
});

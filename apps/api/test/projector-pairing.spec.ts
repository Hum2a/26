import { env, evictDurableObject, runInDurableObject } from "cloudflare:test";
import { Hono } from "hono";
import { expect, it } from "vitest";
import { registerRoomPairingRoutes } from "../src/credentials/pairing-routes.ts";
import {
  maxPairingFailures,
  normalisePairingCode,
  pairingCodeTtlMs,
  pairingStorage,
  pairingRedeemRateLimit,
  pairingSpentMessage,
} from "../src/credentials/pairing.ts";
import { readCredentialCookie } from "../src/credentials/cookies.ts";
import { presentationCredentialTtlMs } from "../src/credentials/verify.ts";
import { payloadDigest } from "../src/room/digest.ts";
import { withClientApiQuery } from "./client-api-key.ts";
import {
  localAdminProof,
  localAdminProofHeader,
} from "../src/room/local-auth-proof.ts";

async function createRoom() {
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
  const issue = (nowMs = Date.now()) =>
    stub.issueProjectorPairing({ ...control, requestId: crypto.randomUUID(), nowMs });
  const redeem = (code: string, nowMs = Date.now(), requestId = crypto.randomUUID()) =>
    stub.redeemProjectorPairing({ code, requestId, nowMs });
  return { created: created.result, stub, control, issue, redeem };
}

it("issues a code only to the room's control credential", async () => {
  const { stub, control } = await createRoom();
  const refused = await stub.issueProjectorPairing({
    ...control,
    secret: "wrong",
    requestId: crypto.randomUUID(),
    nowMs: Date.now(),
  });
  expect(refused.ok).toBe(false);
  const issued = await stub.issueProjectorPairing({
    ...control,
    requestId: crypto.randomUUID(),
    nowMs: Date.now(),
  });
  if (!issued.ok) throw new Error(issued.message);
  expect(issued.code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/);
  expect(Date.parse(issued.expiresAt) - Date.now()).toBeLessThanOrEqual(
    pairingCodeTtlMs,
  );
});

it("redeems a code once for a presentation credential that lasts the night", async () => {
  const { stub, created, issue, redeem } = await createRoom();
  const issued = await issue();
  if (!issued.ok) throw new Error(issued.message);
  const requestId = crypto.randomUUID();
  const paired = await redeem(issued.code, Date.now(), requestId);
  if (!paired.ok) throw new Error(paired.message);
  expect(paired).toMatchObject({ gameId: created.gameId, joinCode: created.joinCode });
  const lifetime = Date.parse(paired.presentation.expiresAt) - Date.now();
  expect(lifetime).toBeGreaterThan(presentationCredentialTtlMs - 60_000);
  expect(lifetime).toBeLessThanOrEqual(presentationCredentialTtlMs);
  const verify = (credential = paired.presentation) =>
    stub.verifyPresentation({
      credentialId: credential.credentialId,
      secret: credential.secret,
      now: new Date().toISOString(),
    });
  // Persisted before the caller is told: it survives losing memory.
  await evictDurableObject(stub);
  expect(await verify()).toEqual({ ok: true });
  // The paired credential is presentation only, never control.
  const asControl = await stub.issueProjectorPairing({
    credentialId: paired.presentation.credentialId,
    secret: paired.presentation.secret,
    requestId: crypto.randomUUID(),
    nowMs: Date.now(),
  });
  expect(asControl.ok).toBe(false);
  // A retry with the same request gets the same credential back.
  expect(await redeem(issued.code, Date.now(), requestId)).toEqual(paired);
  // A fresh attempt with the used code is refused.
  expect(await redeem(issued.code)).toMatchObject({
    ok: false,
    error: "invalid",
    message: expect.stringContaining("no longer valid"),
  });
});

it("refuses an expired code, and a new code voids the one before it", async () => {
  const { issue, redeem } = await createRoom();
  const issuedAt = Date.now();
  const expired = await issue(issuedAt);
  if (!expired.ok) throw new Error(expired.message);
  expect(await redeem(expired.code, issuedAt + pairingCodeTtlMs + 1)).toMatchObject({
    ok: false,
    error: "expired",
  });
  const first = await issue(),
    second = await issue();
  if (!first.ok || !second.ok) throw new Error("Pairing issue failed");
  expect((await redeem(first.code)).ok).toBe(false);
  expect((await redeem(second.code)).ok).toBe(true);
});

it("pairs only the room that issued the code", async () => {
  const roomA = await createRoom();
  const roomB = await createRoom();
  const issued = await roomA.issue();
  if (!issued.ok) throw new Error(issued.message);
  expect(await roomB.redeem(issued.code)).toMatchObject({
    ok: false,
    error: "invalid",
  });
  const paired = await roomA.redeem(issued.code);
  if (!paired.ok) throw new Error(paired.message);
  expect(
    await roomB.stub.verifyPresentation({
      credentialId: paired.presentation.credentialId,
      secret: paired.presentation.secret,
      now: new Date().toISOString(),
    }),
  ).toEqual({ ok: false });
});

it("rate-limits guesses and voids the open code after too many wrong ones", async () => {
  const { stub, issue, redeem } = await createRoom();
  const issued = await issue();
  if (!issued.ok) throw new Error(issued.message);
  const wrong = issued.code === "AAAAAAAA" ? "BBBBBBBB" : "AAAAAAAA";
  for (let attempt = 0; attempt < pairingRedeemRateLimit.capacity; attempt += 1) {
    expect(await redeem(wrong)).toMatchObject({ ok: false, error: "invalid" });
  }
  // Even the right code waits once the room's attempts are spent.
  expect(await redeem(issued.code)).toMatchObject({ ok: false, error: "rate_limited" });
  // Losing memory resets the limiter, but wrong guesses are counted durably.
  let failures = pairingRedeemRateLimit.capacity;
  while (failures < maxPairingFailures) {
    await evictDurableObject(stub);
    for (
      let attempt = 0;
      attempt < pairingRedeemRateLimit.capacity && failures < maxPairingFailures;
      attempt += 1, failures += 1
    ) {
      expect((await redeem(wrong)).ok).toBe(false);
    }
  }
  await evictDurableObject(stub);
  expect(await redeem(issued.code)).toMatchObject({
    ok: false,
    message: expect.stringContaining("no longer valid"),
  });
});

it("normalises typed codes", () => {
  expect(normalisePairingCode(" abcd-efgh ")).toBe("ABCDEFGH");
  expect(normalisePairingCode("ABCD EFG2")).toBe("ABCDEFG2");
  expect(normalisePairingCode("ABCDEFG1")).toBeUndefined();
  expect(normalisePairingCode("ABCDEFG")).toBeUndefined();
  expect(normalisePairingCode(12345678)).toBeUndefined();
});

it("replays a refused redeem instead of counting it as another guess", async () => {
  const { stub, issue, redeem } = await createRoom();
  const issued = await issue();
  if (!issued.ok) throw new Error(issued.message);
  const wrong = issued.code === "AAAAAAAA" ? "BBBBBBBB" : "AAAAAAAA";
  const requestId = crypto.randomUUID();
  const refused = await redeem(wrong, Date.now(), requestId);
  expect(refused).toMatchObject({ ok: false, error: "invalid" });
  for (let retry = 0; retry < 3; retry += 1) {
    expect(await redeem(wrong, Date.now(), requestId)).toEqual(refused);
  }
  const failures = await runInDurableObject(stub, (_instance, state) =>
    state.storage.sql
      .exec<{ failures: number }>(`SELECT failures FROM projector_pairing`)
      .toArray()
      .map((row) => row.failures),
  );
  expect(failures).toEqual([1]);
  expect((await redeem(issued.code)).ok).toBe(true);
});

it("keeps the plain code in its receipt only while the code is open", async () => {
  const { stub, control, redeem } = await createRoom();
  const requestId = crypto.randomUUID();
  const issue = () =>
    stub.issueProjectorPairing({ ...control, requestId, nowMs: Date.now() });
  const issued = await issue();
  if (!issued.ok) throw new Error(issued.message);
  // A retried request shows the same open code instead of voiding it.
  expect(await issue()).toEqual(issued);
  expect((await redeem(issued.code)).ok).toBe(true);
  expect(await issue()).toEqual({
    ok: false,
    error: "invalid",
    message: pairingSpentMessage,
  });
  const receipts = await runInDurableObject(stub, (_instance, state) =>
    state.storage.sql
      .exec<{ result_json: string }>(
        `SELECT result_json FROM receipt WHERE principal = ?`,
        `${pairingStorage("presentation").principal}-issue`,
      )
      .toArray()
      .map((row) => row.result_json),
  );
  expect(receipts).toHaveLength(1);
  expect(receipts[0]).not.toContain(issued.code);
});

it("serves issue to the signed-in admin and sets the presentation cookie on redeem", async () => {
  const app = new Hono<{ Bindings: Env }>();
  registerRoomPairingRoutes(app);
  const proofKey = "p".repeat(64);
  const bindings = { ...env, APP_ENV: "local", LOCAL_ADMIN_PROOF_KEY: proofKey } as Env;
  const origin = "https://example.com";
  const { created, control, stub } = await createRoom();
  const post = (
    path: string,
    body: unknown,
    options: { cookie?: string; admin?: boolean; origin?: string } = {},
  ) => {
    const request = new Request(`${origin}${path}`, {
      method: "POST",
      headers: {
        origin: options.origin ?? origin,
        "content-type": "application/json",
        ...(options.cookie ? { cookie: options.cookie } : {}),
      },
      body: JSON.stringify(body),
    });
    if (options.admin)
      request.headers.set(
        localAdminProofHeader,
        localAdminProof(proofKey, request, Date.now()),
      );
    return app.request(request, undefined, bindings);
  };
  const issuePath = `/api/admin/rooms/${created.gameId}/projector-pairing`;
  const controlCookie = `26_room_control=${control.credentialId}.${control.secret}`;
  // Not signed in to admin.
  expect(
    (
      await post(
        issuePath,
        { requestId: crypto.randomUUID() },
        { cookie: controlCookie },
      )
    ).status,
  ).toBe(401);
  // Signed in, but without this room's control credential.
  expect(
    (await post(issuePath, { requestId: crypto.randomUUID() }, { admin: true })).status,
  ).toBe(401);
  const issuedResponse = await post(
    issuePath,
    { requestId: crypto.randomUUID() },
    { cookie: controlCookie, admin: true },
  );
  expect(issuedResponse.status).toBe(200);
  expect(issuedResponse.headers.get("cache-control")).toBe("no-store");
  const issued = (await issuedResponse.json()) as { code: string; expiresAt: string };
  const typed = `${issued.code.slice(0, 4).toLowerCase()}-${issued.code.slice(4)}`;

  const redeemPath = "/api/stage/pair";
  const crossSite = await post(
    redeemPath,
    { joinCode: created.joinCode, code: typed, requestId: crypto.randomUUID() },
    { origin: "https://elsewhere.example" },
  );
  expect(crossSite.status).toBe(403);
  const paired = await post(redeemPath, {
    joinCode: created.joinCode.toLowerCase(),
    code: typed,
    requestId: crypto.randomUUID(),
  });
  expect(paired.status).toBe(200);
  expect(await paired.json()).toMatchObject({
    gameId: created.gameId,
    joinCode: created.joinCode,
  });
  const setCookie = paired.headers.get("set-cookie") ?? "";
  expect(setCookie).toMatch(/^26_room_presentation=/);
  expect(setCookie).toContain("HttpOnly");
  expect(setCookie).toContain("SameSite=Strict");
  const presented = readCredentialCookie(setCookie.split(";")[0], "presentation");
  if (!presented) throw new Error("No presentation cookie");
  expect(
    await stub.verifyPresentation({ ...presented, now: new Date().toISOString() }),
  ).toEqual({ ok: true });
  const again = await post(redeemPath, {
    joinCode: created.joinCode,
    code: issued.code,
    requestId: crypto.randomUUID(),
  });
  expect(again.status).toBe(400);
  expect(again.headers.get("set-cookie")).toBeNull();
  expect(
    (
      await post(redeemPath, {
        joinCode: created.joinCode,
        code: "not a code",
        requestId: crypto.randomUUID(),
      })
    ).status,
  ).toBe(400);
});

it("pairs Baseer separately, lets his phone advance the visible beat and revokes access", async () => {
  const { created, control, stub, issue } = await createRoom();
  const app = new Hono<{ Bindings: Env }>();
  registerRoomPairingRoutes(app);
  const proofKey = "p".repeat(64);
  const bindings = { ...env, APP_ENV: "local", LOCAL_ADMIN_PROOF_KEY: proofKey } as Env;
  const origin = "https://example.com";
  const post = (path: string, body: object, cookie?: string, admin = false) => {
    const request = new Request(`${origin}${path}`, {
      method: "POST",
      headers: {
        origin,
        "content-type": "application/json",
        ...(cookie ? { cookie } : {}),
      },
      body: JSON.stringify(body),
    });
    if (admin)
      request.headers.set(
        localAdminProofHeader,
        localAdminProof(proofKey, request, Date.now()),
      );
    return app.request(request, undefined, bindings);
  };
  const controlCookie = `26_room_control=${control.credentialId}.${control.secret}`;
  const issuePath = `/api/admin/rooms/${created.gameId}/presenter-pairing`;
  const presenterCode = async () => {
    const response = await post(
      issuePath,
      { requestId: crypto.randomUUID() },
      controlCookie,
      true,
    );
    expect(response.status).toBe(200);
    return ((await response.json()) as { code: string }).code;
  };
  const pair = (code: string, path = "/api/presenter/pair") =>
    post(path, {
      joinCode: created.joinCode,
      code,
      requestId: crypto.randomUUID(),
    });
  expect(
    (await post(issuePath, { requestId: crypto.randomUUID() }, controlCookie)).status,
  ).toBe(401);
  const code = await presenterCode();
  const projector = await issue();
  if (!projector.ok) throw new Error(projector.message);
  expect((await pair(projector.code)).status).toBe(400);
  expect((await pair(code, "/api/stage/pair")).status).toBe(400);
  const paired = await pair(code);
  expect(paired.status).toBe(200);
  const cookie = paired.headers.get("set-cookie")?.split(";")[0];
  expect(cookie).toMatch(/^26_room_presenter=/);
  if (!cookie) throw new Error("Presenter cookie missing");
  expect((await pair(code)).status).toBe(400);
  const presenter = readCredentialCookie(cookie, "presenter")!;
  expect(
    (await stub.adminRoom({ ...presenter, now: new Date().toISOString() })).ok,
  ).toBe(false);
  const view = await stub.snapshotFor("control");
  expect(view.players).toHaveLength(0);
  expect(view.presenterAccess?.pairedAt).toBeTypeOf("number");
  for (const audience of ["stage", "guest"] as const) {
    expect(await stub.snapshotFor(audience)).not.toHaveProperty("presenterAccess");
    expect(await stub.snapshotFor(audience)).not.toHaveProperty("phaseGeneration");
  }
  const advancePath = `/api/presenter/${created.gameId}/advance`;
  const intent = (expectedPhaseGeneration: number) => ({
    requestId: crypto.randomUUID(),
    expectedPhaseGeneration,
  });
  expect((await post(advancePath, intent(view.phaseGeneration!))).status).toBe(401);
  expect((await post(advancePath, intent(view.phaseGeneration!), cookie)).status).toBe(
    400,
  );
  const response = await stub.fetch(
    new Request(withClientApiQuery(`${origin}/ws/${created.gameId}?role=presenter`), {
      headers: { origin, Upgrade: "websocket", Connection: "Upgrade", Cookie: cookie },
    }),
  );
  expect(response.status).toBe(101);
  const socket = response.webSocket!;
  socket.accept();
  const snapshots: Record<string, unknown>[] = [];
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(String(event.data));
    if (message.kind === "snapshot") snapshots.push(message.snapshot);
  });
  try {
    await expect.poll(() => snapshots[0]?.phase).toBe("lobby");
    expect(snapshots[0]?.phaseGeneration).toBe(view.phaseGeneration);
    expect(snapshots[0]).not.toHaveProperty("presenterAccess");
    expect(snapshots[0]).not.toHaveProperty("developerTools");
    expect((await stub.snapshotFor("control")).presenterAccess?.connected).toBe(true);
    await stub.startDemo({
      ...control,
      requestId: crypto.randomUUID(),
      nowMs: Date.now(),
    });
    const intro = await stub.snapshotFor("control");
    const show = intent(intro.phaseGeneration!);
    const prompt = await post(advancePath, show, cookie);
    expect(prompt.status).toBe(200);
    const receipt = await prompt.json();
    expect(receipt).toMatchObject({ phase: "prompt" });
    expect(await (await post(advancePath, show, cookie)).json()).toEqual(receipt);
    expect(
      (await post(advancePath, intent(intro.phaseGeneration!), cookie)).status,
    ).toBe(400);
    expect((await stub.snapshotFor("control")).phase).toBe("prompt");
    const open = intent((await stub.snapshotFor("control")).phaseGeneration!);
    await stub.pauseRound({
      ...control,
      requestId: crypto.randomUUID(),
      nowMs: Date.now(),
    });
    expect((await post(advancePath, open, cookie)).status).toBe(400);
    await stub.resumeRound({
      ...control,
      requestId: crypto.randomUUID(),
      nowMs: Date.now(),
    });
    expect((await post(advancePath, open, cookie)).status).toBe(200);
    const collect = await stub.snapshotFor("control");
    expect(collect.deadlineAt).toBeGreaterThan(Date.now());
    const closed = await post(advancePath, intent(collect.phaseGeneration!), cookie);
    expect(await closed.json()).toMatchObject({ phase: "reveal" });
    await stub.hostAction({
      ...control,
      action: "hide",
      requestId: crypto.randomUUID(),
      nowMs: Date.now(),
    });
    expect((await stub.snapshotFor("stage")).play).toBeNull();
    await expect
      .poll(() => snapshots.at(-1))
      .toMatchObject({
        phase: "reveal",
        stageHidden: true,
        play: { question: expect.any(Object) },
      });
    const unused = await presenterCode();
    const revoke = {
      ...control,
      action: "presenter-revoke",
      requestId: crypto.randomUUID(),
      nowMs: Date.now(),
    };
    expect((await stub.hostAction({ ...revoke, ...presenter })).ok).toBe(false);
    const revoked = await stub.hostAction(revoke);
    expect(revoked.ok).toBe(true);
    expect(await stub.hostAction(revoke)).toEqual(revoked);
    expect((await post(advancePath, open, cookie)).status).toBe(401);
    expect((await pair(unused)).status).toBe(400);
    await expect
      .poll(async () => (await stub.snapshotFor("control")).presenterAccess?.connected)
      .toBe(false);
  } finally {
    socket.close();
  }
});

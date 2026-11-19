import { env, evictDurableObject } from "cloudflare:test";
import { Hono } from "hono";
import { beforeEach, expect, it, vi } from "vitest";
vi.mock("../src/auth/routes.ts", () => ({ administratorForRequest: vi.fn() }));
import { administratorForRequest } from "../src/auth/routes.ts";
import { registerProjectorPairingRoutes } from "../src/credentials/pairing-routes.ts";
import {
  maxPairingFailures,
  normalisePairingCode,
  pairingCodeTtlMs,
  pairingRedeemRateLimit,
} from "../src/credentials/pairing.ts";
import { readCredentialCookie } from "../src/credentials/cookies.ts";
import { presentationCredentialTtlMs } from "../src/credentials/verify.ts";
import { payloadDigest } from "../src/room/digest.ts";

beforeEach(() => {
  vi.mocked(administratorForRequest).mockResolvedValue({ email: "admin@example.test" });
});

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
    message: expect.stringContaining("already been used"),
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
    message: expect.stringContaining("already been used"),
  });
});

it("normalises typed codes", () => {
  expect(normalisePairingCode(" abcd-efgh ")).toBe("ABCDEFGH");
  expect(normalisePairingCode("ABCD EFG2")).toBe("ABCDEFG2");
  expect(normalisePairingCode("ABCDEFG1")).toBeUndefined();
  expect(normalisePairingCode("ABCDEFG")).toBeUndefined();
  expect(normalisePairingCode(12345678)).toBeUndefined();
});

it("serves issue to the signed-in admin and sets the presentation cookie on redeem", async () => {
  const app = new Hono<{ Bindings: Env }>();
  registerProjectorPairingRoutes(app);
  const bindings = { ...env, APP_ENV: "staging" } as Env;
  const origin = "https://example.com";
  const { created, control, stub } = await createRoom();
  const post = (path: string, body: unknown, cookie?: string) =>
    app.request(
      `${origin}${path}`,
      {
        method: "POST",
        headers: {
          origin,
          "content-type": "application/json",
          ...(cookie ? { cookie } : {}),
        },
        body: JSON.stringify(body),
      },
      bindings,
    );
  const issuePath = `/api/admin/rooms/${created.gameId}/projector-pairing`;
  expect((await post(issuePath, { requestId: crypto.randomUUID() })).status).toBe(401);
  vi.mocked(administratorForRequest).mockResolvedValueOnce(
    Response.json({ error: "unauthenticated" }, { status: 401 }),
  );
  const controlCookie = `26_room_control=${control.credentialId}.${control.secret}`;
  expect(
    (await post(issuePath, { requestId: crypto.randomUUID() }, controlCookie)).status,
  ).toBe(401);
  const issuedResponse = await post(
    issuePath,
    { requestId: crypto.randomUUID() },
    controlCookie,
  );
  expect(issuedResponse.status).toBe(200);
  expect(issuedResponse.headers.get("cache-control")).toBe("no-store");
  const issued = (await issuedResponse.json()) as { code: string; expiresAt: string };
  const typed = `${issued.code.slice(0, 4).toLowerCase()}-${issued.code.slice(4)}`;

  const redeemPath = "/api/stage/pair";
  const crossSite = await app.request(
    `${origin}${redeemPath}`,
    {
      method: "POST",
      headers: {
        origin: "https://elsewhere.example",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        joinCode: created.joinCode,
        code: typed,
        requestId: crypto.randomUUID(),
      }),
    },
    bindings,
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

import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  serializeCredentialCookie,
  serializeGuestCookie,
} from "../src/credentials/cookies.ts";
import {
  createCredentialSecret,
  hashCredentialSecret,
  verifyRoomCredential,
} from "../src/credentials/verify.ts";
import type { RoomCredentialRecord } from "../src/credentials/types.ts";

const roomId = "ABCDEFGH";

function record(overrides: Partial<RoomCredentialRecord> = {}): RoomCredentialRecord {
  return {
    id: "credential-1",
    roomId,
    role: "control",
    secretHash: "",
    expiresAt: "2099-01-01T00:00:00.000Z",
    revokedAt: null,
    ...overrides,
  };
}

describe("room credential verifier", () => {
  it("accepts a matching control secret and rejects the other role", async () => {
    const secret = createCredentialSecret();
    const stored = record({ secretHash: await hashCredentialSecret(secret) });
    const now = new Date("2026-09-22T12:00:00.000Z");

    await expect(
      verifyRoomCredential({
        credentialId: stored.id,
        secret,
        record: stored,
        now,
        roomId,
        role: "control",
      }),
    ).resolves.toEqual({ ok: true });

    await expect(
      verifyRoomCredential({
        credentialId: stored.id,
        secret,
        record: stored,
        now,
        roomId,
        role: "presentation",
      }),
    ).resolves.toEqual({ ok: false, reason: "wrong_role" });
  });

  it("rejects an expired, revoked, or wrong secret without a database", async () => {
    const secret = createCredentialSecret();
    const secretHash = await hashCredentialSecret(secret);
    const now = new Date("2026-09-22T12:00:00.000Z");

    await expect(
      verifyRoomCredential({
        credentialId: "credential-1",
        secret,
        record: record({ secretHash, expiresAt: "2020-01-01T00:00:00.000Z" }),
        now,
        roomId,
        role: "control",
      }),
    ).resolves.toEqual({ ok: false, reason: "expired" });

    await expect(
      verifyRoomCredential({
        credentialId: "credential-1",
        secret,
        record: record({ secretHash, revokedAt: "2026-09-22T11:00:00.000Z" }),
        now,
        roomId,
        role: "control",
      }),
    ).resolves.toEqual({ ok: false, reason: "revoked" });

    await expect(
      verifyRoomCredential({
        credentialId: "credential-1",
        secret: createCredentialSecret(),
        record: record({ secretHash }),
        now,
        roomId,
        role: "control",
      }),
    ).resolves.toEqual({ ok: false, reason: "mismatch" });
  });

  it("sets room cookies on the site root with the secure flag", () => {
    const control = serializeCredentialCookie({
      role: "control",
      credentialId: "credential-1",
      secret: "secret",
      maxAgeSeconds: 60,
    });
    const presentation = serializeCredentialCookie({
      role: "presentation",
      credentialId: "credential-2",
      secret: "secret",
      maxAgeSeconds: 60,
    });
    const guest = serializeGuestCookie({
      gameId: "ABCDEFGHJKLM",
      playerId: "11111111-1111-4111-8111-111111111111",
      secret: "secret",
      maxAgeSeconds: 60,
    });
    for (const header of [control, presentation, guest]) {
      expect(header).toContain("Path=/");
      expect(header).toContain("HttpOnly");
      expect(header).toContain("Secure");
      expect(header).toContain("SameSite=Strict");
    }
    expect(control).toContain("Path=/;");
    expect(presentation).toContain("Path=/;");
  });

  it("does not import the database or Neon driver", () => {
    const source = readFileSync(
      path.join(
        path.dirname(fileURLToPath(import.meta.url)),
        "../src/credentials/verify.ts",
      ),
      "utf8",
    );
    expect(source).not.toContain("@neondatabase/serverless");
    expect(source).not.toContain("create-database");
    expect(source).not.toContain("DATABASE_URL");
  });

  it("keeps the alarm inside the scheduler and uses one browser socket", () => {
    const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
    const roomDir = path.join(root, "src", "room");
    const alarmFiles = readdirSync(roomDir)
      .filter((name) => name.endsWith(".ts"))
      .filter((name) => {
        const source = readFileSync(path.join(roomDir, name), "utf8");
        return source.includes("setAlarm") || source.includes("deleteAlarm");
      });
    expect(alarmFiles).toEqual(["scheduler.ts"]);
    const scheduler = readFileSync(path.join(roomDir, "scheduler.ts"), "utf8");
    expect(scheduler).toContain("txn.setAlarm");
    expect(scheduler).toContain("txn.deleteAlarm");
    expect(scheduler).not.toContain(".transactionSync(");

    const webRoot = path.resolve(root, "../web/src");
    const socketFiles = collectSource(webRoot).filter((file) =>
      readFileSync(file, "utf8").includes("new WebSocket("),
    );
    expect(socketFiles.map((file) => path.basename(file))).toEqual(["room-socket.ts"]);
  });
});

function collectSource(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name);
    return entry.isDirectory() ? collectSource(full) : [full];
  });
}

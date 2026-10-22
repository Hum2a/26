import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDatabase, type AppDatabase } from "../src/auth/create-database.ts";
import {
  EmailUncertain,
  restrictResultsEmail,
  type EmailSender,
  type OutboundEmail,
} from "../src/auth/create-email.ts";
import { applyArchiveSchema } from "../src/archive/schema.ts";
import type { PublicArchive } from "../src/archive/document.ts";
import {
  confirmVerification,
  personalFromGrant,
  startVerification,
  type DeliveryJob,
  type DeliveryStore,
  type EmailGrant,
} from "../src/results/delivery.ts";
import { verificationMessage } from "../src/results/messages.ts";
import { postgresDelivery } from "../src/results/postgres-delivery.ts";
import { toPublicResults } from "../src/results/project.ts";

describe("public results and email delivery", () => {
  it("publishes standings and shared photos without personal or device rows", () => {
    const projected = JSON.stringify(
      toPublicResults({
        gameId: "ARCHIVE15",
        revision: 1,
        kind: "final",
        questionSetVersion: "illustrative-1",
        standings: [
          {
            playerId: "11111111-1111-4111-8111-111111111111",
            nickname: "Amina",
            position: 1,
            points: 4,
          },
        ],
        highlights: [],
        funFacts: [],
        media: [
          {
            mediaId: "22222222-2222-4222-8222-222222222222",
            kind: "photo",
            nickname: "Amina",
            hidden: false,
          },
          {
            mediaId: "33333333-3333-4333-8333-333333333333",
            kind: "photo",
            nickname: "Amina",
            hidden: true,
          },
        ],
      } satisfies PublicArchive),
    );
    expect(projected).toContain("Amina");
    expect(projected).toContain("Shared by Amina, who sent this photo.");
    expect(projected).not.toContain("11111111-1111-4111-8111-111111111111");
    expect(projected).not.toContain("33333333-3333-4333-8333-333333333333");
    expect(projected).not.toContain("PRIVATE-RECAP-TOKEN");
    expect(projected).not.toContain("reportJson");
  });

  it("renders a verification message without a session secret", () => {
    const message = verificationMessage({
      origin: "http://localhost:4173",
      gameId: "ARCHIVE15",
      token: "verify-token",
    });
    expect(message.text).toContain("verify=verify-token");
    expect(message.text).not.toContain("26_guest");
    expect(message.subject).toContain("Confirm");
  });

  it("retries an uncertain send with the same key and does not send a second job", async () => {
    const store = memoryStore();
    const sender = scriptedSender();
    sender.state.failNext = true;
    const first = await startVerification({
      store,
      sender: sender.sender,
      gameId: "ARCHIVE15",
      playerId: "11111111-1111-4111-8111-111111111111",
      email: "Amina@Example.test",
      nowMs: Date.now(),
      origin: "http://localhost:4173",
    });
    expect(first).toBe("uncertain");
    const second = await startVerification({
      store,
      sender: sender.sender,
      gameId: "ARCHIVE15",
      playerId: "11111111-1111-4111-8111-111111111111",
      email: "amina@example.test",
      nowMs: Date.now(),
      origin: "http://localhost:4173",
    });
    expect(second).toBe("sent");
    expect(sender.keys).toHaveLength(2);
    expect(sender.keys[0]).toBe(sender.keys[1]);
    const third = await startVerification({
      store,
      sender: sender.sender,
      gameId: "ARCHIVE15",
      playerId: "11111111-1111-4111-8111-111111111111",
      email: "amina@example.test",
      nowMs: Date.now(),
      origin: "http://localhost:4173",
    });
    expect(third).toBe("sent");
    expect(sender.keys).toHaveLength(2);
    expect(store.jobs.size).toBe(1);
  });

  it("rejects an expired verification link", async () => {
    const store = memoryStore();
    const sender = scriptedSender();
    await startVerification({
      store,
      sender: sender.sender,
      gameId: "ARCHIVE15",
      playerId: "11111111-1111-4111-8111-111111111111",
      email: "amina@example.test",
      nowMs: 1_000,
      origin: "http://localhost:4173",
    });
    const token = linkParam(sender.bodies[0] ?? "", "verify");
    expect(token).toBeTruthy();
    const expired = await confirmVerification({
      store,
      sender: sender.sender,
      token: token ?? "",
      nowMs: Date.now() + 86_400_000,
      origin: "http://localhost:4173",
      personal: { nickname: "Amina", position: 1, points: 4, given: 0, received: 1 },
    });
    expect(expired).toBe("expired");
    expect(sender.bodies).toHaveLength(1);
  });

  it("opens a personal grant and ignores a guessed token", async () => {
    const store = memoryStore();
    const sender = scriptedSender();
    await startVerification({
      store,
      sender: sender.sender,
      gameId: "ARCHIVE15",
      playerId: "11111111-1111-4111-8111-111111111111",
      email: "amina@example.test",
      nowMs: Date.now(),
      origin: "http://localhost:4173",
    });
    const verify = linkParam(sender.bodies[0] ?? "", "verify");
    const confirmed = await confirmVerification({
      store,
      sender: sender.sender,
      token: verify,
      nowMs: Date.now(),
      origin: "http://localhost:4173",
      personal: { nickname: "Amina", position: 1, points: 4, given: 2, received: 1 },
    });
    expect(confirmed).toBe("sent");
    const recap = linkParam(sender.bodies[1] ?? "", "recap");
    const opened = await personalFromGrant({ store, token: recap, nowMs: Date.now() });
    expect(typeof opened).not.toBe("string");
    const guessed = await personalFromGrant({
      store,
      token: "11111111-1111-4111-8111-111111111111",
      nowMs: Date.now(),
    });
    expect(guessed).toBe("invalid");
    expect(sender.bodies[1]).not.toContain("26_guest");
    expect(sender.bodies[1]).toContain("position 1");
  });
});

describe("archive delivery tables", () => {
  let database: AppDatabase;

  beforeAll(async () => {
    const env = {
      APP_ENV: "local" as const,
      DATABASE_URL: "",
      LOCAL_DATABASE_ID: "results-delivery",
    };
    database = await createDatabase(env);
    await applyArchiveSchema(database);
  });

  afterAll(async () => {
    await database.close();
  });

  it("stores one job when the same id is inserted twice", async () => {
    const store = postgresDelivery(database.executor.query);
    const job: DeliveryJob = {
      jobId: "verify:ARCHIVE15:player:amina@example.test",
      gameId: "ARCHIVE15",
      playerId: "11111111-1111-4111-8111-111111111111",
      purpose: "verify",
      recipient: "amina@example.test",
      idempotencyKey: "verify:ARCHIVE15:player:amina@example.test",
      status: "pending",
      attempts: 0,
      subject: "Confirm",
      bodyText: "hello",
    };
    expect(await store.insertJob(job)).toBe("stored");
    expect(await store.insertJob(job)).toBe("present");
    const rows = await database.executor.query(
      `SELECT job_id FROM archive_delivery_job WHERE game_id = $1`,
      ["ARCHIVE15"],
    );
    expect(rows).toHaveLength(1);
  });

  it("sends staging results mail only to the configured test recipient", async () => {
    const sent: string[] = [];
    const sender: EmailSender = {
      kind: "resend",
      async send(message) {
        sent.push(message.to);
      },
    };
    const closed = restrictResultsEmail({ APP_ENV: "staging" }, sender);
    await expect(
      closed.send({ to: "guest@example.test", subject: "Hi", text: "Hi" }),
    ).rejects.toThrow("Staging email needs EMAIL_TEST_RECIPIENT.");
    const limited = restrictResultsEmail(
      { APP_ENV: "staging", EMAIL_TEST_RECIPIENT: "host@example.test" },
      sender,
    );
    await expect(
      limited.send({ to: "guest@example.test", subject: "Hi", text: "Hi" }),
    ).rejects.toThrow("That address is outside the configured test recipient.");
    await limited.send({ to: "host@example.test", subject: "Hi", text: "Hi" });
    expect(sent).toEqual(["host@example.test"]);
  });
});

function linkParam(text: string, name: string): string {
  const match = text.match(/https?:\/\/\S+/);
  if (!match?.[0]) {
    return "";
  }
  return new URL(match[0]).searchParams.get(name) ?? "";
}

function scriptedSender() {
  const keys: string[] = [];
  const bodies: string[] = [];
  const state = { failNext: false, keys, bodies };
  const sender: EmailSender = {
    kind: "local-inbox",
    async send(message: OutboundEmail) {
      keys.push(message.idempotencyKey ?? "");
      bodies.push(message.text);
      if (state.failNext) {
        state.failNext = false;
        throw new EmailUncertain();
      }
    },
  };
  return { state, sender, keys, bodies };
}

function memoryStore(): DeliveryStore & { jobs: Map<string, DeliveryJob> } {
  const jobs = new Map<string, DeliveryJob>();
  const grants: EmailGrant[] = [];
  return {
    jobs,
    async getJob(jobId) {
      return jobs.get(jobId) ?? null;
    },
    async insertJob(job) {
      if (jobs.has(job.jobId)) {
        return "present";
      }
      jobs.set(job.jobId, job);
      return "stored";
    },
    async saveJob(job) {
      jobs.set(job.jobId, job);
    },
    async upsertGrant(grant) {
      const index = grants.findIndex(
        (item) =>
          item.gameId === grant.gameId &&
          item.playerId === grant.playerId &&
          item.purpose === grant.purpose &&
          item.recipient === grant.recipient,
      );
      if (index >= 0) {
        grants.splice(index, 1);
      }
      grants.push(grant);
    },
    async findGrantByHash(tokenHash) {
      return grants.find((grant) => grant.tokenHash === tokenHash) ?? null;
    },
    async findGrant(input) {
      return (
        grants.find(
          (grant) =>
            grant.gameId === input.gameId &&
            grant.playerId === input.playerId &&
            grant.purpose === input.purpose &&
            grant.recipient === input.recipient,
        ) ?? null
      );
    },
    async markGrantUsed(grantId, nowIso) {
      const grant = grants.find((item) => item.grantId === grantId);
      if (grant) {
        grant.usedAt = nowIso;
      }
    },
    async summarise(gameId) {
      const counts = { pending: 0, uncertain: 0, failed: 0, sent: 0 };
      for (const job of jobs.values()) {
        if (job.gameId !== gameId) {
          continue;
        }
        counts[job.status] += 1;
      }
      return counts;
    },
    async listRetryable(gameId) {
      return [...jobs.values()].filter(
        (job) =>
          job.gameId === gameId &&
          (job.status === "failed" || job.status === "uncertain") &&
          job.attempts < 8,
      );
    },
  };
}

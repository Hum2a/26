import { emailVerifyTtlMs, recapLinkTtlMs } from "@26/shared";
import { EmailUncertain, type EmailSender } from "../auth/create-email.ts";
import { createCredentialSecret, hashCredentialSecret } from "../credentials/verify.ts";
import { resultsMessage, verificationMessage } from "./messages.ts";

export const maxDeliveryAttempts = 8;

export type DeliveryPurpose = "verify" | "results";
export type DeliveryStatus = "pending" | "uncertain" | "sent" | "failed";

export type DeliveryJob = {
  jobId: string;
  gameId: string;
  playerId: string;
  purpose: DeliveryPurpose;
  recipient: string;
  idempotencyKey: string;
  status: DeliveryStatus;
  attempts: number;
  subject: string | null;
  bodyText: string | null;
};

export type EmailGrant = {
  grantId: string;
  gameId: string;
  playerId: string;
  recipient: string;
  purpose: DeliveryPurpose;
  tokenHash: string;
  expiresAt: string;
  usedAt: string | null;
};

export type DeliveryStore = {
  getJob(jobId: string): Promise<DeliveryJob | null>;
  insertJob(job: DeliveryJob): Promise<"stored" | "present">;
  saveJob(job: DeliveryJob, nowIso: string): Promise<void>;
  upsertGrant(grant: EmailGrant): Promise<void>;
  findGrantByHash(tokenHash: string): Promise<EmailGrant | null>;
  findGrant(input: {
    gameId: string;
    playerId: string;
    purpose: DeliveryPurpose;
    recipient: string;
  }): Promise<EmailGrant | null>;
  markGrantUsed(grantId: string, nowIso: string): Promise<void>;
  summarise(gameId: string): Promise<DeliveryCounts>;
  listRetryable(gameId: string): Promise<DeliveryJob[]>;
};

export type DeliveryCounts = {
  pending: number;
  uncertain: number;
  failed: number;
  sent: number;
};

export type EmailOutcome = "sent" | "uncertain" | "failed" | "expired" | "invalid";

export function verifyJobId(gameId: string, playerId: string, email: string): string {
  return `verify:${gameId}:${playerId}:${email}`;
}

export function resultsJobId(gameId: string, playerId: string, email: string): string {
  return `results:${gameId}:${playerId}:${email}`;
}

export function normaliseEmail(value: string): string | null {
  const email = value.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 200) {
    return null;
  }
  return email;
}

export async function startVerification(input: {
  store: DeliveryStore;
  sender: EmailSender;
  gameId: string;
  playerId: string;
  email: string;
  nowMs: number;
  origin: string;
}): Promise<EmailOutcome> {
  const email = normaliseEmail(input.email);
  if (!email) {
    return "invalid";
  }
  const nowIso = new Date(input.nowMs).toISOString();
  const jobId = verifyJobId(input.gameId, input.playerId, email);
  let job = await input.store.getJob(jobId);
  if (job?.status === "sent") {
    return "sent";
  }
  if (job && job.status === "failed" && job.attempts >= maxDeliveryAttempts) {
    return "failed";
  }
  const grant = await activeGrant(input.store, {
    gameId: input.gameId,
    playerId: input.playerId,
    purpose: "verify",
    recipient: email,
    nowMs: input.nowMs,
  });
  if (!job || !grant || !job.bodyText) {
    const drafted = await draftVerification({
      ...input,
      email,
      jobId,
      attempts: job?.attempts ?? 0,
      nowIso,
    });
    job = drafted;
  }
  return dispatch(input.store, input.sender, job, nowIso);
}

export async function confirmVerification(input: {
  store: DeliveryStore;
  sender: EmailSender;
  token: string;
  nowMs: number;
  origin: string;
  personal: {
    nickname: string;
    position: number;
    points: number;
    given: number;
    received: number;
  };
}): Promise<EmailOutcome> {
  const grant = await input.store.findGrantByHash(
    await hashCredentialSecret(input.token),
  );
  if (!grant || grant.purpose !== "verify") {
    return "invalid";
  }
  if (Date.parse(grant.expiresAt) <= input.nowMs) {
    return "expired";
  }
  const nowIso = new Date(input.nowMs).toISOString();
  const jobId = resultsJobId(grant.gameId, grant.playerId, grant.recipient);
  let job = await input.store.getJob(jobId);
  if (job?.status === "sent") {
    await input.store.markGrantUsed(grant.grantId, nowIso);
    return "sent";
  }
  if (job && job.status === "failed" && job.attempts >= maxDeliveryAttempts) {
    return "failed";
  }
  if (!job || !job.bodyText) {
    const token = createCredentialSecret();
    const message = resultsMessage({
      origin: input.origin,
      gameId: grant.gameId,
      token,
      ...input.personal,
    });
    await input.store.upsertGrant({
      grantId: crypto.randomUUID(),
      gameId: grant.gameId,
      playerId: grant.playerId,
      recipient: grant.recipient,
      purpose: "results",
      tokenHash: await hashCredentialSecret(token),
      expiresAt: new Date(input.nowMs + recapLinkTtlMs).toISOString(),
      usedAt: null,
    });
    const next: DeliveryJob = {
      jobId,
      gameId: grant.gameId,
      playerId: grant.playerId,
      purpose: "results",
      recipient: grant.recipient,
      idempotencyKey: job ? `${jobId}:${job.attempts + 1}` : jobId,
      status: "pending",
      attempts: job?.attempts ?? 0,
      subject: message.subject,
      bodyText: message.text,
    };
    if (job) {
      await input.store.saveJob(next, nowIso);
      job = next;
    } else {
      const inserted = await input.store.insertJob(next);
      job = inserted === "present" ? ((await input.store.getJob(jobId)) ?? next) : next;
    }
  }
  await input.store.markGrantUsed(grant.grantId, nowIso);
  return dispatch(input.store, input.sender, job, nowIso);
}

export async function personalFromGrant(input: {
  store: DeliveryStore;
  token: string;
  nowMs: number;
}): Promise<{ grant: EmailGrant } | EmailOutcome> {
  const grant = await input.store.findGrantByHash(
    await hashCredentialSecret(input.token),
  );
  if (!grant || grant.purpose !== "results") {
    return "invalid";
  }
  if (Date.parse(grant.expiresAt) <= input.nowMs) {
    return "expired";
  }
  return { grant };
}

async function activeGrant(
  store: DeliveryStore,
  input: {
    gameId: string;
    playerId: string;
    purpose: DeliveryPurpose;
    recipient: string;
    nowMs: number;
  },
): Promise<EmailGrant | null> {
  const grant = await store.findGrant(input);
  if (!grant || Date.parse(grant.expiresAt) <= input.nowMs) {
    return null;
  }
  return grant;
}

async function draftVerification(input: {
  store: DeliveryStore;
  gameId: string;
  playerId: string;
  email: string;
  jobId: string;
  attempts: number;
  nowMs: number;
  nowIso: string;
  origin: string;
}): Promise<DeliveryJob> {
  const token = createCredentialSecret();
  const message = verificationMessage({
    origin: input.origin,
    gameId: input.gameId,
    token,
  });
  await input.store.upsertGrant({
    grantId: crypto.randomUUID(),
    gameId: input.gameId,
    playerId: input.playerId,
    recipient: input.email,
    purpose: "verify",
    tokenHash: await hashCredentialSecret(token),
    expiresAt: new Date(input.nowMs + emailVerifyTtlMs).toISOString(),
    usedAt: null,
  });
  const job: DeliveryJob = {
    jobId: input.jobId,
    gameId: input.gameId,
    playerId: input.playerId,
    purpose: "verify",
    recipient: input.email,
    idempotencyKey:
      input.attempts === 0 ? input.jobId : `${input.jobId}:${input.attempts + 1}`,
    status: "pending",
    attempts: input.attempts,
    subject: message.subject,
    bodyText: message.text,
  };
  const existing = await input.store.getJob(input.jobId);
  if (existing) {
    await input.store.saveJob(job, input.nowIso);
  } else {
    await input.store.insertJob(job);
  }
  return job;
}

export async function retryStoredDeliveries(
  store: DeliveryStore,
  sender: EmailSender,
  gameId: string,
  nowMs: number,
): Promise<number> {
  const jobs = await store.listRetryable(gameId);
  const nowIso = new Date(nowMs).toISOString();
  let retried = 0;
  for (const job of jobs) {
    if (!job.subject || !job.bodyText) {
      continue;
    }
    await dispatch(store, sender, job, nowIso);
    retried += 1;
  }
  return retried;
}

async function dispatch(
  store: DeliveryStore,
  sender: EmailSender,
  job: DeliveryJob,
  nowIso: string,
): Promise<EmailOutcome> {
  if (job.status === "sent") {
    return "sent";
  }
  if (!job.subject || !job.bodyText) {
    return "failed";
  }
  const nextAttempts = job.attempts + 1;
  try {
    await sender.send({
      to: job.recipient,
      subject: job.subject,
      text: job.bodyText,
      idempotencyKey: job.idempotencyKey,
    });
    await store.saveJob(
      { ...job, status: "sent", attempts: nextAttempts, subject: null, bodyText: null },
      nowIso,
    );
    return "sent";
  } catch (error) {
    const status = error instanceof EmailUncertain ? "uncertain" : "failed";
    await store.saveJob({ ...job, status, attempts: nextAttempts }, nowIso);
    return status;
  }
}

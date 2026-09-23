import { Resend } from "resend";
import { presentBinding, type AuthBindings } from "./bindings.ts";
import type { AppDatabase } from "./create-database.ts";

export type OutboundEmail = {
  to: string;
  subject: string;
  text: string;
  /** Provider idempotency key. A retry of the same message reuses it. */
  idempotencyKey?: string;
};

/**
 * The provider may have accepted the message and the response was lost.
 * A retry must reuse the same idempotency key. Delivery is not exactly once.
 */
export class EmailUncertain extends Error {
  readonly code = "uncertain";

  constructor() {
    super("Email delivery was not confirmed.");
    this.name = "EmailUncertain";
  }
}

export type EmailSender = {
  kind: "local-inbox" | "resend" | "unconfigured";
  send(message: OutboundEmail): Promise<void>;
};

export type InboxMessage = {
  id: string;
  recipient: string;
  subject: string;
  text: string;
};

/**
 * Results mail on staging goes only to EMAIL_TEST_RECIPIENT.
 * Administrator sign-in uses createEmail directly and is not limited by this.
 */
export function restrictResultsEmail(
  env: AuthBindings,
  sender: EmailSender,
): EmailSender {
  const testRecipient = presentBinding(env.EMAIL_TEST_RECIPIENT)?.toLowerCase();
  if (env.APP_ENV !== "staging" && !testRecipient) {
    return sender;
  }
  return {
    kind: sender.kind,
    async send(message) {
      if (!testRecipient) {
        throw new Error("Staging email needs EMAIL_TEST_RECIPIENT.");
      }
      if (message.to.trim().toLowerCase() !== testRecipient) {
        throw new Error("That address is outside the configured test recipient.");
      }
      await sender.send(message);
    },
  };
}

export function createEmail(env: AuthBindings, database: AppDatabase): EmailSender {
  const apiKey = presentBinding(env.RESEND_API_KEY);
  if (apiKey) {
    return createResendSender(apiKey, presentBinding(env.RESEND_FROM));
  }
  if (env.APP_ENV === "local") {
    return createLocalInbox(database);
  }
  return {
    kind: "unconfigured",
    async send() {
      throw new Error("Email delivery is not configured.");
    },
  };
}

function createResendSender(apiKey: string, from: string | undefined): EmailSender {
  const resend = new Resend(apiKey);
  return {
    kind: "resend",
    async send(message) {
      if (!from) {
        throw new Error("Email delivery is not configured.");
      }
      try {
        const result = await resend.emails.send(
          {
            from,
            to: message.to,
            subject: message.subject,
            text: message.text,
          },
          message.idempotencyKey
            ? { idempotencyKey: message.idempotencyKey }
            : undefined,
        );
        if (result.error) {
          throw new Error("Email delivery failed.");
        }
      } catch (error) {
        if (error instanceof Error && error.message === "Email delivery failed.") {
          throw error;
        }
        throw new EmailUncertain();
      }
    },
  };
}

function createLocalInbox(database: AppDatabase): EmailSender {
  return {
    kind: "local-inbox",
    async send(message) {
      await database.executor.query(
        `alter table dev_inbox add column if not exists idempotency_key text`,
      );
      await database.executor.query(
        `create unique index if not exists dev_inbox_idempotency
         on dev_inbox (idempotency_key)`,
      );
      if (message.idempotencyKey) {
        const existing = await database.executor.query(
          `select id from dev_inbox where idempotency_key = $1`,
          [message.idempotencyKey],
        );
        if (existing.length > 0) {
          return;
        }
      }
      await database.executor.query(
        `insert into dev_inbox (id, recipient, subject, body, created_at, idempotency_key)
         values ($1, $2, $3, $4, $5, $6)`,
        [
          crypto.randomUUID(),
          message.to,
          message.subject,
          message.text,
          new Date().toISOString(),
          message.idempotencyKey ?? null,
        ],
      );
    },
  };
}

export async function listLocalInbox(database: AppDatabase): Promise<InboxMessage[]> {
  const rows = await database.executor.query(
    `select id, recipient, subject, body
     from dev_inbox
     order by created_at desc
     limit 20`,
  );
  return rows.map((row) => ({
    id: String(row.id),
    recipient: String(row.recipient),
    subject: String(row.subject),
    text: String(row.body),
  }));
}

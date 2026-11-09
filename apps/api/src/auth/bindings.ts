import type { AppEnvironment } from "@26/shared";

declare global {
  interface Env {
    /** Memory-only local Node-to-Worker proof; never configured for a deployment. */
    LOCAL_ADMIN_PROOF_KEY?: string;
    /** Isolates in-memory PGlite databases in tests. Not a deployed binding. */
    LOCAL_DATABASE_ID?: string;
  }
}

/** Bindings the auth factories read. Blank strings count as unset. */
export type AuthBindings = {
  APP_ENV: AppEnvironment;
  ADMIN_EMAIL?: string;
  BETTER_AUTH_SECRET?: string;
  BETTER_AUTH_URL?: string;
  DATABASE_URL?: string;
  RESEND_API_KEY?: string;
  RESEND_FROM?: string;
  EMAIL_TEST_RECIPIENT?: string;
};

export function presentBinding(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

/**
 * Local fallback when ADMIN_EMAIL is unset. A comma-separated allow-list;
 * a single address is still valid. Staging and production set the same
 * binding as a Cloudflare secret.
 */
export const defaultLocalAdminEmails = "humzab1711@hotmail.com,adenreh@gmail.com";

/**
 * Parses ADMIN_EMAIL as a comma-separated allow-list of administrator
 * addresses. A single address still works. Tokens are trimmed and
 * lowercased. Empty parts, duplicates, and values without `@` are ignored.
 */
export function parseAdminEmails(value: string | undefined): string[] {
  const raw = presentBinding(value);
  if (!raw) {
    return [];
  }
  const emails: string[] = [];
  const seen = new Set<string>();
  for (const part of raw.split(",")) {
    const email = part.trim().toLowerCase();
    if (!email.includes("@") || seen.has(email)) {
      continue;
    }
    seen.add(email);
    emails.push(email);
  }
  return emails;
}

export function configuredAdminEmails(env: AuthBindings): string[] {
  return parseAdminEmails(env.ADMIN_EMAIL);
}

export function isConfiguredAdminEmail(env: AuthBindings, email: string): boolean {
  return configuredAdminEmails(env).includes(email.trim().toLowerCase());
}

/**
 * Test-only isolation key. It is not a Wrangler binding and is never a secret.
 * Each id gets its own in-memory PGlite database.
 */
export function localDatabaseId(env: object): string | undefined {
  if (!("LOCAL_DATABASE_ID" in env)) {
    return undefined;
  }
  const value = (env as { LOCAL_DATABASE_ID?: unknown }).LOCAL_DATABASE_ID;
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function authBindingsFromEnv(env: Env): AuthBindings {
  return {
    APP_ENV: env.APP_ENV,
    ADMIN_EMAIL: env.ADMIN_EMAIL,
    BETTER_AUTH_SECRET: env.BETTER_AUTH_SECRET,
    BETTER_AUTH_URL: env.BETTER_AUTH_URL,
    DATABASE_URL: env.DATABASE_URL,
    RESEND_API_KEY: env.RESEND_API_KEY,
    RESEND_FROM: env.RESEND_FROM,
    EMAIL_TEST_RECIPIENT: env.EMAIL_TEST_RECIPIENT,
  };
}

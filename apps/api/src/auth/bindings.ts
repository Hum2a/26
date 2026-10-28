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

export function configuredAdminEmail(env: AuthBindings): string | undefined {
  return presentBinding(env.ADMIN_EMAIL)?.toLowerCase();
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

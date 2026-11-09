import { betterAuth, type BetterAuthOptions } from "better-auth";
import { emailOTP, magicLink } from "better-auth/plugins";
import {
  configuredAdminEmails,
  presentBinding,
  type AuthBindings,
} from "./bindings.ts";
import type { AppDatabase } from "./create-database.ts";
import type { EmailSender } from "./create-email.ts";

/** Used only when APP_ENV is local and BETTER_AUTH_SECRET is unset. */
export const localDevelopmentAuthSecret =
  "local-development-only-not-a-deployed-secret";

const magicLinkLifetimeSeconds = 300;

export function resolveAuthSecret(env: AuthBindings): string | undefined {
  const configured = presentBinding(env.BETTER_AUTH_SECRET);
  if (configured) {
    return configured;
  }
  if (env.APP_ENV === "local") {
    return localDevelopmentAuthSecret;
  }
  return undefined;
}

export function resolvePublicOrigin(
  env: AuthBindings,
  requestUrl: string,
): string | undefined {
  const requestOrigin = new URL(requestUrl).origin;
  if (env.APP_ENV === "local") {
    return requestOrigin;
  }
  const configured = presentBinding(env.BETTER_AUTH_URL);
  if (!configured) {
    return undefined;
  }
  try {
    return new URL(configured).origin === requestOrigin ? requestOrigin : undefined;
  } catch {
    return undefined;
  }
}

/** Seconds a signed session cookie may answer for the database. */
export const adminSessionCacheSeconds = 120;
export const adminSessionOptions = {
  cookieCache: { enabled: true, maxAge: adminSessionCacheSeconds },
} as const;

export function createAuth(
  env: AuthBindings,
  input: { origin: string; database: AppDatabase; email: EmailSender },
  preparation?: { preparingLocalDatabase: true },
) {
  const adminEmails = configuredAdminEmails(env);
  const allowedAdmins = new Set(adminEmails);
  const secret = resolveAuthSecret(env);
  if (adminEmails.length === 0 || !secret) {
    throw new Error("Authentication is not configured for this environment.");
  }

  const options = {
    appName: "26",
    baseURL: input.origin,
    basePath: "/api/auth",
    secret,
    trustedOrigins: [input.origin],
    telemetry: { enabled: false },
    advanced: {
      useSecureCookies: true,
      // The isolated local migration instance is created before tables exist.
      // Real request instances, including local ones, validate after preparation.
      database: {
        validateSchema: !(
          preparation?.preparingLocalDatabase &&
          env.APP_ENV === "local" &&
          input.database.kind === "pglite"
        ),
      },
    },
    emailAndPassword: { enabled: false },
    rateLimit: { enabled: env.APP_ENV !== "local" },
    // Host commands check the admin session on every Pause or Advance. A short
    // signed cookie cache answers most of them without a database round trip,
    // so a slow Neon start cannot stall the live desk. A revoked session stays
    // valid for at most this long.
    session: adminSessionOptions,
    database: input.database.auth,
    databaseHooks: {
      user: {
        create: {
          before: async (user) => {
            if (!allowedAdmins.has(user.email.toLowerCase())) {
              return false;
            }
          },
        },
      },
    },
    plugins: [
      emailOTP({
        disableSignUp: true,
        otpLength: 6,
        expiresIn: magicLinkLifetimeSeconds,
        allowedAttempts: 5,
        storeOTP: "hashed",
        async sendVerificationOTP({ email, otp, type }) {
          if (type !== "sign-in" || !allowedAdmins.has(email.toLowerCase())) return;
          await input.email.send({
            to: email,
            subject: "Sign in to 26",
            text: [
              `Your sign-in code: ${otp}`,
              "Enter this code on the admin sign-in page. It expires after five minutes.",
              "If you did not request this, you can ignore this email.",
            ].join("\n\n"),
          });
        },
      }),
      magicLink({
        disableSignUp: true,
        storeToken: "hashed",
        expiresIn: magicLinkLifetimeSeconds,
        sendMagicLink: async ({ email, token }) => {
          if (!allowedAdmins.has(email.toLowerCase())) return;
          const code = await issueCode(email);
          const confirm = new URL("/admin/confirm", input.origin);
          confirm.searchParams.set("token", token);
          await input.email.send({
            to: email,
            subject: "Sign in to 26",
            text: [
              `Your sign-in code: ${code}`,
              "Enter this code on the admin sign-in page, or open your secure link below.",
              `Confirm sign-in for 26: ${confirm.toString()}`,
              "Opening this page does not sign you in. Use the confirm button.",
              "Your code and link expire after five minutes. Use the latest email.",
              "If you did not request this, you can ignore this email.",
            ].join("\n\n"),
          });
        },
      }),
    ],
  } satisfies BetterAuthOptions;

  const auth = betterAuth(options);
  // Supported server-only API in pinned Better Auth 1.7.5. It stores only the OTP hash.
  async function issueCode(email: string): Promise<string> {
    return auth.api.createVerificationOTP({ body: { email, type: "sign-in" } });
  }
  return auth;
}

export type Auth = ReturnType<typeof createAuth>;

import { betterAuth, type BetterAuthOptions } from "better-auth";
import { magicLink } from "better-auth/plugins";
import { configuredAdminEmail, presentBinding, type AuthBindings } from "./bindings.ts";
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

export function createAuth(
  env: AuthBindings,
  input: { origin: string; database: AppDatabase; email: EmailSender },
) {
  const adminEmail = configuredAdminEmail(env);
  const secret = resolveAuthSecret(env);
  if (!adminEmail || !secret) {
    throw new Error("Authentication is not configured for this environment.");
  }

  const options = {
    appName: "26",
    baseURL: input.origin,
    basePath: "/api/auth",
    secret,
    trustedOrigins: [input.origin],
    telemetry: { enabled: false },
    advanced: { useSecureCookies: true },
    emailAndPassword: { enabled: false },
    rateLimit: { enabled: env.APP_ENV !== "local" },
    database: input.database.auth,
    databaseHooks: {
      user: {
        create: {
          before: async (user) => {
            if (user.email.toLowerCase() !== adminEmail) {
              return false;
            }
          },
        },
      },
    },
    plugins: [
      magicLink({
        disableSignUp: true,
        storeToken: "hashed",
        expiresIn: magicLinkLifetimeSeconds,
        sendMagicLink: async ({ email, token }) => {
          const confirm = new URL("/admin/confirm", input.origin);
          confirm.searchParams.set("token", token);
          await input.email.send({
            to: email,
            subject: "Sign in to 26",
            text: [
              `Confirm sign-in for 26: ${confirm.toString()}`,
              "Opening this page does not sign you in. Use the confirm button.",
            ].join("\n\n"),
          });
        },
      }),
    ],
  } satisfies BetterAuthOptions;

  return betterAuth(options);
}

export type Auth = ReturnType<typeof createAuth>;

import { getMigrations } from "better-auth/db/migration";
import { configuredAdminEmail, type AuthBindings } from "./bindings.ts";
import { createAuth, resolveAuthSecret, type Auth } from "./create-auth.ts";
import { openDatabase, type AppDatabase } from "./create-database.ts";
import { createEmail, type EmailSender } from "./create-email.ts";
import { devInboxSql, roomCredentialSql } from "./extra-schema.ts";

const prepared = new WeakMap<AppDatabase, Promise<void>>();

export function ensurePrepared(
  env: AuthBindings,
  database: AppDatabase,
  options: { seed: boolean; devInbox: boolean },
): Promise<void> {
  const existing = prepared.get(database);
  if (existing) {
    return existing;
  }
  const pending = prepareDatabase(env, database, options).catch((error: unknown) => {
    prepared.delete(database);
    throw error;
  });
  prepared.set(database, pending);
  return pending;
}

async function prepareDatabase(
  env: AuthBindings,
  database: AppDatabase,
  options: { seed: boolean; devInbox: boolean },
): Promise<void> {
  const auth = createAuth(
    env,
    {
      origin: "http://localhost",
      database,
      email: {
        kind: "unconfigured",
        async send() {
          throw new Error("Email delivery is not configured.");
        },
      },
    },
    { preparingLocalDatabase: true },
  );
  await applyAuthMigrations(auth);
  await applyExtraSchema(database, options.devInbox);
  if (options.seed) {
    await seedAdministrator(auth, env);
  }
}

export async function applyAuthMigrations(auth: Auth): Promise<void> {
  const plan = await getMigrations(auth.options);
  await plan.runMigrations();
}

export async function compileAuthSchema(auth: Auth): Promise<string> {
  const plan = await getMigrations(auth.options);
  return plan.compileMigrations();
}

export async function applyExtraSchema(
  database: AppDatabase,
  devInbox: boolean,
): Promise<void> {
  await database.executor.query(roomCredentialSql);
  if (devInbox) {
    await database.executor.query(devInboxSql);
  }
}

export async function seedAdministrator(auth: Auth, env: AuthBindings): Promise<void> {
  const adminEmail = configuredAdminEmail(env);
  if (!adminEmail || !resolveAuthSecret(env)) {
    throw new Error("The administrator address is not configured.");
  }
  const context = await auth.$context;
  const existing = await context.internalAdapter.findUserByEmail(adminEmail);
  if (existing?.user) {
    return;
  }
  const created = await context.internalAdapter.createUser(
    {
      email: adminEmail,
      name: "Humza",
      emailVerified: true,
    },
    { method: "admin" },
  );
  if (!created) {
    throw new Error("The administrator account was not created.");
  }
}

export async function authForRequest(
  env: AuthBindings & object,
  origin: string,
): Promise<{ database: AppDatabase; email: EmailSender; auth: Auth }> {
  const database = await openDatabase(env);
  if (database.kind === "pglite") {
    await ensurePrepared(env, database, { seed: true, devInbox: true });
  }
  const email = createEmail(env, database);
  const auth = createAuth(env, { origin, database, email });
  return { database, email, auth };
}

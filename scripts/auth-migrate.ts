import { createDatabase, databaseHost } from "../apps/api/src/auth/create-database.ts";
import { presentBinding } from "../apps/api/src/auth/bindings.ts";
import { applyAuthMigrations, applyExtraSchema } from "../apps/api/src/auth/prepare.ts";
import { createAuth } from "../apps/api/src/auth/create-auth.ts";
import { readAuthTarget } from "./auth-target.ts";

const target = readAuthTarget();
const databaseUrl = presentBinding(target.bindings.DATABASE_URL);
const label = databaseUrl
  ? `postgres host ${databaseHost(databaseUrl)}`
  : "local PGlite at apps/api/.data/local-auth";

console.log(`Target environment: ${target.environment}`);
console.log(`Database: ${label}`);
if (target.devInbox) {
  console.log("Also applying the local development inbox table.");
}

const database = await createDatabase(target.bindings);
try {
  const auth = createAuth(
    target.bindings,
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
  await applyExtraSchema(database, target.devInbox);
  console.log("Migration finished.");
} finally {
  await database.close();
}

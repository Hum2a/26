import { createDatabase, databaseHost } from "../apps/api/src/auth/create-database.ts";
import { presentBinding } from "../apps/api/src/auth/bindings.ts";
import { applyArchiveSchema } from "../apps/api/src/archive/schema.ts";
import { readAuthTarget } from "./auth-target.ts";

const target = readAuthTarget();
const databaseUrl = presentBinding(target.bindings.DATABASE_URL);
const label = databaseUrl
  ? `postgres host ${databaseHost(databaseUrl)}`
  : "local PGlite at apps/api/.data/local-auth";

console.log(`Target environment: ${target.environment}`);
console.log(`Database: ${label}`);

const database = await createDatabase(target.bindings);
try {
  await applyArchiveSchema(database);
  console.log("Archive migration finished.");
} finally {
  await database.close();
}

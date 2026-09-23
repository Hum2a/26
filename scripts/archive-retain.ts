import { createDatabase, databaseHost } from "../apps/api/src/auth/create-database.ts";
import { presentBinding } from "../apps/api/src/auth/bindings.ts";
import { applyArchiveSchema } from "../apps/api/src/archive/schema.ts";
import { postgresArchive } from "../apps/api/src/archive/store.ts";
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
  const removed = await postgresArchive(database).purgeDeviceDetails(Date.now());
  console.log(`Removed ${removed} archived device detail rows.`);
} finally {
  await database.close();
}

import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createDatabase } from "../apps/api/src/auth/create-database.ts";
import { compileAuthSchema } from "../apps/api/src/auth/prepare.ts";
import { createAuth } from "../apps/api/src/auth/create-auth.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const database = await createDatabase({
  APP_ENV: "local",
  ADMIN_EMAIL: "humzab1711@hotmail.com",
  LOCAL_DATABASE_ID: "schema-generate",
});

try {
  const auth = createAuth(
    { APP_ENV: "local", ADMIN_EMAIL: "humzab1711@hotmail.com" },
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
  const sql = await compileAuthSchema(auth);
  const output = path.join(root, "apps/api/src/auth/migrations/better-auth.sql");
  writeFileSync(output, sql.endsWith("\n") ? sql : `${sql}\n`);
  console.log("Wrote apps/api/src/auth/migrations/better-auth.sql");
} finally {
  await database.close();
}

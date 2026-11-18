import { existsSync } from "node:fs";
import { clientApiKeyHeader } from "@26/shared";
import { agentAdminEmail } from "../apps/api/src/auth/agent-identity.ts";
import { createAuth } from "../apps/api/src/auth/create-auth.ts";
import { createDatabase } from "../apps/api/src/auth/create-database.ts";
import { ensurePrepared } from "../apps/api/src/auth/prepare.ts";
import { readAuthTarget } from "./auth-target.ts";
import { devVarsPath, readEnvValues } from "./env-files.ts";
import { workerRelease } from "./release-support.ts";

const [environment, action, name, ...extra] = process.argv.slice(2);
const actions = ["provision", "code", "check", "revoke"];
if (
  (environment !== "local" && environment !== "staging") ||
  !actions.includes(action) ||
  !name ||
  extra.length ||
  (action === "check" && environment !== "staging")
) {
  console.error(
    "Usage: npm run auth:agent -- <local|staging> <provision|code|check|revoke> <agent-name>. Check is staging only.",
  );
  process.exit(1);
}
const email = agentAdminEmail(environment, name);
if (!email) {
  console.error(
    "Use an agent name of 1–32 lowercase letters, digits or hyphens, starting with a letter.",
  );
  process.exit(1);
}

const { bindings } = readAuthTarget();
const origin =
  environment === "staging" ? workerRelease("staging").origin : "http://localhost:5173";
// Vite deliberately serves local admin auth from PGlite, even if a development
// DATABASE_URL is configured for other commands. Keep this command on that DB.
if (environment === "local") {
  bindings.DATABASE_URL = "";
  bindings.BETTER_AUTH_SECRET = "";
} else {
  try {
    if (new URL(bindings.BETTER_AUTH_URL ?? "").origin !== origin) throw new Error();
    const prodFile = devVarsPath("production");
    if (existsSync(prodFile)) {
      const productionUrl = readEnvValues(prodFile).DATABASE_URL;
      if (
        productionUrl &&
        databaseEndpoint(productionUrl) === databaseEndpoint(bindings.DATABASE_URL!)
      )
        throw new Error();
    }
  } catch {
    console.error(
      "Check the staging auth origin and use a database endpoint separate from production.",
    );
    process.exit(1);
  }
}

try {
  const database = await createDatabase({
    ...bindings,
    LOCAL_DATABASE_ID: process.env.LOCAL_DATABASE_ID,
  });
  try {
    if (environment === "local")
      await ensurePrepared(bindings, database, { seed: true, devInbox: true });
    if (environment === "local" && !database.label.startsWith("local PGlite at")) {
      throw new Error(
        "Use the persistent local auth database. Stop the dev server before running this command, and clear LOCAL_DATABASE_ID.",
      );
    }
    if (action === "provision") {
      // Only this operator command can insert a reserved verified identity.
      // The unique email constraint makes repeated provisioning idempotent.
      await database.executor.query(
        `INSERT INTO "user" (id, name, email, "emailVerified") VALUES ($1, $2, $3, true)
         ON CONFLICT (email) DO NOTHING`,
        [crypto.randomUUID(), `${name} (agent)`, email],
      );
      console.log(`Agent account ready: ${email}`);
    } else {
      const auth = createAuth(bindings, {
        origin,
        database,
        email: {
          kind: "unconfigured",
          async send() {
            throw new Error("Agent codes are never emailed.");
          },
        },
      });
      const context = await auth.$context;
      if (!(await context.internalAdapter.findUserByEmail(email))?.user.emailVerified)
        throw new Error("Agent account not found. Provision it first.");
      const issue = () =>
        auth.api.createVerificationOTP({ body: { email, type: "sign-in" } });
      if (action === "revoke") {
        await issue(); // Replace a previously issued code before deleting the account.
        await database.executor.query(`DELETE FROM "user" WHERE email = $1`, [email]);
        console.log(`Revoked ${email}`);
      } else if (action === "check") {
        const clientKey = readEnvValues(devVarsPath("staging")).CLIENT_API_KEY;
        if (!clientKey) throw new Error("The staging client API key is missing.");
        await verifyStaging(email, await issue(), clientKey);
        console.log(
          `Verified ${email}: session and protected admin content, then signed out.`,
        );
      } else {
        console.log(
          `${origin}/admin/login?agent=1\n${email}\nCode (private, expires in five minutes): ${await issue()}`,
        );
      }
    }
  } finally {
    await database.close();
  }
} catch (error) {
  // Never emit database connection details, codes or cookies on failure.
  const safe = [
    "Agent account not found. Provision it first.",
    "The staging client API key is missing.",
    "Use the persistent local auth database. Stop the dev server before running this command, and clear LOCAL_DATABASE_ID.",
  ];
  const message = error instanceof Error ? error.message : "";
  console.error(
    safe.includes(message) || /^Staging [a-z -]+ returned HTTP \d{3}\.$/.test(message)
      ? message
      : "Agent auth command failed. Check the target's auth configuration and database connectivity.",
  );
  process.exitCode = 1;
}

function databaseEndpoint(connectionString: string) {
  return new URL(connectionString).hostname.replace(/-pooler\./, ".");
}

async function verifyStaging(email: string, code: string, clientKey: string) {
  const headers = new Headers({
    [clientApiKeyHeader]: clientKey,
    origin,
    "content-type": "application/json",
  });
  const request = (pathname: string, body?: object) =>
    fetch(new URL(pathname, origin), {
      headers,
      redirect: "error",
      signal: AbortSignal.timeout(15_000),
      ...(body ? { method: "POST", body: JSON.stringify(body) } : {}),
    });
  const verify = await request("/api/admin/email-code/verify", { email, code });
  const cookies = verify.headers.getSetCookie();
  if (!verify.ok || !cookies.length)
    throw new Error(`Staging sign-in returned HTTP ${verify.status}.`);
  headers.set("cookie", cookies.map((cookie) => cookie.split(";", 1)[0]).join("; "));
  let signOut: Response | undefined;
  try {
    const session = await request("/api/admin/session");
    const identity = session.ok ? await session.json() : null;
    if (identity?.signedIn !== true || identity.email !== email)
      throw new Error(`Staging session check returned HTTP ${session.status}.`);
    const content = await request("/api/admin/content");
    if (!content.ok)
      throw new Error(`Staging admin content returned HTTP ${content.status}.`);
  } finally {
    signOut = await request("/api/admin/sign-out", {}).catch(() => undefined);
  }
  if (!signOut?.ok)
    throw new Error(`Staging sign-out returned HTTP ${signOut?.status ?? 503}.`);
}

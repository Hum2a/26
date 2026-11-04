import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { dirname, delimiter } from "node:path";
import { fileURLToPath } from "node:url";

if (process.env.CLOUDFLARE_ENV)
  throw new Error("Kart measurements require the isolated local environment.");
const root = fileURLToPath(new URL("../", import.meta.url));
const env = {
  ...process.env,
  PARTY_BROWSER_REHEARSAL: "1",
  LOCAL_DATABASE_ID: "browser-checks",
  // Shared only by this local build and its preview process, never logged.
  PARTY_BROWSER_PROOF_KEY: randomBytes(32).toString("hex"),
  KART_RUNTIME_VARIANT: "cloudflare-vitest",
  NODE_OPTIONS: [
    process.env.NODE_OPTIONS,
    "--import=" + new URL("./kart-test-runtime.mjs", import.meta.url).href,
  ]
    .filter(Boolean)
    .join(" "),
};
const pathKey = Object.keys(env).find((key) => key.toLowerCase() === "path") ?? "PATH";
env[pathKey] = dirname(process.execPath) + delimiter + (env[pathKey] ?? "");
function checked(result) {
  if (result.error) throw result.error;
  if (result.status !== 0) {
    console.error("Kart baseline child did not complete successfully.", {
      status: result.status,
      signal: result.signal,
    });
    process.exit(result.status ?? 1);
  }
}
// Build through the existing release checks, including generated-secret removal.
const npmCli = process.env.npm_execpath;
checked(
  npmCli
    ? spawnSync(process.execPath, [npmCli, "run", "build"], {
        cwd: root,
        env,
        stdio: "inherit",
        windowsHide: true,
      })
    : spawnSync(process.platform === "win32" ? "npm.cmd" : "npm", ["run", "build"], {
        cwd: root,
        env,
        stdio: "inherit",
        shell: process.platform === "win32",
        windowsHide: true,
      }),
);
checked(
  spawnSync(
    process.execPath,
    [
      fileURLToPath(
        new URL("../node_modules/@playwright/test/cli.js", import.meta.url),
      ),
      "test",
      "--config",
      "playwright.kart-baseline.config.ts",
      ...process.argv.slice(2),
    ],
    { cwd: root, env, stdio: "inherit", windowsHide: true },
  ),
);

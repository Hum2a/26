import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const adapter = new URL("./kart-test-runtime.mjs", import.meta.url).href;
function run(settings, script = "process.exit(0)") {
  const env = { ...process.env };
  for (const key of [
    "NODE_OPTIONS",
    "PARTY_BROWSER_REHEARSAL",
    "LOCAL_DATABASE_ID",
    "CLOUDFLARE_ENV",
  ])
    delete env[key];
  return spawnSync(
    process.execPath,
    ["--import=" + adapter, "--input-type=module", "--eval", script],
    {
      cwd: root,
      env: { ...env, ...settings },
      encoding: "utf8",
      windowsHide: true,
      timeout: 15_000,
    },
  );
}
for (const [name, settings] of [
  ["ordinary development", {}],
  ["missing isolated database", { PARTY_BROWSER_REHEARSAL: "1" }],
  [
    "staging",
    {
      PARTY_BROWSER_REHEARSAL: "1",
      LOCAL_DATABASE_ID: "browser-checks",
      CLOUDFLARE_ENV: "staging",
    },
  ],
  [
    "production",
    {
      PARTY_BROWSER_REHEARSAL: "1",
      LOCAL_DATABASE_ID: "browser-checks",
      CLOUDFLARE_ENV: "production",
    },
  ],
]) {
  test("refuses the test backend in " + name, () => {
    const result = run(settings);
    assert.equal(result.signal, null);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /requires isolated local browser rehearsal/);
  });
}
test("loads the real locked test backend through the preview SDK only in local rehearsal", () => {
  const result = run(
    { PARTY_BROWSER_REHEARSAL: "1", LOCAL_DATABASE_ID: "browser-checks" },
    "await import('@cloudflare/vite-plugin'); console.log('SDK imported');",
  );
  assert.equal(result.signal, null);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /SDK imported/);
  assert.match(result.stderr, /KART-TEST-RUNTIME.*miniflare.*workerd/);
});

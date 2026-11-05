import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { blankDatabaseUrl, runSafely } from "./test-safe-env.mjs";

const sample = "ADMIN_EMAIL=a@example.com\nDATABASE_URL=postgres://secret\nOTHER=1\n";

test("blanks only the database URL", () => {
  assert.equal(
    blankDatabaseUrl(sample),
    "ADMIN_EMAIL=a@example.com\nDATABASE_URL=\nOTHER=1\n",
  );
});

test("the command sees a blank URL and the original is restored afterwards", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "safe-env-"));
  const file = path.join(dir, ".dev.vars");
  writeFileSync(file, sample);
  const code = await runSafely(
    process.execPath,
    [
      "-e",
      `process.exit(require("fs").readFileSync(${JSON.stringify(file)},"utf8").includes("secret") ? 3 : 0)`,
    ],
    file,
  );
  assert.equal(code, 0);
  assert.equal(readFileSync(file, "utf8"), sample);
});

test("the original is restored when the command fails", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "safe-env-"));
  const file = path.join(dir, ".dev.vars");
  writeFileSync(file, sample);
  const code = await runSafely(process.execPath, ["-e", "process.exit(7)"], file);
  assert.equal(code, 7);
  assert.equal(readFileSync(file, "utf8"), sample);
});

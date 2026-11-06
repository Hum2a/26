import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { blankDatabaseUrl, runSafely } from "./test-safe-env.mjs";
import { resolveCommand } from "./command.mjs";

const sample = "ADMIN_EMAIL=a@example.com\nDATABASE_URL=postgres://secret\nOTHER=1\n";

test("blanks only the database URL", () => {
  assert.equal(
    blankDatabaseUrl(sample),
    "ADMIN_EMAIL=a@example.com\nDATABASE_URL=\nOTHER=1\n",
  );
});

test("blanks whitespace assignments and duplicate URLs while preserving CRLF and comments", () => {
  assert.equal(
    blankDatabaseUrl(
      '\uFEFF  DATABASE_URL = "postgres://private"\r\n\tDATABASE_URL\t=other\r\n# DATABASE_URL=comment\r\nDATABASE_URL_EXTRA=keep\r\n',
    ),
    "DATABASE_URL=\r\nDATABASE_URL=\r\n# DATABASE_URL=comment\r\nDATABASE_URL_EXTRA=keep\r\n",
  );
});

test("Windows npm shims use Node with literal argument boundaries", () => {
  const npmCli = "C:\\Program Files\\nodejs\\node_modules\\npm\\bin\\npm-cli.js";
  const npxCli = "C:\\Program Files\\nodejs\\node_modules\\npm\\bin\\npx-cli.js";
  const options = {
    platform: "win32",
    env: { npm_execpath: npmCli },
    execPath: "C:\\Program Files\\nodejs\\node.exe",
    exists: (candidate) => candidate === npmCli || candidate === npxCli,
  };
  const args = ["run", "test", "--", 'a path & "quoted" value', "$(literal)"];
  assert.deepEqual(resolveCommand("npm.cmd", args, options), {
    command: options.execPath,
    args: [npmCli, ...args],
  });
  assert.deepEqual(resolveCommand("npx", args, options), {
    command: options.execPath,
    args: [npxCli, ...args],
  });
  assert.deepEqual(resolveCommand(options.execPath, args, options), {
    command: options.execPath,
    args,
  });
  assert.throws(() => resolveCommand("unrelated.cmd", [], options), /batch file/);
});

test("child code and literal arguments survive spaces, quotes and shell characters", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "safe env quoted "));
  const file = path.join(dir, ".dev.vars");
  const values = ["a b", 'say "hello"', "x&y|z", "%PATH%", "$(literal)", "trailing\\"];
  writeFileSync(file, sample);
  const code = await runSafely(
    process.execPath,
    [
      "-e",
      `require('node:assert/strict').deepEqual(process.argv.slice(1), ${JSON.stringify(values)})`,
      ...values,
    ],
    file,
  );
  assert.equal(code, 0);
  assert.equal(readFileSync(file, "utf8"), sample);
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

test("a spawn failure restores the fixture and removes process listeners", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "safe-env-"));
  const file = path.join(dir, ".dev.vars");
  writeFileSync(file, sample);
  const before = ["SIGINT", "SIGTERM", "exit"].map((event) =>
    process.listenerCount(event),
  );
  assert.equal(await runSafely(path.join(dir, "missing-executable"), [], file), 1);
  assert.equal(readFileSync(file, "utf8"), sample);
  assert.deepEqual(
    ["SIGINT", "SIGTERM", "exit"].map((event) => process.listenerCount(event)),
    before,
  );
});

test("a synchronous spawn refusal also restores the fixture", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "safe-env-"));
  const file = path.join(dir, ".dev.vars");
  writeFileSync(file, sample);
  assert.equal(await runSafely(process.execPath, ["invalid\u0000argument"], file), 1);
  assert.equal(readFileSync(file, "utf8"), sample);
});

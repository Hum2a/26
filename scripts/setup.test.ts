import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { needsLocalClientKey, runSetup, setupSteps, type SetupStep } from "./setup.ts";

function argsOf(steps: readonly SetupStep[]): string[][] {
  return steps.map((step) => step.args);
}

test("a blank local client key is generated and a complete pair is kept", () => {
  assert.equal(needsLocalClientKey(undefined, undefined), true);
  assert.equal(needsLocalClientKey("  ", "present"), true);
  assert.equal(needsLocalClientKey("present", ""), true);
  assert.equal(needsLocalClientKey("worker", "web"), false);
});

test("setup prepares a local checkout and does not deploy or rotate remote keys", () => {
  const withKey = argsOf(setupSteps(true));
  const withoutKey = argsOf(setupSteps(false));

  assert.deepEqual(withKey, [
    ["install"],
    ["run", "env:sync"],
    ["run", "client-api-key:rotate", "--", "--env", "local"],
    ["run", "agents:sync"],
    ["run", "cf-typegen"],
    ["playwright", "install", "chromium"],
    ["run", "db:migrate:dev"],
    ["run", "auth:seed", "--", "--env", "local"],
  ]);
  assert.equal(
    withoutKey.some((args) => args.includes("client-api-key:rotate")),
    false,
  );

  const joined = withKey.flat().join(" ");
  assert.equal(joined.includes("staging"), false);
  assert.equal(joined.includes("production"), false);
  assert.equal(joined.includes("deploy"), false);
  assert.equal(joined.includes("secrets-sync"), false);
});

test("setup stops at the first failing step", () => {
  const ran: string[] = [];
  const steps: SetupStep[] = [
    { name: "First", command: "npm", args: ["run", "one"] },
    { name: "Second", command: "npm", args: ["run", "two"] },
    { name: "Third", command: "npm", args: ["run", "three"] },
  ];

  assert.throws(
    () =>
      runSetup(steps, (step) => {
        ran.push(step.name);
        if (step.name === "Second") {
          throw new Error("Second failed with exit 1.");
        }
      }),
    /Second failed/,
  );
  assert.deepEqual(ran, ["First", "Second"]);
});

test("the setup script is the npm setup command", () => {
  const packageJson = path.join(import.meta.dirname, "..", "package.json");
  const scripts = (
    JSON.parse(readFileSync(packageJson, "utf8")) as { scripts: Record<string, string> }
  ).scripts;
  assert.equal(scripts.setup, "node --experimental-strip-types scripts/setup.ts");
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { projectRoot } from "./env-files.ts";
import { localRunCommand, parseWorkflowRuns } from "./github-actions-workflow.ts";

const checkWorkflow = readFileSync(
  path.join(projectRoot(), ".github", "workflows", "check.yml"),
  "utf8",
);

test("the check workflow's shell steps run in order", () => {
  const runs = parseWorkflowRuns(checkWorkflow);
  assert.deepEqual(
    runs.map((step) => step.command),
    [
      "npm ci",
      "npx playwright install --with-deps chromium",
      "npm run typecheck",
      "npm run lint",
      "npm run format:check",
      "npm test",
      "npm run build",
      "npx playwright test --workers=1",
    ],
  );
  assert.equal(new Set(runs.map((step) => step.job)).size, 1);
  assert.equal(runs[0]?.job, "check");
  assert.ok(runs.every((step) => step.workingDirectory === null));
});

test("action steps are skipped and multiline scripts keep their directory", () => {
  const runs = parseWorkflowRuns(`
name: Sample
on: push
jobs:
  first:
    steps:
      - uses: actions/checkout@v4
      - name: Install
        working-directory: apps/web
        run: |
          npm ci
          npm test
  second:
    steps:
      - run: "npm run lint"
`);

  assert.deepEqual(runs, [
    {
      job: "first",
      name: "Install",
      command: "npm ci\nnpm test",
      workingDirectory: "apps/web",
    },
    {
      job: "second",
      name: null,
      command: "npm run lint",
      workingDirectory: null,
    },
  ]);
});

test("folded scripts become one command", () => {
  const runs = parseWorkflowRuns(`
jobs:
  check:
    steps:
      - run: >
          npm run typecheck
          npm run lint
`);
  assert.equal(runs[0]?.command, "npm run typecheck npm run lint");
});

test("Windows drops Ubuntu package installs and joins script lines", () => {
  const install = localRunCommand(
    "npx playwright install --with-deps chromium",
    "win32",
  );
  assert.equal(install.command, "npx playwright install chromium");
  assert.match(install.note ?? "", /without --with-deps/);

  const linux = localRunCommand("npx playwright install --with-deps chromium", "linux");
  assert.equal(linux.command, "npx playwright install --with-deps chromium");
  assert.equal(linux.note, null);

  const script = localRunCommand("npm ci\nnpm test", "win32");
  assert.equal(script.command, "npm ci && npm test");
});

test("GitHub expressions are refused", () => {
  assert.throws(
    () => localRunCommand("echo ${{ github.sha }}", "win32"),
    /GitHub expressions/,
  );
});

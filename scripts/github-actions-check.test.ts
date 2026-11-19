import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
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
  const runs = parseWorkflowRuns(checkWorkflow).filter((step) => step.job === "check");
  assert.deepEqual(
    runs.map((step) => step.command),
    [
      "npm ci",
      "npm run typecheck",
      "npm run lint",
      "npm run format:check",
      "npm test",
      "npm run build",
    ],
  );
  assert.ok(runs.every((step) => step.workingDirectory === null));
});

test("Playwright runs in a manual job after building the app", () => {
  assert.match(checkWorkflow, /^on:\r?\n(?: {2}\w+:\r?\n)* {2}workflow_dispatch:\r?$/m);
  assert.match(
    checkWorkflow,
    /^ {2}e2e:\r?\n {4}if: github\.event_name == 'workflow_dispatch'\r?$/m,
  );
  const runs = parseWorkflowRuns(checkWorkflow).filter((step) => step.job !== "check");
  assert.deepEqual(
    runs.map((step) => step.job),
    ["e2e", "e2e", "e2e", "e2e"],
  );
  assert.deepEqual(
    runs.map((step) => step.command),
    [
      "npm ci",
      "npx playwright install --with-deps chromium",
      "npm run build",
      "npx playwright test --workers=1",
    ],
  );
});

test("the local workflow checker plans only the automatic checks", () => {
  const result = spawnSync(
    process.execPath,
    ["--experimental-strip-types", "scripts/github-actions-check.ts", "--dry-run"],
    { cwd: projectRoot(), encoding: "utf8" },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /\$ npm run build/);
  assert.doesNotMatch(result.stdout, /playwright|\be2e\b/);
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

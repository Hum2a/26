import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { execSync, spawnSync } from "node:child_process";
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { resolveBash, resolveCommand } from "./command.mjs";
import { projectRoot } from "./env-files.ts";
import { deployFreeze, workerRelease } from "./release-support.ts";

/**
 * Command-level tests for scripts/release.ts and release.sh.
 *
 * Every allowed path runs against fakes for git, npm, npx, curl and gh. The
 * fakes are Node scripts installed three ways, so they are what actually runs
 * on every platform: on PATH for Linux, macOS and Git Bash; as
 * `node_modules/npm/bin/npm-cli.js` behind a fake `npm_execpath` for the
 * Windows npm/npx resolution in command.mjs; and as `git.cmd` for cmd.exe.
 * Before any release command runs, `assertFakesResolve` proves each one
 * answers and throws otherwise. A real Wrangler that still slipped through
 * would meet an invalid CLOUDFLARE_API_TOKEN instead of a saved login.
 *
 * release.sh is tested in a throwaway git repository with a local bare
 * `origin`, so its version bump, commit, tag and push never touch this repo
 * or the network. The clock is injected with Node's `--import`, never through
 * a production code path.
 */

const root = projectRoot();
const releaseScript = path.join(root, "scripts/release.ts");
const generatedConfigPath = workerRelease("production").generatedConfigPath;
const insideFreeze = deployFreeze.from + 60 * 60 * 1000;
const outsideFreeze = deployFreeze.from - 24 * 60 * 60 * 1000;

type RunResult = {
  status: number;
  stdout: string;
  stderr: string;
  log: string;
};

type Tool = "GIT" | "NPM" | "NPX" | "CURL" | "GH";

/** One fake for every tool: logs its arguments, then behaves as FAKE_* asks. */
function fakeSource(tool: Tool, logFile: string): string {
  return `#!/usr/bin/env node
"use strict";
const fs = require("node:fs");
const path = require("node:path");
const tool = ${JSON.stringify(tool)};
const logFile = ${JSON.stringify(logFile)};
const args = process.argv.slice(2);
const log = (line) => fs.appendFileSync(logFile, line + "\\n");
log(tool + " " + args.join(" "));
if (tool === "GIT") {
  if (process.env.FAKE_GIT_FAIL === "1") {
    process.stderr.write("fake git failed\\n");
    process.exit(1);
  }
  if (args[0] === "rev-parse" && args[1] === "--abbrev-ref") {
    process.stdout.write((process.env.FAKE_GIT_BRANCH || "master") + "\\n");
  } else if (args[0] === "status" && args[1] === "--porcelain") {
    process.stdout.write(process.env.FAKE_GIT_STATUS || "");
  }
  process.exit(0);
}
if (tool === "NPM" && args[0] === "run") {
  if (args[1] && args[1] === process.env.FAKE_NPM_FAIL) {
    process.stderr.write("fake npm: " + args[1] + " failed\\n");
    process.exit(1);
  }
  if (args[1] === "build") {
    const target = process.env.CLOUDFLARE_ENV || "staging";
    log("BUILD " + target);
    const production = target === "production";
    const config = {
      name: production ? "26-humza-website" : "26-humza-website-staging",
      targetEnvironment: target,
      routes: [
        {
          pattern: production ? "26.humza.website" : "26-staging.humza.website",
          custom_domain: true,
        },
      ],
    };
    const generated = ${JSON.stringify(generatedConfigPath)};
    fs.mkdirSync(path.dirname(generated), { recursive: true });
    fs.writeFileSync(generated, JSON.stringify(config));
  }
  if (args[1] && args[1].startsWith("deploy:")) {
    log("DEPLOY SKIP_GIT_CHECK=" + (process.env.SKIP_GIT_CHECK || ""));
  }
}
if (tool === "NPX" && args[0] === "wrangler" && args[1] === "deploy") {
  const configIndex = args.indexOf("--config");
  const configPath = configIndex !== -1 ? args[configIndex + 1] : "";
  if (configPath && fs.existsSync(configPath)) {
    const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
    log("WRANGLER_DEPLOY " + (config.targetEnvironment || "") + " " + (config.name || ""));
  }
}
if (tool === "CURL") {
  process.stdout.write(JSON.stringify({ version: process.env.FAKE_LIVE_VERSION || "" }));
}
if (tool === "GH") process.exit(1);
process.exit(0);
`;
}

function writeExecutable(filePath: string, body: string): void {
  writeFileSync(filePath, body);
  chmodSync(filePath, 0o755);
}

function installFakes(binDir: string, logFile: string, realGit: boolean): void {
  const npmCliDir = path.join(binDir, "node_modules/npm/bin");
  mkdirSync(npmCliDir, { recursive: true });
  const fakes: Array<[Tool, string]> = [
    ["NPM", "npm"],
    ["NPX", "npx"],
    ["CURL", "curl"],
    ["GH", "gh"],
  ];
  if (!realGit) fakes.push(["GIT", "git"]);
  for (const [tool, name] of fakes) {
    writeExecutable(path.join(binDir, name), fakeSource(tool, logFile));
    // Windows (and Git Bash) prefer name.exe / name.cmd over an extensionless
    // shebang. System32 ships curl.exe, so without a shim the real curl wins.
    if (process.platform === "win32") {
      writeFileSync(
        path.join(binDir, `${name}.cmd`),
        `@"${process.execPath}" "%~dp0${name}" %*\r\n`,
      );
    }
  }
  writeFileSync(path.join(npmCliDir, "npm-cli.js"), fakeSource("NPM", logFile));
  writeFileSync(path.join(npmCliDir, "npx-cli.js"), fakeSource("NPX", logFile));
}

function stubEnv(
  binDir: string,
  extra: Record<string, string | undefined>,
): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {};
  for (const [key, value] of Object.entries(process.env)) {
    // One PATH key on Windows, no inherited npm run context, no outside FAKE_*.
    if (/^path$/i.test(key) || /^npm_/i.test(key)) continue;
    if (key === "SKIP_GIT_CHECK" || key === "NODE_OPTIONS" || key.startsWith("FAKE_"))
      continue;
    env[key] = value;
  }
  env.PATH = `${binDir}${path.delimiter}${process.env.PATH ?? ""}`;
  env.npm_execpath = path.join(binDir, "node_modules/npm/bin/npm-cli.js");
  // Tripwire: a real wrangler would fail to authenticate, not use a saved login.
  env.CLOUDFLARE_API_TOKEN = "release-test-invalid-token";
  env.CLOUDFLARE_ACCOUNT_ID = "00000000000000000000000000000000";
  env.WRANGLER_SEND_METRICS = "false";
  for (const [key, value] of Object.entries(extra)) {
    if (value !== undefined) env[key] = value;
  }
  return env;
}

/** Runs npm, npx and git the way the release scripts do; the fakes must answer. */
function assertFakesResolve(
  env: NodeJS.ProcessEnv,
  logFile: string,
  realGit: boolean,
): void {
  for (const name of ["npm", "npx"]) {
    const command = process.platform === "win32" ? `${name}.cmd` : name;
    const invocation = resolveCommand(command, ["fake-probe"], { env });
    spawnSync(invocation.command, invocation.args, {
      env,
      shell: false,
      windowsHide: true,
    });
  }
  if (!realGit) {
    try {
      execSync("git fake-probe", {
        env,
        cwd: root,
        stdio: "ignore",
        windowsHide: true,
      });
    } catch {
      // The log check below reports it.
    }
  }
  const log = readFileSync(logFile, "utf8");
  for (const tool of ["NPM", "NPX", ...(realGit ? [] : ["GIT"])]) {
    if (!log.includes(`${tool} fake-probe`)) {
      throw new Error(
        `The fake ${tool.toLowerCase()} did not run, so the real one would. Refusing to run release commands.`,
      );
    }
  }
  writeFileSync(logFile, "");
}

function withStubs(
  extra: Record<string, string | undefined>,
  run: (env: NodeJS.ProcessEnv) => Omit<RunResult, "log">,
  options: { realGit?: boolean } = {},
): RunResult {
  const dir = mkdtempSync(path.join(tmpdir(), "release-stubs-"));
  const binDir = path.join(dir, "bin");
  const logFile = path.join(dir, "invocations.log");
  mkdirSync(binDir);
  writeFileSync(logFile, "");
  installFakes(binDir, logFile, options.realGit === true);
  const env = stubEnv(binDir, extra);
  const previousConfig = existsSync(generatedConfigPath)
    ? readFileSync(generatedConfigPath, "utf8")
    : undefined;
  try {
    assertFakesResolve(env, logFile, options.realGit === true);
    const result = run(env);
    return { ...result, log: readFileSync(logFile, "utf8") };
  } finally {
    if (previousConfig === undefined) {
      rmSync(generatedConfigPath, { force: true });
    } else {
      writeFileSync(generatedConfigPath, previousConfig);
    }
    rmSync(dir, { recursive: true, force: true });
  }
}

/** A fixed clock for the child process only. */
function clockImport(nowMs: number): string {
  return `--import=data:text/javascript,Date.now=()=>${nowMs}`;
}

function runRelease(
  args: readonly string[],
  extraEnv: Record<string, string> = {},
  options: { nowMs?: number } = {},
): RunResult {
  return withStubs(extraEnv, (env) => {
    const result = spawnSync(
      process.execPath,
      [
        "--experimental-strip-types",
        clockImport(options.nowMs ?? outsideFreeze),
        releaseScript,
        ...args,
      ],
      { cwd: root, encoding: "utf8", env, timeout: 30_000, windowsHide: true },
    );
    return {
      status: result.status ?? 1,
      stdout: result.stdout ?? "",
      stderr: result.stderr ?? "",
    };
  });
}

function loggedCommands(log: string, prefix: string): string[] {
  return log
    .split(/\r?\n/)
    .filter((line) => line.startsWith(`${prefix} `))
    .map((line) => line.slice(prefix.length + 1));
}

const checkSteps = [
  "run typecheck",
  "run content:check",
  "run test:unit",
  "run lint",
  "run test:release",
];

describe("package.json deploy/full routes", () => {
  it("wires deploy and full commands to scripts/release.ts, not release.sh", () => {
    const scripts = (
      JSON.parse(readFileSync(path.join(root, "package.json"), "utf8")) as {
        scripts: Record<string, string>;
      }
    ).scripts;
    assert.equal(
      scripts["deploy:prod"],
      "node --experimental-strip-types scripts/release.ts deploy --env production",
    );
    assert.equal(
      scripts["deploy:both"],
      "node --experimental-strip-types scripts/release.ts deploy --env both",
    );
    assert.equal(
      scripts["deploy:prod:full"],
      "node --experimental-strip-types scripts/release.ts full --env production",
    );
    assert.equal(
      scripts["deploy:both:full"],
      "node --experimental-strip-types scripts/release.ts full --env both",
    );
    assert.equal(
      scripts["secrets-sync:prod"],
      "node --experimental-strip-types scripts/release.ts secrets-sync --env production",
    );
    assert.equal(scripts.release, "node scripts/run-bash.mjs release.sh");
  });
});

describe("release.ts guards with fake git/npm/npx", () => {
  it("refuses a non-master branch for deploy and full, before npm or wrangler", () => {
    for (const [command, target] of [
      ["deploy", "production"],
      ["full", "production"],
      ["deploy", "both"],
      ["full", "both"],
    ]) {
      const result = runRelease([command, "--env", target], {
        FAKE_GIT_BRANCH: "cursor/safeguard-corrections-c6a9",
      });
      assert.equal(result.status, 1, `${command} ${target}`);
      assert.match(
        result.stderr,
        /must be from master.*cursor\/safeguard-corrections-c6a9/,
      );
      assert.equal(loggedCommands(result.log, "NPM").length, 0);
      assert.equal(loggedCommands(result.log, "NPX").length, 0);
    }
  });

  it("refuses a dirty tree for deploy and full, before npm or wrangler", () => {
    for (const command of ["deploy", "full"]) {
      const result = runRelease([command, "--env", "both"], {
        FAKE_GIT_STATUS: " M package.json\n",
      });
      assert.equal(result.status, 1, command);
      assert.match(result.stderr, /clean working tree/);
      assert.equal(loggedCommands(result.log, "NPM").length, 0);
      assert.equal(loggedCommands(result.log, "NPX").length, 0);
    }
  });

  it("fails closed for production when git cannot be queried", () => {
    for (const command of ["deploy", "full"]) {
      const result = runRelease([command, "--env", "production"], {
        FAKE_GIT_FAIL: "1",
      });
      assert.equal(result.status, 1, command);
      assert.match(result.stderr, /Cannot verify git state/);
      assert.equal(loggedCommands(result.log, "NPM").length, 0);
      assert.equal(loggedCommands(result.log, "NPX").length, 0);
    }
  });

  it("does not read git for a staging deploy or a production dry run", () => {
    const staging = runRelease(["deploy", "--env", "staging", "--skip-checks"], {
      FAKE_GIT_FAIL: "1",
    });
    assert.equal(staging.status, 0, staging.stderr);
    assert.equal(loggedCommands(staging.log, "GIT").length, 0);
    assert.deepEqual(loggedCommands(staging.log, "BUILD"), ["staging"]);
    const dryRun = runRelease(["deploy", "--env", "production", "--dry-run"], {
      FAKE_GIT_FAIL: "1",
    });
    assert.equal(dryRun.status, 0, dryRun.stderr);
    assert.equal(loggedCommands(dryRun.log, "GIT").length, 0);
    const npx = loggedCommands(dryRun.log, "NPX");
    assert.equal(npx.length, 1);
    assert.match(npx[0] ?? "", /^wrangler deploy --config .* --dry-run$/);
  });

  it("lets staging deploy without confirmation or a clean master", () => {
    const result = runRelease(["deploy", "--env", "staging", "--skip-checks"], {
      FAKE_GIT_BRANCH: "feature",
      FAKE_GIT_STATUS: " M dirty.txt\n",
    });
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(loggedCommands(result.log, "NPM"), ["run build"]);
    const npx = loggedCommands(result.log, "NPX");
    assert.equal(npx.length, 1);
    assert.match(npx[0] ?? "", /^wrangler deploy --config /);
  });

  it("does not apply git guards to secrets-sync", () => {
    const result = runRelease(["secrets-sync", "--env", "production", "--dry-run"], {
      FAKE_GIT_BRANCH: "feature",
      FAKE_GIT_STATUS: " M dirty.txt\n",
    });
    assert.doesNotMatch(
      result.stderr,
      /must be from master|clean working tree|Cannot verify git state/,
    );
    assert.equal(loggedCommands(result.log, "GIT").length, 0);
    assert.equal(loggedCommands(result.log, "NPX").length, 0);
  });
});

describe("release.ts validation and approved deploys with fakes", () => {
  it("stops deploy at a failed check: no build, no wrangler", () => {
    const result = runRelease(["deploy", "--env", "production"], {
      FAKE_NPM_FAIL: "test:unit",
    });
    assert.equal(result.status, 1);
    assert.deepEqual(loggedCommands(result.log, "NPM"), [
      "run typecheck",
      "run content:check",
      "run test:unit",
    ]);
    assert.equal(loggedCommands(result.log, "BUILD").length, 0);
    assert.equal(loggedCommands(result.log, "NPX").length, 0);
  });

  it("stops full at a failed check: no migrations, no build, no wrangler", () => {
    const result = runRelease(["full", "--env", "both"], {
      FAKE_NPM_FAIL: "lint",
    });
    assert.equal(result.status, 1);
    const npm = loggedCommands(result.log, "NPM");
    assert.deepEqual(npm, checkSteps.slice(0, 4));
    assert.equal(
      npm.some((line) => /migrate/.test(line)),
      false,
    );
    assert.equal(loggedCommands(result.log, "NPX").length, 0);
  });

  it("runs every check once, then one build and one deploy for production", () => {
    const result = runRelease(["deploy", "--env", "production"]);
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(loggedCommands(result.log, "GIT"), [
      "rev-parse --abbrev-ref HEAD",
      "status --porcelain",
    ]);
    assert.deepEqual(loggedCommands(result.log, "NPM"), [...checkSteps, "run build"]);
    assert.deepEqual(loggedCommands(result.log, "BUILD"), ["production"]);
    const npx = loggedCommands(result.log, "NPX");
    assert.equal(npx.length, 1);
    assert.match(npx[0] ?? "", /^wrangler deploy --config /);
    // No recursion: nothing calls the deploy scripts or release.sh again.
    assert.doesNotMatch(result.log, /deploy:|release\.sh|secret bulk/);
  });

  it("checks once for both targets, then builds once and deploys staging before production", () => {
    const result = runRelease(["deploy", "--env", "both"]);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(loggedCommands(result.log, "GIT").length, 2);
    assert.deepEqual(loggedCommands(result.log, "NPM"), [
      ...checkSteps,
      "run build",
    ]);
    assert.deepEqual(loggedCommands(result.log, "BUILD"), ["staging"]);
    assert.deepEqual(loggedCommands(result.log, "WRANGLER_DEPLOY"), [
      "staging 26-humza-website-staging",
      "production 26-humza-website",
    ]);
    assert.equal(loggedCommands(result.log, "NPX").length, 2);
    assert.doesNotMatch(result.log, /deploy:|release\.sh|secret bulk/);
  });

  it("adds the full API suite only with --full-checks", () => {
    const result = runRelease([
      "deploy",
      "--env",
      "staging",
      "--full-checks",
      "--dry-run",
    ]);
    assert.equal(result.status, 0, result.stderr);
    // A dry run packages only; it never runs the checks.
    assert.deepEqual(loggedCommands(result.log, "NPM"), ["run build"]);
    const checked = runRelease(["deploy", "--env", "staging", "--full-checks"]);
    assert.equal(checked.status, 0, checked.stderr);
    assert.deepEqual(loggedCommands(checked.log, "NPM"), [
      ...checkSteps,
      "run test -w @26/api",
      "run build",
    ]);
  });
});

describe("release.ts freeze survives a git bypass", () => {
  for (const [label, bypass, flag] of [
    ["SKIP_GIT_CHECK=true", { SKIP_GIT_CHECK: "true" }, []],
    ["--skip-git-check", {}, ["--skip-git-check"]],
  ] as const) {
    it(`still refuses the party freeze with ${label}`, () => {
      for (const command of ["deploy", "full"]) {
        const result = runRelease([command, "--env", "production", ...flag], bypass, {
          nowMs: insideFreeze,
        });
        assert.equal(result.status, 1, command);
        assert.match(result.stderr, /frozen for the party weekend/);
        assert.equal(loggedCommands(result.log, "NPM").length, 0);
        assert.equal(loggedCommands(result.log, "NPX").length, 0);
      }
    });
  }

  it("deploys in the freeze only with --override-freeze, once", () => {
    const result = runRelease(
      ["deploy", "--env", "production", "--override-freeze", "--skip-checks"],
      { SKIP_GIT_CHECK: "true" },
      { nowMs: insideFreeze },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.equal(loggedCommands(result.log, "GIT").length, 0);
    assert.deepEqual(loggedCommands(result.log, "BUILD"), ["production"]);
    assert.equal(loggedCommands(result.log, "NPX").length, 1);
  });

  it("does not freeze staging", () => {
    const result = runRelease(
      ["deploy", "--env", "staging", "--skip-checks"],
      {},
      {
        nowMs: insideFreeze,
      },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(loggedCommands(result.log, "BUILD"), ["staging"]);
  });
});

/* ---------- release.sh in a throwaway repository ---------- */

type Fixture = { dir: string; work: string; origin: string };

function git(cwd: string, args: readonly string[]): string {
  const result = spawnSync("git", args, { cwd, encoding: "utf8", windowsHide: true });
  if (result.status !== 0) {
    throw new Error(`git ${args.join(" ")} failed: ${result.stderr}`);
  }
  return result.stdout.trim();
}

/** A clean master at v0.0.5 with a local bare origin and the release scripts. */
function releaseFixture(): Fixture {
  const dir = mkdtempSync(path.join(tmpdir(), "release-sh-"));
  const work = path.join(dir, "work");
  const origin = path.join(dir, "origin.git");
  mkdirSync(path.join(work, "scripts"), { recursive: true });
  mkdirSync(path.join(work, "packages/shared/src"), { recursive: true });
  copyFileSync(path.join(root, "release.sh"), path.join(work, "release.sh"));
  for (const file of ["release-support.ts", "env-files.ts"]) {
    copyFileSync(path.join(root, "scripts", file), path.join(work, "scripts", file));
  }
  const name = "26-humza-website";
  writeFileSync(
    path.join(work, "package.json"),
    `${JSON.stringify({ name, version: "0.0.5", private: true }, null, 2)}\n`,
  );
  writeFileSync(
    path.join(work, "package-lock.json"),
    `${JSON.stringify(
      {
        name,
        version: "0.0.5",
        lockfileVersion: 3,
        packages: { "": { name, version: "0.0.5" } },
      },
      null,
      2,
    )}\n`,
  );
  writeFileSync(
    path.join(work, "packages/shared/src/version.ts"),
    'export const appVersion = "0.0.5";\n',
  );
  git(dir, ["init", "--bare", "--initial-branch=master", origin]);
  git(work, ["init", "--initial-branch=master"]);
  git(work, ["config", "user.email", "release-test@example.invalid"]);
  git(work, ["config", "user.name", "Release test"]);
  git(work, ["config", "commit.gpgsign", "false"]);
  git(work, ["config", "tag.gpgsign", "false"]);
  git(work, ["config", "core.autocrlf", "false"]);
  git(work, ["add", "-A"]);
  git(work, ["commit", "-q", "-m", "Fixture"]);
  git(work, ["remote", "add", "origin", origin]);
  git(work, ["push", "-q", "-u", "origin", "master"]);
  return { dir, work, origin };
}

/** Git Bash path for a Windows directory (`E:\x\y` → `/e/x/y`). */
function bashPath(windowsPath: string): string {
  if (process.platform !== "win32") return windowsPath;
  const resolved = path.resolve(windowsPath);
  const drive = /^([A-Za-z]):[\\/](.*)$/.exec(resolved);
  if (!drive) return resolved.replace(/\\/g, "/");
  return `/${drive[1].toLowerCase()}/${drive[2].replace(/\\/g, "/")}`;
}

function runReleaseSh(
  fixture: Fixture,
  args: readonly string[],
  extra: Record<string, string | undefined> = {},
): RunResult {
  return withStubs(
    { FAKE_LIVE_VERSION: "0.0.6", ...extra },
    (env) => {
      const script = path.join(fixture.work, "release.sh");
      const stubBin = (env.PATH ?? "").split(path.delimiter)[0] ?? "";
      // Git for Windows injects /usr/bin (real curl) before any script runs.
      // Put the stub directory first inside bash so the fakes win.
      const result = spawnSync(
        resolveBash({ env }),
        [
          "--noprofile",
          "--norc",
          "-c",
          'export PATH="$1:$PATH"; script="$2"; shift 2; exec bash --noprofile --norc "$script" "$@"',
          "run-release-sh",
          bashPath(stubBin),
          bashPath(script),
          ...args,
        ],
        {
          cwd: fixture.work,
          encoding: "utf8",
          env,
          timeout: 120_000,
          windowsHide: true,
        },
      );
      return {
        status: result.status ?? 1,
        stdout: result.stdout ?? "",
        stderr: result.stderr ?? "",
      };
    },
    { realGit: true },
  );
}

function withFixture(run: (fixture: Fixture) => void): void {
  const fixture = releaseFixture();
  try {
    run(fixture);
  } finally {
    rmSync(fixture.dir, { recursive: true, force: true });
  }
}

function fixtureVersion(fixture: Fixture): string {
  return (
    JSON.parse(readFileSync(path.join(fixture.work, "package.json"), "utf8")) as {
      version: string;
    }
  ).version;
}

/** Nothing changed: same commit, no tag, clean files at v0.0.5, origin untouched. */
function assertUntouched(fixture: Fixture, head: string, log: string): void {
  assert.equal(git(fixture.work, ["rev-parse", "HEAD"]), head);
  assert.equal(git(fixture.work, ["tag", "--list"]), "");
  assert.equal(git(fixture.origin, ["tag", "--list"]), "");
  assert.equal(fixtureVersion(fixture), "0.0.5");
  assert.match(
    readFileSync(path.join(fixture.work, "packages/shared/src/version.ts"), "utf8"),
    /"0\.0\.5"/,
  );
  assert.equal(loggedCommands(log, "NPM").length, 0);
  assert.equal(loggedCommands(log, "NPX").length, 0);
  assert.equal(loggedCommands(log, "CURL").length, 0);
}

describe("release.sh wrapper", () => {
  it("does not accept --skip-git-check as a flag", () => {
    const result = spawnSync(
      resolveBash(),
      ["--noprofile", "--norc", path.join(root, "release.sh"), "--skip-git-check"],
      {
        cwd: root,
        encoding: "utf8",
        timeout: 10_000,
        windowsHide: true,
      },
    );
    assert.equal(result.status, 2);
    assert.match(result.stderr, /Unknown option: --skip-git-check/);
  });

  it("bumps, checks, commits, tags, pushes and deploys once with the git check handed off", () => {
    withFixture((fixture) => {
      const result = runReleaseSh(fixture, [
        "patch",
        "--deploy=staging",
        "--no-github",
      ]);
      assert.equal(result.status, 0, result.stderr);
      assert.equal(fixtureVersion(fixture), "0.0.6");
      assert.match(
        readFileSync(path.join(fixture.work, "packages/shared/src/version.ts"), "utf8"),
        /appVersion = "0\.0\.6"/,
      );
      assert.equal(git(fixture.work, ["log", "-1", "--format=%s"]), "Release v0.0.6");
      assert.equal(git(fixture.work, ["status", "--porcelain"]), "");
      assert.equal(git(fixture.origin, ["tag", "--list"]), "v0.0.6");
      assert.equal(
        git(fixture.origin, ["rev-parse", "master"]),
        git(fixture.work, ["rev-parse", "HEAD"]),
      );
      assert.deepEqual(loggedCommands(result.log, "NPM"), [
        "run typecheck",
        "run content:check",
        "run test:unit",
        "run test:release",
        "run deploy:staging -- --skip-checks",
      ]);
      assert.deepEqual(loggedCommands(result.log, "NPX"), ["eslint ."]);
      assert.deepEqual(loggedCommands(result.log, "DEPLOY"), ["SKIP_GIT_CHECK=true"]);
      assert.equal(loggedCommands(result.log, "CURL").length, 1);
      assert.equal(loggedCommands(result.log, "GH").length, 0);
    });
  });

  it("deploys production without a confirmation flag", () => {
    withFixture((fixture) => {
      const result = runReleaseSh(
        fixture,
        ["patch", "--deploy=production", "--no-github", "--skip-checks"],
        { NODE_OPTIONS: clockImport(outsideFreeze) },
      );
      assert.equal(result.status, 0, result.stderr);
      assert.deepEqual(loggedCommands(result.log, "NPM"), [
        "run deploy:production -- --skip-checks",
      ]);
      assert.deepEqual(loggedCommands(result.log, "DEPLOY"), ["SKIP_GIT_CHECK=true"]);
    });
  });

  it("undoes the version and deploys nothing when a check fails", () => {
    withFixture((fixture) => {
      const head = git(fixture.work, ["rev-parse", "HEAD"]);
      const result = runReleaseSh(
        fixture,
        ["patch", "--deploy=staging", "--no-github"],
        {
          FAKE_NPM_FAIL: "test:unit",
        },
      );
      assert.equal(result.status, 1);
      assert.match(result.stderr, /Checks failed/);
      assert.equal(git(fixture.work, ["rev-parse", "HEAD"]), head);
      assert.equal(git(fixture.work, ["status", "--porcelain"]), "");
      assert.equal(git(fixture.origin, ["tag", "--list"]), "");
      assert.equal(fixtureVersion(fixture), "0.0.5");
      assert.deepEqual(loggedCommands(result.log, "NPM"), [
        "run typecheck",
        "run content:check",
        "run test:unit",
      ]);
      assert.equal(loggedCommands(result.log, "DEPLOY").length, 0);
    });
  });

  it("refuses a dirty tree before bumping, even with SKIP_GIT_CHECK set", () => {
    withFixture((fixture) => {
      const head = git(fixture.work, ["rev-parse", "HEAD"]);
      writeFileSync(path.join(fixture.work, "stray.txt"), "uncommitted\n");
      const result = runReleaseSh(fixture, ["patch", "--deploy=staging"], {
        SKIP_GIT_CHECK: "true",
      });
      assert.equal(result.status, 1);
      assert.match(result.stderr, /Commit or stash your changes first/);
      assertUntouched(fixture, head, result.log);
    });
  });

  it("refuses a non-master branch before bumping", () => {
    withFixture((fixture) => {
      git(fixture.work, ["checkout", "-q", "-b", "feature"]);
      const head = git(fixture.work, ["rev-parse", "HEAD"]);
      const result = runReleaseSh(fixture, ["patch", "--deploy=production"], {
        NODE_OPTIONS: clockImport(outsideFreeze),
      });
      assert.equal(result.status, 1);
      assert.match(result.stderr, /Releases are cut from master/);
      assertUntouched(fixture, head, result.log);
    });
  });

  it("refuses frozen production before bumping", () => {
    withFixture((fixture) => {
      const head = git(fixture.work, ["rev-parse", "HEAD"]);
      const frozen = runReleaseSh(fixture, ["patch", "--deploy=production"], {
        SKIP_GIT_CHECK: "true",
        NODE_OPTIONS: clockImport(insideFreeze),
      });
      assert.equal(frozen.status, 1);
      assert.match(frozen.stderr, /frozen for the party weekend/);
      assertUntouched(fixture, head, frozen.log);
    });
  });
});

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { projectRoot } from "./env-files.ts";
import { workerRelease } from "./release-support.ts";

/**
 * Command-level tests for scripts/release.ts and release.sh.
 * Fake git/npm/npx sit on PATH so an allowed path cannot reach real npm,
 * wrangler, migrations, secrets, or network services.
 */

const root = projectRoot();
const releaseScript = path.join(root, "scripts/release.ts");
const generatedConfigPath = workerRelease("production").generatedConfigPath;

type RunResult = {
  status: number;
  stdout: string;
  stderr: string;
  log: string;
};

function writeExecutable(filePath: string, body: string): void {
  writeFileSync(filePath, body);
  chmodSync(filePath, 0o755);
}

function withStubBin(run: (binDir: string, logFile: string) => RunResult): RunResult {
  const dir = mkdtempSync(path.join(tmpdir(), "release-stubs-"));
  const binDir = path.join(dir, "bin");
  const logFile = path.join(dir, "invocations.log");
  mkdirSync(binDir);
  writeFileSync(logFile, "");

  writeExecutable(
    path.join(binDir, "git"),
    `#!/usr/bin/env bash
printf 'GIT %s\\n' "$*" >> ${JSON.stringify(logFile)}
if [[ "\${FAKE_GIT_FAIL:-}" == "1" ]]; then
  echo "fake git failed" >&2
  exit 1
fi
if [[ "$1" == "rev-parse" && "$2" == "--abbrev-ref" ]]; then
  printf '%s\\n' "\${FAKE_GIT_BRANCH:-master}"
  exit 0
fi
if [[ "$1" == "status" && "$2" == "--porcelain" ]]; then
  printf '%s' "\${FAKE_GIT_STATUS:-}"
  exit 0
fi
exit 0
`,
  );

  writeExecutable(
    path.join(binDir, "npm"),
    `#!/usr/bin/env bash
printf 'NPM %s\\n' "$*" >> ${JSON.stringify(logFile)}
if [[ "$1" == "run" && "$2" == "build" ]]; then
  mkdir -p ${JSON.stringify(path.dirname(generatedConfigPath))}
  env_name="\${CLOUDFLARE_ENV:-staging}"
  if [[ "$env_name" == "production" ]]; then
    cat > ${JSON.stringify(generatedConfigPath)} <<'JSON'
{
  "name": "26-humza-website",
  "targetEnvironment": "production",
  "routes": [{ "pattern": "26.humza.website", "custom_domain": true }]
}
JSON
  else
    cat > ${JSON.stringify(generatedConfigPath)} <<'JSON'
{
  "name": "26-humza-website-staging",
  "targetEnvironment": "staging",
  "routes": [{ "pattern": "26-staging.humza.website", "custom_domain": true }]
}
JSON
  fi
fi
exit 0
`,
  );

  writeExecutable(
    path.join(binDir, "npx"),
    `#!/usr/bin/env bash
printf 'NPX %s\\n' "$*" >> ${JSON.stringify(logFile)}
exit 0
`,
  );

  const previousConfig = existsSync(generatedConfigPath)
    ? readFileSync(generatedConfigPath, "utf8")
    : undefined;

  try {
    return run(binDir, logFile);
  } finally {
    if (previousConfig === undefined) {
      rmSync(generatedConfigPath, { force: true });
    } else {
      writeFileSync(generatedConfigPath, previousConfig);
    }
    rmSync(dir, { recursive: true, force: true });
  }
}

function stubEnv(
  binDir: string,
  extra: Record<string, string | undefined>,
): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    PATH: `${binDir}${path.delimiter}${process.env.PATH ?? ""}`,
    ...extra,
  };
  delete env.SKIP_GIT_CHECK;
  if (extra.SKIP_GIT_CHECK) env.SKIP_GIT_CHECK = extra.SKIP_GIT_CHECK;
  delete env.CLOUDFLARE_API_TOKEN;
  delete env.CLOUDFLARE_API_KEY;
  return env;
}

function runRelease(
  args: readonly string[],
  extraEnv: Record<string, string> = {},
): RunResult {
  return withStubBin((binDir, logFile) => {
    const result = spawnSync(
      process.execPath,
      ["--experimental-strip-types", releaseScript, ...args],
      {
        cwd: root,
        encoding: "utf8",
        env: stubEnv(binDir, extraEnv),
        timeout: 15_000,
        windowsHide: true,
      },
    );
    return {
      status: result.status ?? 1,
      stdout: result.stdout ?? "",
      stderr: result.stderr ?? "",
      log: readFileSync(logFile, "utf8"),
    };
  });
}

function loggedCommands(log: string, prefix: string): string[] {
  return log
    .split(/\r?\n/)
    .filter((line) => line.startsWith(`${prefix} `))
    .map((line) => line.slice(prefix.length + 1));
}

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
    assert.equal(scripts.release, "bash release.sh");
  });
});

describe("release.ts subprocess guards with stubbed git/npm/npx", () => {
  it("rejects production without confirmation before npm or wrangler", () => {
    const result = runRelease(["deploy", "--env", "production"]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /needs --confirm-production/);
    assert.equal(loggedCommands(result.log, "NPM").length, 0);
    assert.equal(loggedCommands(result.log, "NPX").length, 0);
  });

  it("rejects a non-master branch before npm or wrangler", () => {
    const result = runRelease(
      ["deploy", "--env", "production", "--confirm-production"],
      { FAKE_GIT_BRANCH: "cursor/safeguard-corrections-c6a9" },
    );
    assert.equal(result.status, 1);
    assert.match(
      result.stderr,
      /must be from master.*cursor\/safeguard-corrections-c6a9/,
    );
    assert.equal(loggedCommands(result.log, "NPM").length, 0);
    assert.equal(loggedCommands(result.log, "NPX").length, 0);
  });

  it("rejects a dirty tree before npm or wrangler", () => {
    const result = runRelease(
      ["deploy", "--env", "production", "--confirm-production"],
      { FAKE_GIT_BRANCH: "master", FAKE_GIT_STATUS: " M package.json\n" },
    );
    assert.equal(result.status, 1);
    assert.match(result.stderr, /clean working tree/);
    assert.equal(loggedCommands(result.log, "NPM").length, 0);
    assert.equal(loggedCommands(result.log, "NPX").length, 0);
  });

  it("fails closed when git cannot be queried", () => {
    const result = runRelease(
      ["deploy", "--env", "production", "--confirm-production"],
      { FAKE_GIT_FAIL: "1" },
    );
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Cannot verify git state/);
    assert.equal(loggedCommands(result.log, "NPM").length, 0);
    assert.equal(loggedCommands(result.log, "NPX").length, 0);
  });

  it("keeps confirmation when git checks are skipped", () => {
    const result = runRelease(["deploy", "--env", "production"], {
      SKIP_GIT_CHECK: "true",
    });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /needs --confirm-production/);
    assert.equal(loggedCommands(result.log, "GIT").length, 0);
    assert.equal(loggedCommands(result.log, "NPM").length, 0);
    assert.equal(loggedCommands(result.log, "NPX").length, 0);
  });

  it("runs an approved production deploy once, in order, without recursion", () => {
    const result = runRelease(
      ["deploy", "--env", "production", "--confirm-production", "--skip-checks"],
      { FAKE_GIT_BRANCH: "master", FAKE_GIT_STATUS: "" },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(loggedCommands(result.log, "GIT"), [
      "rev-parse --abbrev-ref HEAD",
      "status --porcelain",
    ]);
    assert.deepEqual(loggedCommands(result.log, "NPM"), ["run build"]);
    const npx = loggedCommands(result.log, "NPX");
    assert.equal(npx.length, 1);
    assert.match(npx[0] ?? "", /^wrangler deploy --config /);
    assert.doesNotMatch(result.log, /deploy:prod|release\.sh|secret bulk/);
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

describe("release.sh wrapper policy", () => {
  it("requires master and a clean tree before it sets SKIP_GIT_CHECK", () => {
    const text = readFileSync(path.join(root, "release.sh"), "utf8");
    const branchCheck = text.indexOf('[[ "$branch" == "master" ]]');
    const dirtyCheck = text.indexOf("git status --porcelain");
    const skipGit = text.indexOf("SKIP_GIT_CHECK=true");
    assert.ok(branchCheck > 0);
    assert.ok(dirtyCheck > branchCheck);
    assert.ok(skipGit > dirtyCheck);
    assert.match(
      text,
      /SKIP_GIT_CHECK=true npm run "deploy:\$deploy" -- "\$\{deploy_options\[@\]\}"/,
    );
    assert.match(
      text,
      /\[\[ "\$confirm_production" == true \]\] && deploy_options\+=\(--confirm-production\)/,
    );
  });

  it("does not accept --skip-git-check as a flag", () => {
    const result = spawnSync(
      "bash",
      [path.join(root, "release.sh"), "--skip-git-check"],
      {
        cwd: root,
        encoding: "utf8",
        timeout: 5_000,
        windowsHide: true,
      },
    );
    assert.equal(result.status, 2);
    assert.match(result.stderr, /Unknown option: --skip-git-check/);
  });

  it("stops on a non-master branch before npm deploy", () => {
    const result = withStubBin((binDir, logFile) => {
      const spawned = spawnSync(
        "bash",
        [path.join(root, "release.sh"), "--deploy=production", "--confirm-production"],
        {
          cwd: root,
          encoding: "utf8",
          env: stubEnv(binDir, { FAKE_GIT_BRANCH: "feature" }),
          timeout: 10_000,
          windowsHide: true,
        },
      );
      return {
        status: spawned.status ?? 1,
        stdout: spawned.stdout ?? "",
        stderr: spawned.stderr ?? "",
        log: readFileSync(logFile, "utf8"),
      };
    });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Releases are cut from master/);
    assert.equal(loggedCommands(result.log, "NPM").length, 0);
    assert.equal(loggedCommands(result.log, "NPX").length, 0);
  });
});

import { spawnSync, execSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { resolveCommand } from "./command.mjs";
import {
  devVarsPath,
  projectRoot,
  readEnvValues,
  readTargetEnvironment,
  type TargetEnvironment,
} from "./env-files.ts";
import {
  assertGeneratedWorkerConfig,
  assertDeployAllowed,
  collectWorkerSecrets,
  readGeneratedWorkerConfig,
  requiredWorkerSecrets,
  retargetGeneratedWorkerConfig,
  resolveMigrateEnvironment,
  resolveReleaseTargets,
  releaseCheckSteps,
  workerRelease,
  type DeployableEnvironment,
  type SecretCollection,
} from "./release-support.ts";

type ReleaseCommand = "deploy" | "secrets-sync" | "migrate" | "full";

const root = projectRoot();
const wranglerConfigPath = path.join(root, "apps/api/wrangler.jsonc");
const argv = process.argv.slice(2);
const command = readCommand(argv);
const dryRun = argv.includes("--dry-run");

function readGitState(): { branch: string; clean: boolean } | undefined {
  // release.sh verifies clean master before this, then sets SKIP_GIT_CHECK.
  // Direct npm deploy routes must still read git. There is no blanket CI bypass.
  if (argv.includes("--skip-git-check") || process.env.SKIP_GIT_CHECK === "true") {
    return undefined;
  }
  try {
    const branch = execSync("git rev-parse --abbrev-ref HEAD", {
      cwd: root,
      encoding: "utf8",
    }).trim();
    const status = execSync("git status --porcelain", {
      cwd: root,
      encoding: "utf8",
    }).trim();
    return { branch, clean: status === "" };
  } catch {
    throw new Error(
      "Cannot verify git state. Production deploys require a clean master branch. Pass --skip-git-check or set SKIP_GIT_CHECK=true only from a trusted wrapper that has already enforced that policy.",
    );
  }
}

if (command === "migrate") {
  const environment = resolveMigrateEnvironment(
    readTargetEnvironment(process.argv) ?? argv[1],
  );
  migrateEnvironment(environment);
} else {
  const targets = resolveReleaseTargets(
    readTargetEnvironment(process.argv) ?? (argv.includes("both") ? "both" : argv[1]),
  );
  if (command === "deploy" || command === "full") {
    // Git state matters only to a real production deploy, the one case
    // assertDeployAllowed checks it. Staging and packaging dry runs never read
    // git, so they do not fail on a missing git with a production message.
    const needsGit = !dryRun && targets.includes("production");
    assertDeployAllowed(
      targets,
      {
        dryRun,
        overrideFreeze: argv.includes("--override-freeze"),
      },
      Date.now(),
      needsGit ? readGitState() : undefined,
    );
    if (!dryRun && !argv.includes("--skip-checks")) {
      console.log("Checking the release before any migrations or deployment.");
      for (const args of releaseCheckSteps(argv.includes("--full-checks")))
        runCommand(npmCommand(), args);
    }
  }
  if (command === "secrets-sync") {
    for (const environment of targets) {
      syncSecrets(environment);
    }
  } else {
    const preparedSecrets =
      command === "full"
        ? new Map(
            targets.map((environment) => [environment, prepareSecrets(environment)]),
          )
        : undefined;
    buildRelease(targets);
    for (const environment of targets) {
      if (command === "full" && !dryRun) {
        migrateEnvironment(environment);
      }
      deployEnvironment(environment, {
        prepared: preparedSecrets?.get(environment),
      });
    }
  }
}

function readCommand(args: readonly string[]): ReleaseCommand {
  const command = args.find(
    (arg) =>
      arg === "deploy" || arg === "secrets-sync" || arg === "migrate" || arg === "full",
  );
  if (!command) {
    throw new Error("Pass deploy, secrets-sync, migrate, or full.");
  }
  return command;
}

function migrateEnvironment(environment: TargetEnvironment) {
  console.log(`Migrating ${environment} auth and archive schemas.`);
  if (dryRun) {
    console.log("Dry run: migrations were not applied.");
    return;
  }
  runCommand(npmCommand(), ["run", "auth:migrate", "--", "--env", environment]);
  runCommand(npmCommand(), ["run", "archive:migrate", "--", "--env", environment]);
}

function syncSecrets(environment: DeployableEnvironment) {
  const prepared = prepareSecrets(environment);
  console.log(
    `Syncing ${prepared.keys.length} Worker secrets to ${workerRelease(environment).workerName}: ${prepared.keys.join(", ")}.`,
  );
  if (dryRun) {
    console.log("Dry run: secrets were not uploaded.");
    return;
  }
  withSecretsFile(prepared.envText, (filePath) => {
    runWrangler([
      "secret",
      "bulk",
      filePath,
      "--config",
      wranglerConfigPath,
      "--env",
      environment,
    ]);
  });
}

function buildRelease(targets: readonly DeployableEnvironment[]) {
  const primary = workerRelease(targets[0]);
  if (targets.length === 1) {
    console.log(`Building ${primary.environment} as ${primary.workerName}.`);
  } else {
    console.log(
      `Building once for ${targets.map((env) => workerRelease(env).workerName).join(" and ")}.`,
    );
  }
  runCommand(npmCommand(), ["run", "build"], {
    CLOUDFLARE_ENV: primary.cloudflareEnv,
  });
}

function deployEnvironment(
  environment: DeployableEnvironment,
  options: { prepared?: SecretCollection },
) {
  const release = workerRelease(environment);
  const prepared = options.prepared;
  let generated = readGeneratedWorkerConfig(release.generatedConfigPath);
  if (generated.targetEnvironment !== release.environment) {
    generated = retargetGeneratedWorkerConfig(
      generated,
      readFileSync(wranglerConfigPath, "utf8"),
      release.environment,
    );
    writeFileSync(release.generatedConfigPath, JSON.stringify(generated), "utf8");
  }
  assertGeneratedWorkerConfig(
    readGeneratedWorkerConfig(release.generatedConfigPath),
    release,
  );
  const deployArgs = ["deploy", "--config", release.generatedConfigPath];
  if (dryRun) {
    deployArgs.push("--dry-run");
    console.log(`Dry run: checking the ${release.workerName} package.`);
  } else {
    console.log(`Deploying ${release.workerName}.`);
  }
  if (prepared) {
    console.log(
      `Attaching ${prepared.keys.length} secrets: ${prepared.keys.join(", ")}.`,
    );
    withSecretsFile(prepared.envText, (filePath) => {
      runWrangler(
        [...deployArgs, "--secrets-file", filePath],
        path.dirname(release.generatedConfigPath),
      );
    });
    return;
  }
  runWrangler(deployArgs, path.dirname(release.generatedConfigPath));
}

function prepareSecrets(environment: DeployableEnvironment) {
  const filePath = devVarsPath(environment);
  const fileLabel = path.relative(root, filePath);
  if (!existsSync(filePath)) {
    throw new Error(
      `Missing ${fileLabel}. Run npm run env:sync, then fill in the required values.`,
    );
  }
  return collectWorkerSecrets({
    required: requiredWorkerSecrets(
      readFileSync(wranglerConfigPath, "utf8"),
      environment,
    ),
    values: readEnvValues(filePath),
    fileLabel,
    publicOrigin: workerRelease(environment).origin,
  });
}

function withSecretsFile(envText: string, run: (filePath: string) => void) {
  const directory = mkdtempSync(path.join(os.tmpdir(), "26-humza-secrets-"));
  const filePath = path.join(directory, "secrets.env");
  try {
    writeFileSync(filePath, envText, "utf8");
    run(filePath);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

function runWrangler(args: readonly string[], cwd = path.join(root, "apps/api")) {
  runCommand(npxCommand(), ["wrangler", ...args], undefined, cwd);
}

function runCommand(
  command: string,
  args: readonly string[],
  extraEnv?: Record<string, string>,
  cwd = root,
) {
  const invocation = resolveCommand(command, args);
  const result = spawnSync(invocation.command, invocation.args, {
    cwd,
    env: extraEnv ? { ...process.env, ...extraEnv } : process.env,
    stdio: "inherit",
    shell: false,
    windowsHide: true,
  });
  if (result.status !== 0) {
    throw new Error(
      `${command} ${args.join(" ")} failed with exit ${result.status ?? "null"}.`,
    );
  }
}

function npmCommand(): string {
  return process.platform === "win32" ? "npm.cmd" : "npm";
}

function npxCommand(): string {
  return process.platform === "win32" ? "npx.cmd" : "npx";
}

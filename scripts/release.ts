import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  devVarsPath,
  projectRoot,
  readEnvValues,
  readTargetEnvironment,
  type TargetEnvironment,
} from "./env-files.ts";
import {
  assertGeneratedWorkerConfig,
  collectWorkerSecrets,
  readGeneratedWorkerConfig,
  requiredWorkerSecrets,
  resolveMigrateEnvironment,
  resolveReleaseTargets,
  workerRelease,
  type DeployableEnvironment,
} from "./release-support.ts";

type ReleaseCommand = "deploy" | "secrets-sync" | "migrate" | "full";

const root = projectRoot();
const wranglerConfigPath = path.join(root, "apps/api/wrangler.jsonc");
const argv = process.argv.slice(2);
const command = readCommand(argv);
const dryRun = argv.includes("--dry-run");

if (command === "migrate") {
  const environment = resolveMigrateEnvironment(
    readTargetEnvironment(process.argv) ?? argv[1],
  );
  migrateEnvironment(environment);
} else {
  for (const environment of resolveReleaseTargets(
    readTargetEnvironment(process.argv) ?? (argv.includes("both") ? "both" : argv[1]),
  )) {
    if (command === "secrets-sync") {
      syncSecrets(environment);
    } else if (command === "deploy") {
      deployEnvironment(environment, { withSecrets: false });
    } else {
      if (!dryRun) {
        migrateEnvironment(environment);
      }
      deployEnvironment(environment, { withSecrets: true });
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

function deployEnvironment(
  environment: DeployableEnvironment,
  options: { withSecrets: boolean },
) {
  const release = workerRelease(environment);
  const prepared = options.withSecrets ? prepareSecrets(environment) : undefined;
  console.log(`Building ${environment} as ${release.workerName}.`);
  runCommand(npmCommand(), ["run", "build"], {
    CLOUDFLARE_ENV: release.cloudflareEnv,
  });
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
  const result = spawnSync(command, args, {
    cwd,
    env: extraEnv ? { ...process.env, ...extraEnv } : process.env,
    stdio: "inherit",
    shell: process.platform === "win32",
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

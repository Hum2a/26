import { spawnSync } from "node:child_process";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { devVarsPath, envPath, projectRoot, readEnvValues } from "./env-files.ts";

export type SetupStep = {
  name: string;
  command: string;
  args: string[];
};

export function needsLocalClientKey(
  workerKey: string | undefined,
  webKey: string | undefined,
): boolean {
  return !workerKey?.trim() || !webKey?.trim();
}

export function setupSteps(rotateLocalClientKey: boolean): SetupStep[] {
  const npm = npmCommand();
  const steps: SetupStep[] = [
    { name: "Install dependencies", command: npm, args: ["install"] },
    {
      name: "Create environment files",
      command: npm,
      args: ["run", "env:sync"],
    },
  ];

  if (rotateLocalClientKey) {
    steps.push({
      name: "Generate the local client API key",
      command: npm,
      args: ["run", "client-api-key:rotate", "--", "--env", "local"],
    });
  }

  steps.push(
    {
      name: "Copy agent instructions",
      command: npm,
      args: ["run", "agents:sync"],
    },
    {
      name: "Generate Worker types",
      command: npm,
      args: ["run", "cf-typegen"],
    },
    {
      name: "Install Playwright Chromium",
      command: npxCommand(),
      args: ["playwright", "install", "chromium"],
    },
    {
      name: "Migrate the local database",
      command: npm,
      args: ["run", "db:migrate:dev"],
    },
    {
      name: "Seed the local administrator",
      command: npm,
      args: ["run", "auth:seed", "--", "--env", "local"],
    },
  );

  return steps;
}

export function runSetup(
  steps: readonly SetupStep[],
  run: (step: SetupStep) => void = runStep,
): void {
  steps.forEach((step, index) => {
    console.log(`\n[${index + 1}/${steps.length}] ${step.name}`);
    run(step);
  });
}

function runStep(step: SetupStep): void {
  const result = spawnSync(step.command, step.args, {
    cwd: projectRoot(),
    stdio: "inherit",
    shell: process.platform === "win32",
    windowsHide: true,
  });
  if (result.status !== 0) {
    throw new Error(`${step.name} failed with exit ${result.status ?? "null"}.`);
  }
}

function npmCommand(): string {
  return process.platform === "win32" ? "npm.cmd" : "npm";
}

function npxCommand(): string {
  return process.platform === "win32" ? "npx.cmd" : "npx";
}

async function main(): Promise<number> {
  const root = projectRoot();
  const rotateLocalClientKey = needsLocalClientKey(
    readEnvValues(devVarsPath("local")).CLIENT_API_KEY,
    readEnvValues(envPath("local")).VITE_CLIENT_API_KEY,
  );

  if (rotateLocalClientKey) {
    console.log("Local client API key is missing. Setup will generate one.");
  } else {
    console.log("Local client API key is already set. Leaving it unchanged.");
  }

  try {
    runSetup(setupSteps(rotateLocalClientKey));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return 1;
  }

  console.log("\nSetup finished. Start the app with npm run dev.");
  console.log(`Project: ${root}`);
  return 0;
}

const invokedDirectly =
  Boolean(process.argv[1]) &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (invokedDirectly) {
  process.exit(await main());
}

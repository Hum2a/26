import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { projectRoot } from "./env-files.ts";
import { localRunCommand, parseWorkflowRuns } from "./github-actions-workflow.ts";

const root = projectRoot();
const dryRun = process.argv.includes("--dry-run");
const workflowDir = path.join(root, ".github", "workflows");
const files = readdirSync(workflowDir)
  .filter((file) => file.endsWith(".yml") || file.endsWith(".yaml"))
  .sort();

if (files.length === 0) {
  console.error("No GitHub workflow files in .github/workflows.");
  process.exit(1);
}

console.log(
  dryRun
    ? "Listing GitHub workflow shell steps."
    : "Running GitHub workflow shell steps. Checkout and setup actions stay on this machine.",
);

for (const file of files) {
  const relative = path.posix.join(".github", "workflows", file);
  const runs = parseWorkflowRuns(readFileSync(path.join(workflowDir, file), "utf8"));
  if (runs.length === 0) {
    console.error(`${relative} has no run steps.`);
    process.exit(1);
  }

  console.log(`\n${relative}`);
  for (const step of runs) {
    const local = localRunCommand(step.command, process.platform);
    const cwd = step.workingDirectory
      ? path.resolve(root, step.workingDirectory)
      : root;
    const title = step.name ? `${step.job} / ${step.name}` : step.job;
    console.log(`\n${title}`);
    console.log(`$ ${local.command}`);
    if (local.note) console.log(local.note);
    if (step.workingDirectory)
      console.log(`working directory: ${step.workingDirectory}`);
    if (dryRun) continue;

    const result = spawnSync(local.command, {
      cwd,
      env: process.env,
      stdio: "inherit",
      shell: true,
    });
    if (result.error) {
      console.error(result.error.message);
      process.exit(1);
    }
    if (result.status !== 0) {
      console.error(
        `\n${relative} failed at ${title} with exit ${result.status ?? "null"}.`,
      );
      process.exit(result.status ?? 1);
    }
  }
}

console.log(dryRun ? "\nDry run finished." : "\nGitHub workflow shell steps passed.");

import { spawnSync } from "node:child_process";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { projectRoot } from "./env-files.ts";

export type DropIgnoredResult = {
  removed: string[];
};

type GitResult = {
  status: number;
  stdout: string;
  stderr: string;
};

function git(root: string, args: string[]): GitResult {
  const result = spawnSync("git", args, {
    cwd: root,
    encoding: "utf8",
    windowsHide: true,
    maxBuffer: 10_000_000,
  });
  if (result.error) {
    throw result.error;
  }
  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

export function parseNulPaths(stdout: string): string[] {
  return stdout.split("\0").filter((entry) => entry.length > 0);
}

function assertRepoRelative(file: string): void {
  const parts = file.split("/");
  if (path.isAbsolute(file) || parts.includes("..") || parts.includes("")) {
    throw new Error(`Refusing to untrack a path outside the repository: ${file}`);
  }
}

/** Index paths that `.gitignore` now covers. Git does not drop them on its own. */
export function listTrackedIgnored(root: string): string[] {
  const listed = git(root, ["ls-files", "-z", "-ci", "--exclude-standard"]);
  if (listed.status !== 0) {
    throw new Error(listed.stderr.trim() || "git ls-files failed");
  }
  const paths = parseNulPaths(listed.stdout);
  for (const file of paths) {
    assertRepoRelative(file);
  }
  return paths;
}

/**
 * Remove ignored paths from the index and leave the working copies in place.
 * A second run is a no-op.
 */
export function dropTrackedIgnored(root: string): DropIgnoredResult {
  const removed = listTrackedIgnored(root);
  if (removed.length === 0) {
    return { removed };
  }

  const dropped = git(root, ["rm", "--cached", "--", ...removed]);
  if (dropped.status !== 0) {
    throw new Error(dropped.stderr.trim() || "git rm --cached failed");
  }
  return { removed };
}

async function main(): Promise<number> {
  const root = projectRoot();
  let result: DropIgnoredResult;
  try {
    result = dropTrackedIgnored(root);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return 1;
  }

  if (result.removed.length === 0) {
    console.log("No tracked ignored files.");
    return 0;
  }

  for (const file of result.removed) {
    console.log(`Untracked ${file}`);
  }
  console.log(
    `Removed ${result.removed.length} tracked ignored file${result.removed.length === 1 ? "" : "s"} from the index. Working copies were left in place.`,
  );
  return 0;
}

const invokedDirectly =
  Boolean(process.argv[1]) &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (invokedDirectly) {
  process.exit(await main());
}

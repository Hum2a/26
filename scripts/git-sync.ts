import { spawnSync } from "node:child_process";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { projectRoot } from "./env-files.ts";

export type LocalBranch = {
  name: string;
  current: boolean;
  upstream: string;
  track: string;
};

export type SyncResult = {
  removed: string[];
  kept: { name: string; reason: string }[];
};

const protectedBranches = new Set(["master", "main"]);

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

export function parseBranchRecordsFromLines(records: readonly string[]): LocalBranch[] {
  return records.map((record) => {
    const [head = "", name = "", upstream = "", track = ""] = record.split("\t");
    if (!name) {
      throw new Error(`Unreadable branch record: ${record}`);
    }
    return {
      name,
      current: head.trim() === "*",
      upstream,
      track,
    };
  });
}

export function isGoneUpstream(track: string): boolean {
  return /(?:^|\[|, )gone(?:\]|,|$)/.test(track);
}

export function selectGoneBranches(
  branches: readonly LocalBranch[],
  force: boolean,
): { remove: string[]; skip: { name: string; reason: string }[] } {
  const remove: string[] = [];
  const skip: { name: string; reason: string }[] = [];

  for (const branch of branches) {
    if (!branch.upstream || !isGoneUpstream(branch.track)) {
      continue;
    }
    if (branch.current) {
      skip.push({ name: branch.name, reason: "it is the branch you have checked out" });
      continue;
    }
    if (!force && protectedBranches.has(branch.name)) {
      skip.push({
        name: branch.name,
        reason: "master and main are kept unless you pass --force",
      });
      continue;
    }
    remove.push(branch.name);
  }

  return { remove, skip };
}

function listBranches(root: string): LocalBranch[] {
  const listed = git(root, [
    "for-each-ref",
    "--format=%(HEAD)\t%(refname:short)\t%(upstream:short)\t%(upstream:track)",
    "refs/heads",
  ]);
  if (listed.status !== 0) {
    throw new Error(listed.stderr.trim() || "git for-each-ref failed");
  }
  return parseBranchRecordsFromLines(
    listed.stdout.split(/\r?\n/).filter((line) => line.length > 0),
  );
}

export function syncDeletedBranches(root: string, force: boolean): SyncResult {
  const fetched = git(root, ["fetch", "--prune", "--all"]);
  if (fetched.status !== 0) {
    throw new Error(fetched.stderr.trim() || "git fetch --prune failed");
  }

  const selected = selectGoneBranches(listBranches(root), force);
  const removed: string[] = [];
  const kept = [...selected.skip];

  for (const name of selected.remove) {
    const deleted = git(root, ["branch", force ? "-D" : "-d", "--", name]);
    if (deleted.status === 0) {
      removed.push(name);
      continue;
    }
    const detail = (deleted.stderr || deleted.stdout).trim();
    const unmerged = detail.includes("not fully merged");
    kept.push({
      name,
      reason: unmerged
        ? "it is not fully merged. Run npm run git:sync -- --force to delete it anyway"
        : detail || "git branch failed",
    });
  }

  return { removed, kept };
}

function readForce(argv: readonly string[]): boolean {
  return argv.includes("--force");
}

async function main(): Promise<number> {
  const root = projectRoot();
  const force = readForce(process.argv.slice(2));
  let result: SyncResult;
  try {
    result = syncDeletedBranches(root, force);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return 1;
  }

  if (result.removed.length === 0) {
    console.log("No local branches were deleted.");
  } else {
    for (const name of result.removed) {
      console.log(`Deleted ${name}`);
    }
  }

  for (const branch of result.kept) {
    console.log(`Kept ${branch.name}: ${branch.reason}`);
  }

  console.log(
    result.removed.length === 0
      ? "Remote-tracking branches are pruned."
      : `Deleted ${result.removed.length} local branch${result.removed.length === 1 ? "" : "es"} whose remote branch is gone.`,
  );
  return result.kept.length > 0 ? 1 : 0;
}

const invokedDirectly =
  Boolean(process.argv[1]) &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (invokedDirectly) {
  process.exit(await main());
}

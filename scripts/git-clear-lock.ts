import { lstat, readdir, readFile, unlink } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { projectRoot } from "./env-files.ts";

export type ClearGitLockResult = {
  gitDir: string | null;
  removed: string[];
  failed: { path: string; message: string }[];
};

export async function resolveGitDir(root: string): Promise<string | null> {
  const gitPath = path.join(root, ".git");
  let stats;
  try {
    stats = await lstat(gitPath);
  } catch (error) {
    if (isNotFound(error)) {
      return null;
    }
    throw error;
  }

  if (stats.isDirectory()) {
    return gitPath;
  }

  if (!stats.isFile()) {
    return null;
  }

  const text = await readFile(gitPath, "utf8");
  const match = text.match(/^gitdir:\s*(.+)\s*$/m);
  if (!match) {
    return null;
  }

  const gitDir = match[1].trim();
  return path.isAbsolute(gitDir) ? gitDir : path.resolve(root, gitDir);
}

export async function findGitLockFiles(gitDir: string): Promise<string[]> {
  const locks: string[] = [];

  async function walk(directory: string): Promise<void> {
    let entries;
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch (error) {
      if (isNotFound(error)) {
        return;
      }
      throw error;
    }

    for (const entry of entries) {
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
        continue;
      }
      if (entry.isFile() && entry.name.endsWith(".lock")) {
        locks.push(fullPath);
      }
    }
  }

  await walk(gitDir);
  return locks.sort();
}

export async function clearGitLockFiles(root: string): Promise<ClearGitLockResult> {
  const gitDir = await resolveGitDir(root);
  if (!gitDir) {
    return { gitDir: null, removed: [], failed: [] };
  }

  const locks = await findGitLockFiles(gitDir);
  const removed: string[] = [];
  const failed: { path: string; message: string }[] = [];

  for (const lockPath of locks) {
    try {
      await unlink(lockPath);
      removed.push(lockPath);
    } catch (error) {
      failed.push({
        path: lockPath,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { gitDir, removed, failed };
}

function isNotFound(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "ENOENT");
}

function displayPath(filePath: string, root: string): string {
  return path.relative(root, filePath).split(path.sep).join("/");
}

async function main(): Promise<number> {
  const root = projectRoot();
  const result = await clearGitLockFiles(root);

  if (!result.gitDir) {
    console.error("No .git directory found.");
    return 1;
  }

  for (const lockPath of result.removed) {
    console.log(`Removed ${displayPath(lockPath, root)}`);
  }
  for (const failure of result.failed) {
    console.error(`Could not remove ${displayPath(failure.path, root)}: ${failure.message}`);
  }

  if (result.failed.length > 0) {
    return 1;
  }

  if (result.removed.length === 0) {
    console.log("No git lock files found.");
  } else {
    console.log(
      `Cleared ${result.removed.length} git lock file${result.removed.length === 1 ? "" : "s"}.`,
    );
  }

  return 0;
}

const invokedDirectly =
  Boolean(process.argv[1]) && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (invokedDirectly) {
  process.exit(await main());
}

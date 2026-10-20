import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { clearGitLockFiles, findGitLockFiles, resolveGitDir } from "./git-clear-lock.ts";

test("clears leftover git lock files and leaves other git files alone", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "git-clear-lock-"));
  const gitDir = path.join(root, ".git");

  try {
    await mkdir(path.join(gitDir, "refs", "heads"), { recursive: true });
    await mkdir(path.join(gitDir, "cursor", "crepe"), { recursive: true });
    await writeFile(path.join(gitDir, "HEAD"), "ref: refs/heads/master\n");
    await writeFile(path.join(gitDir, "index.lock"), "");
    await writeFile(path.join(gitDir, "HEAD.lock"), "");
    await writeFile(path.join(gitDir, "refs", "heads", "master.lock"), "");
    await writeFile(path.join(gitDir, "cursor", "crepe", "build.lock"), "");
    await writeFile(path.join(gitDir, "refs", "heads", "master"), "abc123\n");

    const found = await findGitLockFiles(gitDir);
    assert.equal(found.length, 4);
    assert.equal(await resolveGitDir(root), gitDir);

    const result = await clearGitLockFiles(root);
    assert.deepEqual(result.failed, []);
    assert.equal(result.removed.length, 4);
    assert.deepEqual(await findGitLockFiles(gitDir), []);

    const leftover = await clearGitLockFiles(root);
    assert.deepEqual(leftover.removed, []);
    assert.deepEqual(leftover.failed, []);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("follows a gitdir file used by linked worktrees", async () => {
  const parent = await mkdtemp(path.join(os.tmpdir(), "git-clear-lock-worktree-"));
  const worktree = path.join(parent, "worktree");
  const gitDir = path.join(parent, "actual-git");

  try {
    await mkdir(worktree);
    await mkdir(gitDir);
    await writeFile(path.join(worktree, ".git"), `gitdir: ${gitDir}\n`);
    await writeFile(path.join(gitDir, "index.lock"), "");

    const result = await clearGitLockFiles(worktree);
    assert.equal(result.gitDir, gitDir);
    assert.deepEqual(result.removed, [path.join(gitDir, "index.lock")]);
  } finally {
    await rm(parent, { recursive: true, force: true });
  }
});

test("reports a missing git directory without throwing", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "git-clear-lock-missing-"));
  try {
    const result = await clearGitLockFiles(root);
    assert.deepEqual(result, { gitDir: null, removed: [], failed: [] });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

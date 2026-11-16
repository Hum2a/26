import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import {
  isGoneUpstream,
  parseBranchRecordsFromLines,
  selectGoneBranches,
  syncDeletedBranches,
  type LocalBranch,
} from "./git-sync.ts";

function git(root: string, args: string[]): void {
  const result = spawnSync(
    "git",
    ["-c", "user.email=dev@example.com", "-c", "user.name=Dev", ...args],
    {
      cwd: root,
      encoding: "utf8",
      windowsHide: true,
    },
  );
  assert.equal(
    result.status,
    0,
    `${args.join(" ")}\n${result.stderr || result.stdout}`,
  );
}

function branchNames(root: string): string[] {
  const result = spawnSync(
    "git",
    ["for-each-ref", "--format=%(refname:short)", "refs/heads"],
    {
      cwd: root,
      encoding: "utf8",
      windowsHide: true,
    },
  );
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.split(/\r?\n/).filter((name) => name.length > 0);
}

test("gone upstreams are selected and local-only branches are left alone", () => {
  const branches: LocalBranch[] = parseBranchRecordsFromLines([
    [" ", "topic", "origin/topic", "[gone]"].join("\t"),
    ["*", "master", "origin/master", ""].join("\t"),
    [" ", "wip", "", ""].join("\t"),
    [" ", "review", "origin/review", "[ahead 1]"].join("\t"),
    ["*", "old", "origin/old", "[gone]"].join("\t"),
    [" ", "main", "origin/main", "[gone]"].join("\t"),
  ]);

  assert.equal(isGoneUpstream("[gone]"), true);
  assert.equal(isGoneUpstream("[ahead 1, gone]"), true);
  assert.equal(isGoneUpstream("[ahead 1]"), false);

  const selected = selectGoneBranches(branches, false);
  assert.deepEqual(selected.remove, ["topic"]);
  assert.deepEqual(
    selected.skip.map((branch) => branch.name),
    ["old", "main"],
  );

  const forced = selectGoneBranches(branches, true);
  assert.deepEqual(forced.remove, ["topic", "main"]);
  assert.deepEqual(
    forced.skip.map((branch) => branch.name),
    ["old"],
  );
});

test("sync deletes a merged branch whose remote is gone and keeps unmerged work", async () => {
  const parent = await mkdtemp(path.join(os.tmpdir(), "git-sync-"));
  const remote = path.join(parent, "remote.git");
  const work = path.join(parent, "work");

  try {
    await mkdir(remote);
    git(remote, ["init", "--bare", "-b", "master"]);
    git(parent, ["clone", remote, "work"]);
    await writeFile(path.join(work, "readme.txt"), "hello\n");
    git(work, ["add", "readme.txt"]);
    git(work, ["commit", "-m", "initial"]);
    git(work, ["push", "-u", "origin", "master"]);

    git(work, ["checkout", "-b", "merged-topic"]);
    await writeFile(path.join(work, "merged.txt"), "merged\n");
    git(work, ["add", "merged.txt"]);
    git(work, ["commit", "-m", "merged topic"]);
    git(work, ["push", "-u", "origin", "merged-topic"]);
    git(work, ["checkout", "master"]);
    git(work, ["merge", "--no-edit", "merged-topic"]);
    git(work, ["push", "origin", "master"]);
    git(work, ["push", "origin", "--delete", "merged-topic"]);

    git(work, ["checkout", "-b", "open-topic"]);
    await writeFile(path.join(work, "open.txt"), "open\n");
    git(work, ["add", "open.txt"]);
    git(work, ["commit", "-m", "open topic"]);
    git(work, ["push", "-u", "origin", "open-topic"]);
    git(work, ["checkout", "master"]);
    git(work, ["push", "origin", "--delete", "open-topic"]);

    git(work, ["checkout", "-b", "local-only"]);
    git(work, ["checkout", "master"]);

    const first = syncDeletedBranches(work, false);
    assert.deepEqual(first.removed, ["merged-topic"]);
    assert.equal(
      first.kept.some((branch) => branch.name === "open-topic"),
      true,
    );
    assert.deepEqual(branchNames(work).sort(), ["local-only", "master", "open-topic"]);

    const second = syncDeletedBranches(work, true);
    assert.deepEqual(second.removed, ["open-topic"]);
    assert.deepEqual(branchNames(work).sort(), ["local-only", "master"]);
  } finally {
    await rm(parent, { recursive: true, force: true });
  }
});

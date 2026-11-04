import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { dropTrackedIgnored, parseNulPaths } from "./git-drop-ignored.ts";

function git(root: string, args: string[]): void {
  const result = spawnSync("git", args, {
    cwd: root,
    encoding: "utf8",
    windowsHide: true,
  });
  assert.equal(result.status, 0, result.stderr || result.error?.message);
}

test("parseNulPaths keeps empty records out", () => {
  assert.deepEqual(parseNulPaths("a\0b\0"), ["a", "b"]);
  assert.deepEqual(parseNulPaths(""), []);
});

test("drops a tracked ignored file from the index and leaves it on disk", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "git-drop-ignored-"));
  const cached = path.join(root, "artifacts", "browser", ".last-run.json");

  try {
    git(root, ["init"]);
    await writeFile(path.join(root, ".gitignore"), "artifacts/\n");
    await writeFile(path.join(root, "keep.txt"), "keep\n");
    await mkdir(path.dirname(cached), { recursive: true });
    await writeFile(cached, "{}\n");
    git(root, ["add", "keep.txt", ".gitignore"]);
    git(root, ["add", "-f", "artifacts/browser/.last-run.json"]);

    const first = dropTrackedIgnored(root);
    assert.deepEqual(first.removed, ["artifacts/browser/.last-run.json"]);
    assert.equal(await readFile(cached, "utf8"), "{}\n");

    const listed = spawnSync("git", ["ls-files", "-z"], {
      cwd: root,
      encoding: "utf8",
      windowsHide: true,
    });
    assert.equal(listed.status, 0);
    assert.deepEqual(parseNulPaths(listed.stdout).sort(), [".gitignore", "keep.txt"]);

    const second = dropTrackedIgnored(root);
    assert.deepEqual(second.removed, []);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { gzipSync } from "node:zlib";
import { test } from "node:test";
import {
  checkSummary,
  classifyAsset,
  gzipSize,
  measureDist,
  referencedAssets,
  summarise,
} from "./check-bundle-budget.mjs";

test("gzip size and HTML asset refs", () => {
  const body = Buffer.from("hello party", "utf8");
  assert.equal(gzipSize(body), gzipSync(body).length);
  assert.deepEqual(
    referencedAssets(
      `<script src="/assets/index-abc.js"></script><link href="/assets/index-abc.css" rel="stylesheet" />`,
    ),
    ["/assets/index-abc.js", "/assets/index-abc.css"],
  );
  assert.equal(classifyAsset("x.js"), "js");
  assert.equal(classifyAsset("x.css"), "css");
});

test("entry vs lazy chunks and budget failures", () => {
  const files = [
    { webPath: "assets/index.js", kind: "js", bytes: 100, gzipBytes: 40 },
    { webPath: "assets/kart.js", kind: "js", bytes: 800, gzipBytes: 200 },
    { webPath: "assets/index.css", kind: "css", bytes: 50, gzipBytes: 20 },
  ];
  const html = `<script type="module" src="/assets/index.js"></script><link rel="stylesheet" href="/assets/index.css" />`;
  const summary = summarise(files, html);
  assert.equal(summary.entryJsGzipBytes, 40);
  assert.equal(summary.entryCssGzipBytes, 20);
  assert.equal(summary.totalJsGzipBytes, 240);
  assert.equal(summary.largestJsGzipBytes, 200);
  assert.equal(summary.largestJsPath, "assets/kart.js");
  assert.deepEqual(
    checkSummary(summary, {
      entryJsGzipBytes: 40,
      entryCssGzipBytes: 20,
      totalJsGzipBytes: 240,
      anyJsGzipBytes: 200,
    }),
    [],
  );
  assert.equal(
    checkSummary(summary, {
      entryJsGzipBytes: 10,
      entryCssGzipBytes: 20,
      totalJsGzipBytes: 240,
      anyJsGzipBytes: 200,
    }).length,
    1,
  );
});

test("measureDist reads a fake Vite output folder", async () => {
  const fixtureRoot = await mkdtemp(path.join(os.tmpdir(), "26-bundle-budget-"));
  try {
    await mkdir(path.join(fixtureRoot, "assets"));
    const js = "export const play = true;";
    const css = "body{margin:0}";
    await writeFile(path.join(fixtureRoot, "assets", "index.js"), js);
    await writeFile(path.join(fixtureRoot, "assets", "index.css"), css);
    await writeFile(
      path.join(fixtureRoot, "index.html"),
      `<!doctype html><script type="module" src="/assets/index.js"></script><link rel="stylesheet" href="/assets/index.css" />`,
    );
    const measured = await measureDist(fixtureRoot);
    assert.equal(measured.summary.entryJsGzipBytes, gzipSize(Buffer.from(js)));
    assert.equal(measured.summary.entryCssGzipBytes, gzipSize(Buffer.from(css)));
  } finally {
    await rm(fixtureRoot, { recursive: true, force: true });
  }
});

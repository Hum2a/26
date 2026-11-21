import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import {
  analyseLines,
  buildJsonPayload,
  buildMarkdownReport,
  classifyArea,
  classifyFeature,
  classifyFile,
  classifyRole,
  collectStats,
  computeSizeDistribution,
  groupStats,
  parseArgs,
  pathAtDepth,
} from "./loc.ts";

test("analyseLines handles empty content and single trailing newline cleanly", () => {
  assert.deepEqual(analyseLines("", ".ts"), {
    code: 0,
    comment: 0,
    blank: 0,
    total: 0,
    bytes: 0,
  });

  assert.deepEqual(analyseLines("const a = 1;\nconst b = 2;\n", ".ts"), {
    code: 2,
    comment: 0,
    blank: 0,
    total: 2,
    bytes: 26,
  });
});

test("analyseLines preserves code + comment + blank === total across languages", () => {
  const tsSource = [
    "// header comment",
    "",
    'const url = "https://example.com"; // inline',
    "const x = 1; /* starts block",
    "inside block",
    "ends block */ const y = 2;",
    "/* standalone */ /* two blocks */",
    "const z = `template /* not a comment */`;",
    "",
    "",
  ].join("\n");

  const ts = analyseLines(tsSource, ".ts");
  assert.equal(ts.code + ts.comment + ts.blank, ts.total);
  assert.equal(ts.total, 9);
  assert.equal(ts.blank, 2);
  assert.equal(ts.comment, 3);
  assert.equal(ts.code, 4);

  const mdSource = [
    "# Title heading",
    "",
    "Body paragraph.",
    "<!-- hidden note",
    "still hidden -->",
    "",
  ].join("\n");
  const md = analyseLines(mdSource, ".md");
  assert.equal(md.code + md.comment + md.blank, md.total);
  assert.equal(md.code, 2);
  assert.equal(md.comment, 2);
  assert.equal(md.blank, 1);

  const sqlSource = [
    "-- migration",
    "",
    "CREATE TABLE rooms (id TEXT);",
    "/* block */",
    "",
  ].join("\n");
  const sql = analyseLines(sqlSource, ".sql");
  assert.equal(sql.code + sql.comment + sql.blank, sql.total);
  assert.equal(sql.code, 1);
  assert.equal(sql.comment, 2);
  assert.equal(sql.blank, 1);

  const ymlSource = [
    "# workflow",
    "",
    "name: Check",
    "  # indented comment",
    "",
  ].join("\n");
  const yml = analyseLines(ymlSource, ".yml");
  assert.equal(yml.code + yml.comment + yml.blank, yml.total);
  assert.equal(yml.code, 1);
  assert.equal(yml.comment, 2);
  assert.equal(yml.blank, 1);
});

test("classifyRole, classifyArea, and classifyFeature separate app, content, tests, data, config, docs", () => {
  assert.equal(classifyRole("apps/web/src/kart/KartCanvas.tsx", ".tsx"), "app");
  assert.equal(classifyRole("apps/web/src/kart/kart.test.tsx", ".tsx"), "test");
  assert.equal(
    classifyRole("apps/web/src/admin/controls.test-support.tsx", ".tsx"),
    "test",
  );
  assert.equal(classifyRole("apps/api/test/room.spec.ts", ".ts"), "test");
  assert.equal(
    classifyRole("apps/api/src/questions/packs/birthday/best-dressed.ts", ".ts"),
    "content",
  );
  assert.equal(
    classifyRole("apps/api/src/questions/wordle/dictionary/validity-words.ts", ".ts"),
    "data",
  );
  assert.equal(
    classifyRole("packages/shared/src/kart/kart-circuit.json", ".json"),
    "data",
  );
  assert.equal(classifyRole("scripts/loc.ts", ".ts"), "tooling");
  assert.equal(classifyRole("scripts/loc.test.ts", ".ts"), "test");
  assert.equal(classifyRole("eslint.config.js", ".js"), "config");
  assert.equal(classifyRole("docs/night-of.md", ".md"), "docs");

  assert.equal(
    classifyArea("apps/web/src/play/designs/whos-that-pokemon.tsx"),
    "apps/web/src/play/designs",
  );
  assert.equal(
    classifyArea("apps/api/src/room/kart/kart-lobby.ts"),
    "apps/api/src/room/kart",
  );
  assert.equal(
    classifyArea("apps/api/src/questions/packs/birthday/manifest.ts"),
    "apps/api/src/questions/packs/birthday",
  );
  assert.equal(
    classifyArea("packages/shared/src/trends/trend-engine.ts"),
    "packages/shared/src/trends",
  );

  assert.equal(classifyFeature("apps/web/src/kart/KartCanvas.tsx", "app"), "kart");
  assert.equal(classifyFeature("apps/api/src/room/kart/kart-lobby.ts", "app"), "kart");
  assert.equal(
    classifyFeature("apps/api/src/questions/packs/birthday/kart-sprint.ts", "content"),
    "question packs",
  );
  assert.equal(
    classifyFeature("apps/api/src/room/admin-question.ts", "app"),
    "admin console",
  );
  assert.equal(classifyFile(".env.local"), null);
  assert.equal(classifyFile("apps/api/.dev.vars"), null);
  assert.equal(classifyFile("package-lock.json"), null);
});

test("parseArgs supports flags, comma-separated roles, and positional area filter", () => {
  const parsed = parseArgs([
    "--area",
    "kart",
    "--kind",
    "app,test",
    "--depth=4",
    "--top",
    "25",
    "--files",
    "--all",
    "--json",
    "--report",
  ]);
  assert.equal(parsed.area, "kart");
  assert.deepEqual([...(parsed.roles ?? [])].sort(), ["app", "test"]);
  assert.equal(parsed.depth, 4);
  assert.equal(parsed.top, 25);
  assert.equal(parsed.files, true);
  assert.equal(parsed.all, true);
  assert.equal(parsed.json, true);
  assert.equal(parsed.report, true);

  const positional = parseArgs(["admin"]);
  assert.equal(positional.area, "admin");
});

test("collectStats, pathAtDepth, groupStats, size distribution, and report generation work on fixture tree", async () => {
  const fixtureRoot = await mkdtemp(path.join(os.tmpdir(), "26-loc-"));
  try {
    await mkdir(path.join(fixtureRoot, "apps/web/src/kart"), { recursive: true });
    await mkdir(path.join(fixtureRoot, "apps/api/src/questions/packs/birthday"), {
      recursive: true,
    });
    await mkdir(path.join(fixtureRoot, "apps/api/test"), { recursive: true });
    await mkdir(path.join(fixtureRoot, "node_modules/pkg"), { recursive: true });
    await mkdir(path.join(fixtureRoot, "docs"), { recursive: true });

    await writeFile(
      path.join(fixtureRoot, "apps/web/src/kart/KartCanvas.tsx"),
      "export function KartCanvas() {\n  return null;\n}\n",
    );
    await writeFile(
      path.join(fixtureRoot, "apps/web/src/kart/kart.test.tsx"),
      "// test\nexpect(1).toBe(1);\n",
    );
    await writeFile(
      path.join(fixtureRoot, "apps/api/src/questions/packs/birthday/q1.ts"),
      "export const q1 = { id: 'q1' };\n",
    );
    await writeFile(
      path.join(fixtureRoot, "apps/api/test/room.spec.ts"),
      "it('works', () => {});\n",
    );
    await writeFile(path.join(fixtureRoot, "docs/guide.md"), "# Guide\n\nHello.\n");
    await writeFile(path.join(fixtureRoot, ".env.local"), "SECRET=skipme\n");
    await writeFile(
      path.join(fixtureRoot, "node_modules/pkg/index.js"),
      "module.exports = 1;\n",
    );

    const stats = await collectStats(fixtureRoot);
    assert.equal(stats.length, 5);
    assert.equal(
      stats.some((entry) => entry.relativePath.includes("node_modules")),
      false,
    );
    assert.equal(
      stats.some((entry) => entry.relativePath.includes(".env")),
      false,
    );

    assert.equal(
      pathAtDepth("apps/web/src/kart/KartCanvas.tsx", 4),
      "apps/web/src/kart",
    );

    const byFeature = groupStats(stats, (entry) => entry.feature);
    const kartRow = byFeature.find((row) => row.label === "kart");
    assert.ok(kartRow);
    assert.equal(kartRow.roles.app, 3);
    assert.equal(kartRow.roles.test, 1);

    const dist = computeSizeDistribution(stats.filter((e) => e.role === "app"));
    assert.equal(dist.avg, 3);
    assert.equal(dist.median, 3);
    assert.equal(dist.max, 3);

    const payload = buildJsonPayload(stats);
    assert.equal(payload.totals.handwritten.files, 4);
    assert.equal(payload.totals.handwritten.code, 6);

    const report = buildMarkdownReport(stats);
    assert.ok(report.includes("## Cross-stack features (handwritten code)"));
    assert.ok(report.includes("## Granular areas (handwritten code)"));
    assert.ok(report.includes("`apps/web/src/kart/KartCanvas.tsx`"));
  } finally {
    await rm(fixtureRoot, { recursive: true, force: true });
  }
});

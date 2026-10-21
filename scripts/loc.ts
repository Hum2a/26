import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const reportPath = path.join(root, "docs/loc-report.md");

const sourceExtensions = new Set([".ts", ".tsx", ".mjs", ".css", ".sql"]);
const docExtensions = new Set([".md"]);

const excludedDirectories = new Set([
  "node_modules",
  "dist",
  ".wrangler",
  ".data",
  ".vite",
  "coverage",
  "playwright-report",
  "test-results",
  "blob-report",
]);

const excludedFiles = new Set([
  path.join(root, "apps/api/worker-configuration.d.ts"),
  path.join(root, "apps/api/src/auth/migrations/better-auth.sql"),
]);

type LineCounts = {
  files: number;
  code: number;
  comment: number;
  blank: number;
  total: number;
};

type FileStat = {
  relativePath: string;
  area: string;
  extension: string;
  kind: "source" | "docs";
  counts: Omit<LineCounts, "files">;
};

const emptyCounts = (): LineCounts => ({
  files: 0,
  code: 0,
  comment: 0,
  blank: 0,
  total: 0,
});

function addCounts(
  target: LineCounts,
  next: Omit<LineCounts, "files">,
  files = 1,
): void {
  target.files += files;
  target.code += next.code;
  target.comment += next.comment;
  target.blank += next.blank;
  target.total += next.total;
}

function classifyArea(relativePath: string): string {
  const normalised = relativePath.split(path.sep).join("/");
  if (normalised.startsWith("apps/api/src/")) {
    const remainder = normalised.slice("apps/api/src/".length);
    if (!remainder.includes("/")) {
      return "apps/api/src";
    }
    return `apps/api/src/${remainder.split("/")[0]}`;
  }
  if (normalised.startsWith("apps/api/test/")) {
    return "apps/api/test";
  }
  if (normalised.startsWith("apps/web/src/")) {
    const remainder = normalised.slice("apps/web/src/".length);
    if (!remainder.includes("/")) {
      return "apps/web/src";
    }
    return `apps/web/src/${remainder.split("/")[0]}`;
  }
  if (normalised.startsWith("apps/web/e2e/")) {
    return "apps/web/e2e";
  }
  if (normalised.startsWith("packages/shared/")) {
    return "packages/shared";
  }
  if (normalised.startsWith("scripts/")) {
    return "scripts";
  }
  if (normalised.startsWith("docs/")) {
    return "docs";
  }
  if (normalised === "README.md" || normalised === "AGENTS.md") {
    return "root docs";
  }
  return path.dirname(normalised) || ".";
}

async function walk(directory: string, files: string[] = []): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (excludedDirectories.has(entry.name)) {
        continue;
      }
      await walk(fullPath, files);
      continue;
    }
    if (!entry.isFile() || excludedFiles.has(fullPath)) {
      continue;
    }
    files.push(fullPath);
  }
  return files;
}

function analyseLines(content: string): Omit<LineCounts, "files"> {
  const lines = content.split(/\r?\n/);
  let code = 0;
  let comment = 0;
  let blank = 0;
  let inBlockComment = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      blank++;
      continue;
    }

    let rest = trimmed;
    if (inBlockComment) {
      comment++;
      const end = rest.indexOf("*/");
      if (end === -1) {
        continue;
      }
      inBlockComment = false;
      rest = rest.slice(end + 2).trim();
      if (!rest) {
        continue;
      }
    }

    while (rest.startsWith("/*")) {
      const end = rest.indexOf("*/");
      if (end === -1) {
        inBlockComment = true;
        comment++;
        break;
      }
      rest = rest.slice(end + 2).trim();
      if (!rest) {
        comment++;
        break;
      }
    }
    if (inBlockComment) {
      continue;
    }

    if (
      rest.startsWith("//") ||
      rest.startsWith("#") ||
      rest.startsWith("--") ||
      (rest.startsWith("*") && !rest.startsWith("*/"))
    ) {
      comment++;
      continue;
    }

    const codePart = stripInlineComment(rest);
    if (!codePart.trim()) {
      comment++;
      continue;
    }
    code++;
  }

  return {
    code,
    comment,
    blank,
    total: lines.length,
  };
}

function stripInlineComment(line: string): string {
  let inString: "'" | '"' | "`" | null = null;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const previous = line[index - 1];
    if (inString) {
      if (char === inString && previous !== "\\") {
        inString = null;
      }
      continue;
    }
    if (char === "'" || char === '"' || char === "`") {
      inString = char;
      continue;
    }
    if (char === "/" && line[index + 1] === "/") {
      return line.slice(0, index);
    }
  }
  return line;
}

async function collectStats(): Promise<FileStat[]> {
  const scanRoots = [
    path.join(root, "apps"),
    path.join(root, "packages"),
    path.join(root, "scripts"),
    path.join(root, "docs"),
    path.join(root, "README.md"),
    path.join(root, "AGENTS.md"),
  ];

  const stats: FileStat[] = [];
  for (const scanRoot of scanRoots) {
    let files: string[];
    try {
      const resolved = path.resolve(scanRoot);
      const extension = path.extname(resolved);
      files =
        extension && !excludedFiles.has(resolved) ? [resolved] : await walk(resolved);
    } catch {
      continue;
    }

    for (const filePath of files) {
      const extension = path.extname(filePath).toLowerCase();
      const kind = sourceExtensions.has(extension)
        ? "source"
        : docExtensions.has(extension)
          ? "docs"
          : null;
      if (!kind) {
        continue;
      }
      const relativePath = path.relative(root, filePath);
      const content = await readFile(filePath, "utf8");
      stats.push({
        relativePath,
        area: classifyArea(relativePath),
        extension,
        kind,
        counts: analyseLines(content),
      });
    }
  }

  return stats.sort((left, right) =>
    left.relativePath.localeCompare(right.relativePath),
  );
}

function summariseByArea(
  stats: FileStat[],
  kind: "source" | "docs",
): Map<string, LineCounts> {
  const areas = new Map<string, LineCounts>();
  for (const stat of stats.filter((entry) => entry.kind === kind)) {
    const current = areas.get(stat.area) ?? emptyCounts();
    addCounts(current, stat.counts);
    areas.set(stat.area, current);
  }
  return areas;
}

function summariseByExtension(
  stats: FileStat[],
  kind: "source" | "docs",
): Map<string, LineCounts> {
  const extensions = new Map<string, LineCounts>();
  for (const stat of stats.filter((entry) => entry.kind === kind)) {
    const current = extensions.get(stat.extension) ?? emptyCounts();
    addCounts(current, stat.counts);
    extensions.set(stat.extension, current);
  }
  return extensions;
}

function totalCounts(stats: FileStat[], kind?: "source" | "docs"): LineCounts {
  const total = emptyCounts();
  for (const stat of stats) {
    if (kind && stat.kind !== kind) {
      continue;
    }
    addCounts(total, stat.counts);
  }
  return total;
}

function formatNumber(value: number): string {
  return value.toLocaleString("en-GB");
}

function pad(value: string, width: number): string {
  return value.length >= width ? value : `${value}${" ".repeat(width - value.length)}`;
}

function renderTable(rows: Array<{ label: string; counts: LineCounts }>): string {
  const header = [
    pad("Area", 24),
    pad("Files", 7),
    pad("Code", 8),
    pad("Comment", 9),
    pad("Blank", 8),
    pad("Total", 8),
  ].join(" ");
  const lines = [header, "-".repeat(header.length)];
  for (const row of rows) {
    lines.push(
      [
        pad(row.label, 24),
        pad(formatNumber(row.counts.files), 7),
        pad(formatNumber(row.counts.code), 8),
        pad(formatNumber(row.counts.comment), 9),
        pad(formatNumber(row.counts.blank), 8),
        pad(formatNumber(row.counts.total), 8),
      ].join(" "),
    );
  }
  return lines.join("\n");
}

function renderMarkdownTable(
  rows: Array<{ label: string; counts: LineCounts }>,
): string {
  const lines = [
    "| Area | Files | Code | Comment | Blank | Total |",
    "| --- | ---: | ---: | ---: | ---: | ---: |",
  ];
  for (const row of rows) {
    lines.push(
      `| ${row.label} | ${formatNumber(row.counts.files)} | ${formatNumber(row.counts.code)} | ${formatNumber(row.counts.comment)} | ${formatNumber(row.counts.blank)} | ${formatNumber(row.counts.total)} |`,
    );
  }
  return lines.join("\n");
}

function areaRows(
  areas: Map<string, LineCounts>,
): Array<{ label: string; counts: LineCounts }> {
  return [...areas.entries()]
    .sort(
      (left, right) => right[1].code - left[1].code || left[0].localeCompare(right[0]),
    )
    .map(([label, counts]) => ({ label, counts }));
}

function printSummary(stats: FileStat[]): void {
  const sourceAreas = summariseByArea(stats, "source");
  const sourceTotal = totalCounts(stats, "source");
  const rows = areaRows(sourceAreas);
  rows.push({ label: "TOTAL", counts: sourceTotal });

  console.log("26.humza.website source lines");
  console.log(renderTable(rows));
  console.log("");
  console.log(
    `Docs: ${formatNumber(totalCounts(stats, "docs").files)} files, ${formatNumber(totalCounts(stats, "docs").code)} content lines.`,
  );
  console.log("Run npm run loc:report for the full markdown breakdown.");
}

async function writeReport(stats: FileStat[]): Promise<void> {
  const generatedAt = new Date().toISOString();
  const sourceAreas = areaRows(summariseByArea(stats, "source"));
  const docAreas = areaRows(summariseByArea(stats, "docs"));
  const sourceExtensions = areaRows(summariseByExtension(stats, "source"));
  const largestFiles = [...stats]
    .filter((entry) => entry.kind === "source")
    .sort((left, right) => right.counts.code - left.counts.code)
    .slice(0, 20)
    .map((entry) => ({
      label: entry.relativePath.split(path.sep).join("/"),
      counts: {
        files: 1,
        ...entry.counts,
      },
    }));

  const sourceTotal = totalCounts(stats, "source");
  const docsTotal = totalCounts(stats, "docs");

  const markdown = [
    "# Lines of code report",
    "",
    `Generated: ${generatedAt}`,
    "",
    "Counts exclude `node_modules`, build output, generated Wrangler types, and generated Better Auth SQL.",
    "",
    "## Source summary",
    "",
    renderMarkdownTable([...sourceAreas, { label: "TOTAL", counts: sourceTotal }]),
    "",
    "## Source by extension",
    "",
    renderMarkdownTable(sourceExtensions),
    "",
    "## Documentation",
    "",
    renderMarkdownTable([...docAreas, { label: "TOTAL", counts: docsTotal }]),
    "",
    "## Largest source files",
    "",
    renderMarkdownTable(largestFiles),
    "",
  ].join("\n");

  await writeFile(reportPath, markdown, "utf8");
  console.log(`Wrote ${path.relative(root, reportPath)}`);
  printSummary(stats);
}

const stats = await collectStats();
if (process.argv.includes("--report")) {
  await writeReport(stats);
} else {
  printSummary(stats);
}

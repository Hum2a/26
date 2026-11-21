import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const defaultRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const reportRelativePath = "docs/loc-report.md";

export type Role = "app" | "content" | "test" | "tooling" | "config" | "data" | "docs";

export type LineCounts = {
  files: number;
  code: number;
  comment: number;
  blank: number;
  total: number;
  bytes: number;
};

export type RoleBreakdown = {
  app: number;
  content: number;
  test: number;
  tooling: number;
  config: number;
  data: number;
  docs: number;
};

export type FileStat = {
  relativePath: string;
  workspace: string;
  area: string;
  feature: string;
  extension: string;
  role: Role;
  counts: Omit<LineCounts, "files">;
};

export type CliOptions = {
  report: boolean;
  json: boolean;
  files: boolean;
  all: boolean;
  help: boolean;
  area: string | null;
  roles: Set<Role> | null;
  depth: number | null;
  top: number | null;
};

type CommentStyle = "c" | "css" | "sql" | "hash" | "html" | "none";

const countedExtensions = new Map<string, CommentStyle>([
  [".ts", "c"],
  [".tsx", "c"],
  [".js", "c"],
  [".jsx", "c"],
  [".mjs", "c"],
  [".cjs", "c"],
  [".jsonc", "c"],
  [".css", "css"],
  [".sql", "sql"],
  [".sh", "hash"],
  [".yml", "hash"],
  [".yaml", "hash"],
  [".html", "html"],
  [".md", "html"],
  [".json", "none"],
  [".geojson", "none"],
]);

const excludedDirNames = new Set([
  "node_modules",
  "dist",
  ".git",
  ".wrangler",
  ".mf",
  ".vite",
  ".data",
  "coverage",
  "playwright-report",
  "test-results",
  "blob-report",
  "artifacts",
  ".cursor",
  ".claude",
  ".codex",
]);

const excludedDirPrefixes = [
  ".agents/skills",
  ".github/skills",
  "apps/web/public/kart-engine",
  "apps/web/public/chess-engine",
  "apps/kart-solo/public/draco",
  "brag-output",
];

const excludedExactFiles = new Set([
  "package-lock.json",
  "skills-lock.json",
  "docs/loc-report.md",
  "scripts/env-files.d.ts",
  "scripts/env-files.d.ts.map",
  "credentials.json",
  "secrets.json",
]);

const dataExactFiles = new Set([
  "apps/api/worker-configuration.d.ts",
  "apps/api/src/auth/migrations/better-auth.sql",
  "apps/api/src/questions/wordle/dictionary/validity-words.ts",
  "packages/shared/src/kart/kart-circuit.json",
  "packages/shared/src/kart/kart-assets.json",
  "apps/kart-solo/src/track/colliders.json",
  "apps/web/public/assets/maps/world.geojson",
]);

const handwrittenRoles = new Set<Role>(["app", "content", "test", "tooling"]);

const roleLabels: Record<Role, string> = {
  app: "App (Production)",
  content: "Content (Question Packs)",
  test: "Tests & E2E",
  tooling: "Tooling & Scripts",
  config: "Config & CI",
  data: "Generated & Data",
  docs: "Documentation",
};

const roleOrder: Role[] = [
  "app",
  "content",
  "test",
  "tooling",
  "config",
  "data",
  "docs",
];

export const emptyCounts = (): LineCounts => ({
  files: 0,
  code: 0,
  comment: 0,
  blank: 0,
  total: 0,
  bytes: 0,
});

export function addCounts(
  target: LineCounts,
  next: Omit<LineCounts, "files">,
  files = 1,
): void {
  target.files += files;
  target.code += next.code;
  target.comment += next.comment;
  target.blank += next.blank;
  target.total += next.total;
  target.bytes += next.bytes;
}

function commentStyleFor(extension: string): CommentStyle {
  return countedExtensions.get(extension.toLowerCase()) ?? "none";
}

function isQuote(char: string, style: CommentStyle): char is "'" | '"' | "`" {
  if (char === "'") return true;
  if (char === '"') return style !== "sql";
  if (char === "`") return style === "c";
  return false;
}

export function analyseLines(
  content: string,
  extension = ".ts",
): Omit<LineCounts, "files"> {
  const bytes = Buffer.byteLength(content, "utf8");
  if (content.length === 0) {
    return { code: 0, comment: 0, blank: 0, total: 0, bytes };
  }

  const normalized = content.endsWith("\r\n")
    ? content.slice(0, -2)
    : content.endsWith("\n")
      ? content.slice(0, -1)
      : content;

  const lines = normalized.split(/\r?\n/);
  const style = commentStyleFor(extension);

  let code = 0;
  let comment = 0;
  let blank = 0;
  let inBlockComment = false;

  for (const line of lines) {
    if (line.trim().length === 0) {
      blank += 1;
      continue;
    }

    if (style === "none") {
      code += 1;
      continue;
    }

    let hasCode = false;
    let hasComment = false;
    let inString: "'" | '"' | "`" | null = null;
    let index = 0;

    while (index < line.length) {
      const char = line[index];
      const next = line[index + 1];

      if (inBlockComment) {
        hasComment = true;
        if (style === "html") {
          if (line.startsWith("-->", index)) {
            inBlockComment = false;
            index += 3;
            continue;
          }
        } else if (char === "*" && next === "/") {
          inBlockComment = false;
          index += 2;
          continue;
        }
        index += 1;
        continue;
      }

      if (inString) {
        hasCode = true;
        if (char === "\\" && style !== "sql") {
          index += 2;
          continue;
        }
        if (char === inString) {
          inString = null;
        }
        index += 1;
        continue;
      }

      if (char === " " || char === "\t") {
        index += 1;
        continue;
      }

      if (style === "html" && line.startsWith("<!--", index)) {
        hasComment = true;
        inBlockComment = true;
        index += 4;
        continue;
      }

      if (
        (style === "c" || style === "css" || style === "sql") &&
        char === "/" &&
        next === "*"
      ) {
        hasComment = true;
        inBlockComment = true;
        index += 2;
        continue;
      }

      if (style === "c" && char === "/" && next === "/") {
        hasComment = true;
        break;
      }

      if (style === "sql" && char === "-" && next === "-") {
        hasComment = true;
        break;
      }

      if (style === "hash" && char === "#") {
        hasComment = true;
        break;
      }

      if (isQuote(char, style)) {
        inString = char;
        hasCode = true;
        index += 1;
        continue;
      }

      hasCode = true;
      index += 1;
    }

    if (hasCode) {
      code += 1;
    } else if (hasComment || inBlockComment) {
      comment += 1;
    } else {
      blank += 1;
    }
  }

  return {
    code,
    comment,
    blank,
    total: lines.length,
    bytes,
  };
}

function toPosix(relativePath: string): string {
  return relativePath.split(path.sep).join("/");
}

function isSecretOrExcludedFile(posixPath: string): boolean {
  if (excludedExactFiles.has(posixPath)) {
    return true;
  }
  const base = path.posix.basename(posixPath);
  if (
    base.startsWith(".env") ||
    base.startsWith(".dev.vars") ||
    base.endsWith(".pem") ||
    base.endsWith(".key")
  ) {
    return true;
  }
  return false;
}

export function classifyWorkspace(posixPath: string): string {
  if (posixPath.startsWith("apps/web/")) return "apps/web";
  if (posixPath.startsWith("apps/api/")) return "apps/api";
  if (posixPath.startsWith("apps/kart-solo/")) return "apps/kart-solo";
  if (posixPath.startsWith("packages/shared/")) return "packages/shared";
  if (posixPath.startsWith("packages/emails/")) return "packages/emails";
  if (posixPath.startsWith("scripts/")) return "scripts";
  if (posixPath.startsWith("docs/")) return "docs";
  if (posixPath.startsWith(".agents/")) return ".agents";
  if (posixPath.startsWith(".github/")) return ".github";
  return "root";
}

export function classifyRole(posixPath: string, extension: string): Role {
  if (
    dataExactFiles.has(posixPath) ||
    (posixPath.startsWith("docs/") && extension === ".json")
  ) {
    return "data";
  }

  if (extension === ".md") {
    return "docs";
  }

  const base = path.posix.basename(posixPath);
  if (
    /\.(test|spec|test-support)\.[^.]+$/.test(base) ||
    posixPath.startsWith("apps/api/test/") ||
    posixPath.startsWith("apps/web/test/") ||
    posixPath.startsWith("apps/web/e2e/") ||
    posixPath.startsWith("apps/web/perf/") ||
    posixPath === "apps/web/src/chess/worker-mock.ts"
  ) {
    return "test";
  }

  if (
    extension === ".json" ||
    extension === ".jsonc" ||
    extension === ".yml" ||
    extension === ".yaml" ||
    /\.config\.[^.]+$/.test(base) ||
    posixPath === "apps/web/src/vite-env.d.ts"
  ) {
    return "config";
  }

  if (posixPath.startsWith("apps/api/src/questions/packs/")) {
    return "content";
  }

  if (
    posixPath.startsWith("scripts/") ||
    posixPath === "release.sh" ||
    posixPath === "neon.ts"
  ) {
    return "tooling";
  }

  return "app";
}

export function classifyArea(posixPath: string): string {
  if (posixPath.startsWith("apps/web/src/play/designs/")) {
    return "apps/web/src/play/designs";
  }
  if (posixPath.startsWith("apps/web/src/play/controls/")) {
    return "apps/web/src/play/controls";
  }
  if (posixPath.startsWith("apps/web/src/")) {
    const rest = posixPath.slice("apps/web/src/".length);
    return rest.includes("/")
      ? `apps/web/src/${rest.split("/")[0]}`
      : "apps/web/src (root)";
  }
  if (posixPath.startsWith("apps/web/e2e/")) return "apps/web/e2e";
  if (posixPath.startsWith("apps/web/perf/")) return "apps/web/perf";
  if (posixPath.startsWith("apps/web/test/")) return "apps/web/test";
  if (posixPath.startsWith("apps/web/public/")) return "apps/web/public";
  if (posixPath.startsWith("apps/web/")) return "apps/web (root)";

  if (posixPath.startsWith("apps/api/src/questions/packs/")) {
    const rest = posixPath.slice("apps/api/src/questions/packs/".length);
    return rest.includes("/")
      ? `apps/api/src/questions/packs/${rest.split("/")[0]}`
      : "apps/api/src/questions/packs";
  }
  if (posixPath.startsWith("apps/api/src/questions/")) {
    const rest = posixPath.slice("apps/api/src/questions/".length);
    return rest.includes("/")
      ? `apps/api/src/questions/${rest.split("/")[0]}`
      : "apps/api/src/questions";
  }
  if (posixPath.startsWith("apps/api/src/room/kart/")) {
    return "apps/api/src/room/kart";
  }
  if (posixPath.startsWith("apps/api/src/")) {
    const rest = posixPath.slice("apps/api/src/".length);
    return rest.includes("/")
      ? `apps/api/src/${rest.split("/")[0]}`
      : "apps/api/src (root)";
  }
  if (posixPath.startsWith("apps/api/test/")) return "apps/api/test";
  if (posixPath.startsWith("apps/api/")) return "apps/api (root)";

  if (posixPath.startsWith("packages/shared/src/")) {
    const rest = posixPath.slice("packages/shared/src/".length);
    return rest.includes("/")
      ? `packages/shared/src/${rest.split("/")[0]}`
      : "packages/shared/src (core)";
  }
  if (posixPath.startsWith("packages/shared/")) return "packages/shared (root)";
  if (posixPath.startsWith("packages/emails/")) return "packages/emails";

  if (posixPath.startsWith("apps/kart-solo/src/")) {
    const rest = posixPath.slice("apps/kart-solo/src/".length);
    return rest.includes("/")
      ? `apps/kart-solo/src/${rest.split("/")[0]}`
      : "apps/kart-solo/src";
  }
  if (posixPath.startsWith("apps/kart-solo/")) return "apps/kart-solo (root)";

  if (posixPath.startsWith("scripts/")) return "scripts";
  if (posixPath.startsWith("docs/content/")) return "docs/content";
  if (posixPath.startsWith("docs/")) return "docs";
  if (posixPath.startsWith(".agents/")) return ".agents";
  if (posixPath.startsWith(".github/")) return ".github";
  return "root";
}

export function classifyFeature(posixPath: string, role: Role): string {
  if (role === "docs") return "documentation";
  if (role === "data") return "generated & data";
  if (role === "config") return "config & ci";

  if (
    posixPath.startsWith("apps/web/src/kart/") ||
    posixPath.startsWith("apps/api/src/questions/kart/") ||
    posixPath.startsWith("apps/api/src/room/kart/") ||
    posixPath.startsWith("packages/shared/src/kart/") ||
    posixPath.startsWith("apps/kart-solo/") ||
    posixPath.includes("kart")
  ) {
    if (!posixPath.startsWith("apps/api/src/questions/packs/")) {
      return "kart";
    }
  }

  if (
    posixPath.startsWith("apps/web/src/chess/") ||
    posixPath.startsWith("apps/api/src/questions/chess/") ||
    posixPath.startsWith("packages/shared/src/chess/") ||
    (posixPath.startsWith("apps/api/test/") && posixPath.includes("chess")) ||
    (posixPath.startsWith("apps/web/e2e/") && posixPath.includes("chess"))
  ) {
    return "chess";
  }

  if (posixPath.startsWith("apps/api/src/questions/packs/")) {
    return "question packs";
  }

  if (
    posixPath.startsWith("apps/web/src/admin/") ||
    posixPath.startsWith("apps/api/src/room/admin-") ||
    posixPath === "packages/shared/src/admin.ts" ||
    (posixPath.startsWith("apps/api/test/") && posixPath.includes("admin"))
  ) {
    return "admin console";
  }

  if (
    posixPath.startsWith("apps/web/src/troll/") ||
    posixPath.startsWith("apps/api/src/troll/") ||
    posixPath === "packages/shared/src/troll-cooldown.ts" ||
    (posixPath.startsWith("apps/api/test/") && posixPath.includes("troll"))
  ) {
    return "trolls & sabotage";
  }

  if (
    posixPath.startsWith("apps/web/src/play/") ||
    posixPath.startsWith("apps/api/src/questions/") ||
    posixPath.startsWith("packages/shared/src/wordle/") ||
    posixPath.startsWith("packages/shared/src/map-guess/") ||
    posixPath === "packages/shared/src/party-scoring.ts" ||
    posixPath === "packages/shared/src/voters.ts" ||
    (posixPath.startsWith("apps/api/test/") &&
      /(question|vote|duel|slider|rank|wordle|map-guess|multiple|typed|push-luck|best-dressed|birthday|answer|award|party-scoring|cue|content)/.test(
        posixPath,
      )) ||
    (posixPath.startsWith("apps/web/e2e/") &&
      /(wordle|question|play|pokemon|ed-or-humza)/.test(posixPath))
  ) {
    return "play & questions";
  }

  if (
    posixPath.startsWith("apps/web/src/theme/") ||
    posixPath.startsWith("apps/web/src/ui/") ||
    posixPath.startsWith("apps/web/src/anim/") ||
    posixPath === "apps/web/src/index.css"
  ) {
    return "themes & ui";
  }

  if (
    posixPath.startsWith("apps/web/src/media/") ||
    posixPath.startsWith("apps/web/src/wall/") ||
    posixPath.startsWith("apps/web/src/photo/") ||
    posixPath.startsWith("apps/web/src/device/") ||
    posixPath.startsWith("apps/api/src/media/") ||
    posixPath.startsWith("apps/api/src/wall/") ||
    posixPath.startsWith("apps/api/src/device/") ||
    posixPath === "packages/shared/src/wall.ts" ||
    posixPath === "packages/shared/src/moderation.ts" ||
    posixPath === "packages/shared/src/device-context.ts" ||
    (posixPath.startsWith("apps/api/test/") &&
      /(media|wall|photo|device|avatar)/.test(posixPath))
  ) {
    return "media, wall & devices";
  }

  if (
    posixPath.startsWith("apps/api/src/auth/") ||
    posixPath.startsWith("apps/api/src/credentials/") ||
    posixPath.startsWith("apps/api/src/security/") ||
    posixPath.startsWith("apps/web/src/join/") ||
    posixPath === "packages/shared/src/client-api-key.ts" ||
    (posixPath.startsWith("apps/api/test/") &&
      /(auth|credential|client-api-key|security)/.test(posixPath))
  ) {
    return "auth & security";
  }

  if (
    posixPath.startsWith("apps/api/src/stats/") ||
    posixPath.startsWith("apps/api/src/results/") ||
    posixPath.startsWith("apps/api/src/archive/") ||
    posixPath.startsWith("apps/web/src/results/") ||
    posixPath.startsWith("packages/shared/src/trends/") ||
    posixPath.startsWith("packages/emails/") ||
    posixPath === "packages/shared/src/results.ts" ||
    posixPath === "packages/shared/src/stats.ts" ||
    posixPath === "packages/shared/src/archive.ts" ||
    (posixPath.startsWith("apps/api/test/") &&
      /(stats|trends|results|archive|email)/.test(posixPath))
  ) {
    return "stats, results & archive";
  }

  if (
    posixPath.startsWith("apps/web/src/developer/") ||
    posixPath.startsWith("apps/api/src/developer/") ||
    posixPath === "packages/shared/src/developer.ts" ||
    posixPath.startsWith("scripts/") ||
    posixPath.startsWith("apps/web/perf/") ||
    posixPath.startsWith("apps/web/e2e/") ||
    posixPath === "release.sh" ||
    posixPath === "neon.ts" ||
    (posixPath.startsWith("apps/api/test/") && /(developer|load)/.test(posixPath))
  ) {
    return "developer, perf & tooling";
  }

  return "room & realtime";
}

export function classifyFile(posixPath: string): Omit<FileStat, "counts"> | null {
  if (isSecretOrExcludedFile(posixPath)) {
    return null;
  }
  const extension = path.posix.extname(posixPath).toLowerCase();
  if (!countedExtensions.has(extension)) {
    return null;
  }
  const role = classifyRole(posixPath, extension);
  return {
    relativePath: posixPath,
    workspace: classifyWorkspace(posixPath),
    area: classifyArea(posixPath),
    feature: classifyFeature(posixPath, role),
    extension,
    role,
  };
}

async function walk(
  directory: string,
  root: string,
  files: string[] = [],
): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    const relativePosix = toPosix(path.relative(root, fullPath));

    if (entry.isDirectory()) {
      if (
        excludedDirNames.has(entry.name) ||
        excludedDirPrefixes.some(
          (prefix) =>
            relativePosix === prefix || relativePosix.startsWith(`${prefix}/`),
        )
      ) {
        continue;
      }
      await walk(fullPath, root, files);
      continue;
    }

    if (entry.isFile()) {
      files.push(fullPath);
    }
  }
  return files;
}

export async function collectStats(root = defaultRoot): Promise<FileStat[]> {
  try {
    const info = await stat(root);
    if (!info.isDirectory()) {
      return [];
    }
  } catch {
    return [];
  }

  const allFiles = await walk(root, root);
  const stats: FileStat[] = [];

  for (const filePath of allFiles) {
    const relativePosix = toPosix(path.relative(root, filePath));
    const classified = classifyFile(relativePosix);
    if (!classified) {
      continue;
    }
    const content = await readFile(filePath, "utf8");
    stats.push({
      ...classified,
      counts: analyseLines(content, classified.extension),
    });
  }

  return stats.sort((left, right) =>
    left.relativePath.localeCompare(right.relativePath),
  );
}

export function pathAtDepth(posixPath: string, depth: number): string {
  const parts = posixPath.split("/");
  if (parts.length <= depth) {
    return parts.slice(0, -1).join("/") || ".";
  }
  return parts.slice(0, depth).join("/");
}

export type GroupRow = {
  label: string;
  counts: LineCounts;
  roles: RoleBreakdown;
};

const emptyRoleBreakdown = (): RoleBreakdown => ({
  app: 0,
  content: 0,
  test: 0,
  tooling: 0,
  config: 0,
  data: 0,
  docs: 0,
});

export function groupStats(
  stats: FileStat[],
  keyFn: (stat: FileStat) => string,
): GroupRow[] {
  const map = new Map<string, GroupRow>();
  for (const entry of stats) {
    const key = keyFn(entry);
    let row = map.get(key);
    if (!row) {
      row = {
        label: key,
        counts: emptyCounts(),
        roles: emptyRoleBreakdown(),
      };
      map.set(key, row);
    }
    addCounts(row.counts, entry.counts);
    row.roles[entry.role] += entry.counts.code;
  }

  return [...map.values()].sort(
    (left, right) =>
      right.counts.code - left.counts.code || left.label.localeCompare(right.label),
  );
}

export function sumCounts(stats: FileStat[]): LineCounts {
  const total = emptyCounts();
  for (const entry of stats) {
    addCounts(total, entry.counts);
  }
  return total;
}

export function sumRoles(stats: FileStat[]): RoleBreakdown {
  const roles = emptyRoleBreakdown();
  for (const entry of stats) {
    roles[entry.role] += entry.counts.code;
  }
  return roles;
}

export type SizeBucket = {
  label: string;
  files: number;
  code: number;
};

export type SizeDistribution = {
  buckets: SizeBucket[];
  median: number;
  p90: number;
  max: number;
  avg: number;
};

export function computeSizeDistribution(stats: FileStat[]): SizeDistribution {
  const bucketDefs: Array<{ label: string; min: number; max: number }> = [
    { label: "< 50 LOC", min: 0, max: 49 },
    { label: "50 - 99 LOC", min: 50, max: 99 },
    { label: "100 - 299 LOC", min: 100, max: 299 },
    { label: "300 - 499 LOC", min: 300, max: 499 },
    { label: "500 - 999 LOC", min: 500, max: 999 },
    { label: "1,000+ LOC", min: 1000, max: Number.POSITIVE_INFINITY },
  ];

  const buckets: SizeBucket[] = bucketDefs.map((def) => ({
    label: def.label,
    files: 0,
    code: 0,
  }));

  if (stats.length === 0) {
    return { buckets, median: 0, p90: 0, max: 0, avg: 0 };
  }

  const sorted = stats.map((entry) => entry.counts.code).sort((a, b) => a - b);
  let totalCode = 0;

  for (const code of sorted) {
    totalCode += code;
    const bucketIndex = bucketDefs.findIndex(
      (def) => code >= def.min && code <= def.max,
    );
    if (bucketIndex !== -1) {
      buckets[bucketIndex].files += 1;
      buckets[bucketIndex].code += code;
    }
  }

  const mid = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 === 0
      ? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
      : sorted[mid];
  const p90Index = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.9));

  return {
    buckets,
    median,
    p90: sorted[p90Index],
    max: sorted[sorted.length - 1],
    avg: Math.round(totalCode / sorted.length),
  };
}

function formatNumber(value: number): string {
  return value.toLocaleString("en-GB");
}

function formatShare(part: number, total: number): string {
  if (total <= 0) return "0.0%";
  return `${((part / total) * 100).toFixed(1)}%`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

type ColumnAlign = "left" | "right";

type TableColumn = {
  header: string;
  align?: ColumnAlign;
};

function renderAlignedTable(
  columns: TableColumn[],
  rows: string[][],
  dividerAfterIndex?: number,
): string {
  const widths = columns.map((col, idx) =>
    Math.max(col.header.length, ...rows.map((row) => (row[idx] ?? "").length)),
  );

  const formatRow = (cells: string[]) =>
    columns
      .map((col, idx) => {
        const value = cells[idx] ?? "";
        return col.align === "right"
          ? value.padStart(widths[idx])
          : value.padEnd(widths[idx]);
      })
      .join("  ");

  const headerLine = formatRow(columns.map((c) => c.header));
  const sepLine = "-".repeat(headerLine.length);
  const out = [headerLine, sepLine];

  rows.forEach((row, index) => {
    out.push(formatRow(row));
    if (dividerAfterIndex !== undefined && index === dividerAfterIndex) {
      out.push(sepLine);
    }
  });

  return out.join("\n");
}

function renderMarkdownTable(columns: TableColumn[], rows: string[][]): string {
  const header = `| ${columns.map((c) => c.header).join(" | ")} |`;
  const align = `| ${columns.map((c) => (c.align === "right" ? "---:" : "---")).join(" | ")} |`;
  const body = rows.map((row) => `| ${row.join(" | ")} |`);
  return [header, align, ...body].join("\n");
}

function filterStats(stats: FileStat[], options: CliOptions): FileStat[] {
  return stats.filter((entry) => {
    if (options.roles && !options.roles.has(entry.role)) {
      return false;
    }
    if (options.area) {
      const needle = options.area.toLowerCase();
      const hit =
        entry.relativePath.toLowerCase().includes(needle) ||
        entry.area.toLowerCase().includes(needle) ||
        entry.workspace.toLowerCase().includes(needle) ||
        entry.feature.toLowerCase().includes(needle);
      if (!hit) return false;
    }
    return true;
  });
}

function buildOverviewTableRows(
  stats: FileStat[],
  markdown: boolean,
): { rows: string[][]; dividerIndex: number } {
  const byRole = new Map<Role, FileStat[]>();
  for (const role of roleOrder) {
    byRole.set(role, []);
  }
  for (const entry of stats) {
    byRole.get(entry.role)?.push(entry);
  }

  const handwritten = stats.filter((entry) => handwrittenRoles.has(entry.role));
  const handwrittenTotal = sumCounts(handwritten);
  const grandTotal = sumCounts(stats);

  const toRow = (label: string, counts: LineCounts, shareBase: number): string[] => {
    const avg = counts.files > 0 ? Math.round(counts.code / counts.files) : 0;
    return [
      label,
      formatNumber(counts.files),
      formatNumber(counts.code),
      formatNumber(counts.comment),
      formatNumber(counts.blank),
      formatNumber(counts.total),
      formatShare(counts.code, shareBase),
      formatNumber(avg),
      formatBytes(counts.bytes),
    ];
  };

  const rows: string[][] = [];
  for (const role of ["app", "content", "test", "tooling"] as Role[]) {
    const group = byRole.get(role) ?? [];
    if (group.length > 0) {
      rows.push(toRow(roleLabels[role], sumCounts(group), handwrittenTotal.code));
    }
  }

  const bold = (s: string) => (markdown ? `**${s}**` : s);
  rows.push(
    toRow(bold("Handwritten Code Subtotal"), handwrittenTotal, handwrittenTotal.code),
  );
  const dividerIndex = rows.length - 1;

  for (const role of ["config", "data", "docs"] as Role[]) {
    const group = byRole.get(role) ?? [];
    if (group.length > 0) {
      rows.push(toRow(roleLabels[role], sumCounts(group), grandTotal.code));
    }
  }

  rows.push(toRow(bold("Repository Total"), grandTotal, grandTotal.code));
  return { rows, dividerIndex };
}

const overviewColumns: TableColumn[] = [
  { header: "Role", align: "left" },
  { header: "Files", align: "right" },
  { header: "Code", align: "right" },
  { header: "Comment", align: "right" },
  { header: "Blank", align: "right" },
  { header: "Total", align: "right" },
  { header: "Share", align: "right" },
  { header: "Avg LOC", align: "right" },
  { header: "Size", align: "right" },
];

const splitColumns = (firstHeader: string, includeDataDocs = false): TableColumn[] => {
  const cols: TableColumn[] = [
    { header: firstHeader, align: "left" },
    { header: "Files", align: "right" },
    { header: "App", align: "right" },
    { header: "Content", align: "right" },
    { header: "Test", align: "right" },
    { header: "Tool/Cfg", align: "right" },
  ];
  if (includeDataDocs) {
    cols.push({ header: "Data/Docs", align: "right" });
  }
  cols.push(
    { header: "Code", align: "right" },
    { header: "Share", align: "right" },
    { header: "Avg", align: "right" },
  );
  return cols;
};

function groupToSplitRow(
  row: GroupRow,
  totalCode: number,
  includeDataDocs = false,
  markdown = false,
): string[] {
  const label = markdown ? `\`${row.label}\`` : row.label;
  const avg = row.counts.files > 0 ? Math.round(row.counts.code / row.counts.files) : 0;
  const cells = [
    label,
    formatNumber(row.counts.files),
    formatNumber(row.roles.app),
    formatNumber(row.roles.content),
    formatNumber(row.roles.test),
    formatNumber(row.roles.tooling + row.roles.config),
  ];
  if (includeDataDocs) {
    cells.push(formatNumber(row.roles.data + row.roles.docs));
  }
  cells.push(
    formatNumber(row.counts.code),
    formatShare(row.counts.code, totalCode),
    formatNumber(avg),
  );
  return cells;
}

function buildSplitRows(
  groups: GroupRow[],
  statsForTotal: FileStat[],
  limit?: number,
  markdown = false,
  includeDataDocs = false,
): { rows: string[][]; dividerIndex: number; omitted: number } {
  const totalCounts = sumCounts(statsForTotal);
  const totalRoles = sumRoles(statsForTotal);
  const shown = limit && groups.length > limit ? groups.slice(0, limit) : groups;
  const omitted = groups.length - shown.length;

  const rows = shown.map((group) =>
    groupToSplitRow(group, totalCounts.code, includeDataDocs, markdown),
  );

  if (omitted > 0) {
    const rest = groups.slice(limit);
    const restCounts = emptyCounts();
    const restRoles = emptyRoleBreakdown();
    for (const item of rest) {
      addCounts(restCounts, item.counts, item.counts.files);
      for (const key of roleOrder) {
        restRoles[key] += item.roles[key];
      }
    }
    rows.push(
      groupToSplitRow(
        {
          label: `(${omitted} smaller areas)`,
          counts: restCounts,
          roles: restRoles,
        },
        totalCounts.code,
        includeDataDocs,
        false,
      ),
    );
  }

  const dividerIndex = rows.length - 1;
  const totalAvg =
    totalCounts.files > 0 ? Math.round(totalCounts.code / totalCounts.files) : 0;
  const label = markdown ? "**TOTAL**" : "TOTAL";
  const totalRow = [
    label,
    formatNumber(totalCounts.files),
    formatNumber(totalRoles.app),
    formatNumber(totalRoles.content),
    formatNumber(totalRoles.test),
    formatNumber(totalRoles.tooling + totalRoles.config),
  ];
  if (includeDataDocs) {
    totalRow.push(formatNumber(totalRoles.data + totalRoles.docs));
  }
  totalRow.push(formatNumber(totalCounts.code), "100.0%", formatNumber(totalAvg));
  rows.push(totalRow);

  return { rows, dividerIndex, omitted };
}

function printDefaultSummary(stats: FileStat[], options: CliOptions): void {
  const handwritten = stats.filter((entry) => handwrittenRoles.has(entry.role));
  const appStats = stats.filter((entry) => entry.role === "app");
  const testStats = stats.filter((entry) => entry.role === "test");
  const testToAppRatio =
    sumCounts(appStats).code > 0
      ? (sumCounts(testStats).code / sumCounts(appStats).code).toFixed(2)
      : "0.00";

  console.log("26.humza.website — In-Depth Lines of Code");
  console.log("==========================================");
  console.log(
    `Test-to-App code ratio: ${testToAppRatio}x  (${formatNumber(sumCounts(testStats).code)} test LOC / ${formatNumber(sumCounts(appStats).code)} app LOC)`,
  );
  console.log("");

  console.log("1. OVERVIEW BY ROLE");
  const overview = buildOverviewTableRows(stats, false);
  console.log(
    renderAlignedTable(overviewColumns, overview.rows, overview.dividerIndex),
  );
  console.log("");

  console.log("2. WORKSPACE BREAKDOWN (Handwritten + Config)");
  const wsStats = stats.filter(
    (entry) => handwrittenRoles.has(entry.role) || entry.role === "config",
  );
  const wsGroups = groupStats(wsStats, (entry) => entry.workspace);
  const wsTable = buildSplitRows(wsGroups, wsStats);
  console.log(
    renderAlignedTable(splitColumns("Workspace"), wsTable.rows, wsTable.dividerIndex),
  );
  console.log("");

  console.log("3. CROSS-STACK FEATURE BREAKDOWN (Handwritten Code)");
  const featGroups = groupStats(handwritten, (entry) => entry.feature);
  const featTable = buildSplitRows(featGroups, handwritten);
  console.log(
    renderAlignedTable(
      splitColumns("Feature / Domain"),
      featTable.rows,
      featTable.dividerIndex,
    ),
  );
  console.log("");

  console.log("4. GRANULAR AREA BREAKDOWN (Handwritten Code)");
  const areaGroups = groupStats(handwritten, (entry) => entry.area);
  const areaLimit = options.all ? undefined : 30;
  const areaTable = buildSplitRows(areaGroups, handwritten, areaLimit);
  console.log(
    renderAlignedTable(splitColumns("Area"), areaTable.rows, areaTable.dividerIndex),
  );
  console.log("");

  console.log("5. LANGUAGE / EXTENSION BREAKDOWN (Handwritten + Config)");
  const extGroups = groupStats(wsStats, (entry) => entry.extension);
  const extTable = buildSplitRows(extGroups, wsStats);
  console.log(
    renderAlignedTable(splitColumns("Ext"), extTable.rows, extTable.dividerIndex),
  );
  console.log("");

  const dist = computeSizeDistribution(appStats);
  console.log(
    `6. APP FILE SIZE DISTRIBUTION (${formatNumber(appStats.length)} files — avg ${formatNumber(dist.avg)}, median ${formatNumber(dist.median)}, p90 ${formatNumber(dist.p90)}, max ${formatNumber(dist.max)} LOC)`,
  );
  const distCols: TableColumn[] = [
    { header: "Bucket", align: "left" },
    { header: "Files", align: "right" },
    { header: "Code", align: "right" },
    { header: "Share", align: "right" },
  ];
  const appTotalCode = sumCounts(appStats).code;
  const distRows = dist.buckets.map((bucket) => [
    bucket.label,
    formatNumber(bucket.files),
    formatNumber(bucket.code),
    formatShare(bucket.code, appTotalCode),
  ]);
  console.log(renderAlignedTable(distCols, distRows));
  console.log("");

  const topN = options.top ?? 12;
  console.log(`7. TOP ${topN} LARGEST APP FILES`);
  printFileTable(appStats, topN);
  console.log("");

  console.log(
    "Drill down: npm run loc -- --area kart | --kind app,test | --depth 4 | --files | --all | --json | npm run loc:report",
  );
}

function printFileTable(stats: FileStat[], limit?: number): void {
  const sorted = [...stats].sort(
    (left, right) =>
      right.counts.code - left.counts.code ||
      left.relativePath.localeCompare(right.relativePath),
  );
  const shown = limit && sorted.length > limit ? sorted.slice(0, limit) : sorted;

  const cols: TableColumn[] = [
    { header: "File", align: "left" },
    { header: "Role", align: "left" },
    { header: "Code", align: "right" },
    { header: "Comment", align: "right" },
    { header: "Blank", align: "right" },
    { header: "Total", align: "right" },
  ];
  const rows = shown.map((entry) => [
    entry.relativePath,
    entry.role,
    formatNumber(entry.counts.code),
    formatNumber(entry.counts.comment),
    formatNumber(entry.counts.blank),
    formatNumber(entry.counts.total),
  ]);
  console.log(renderAlignedTable(cols, rows));
  if (sorted.length > shown.length) {
    console.log(
      `... ${formatNumber(sorted.length - shown.length)} more files omitted (pass --all or --top <n>).`,
    );
  }
}

function printFilteredView(filtered: FileStat[], options: CliOptions): void {
  const filterDesc = [
    options.area ? `area="${options.area}"` : null,
    options.roles ? `kind=${[...options.roles].join(",")}` : null,
    options.depth ? `depth=${options.depth}` : null,
  ]
    .filter(Boolean)
    .join(" ");

  console.log(`26.humza.website — Filtered LOC (${filterDesc || "all"})`);
  console.log("=".repeat(56));

  if (filtered.length === 0) {
    console.log("No files matched the given filter.");
    return;
  }

  const total = sumCounts(filtered);
  const roles = sumRoles(filtered);
  const handwrittenCode = roles.app + roles.content + roles.test + roles.tooling;
  const dataDocsCode = roles.data + roles.docs;
  const hasDataDocs = dataDocsCode > 0;
  console.log(
    `Matched ${formatNumber(total.files)} files: ${formatNumber(handwrittenCode)} handwritten LOC, ${formatNumber(roles.config)} config, ${formatNumber(dataDocsCode)} data/docs (${formatNumber(total.total)} total lines, ${formatBytes(total.bytes)}).`,
  );
  console.log("");

  if (options.depth) {
    const groups = groupStats(filtered, (entry) =>
      pathAtDepth(entry.relativePath, options.depth!),
    );
    const table = buildSplitRows(
      groups,
      filtered,
      options.all ? undefined : 50,
      false,
      hasDataDocs,
    );
    console.log(
      renderAlignedTable(
        splitColumns(`Path (depth ${options.depth})`, hasDataDocs),
        table.rows,
        table.dividerIndex,
      ),
    );
    console.log("");
  } else {
    const groups = groupStats(filtered, (entry) => entry.area);
    if (groups.length > 1) {
      const table = buildSplitRows(
        groups,
        filtered,
        options.all ? undefined : 30,
        false,
        hasDataDocs,
      );
      console.log(
        renderAlignedTable(
          splitColumns("Area", hasDataDocs),
          table.rows,
          table.dividerIndex,
        ),
      );
      console.log("");
    }
  }

  if (options.files || options.area || options.top !== null) {
    const limit = options.all ? undefined : (options.top ?? 40);
    printFileTable(filtered, limit);
  }
}

export function buildJsonPayload(stats: FileStat[]) {
  const handwritten = stats.filter((entry) => handwrittenRoles.has(entry.role));
  const appStats = stats.filter((entry) => entry.role === "app");

  return {
    generatedAt: new Date().toISOString(),
    totals: {
      all: sumCounts(stats),
      handwritten: sumCounts(handwritten),
      byRole: Object.fromEntries(
        roleOrder.map((role) => [
          role,
          sumCounts(stats.filter((entry) => entry.role === role)),
        ]),
      ),
    },
    byWorkspace: groupStats(stats, (entry) => entry.workspace),
    byFeature: groupStats(handwritten, (entry) => entry.feature),
    byArea: groupStats(stats, (entry) => entry.area),
    byExtension: groupStats(stats, (entry) => entry.extension),
    appSizeDistribution: computeSizeDistribution(appStats),
    files: stats,
  };
}

export function buildMarkdownReport(stats: FileStat[]): string {
  const generatedAt = new Date().toISOString();
  const handwritten = stats.filter((entry) => handwrittenRoles.has(entry.role));
  const appStats = stats.filter((entry) => entry.role === "app");
  const testStats = stats.filter((entry) => entry.role === "test");
  const contentStats = stats.filter((entry) => entry.role === "content");
  const dist = computeSizeDistribution(appStats);
  const testToApp =
    sumCounts(appStats).code > 0
      ? (sumCounts(testStats).code / sumCounts(appStats).code).toFixed(2)
      : "0.00";

  const overview = buildOverviewTableRows(stats, true);

  const wsStats = stats.filter(
    (entry) => handwrittenRoles.has(entry.role) || entry.role === "config",
  );
  const wsTable = buildSplitRows(
    groupStats(wsStats, (entry) => entry.workspace),
    wsStats,
    undefined,
    true,
  );
  const featTable = buildSplitRows(
    groupStats(handwritten, (entry) => entry.feature),
    handwritten,
    undefined,
    true,
  );
  const areaTable = buildSplitRows(
    groupStats(handwritten, (entry) => entry.area),
    handwritten,
    undefined,
    true,
  );

  const extTable = buildSplitRows(
    groupStats(wsStats, (entry) => entry.extension),
    wsStats,
    undefined,
    true,
  );

  const fileCols: TableColumn[] = [
    { header: "File", align: "left" },
    { header: "Area", align: "left" },
    { header: "Code", align: "right" },
    { header: "Comment", align: "right" },
    { header: "Blank", align: "right" },
    { header: "Total", align: "right" },
  ];
  const toFileRows = (items: FileStat[], limit: number) =>
    [...items]
      .sort((a, b) => b.counts.code - a.counts.code)
      .slice(0, limit)
      .map((entry) => [
        `\`${entry.relativePath}\``,
        `\`${entry.area}\``,
        formatNumber(entry.counts.code),
        formatNumber(entry.counts.comment),
        formatNumber(entry.counts.blank),
        formatNumber(entry.counts.total),
      ]);

  const distCols: TableColumn[] = [
    { header: "Bucket", align: "left" },
    { header: "Files", align: "right" },
    { header: "Code", align: "right" },
    { header: "Share", align: "right" },
  ];
  const appTotalCode = sumCounts(appStats).code;
  const distRows = dist.buckets.map((bucket) => [
    bucket.label,
    formatNumber(bucket.files),
    formatNumber(bucket.code),
    formatShare(bucket.code, appTotalCode),
  ]);

  return [
    "# Lines of code report",
    "",
    `Generated: ${generatedAt}`,
    "",
    `Excludes \`node_modules\`, build outputs (\`dist\`, \`.wrangler\`, \`.vite\`, \`kart-engine\`), vendored engines (\`draco\`, \`chess-engine\`), lockfiles, secret env files, and this report. Generated types/data (\`worker-configuration.d.ts\`, \`validity-words.ts\`, \`kart-circuit.json\`, etc.) are separated into **Generated & Data** so handwritten totals remain exact.`,
    "",
    `- **Handwritten Code:** ${formatNumber(sumCounts(handwritten).code)} LOC across ${formatNumber(handwritten.length)} files`,
    `- **Test-to-App Ratio:** ${testToApp}x (${formatNumber(sumCounts(testStats).code)} test LOC vs ${formatNumber(sumCounts(appStats).code)} app LOC)`,
    `- **App File Size:** avg ${formatNumber(dist.avg)} LOC · median ${formatNumber(dist.median)} LOC · p90 ${formatNumber(dist.p90)} LOC · max ${formatNumber(dist.max)} LOC`,
    "",
    "## Overview by role",
    "",
    renderMarkdownTable(overviewColumns, overview.rows),
    "",
    "## Workspaces",
    "",
    renderMarkdownTable(splitColumns("Workspace"), wsTable.rows),
    "",
    "## Cross-stack features (handwritten code)",
    "",
    renderMarkdownTable(splitColumns("Feature"), featTable.rows),
    "",
    "## Granular areas (handwritten code)",
    "",
    renderMarkdownTable(splitColumns("Area"), areaTable.rows),
    "",
    "## Languages & extensions (handwritten + config)",
    "",
    renderMarkdownTable(splitColumns("Extension"), extTable.rows),
    "",
    "## App file size distribution",
    "",
    renderMarkdownTable(distCols, distRows),
    "",
    "## Largest app files",
    "",
    renderMarkdownTable(fileCols, toFileRows(appStats, 25)),
    "",
    "## Largest test files",
    "",
    renderMarkdownTable(fileCols, toFileRows(testStats, 15)),
    "",
    "## Largest content pack files",
    "",
    renderMarkdownTable(fileCols, toFileRows(contentStats, 10)),
    "",
  ].join("\n");
}

export function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    report: false,
    json: false,
    files: false,
    all: false,
    help: false,
    area: null,
    roles: null,
    depth: null,
    top: null,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--report") {
      options.report = true;
    } else if (arg === "--json") {
      options.json = true;
    } else if (arg === "--files") {
      options.files = true;
    } else if (arg === "--all") {
      options.all = true;
    } else if (arg === "--help" || arg === "-h") {
      options.help = true;
    } else if (arg === "--area" || arg === "-a") {
      options.area = argv[i + 1] ?? "";
      i += 1;
    } else if (arg.startsWith("--area=")) {
      options.area = arg.slice("--area=".length);
    } else if (arg === "--kind" || arg === "--role") {
      const raw = argv[i + 1] ?? "";
      i += 1;
      options.roles = parseRoleList(raw);
    } else if (arg.startsWith("--kind=") || arg.startsWith("--role=")) {
      const raw = arg.split("=")[1] ?? "";
      options.roles = parseRoleList(raw);
    } else if (arg === "--depth") {
      const value = Number.parseInt(argv[i + 1] ?? "", 10);
      i += 1;
      if (Number.isFinite(value) && value > 0) {
        options.depth = value;
      }
    } else if (arg.startsWith("--depth=")) {
      const value = Number.parseInt(arg.slice("--depth=".length), 10);
      if (Number.isFinite(value) && value > 0) {
        options.depth = value;
      }
    } else if (arg === "--top") {
      const value = Number.parseInt(argv[i + 1] ?? "", 10);
      i += 1;
      if (Number.isFinite(value) && value > 0) {
        options.top = value;
      }
    } else if (arg.startsWith("--top=")) {
      const value = Number.parseInt(arg.slice("--top=".length), 10);
      if (Number.isFinite(value) && value > 0) {
        options.top = value;
      }
    } else if (!arg.startsWith("-") && !options.area) {
      options.area = arg;
    }
  }

  return options;
}

function parseRoleList(raw: string): Set<Role> {
  const valid = new Set<Role>(roleOrder);
  const selected = new Set<Role>();
  for (const token of raw.split(",")) {
    const trimmed = token.trim().toLowerCase() as Role;
    if (valid.has(trimmed)) {
      selected.add(trimmed);
    }
  }
  return selected.size > 0 ? selected : new Set(roleOrder);
}

function printHelp(): void {
  console.log(`Usage: npm run loc [-- options]

Options:
  --area, -a <text>     Filter by path, area, workspace, or feature (also shows matching files)
  --kind, --role <list> Comma-separated roles: app,content,test,tooling,config,data,docs
  --depth <n>           Group paths at directory depth <n> (e.g. --depth 4)
  --files               Show individual files sorted by code lines
  --top <n>             Number of files to display (default: 12 summary / 40 filtered)
  --all                 Show every area and file without truncation
  --json                Output machine-readable JSON
  --report              Write full breakdown to ${reportRelativePath}
  --help, -h            Show this help message`);
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }

  const allStats = await collectStats(defaultRoot);
  const filtered = filterStats(allStats, options);

  if (options.report) {
    const markdown = buildMarkdownReport(filtered);
    const outPath = path.join(defaultRoot, reportRelativePath);
    await writeFile(outPath, markdown, "utf8");
    console.log(`Wrote ${reportRelativePath}`);
  }

  if (options.json) {
    console.log(JSON.stringify(buildJsonPayload(filtered), null, 2));
    return;
  }

  if (options.area || options.roles || options.depth || options.files) {
    printFilteredView(filtered, options);
    return;
  }

  printDefaultSummary(filtered, options);
}

const invoked =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invoked) {
  await main();
}

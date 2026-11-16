import { gzipSync } from "node:zlib";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const defaultDist = path.join(root, "apps/web/dist/client");
const defaultBudget = path.join(here, "web-bundle-budget.json");

export function gzipSize(buffer) {
  return gzipSync(buffer).length;
}

export function referencedAssets(html) {
  const found = [];
  const pattern = /(?:src|href)="([^"]+)"/g;
  for (const match of html.matchAll(pattern)) {
    const href = match[1];
    if (href.startsWith("/assets/") || href.startsWith("./assets/")) found.push(href);
  }
  return found;
}

export function classifyAsset(filePath) {
  const base = path.basename(filePath);
  if (base.endsWith(".js") || base.endsWith(".mjs")) return "js";
  if (base.endsWith(".css")) return "css";
  return "other";
}

export function summarise(files, html) {
  const refs = new Set(
    referencedAssets(html).map((href) => href.replace(/^\.\//, "").replace(/^\//, "")),
  );
  const js = files.filter((file) => file.kind === "js");
  const css = files.filter((file) => file.kind === "css");
  const isEntry = (file) => refs.has(file.webPath) || refs.has(`/${file.webPath}`);
  const entryJs = js.filter(isEntry);
  const entryCss = css.filter(isEntry);
  const largestJs = js.reduce(
    (max, file) => (file.gzipBytes > max.gzipBytes ? file : max),
    {
      gzipBytes: 0,
      webPath: "",
    },
  );
  return {
    entryJsGzipBytes: entryJs.reduce((sum, file) => sum + file.gzipBytes, 0),
    entryCssGzipBytes: entryCss.reduce((sum, file) => sum + file.gzipBytes, 0),
    totalJsGzipBytes: js.reduce((sum, file) => sum + file.gzipBytes, 0),
    largestJsGzipBytes: largestJs.gzipBytes,
    largestJsPath: largestJs.webPath,
    jsFiles: js.length,
    cssFiles: css.length,
  };
}

function over(name, actual, limit) {
  if (actual <= limit) return null;
  return `${name}: ${actual} gzip bytes exceeds ${limit}`;
}

export function checkSummary(summary, budget) {
  return [
    over("entry JS", summary.entryJsGzipBytes, budget.entryJsGzipBytes),
    over("entry CSS", summary.entryCssGzipBytes, budget.entryCssGzipBytes),
    over("total JS", summary.totalJsGzipBytes, budget.totalJsGzipBytes),
    over("largest JS chunk", summary.largestJsGzipBytes, budget.anyJsGzipBytes),
  ].filter(Boolean);
}

async function walk(directory, files = []) {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error && error.code === "ENOENT") return { missing: true, files };
    throw error;
  }
  for (const entry of entries) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) await walk(full, files);
    else if (entry.isFile()) files.push(full);
  }
  return { missing: false, files };
}

export async function measureDist(distRoot) {
  const htmlPath = path.join(distRoot, "index.html");
  let html;
  try {
    html = await readFile(htmlPath, "utf8");
  } catch (error) {
    if (error && error.code === "ENOENT") {
      throw new Error(`${htmlPath} is missing. Run npm run build -w @26/web first.`);
    }
    throw error;
  }
  const assetsRoot = path.join(distRoot, "assets");
  const walked = await walk(assetsRoot);
  if (walked.missing) {
    throw new Error(`${assetsRoot} is missing. Run npm run build -w @26/web first.`);
  }
  const files = [];
  for (const filePath of walked.files) {
    const kind = classifyAsset(filePath);
    if (kind === "other") continue;
    const buffer = await readFile(filePath);
    const relative = path.relative(distRoot, filePath).split(path.sep).join("/");
    files.push({
      webPath: relative,
      kind,
      bytes: buffer.length,
      gzipBytes: gzipSize(buffer),
    });
  }
  return { files, html, summary: summarise(files, html) };
}

export async function loadBudget(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

const isMain =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  const dist = process.env.WEB_DIST ?? defaultDist;
  const budgetPath = process.env.WEB_BUNDLE_BUDGET ?? defaultBudget;
  const measured = await measureDist(dist);
  const budget = await loadBudget(budgetPath);
  const problems = checkSummary(measured.summary, budget);
  console.log(
    JSON.stringify(
      {
        dist,
        ...measured.summary,
        budget,
      },
      null,
      2,
    ),
  );
  if (problems.length > 0) {
    console.error(problems.join("\n"));
    console.error(
      "Raise scripts/web-bundle-budget.json in the same PR and say why, or split the new code.",
    );
    process.exit(1);
  }
  console.log("Web bundle is within gzip budgets.");
}

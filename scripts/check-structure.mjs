import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const defaultRoot = path.resolve(here, "..");

const sourceExt = new Set([".ts", ".tsx", ".js", ".mjs"]);

export const webFolders = [
  "admin",
  "anim",
  "api",
  "chess",
  "controller",
  "developer",
  "device",
  "guest",
  "home",
  "join",
  "kart",
  "live",
  "lobby",
  "media",
  "photo",
  "play",
  "results",
  "stage",
  "theme",
  "troll",
  "ui",
  "wall",
];

export const webFiles = [
  "example-game.ts",
  "index.css",
  "main.tsx",
  "not-found-page.test.tsx",
  "not-found-page.tsx",
  "README.md",
  "router.test.tsx",
  "router.tsx",
  "routes.tsx",
  "security-headers.test.ts",
  "vite-env.d.ts",
];

export const apiFolders = [
  "archive",
  "auth",
  "credentials",
  "developer",
  "device",
  "media",
  "questions",
  "results",
  "room",
  "security",
  "stats",
  "troll",
  "wall",
];

export const apiFiles = ["index.ts", "log.ts", "README.md", "timeout.ts"];

export const sharedFolders = ["chess", "kart", "wordle"];

export const sharedFiles = [
  "admin.ts",
  "archive.ts",
  "client-api-key.ts",
  "developer.ts",
  "device-context.ts",
  "index.ts",
  "moderation.ts",
  "party-scoring.ts",
  "rate-limit.ts",
  "results.ts",
  "stats.ts",
  "version.ts",
  "voters.ts",
  "wall.ts",
];

export const stalePaths = [
  "apps/web/src/rounds",
  "apps/web/src/net",
  "packages/shared/src/kart.ts",
  "packages/shared/src/wordle.ts",
  "apps/api/src/questions/kart.ts",
  "apps/api/src/questions/wordle.ts",
  "apps/api/src/questions/chess-mechanic.ts",
  "apps/api/src/questions/chess-coordinator.ts",
  "apps/api/src/questions/wordle-dictionary",
  "apps/api/src/room/kart-ingress.ts",
  "apps/api/src/room/kart-lobby.ts",
];

const skipDir = new Set([
  "node_modules",
  "dist",
  ".git",
  ".wrangler",
  ".mf",
  ".vite",
  ".data",
  "coverage",
]);

export function listNames(dir) {
  return readdirSync(dir).sort();
}

export function unexpectedEntries(names, allowedFolders, allowedFiles) {
  const allowed = new Set([...allowedFolders, ...allowedFiles]);
  return names.filter((name) => !allowed.has(name) && !name.startsWith("."));
}

function exists(root, relative) {
  try {
    statSync(path.join(root, relative));
    return true;
  } catch {
    return false;
  }
}

export function importSpecifiers(source) {
  const found = [];
  const from = /from\s+["']([^"']+)["']/g;
  const dyn = /import\s*\(\s*["']([^"']+)["']\s*\)/g;
  const req = /require\s*\(\s*["']([^"']+)["']\s*\)/g;
  for (const pattern of [from, dyn, req]) {
    for (const match of source.matchAll(pattern)) found.push(match[1]);
  }
  return found;
}

export function posixJoin(fromFile, specifier) {
  if (!specifier.startsWith(".")) return specifier.replaceAll("\\", "/");
  const dir = path.posix.dirname(fromFile.replaceAll("\\", "/"));
  return path.posix.normalize(`${dir}/${specifier}`);
}

export function webFeature(posixPath) {
  const match = posixPath
    .replaceAll("\\", "/")
    .match(/apps\/web\/src\/(kart|chess|troll)(?:\/|$)/);
  return match ? match[1] : null;
}

export function apiMechanic(posixPath) {
  const match = posixPath
    .replaceAll("\\", "/")
    .match(/apps\/api\/src\/questions\/(kart|chess|wordle)(?:\/|$)/);
  return match ? match[1] : null;
}

export function boundaryViolations(fromFile, specifier) {
  const resolved = posixJoin(fromFile, specifier);
  const problems = [];
  if (fromFile.startsWith("apps/web/") && /(?:^|\/)apps\/api(?:\/|$)/.test(resolved)) {
    problems.push("web must not import apps/api");
  }
  if (
    fromFile.startsWith("packages/shared/") &&
    (/(?:^|\/)apps\//.test(resolved) ||
      specifier === "react" ||
      specifier.startsWith("react/") ||
      specifier === "hono" ||
      specifier.startsWith("hono/") ||
      specifier === "three" ||
      specifier === "stockfish")
  ) {
    problems.push("shared must stay free of apps and UI/runtime packages");
  }
  const fromWeb = webFeature(fromFile);
  const toWeb = webFeature(resolved);
  if (fromWeb && toWeb && fromWeb !== toWeb) {
    problems.push(`${fromWeb} must not import ${toWeb} internals`);
  }
  const fromApi = apiMechanic(fromFile);
  const toApi = apiMechanic(resolved);
  if (fromApi && toApi && fromApi !== toApi) {
    problems.push(`questions/${fromApi} must not import questions/${toApi}`);
  }
  return problems;
}

function walk(dir, files = []) {
  for (const name of readdirSync(dir)) {
    if (skipDir.has(name)) continue;
    const full = path.join(dir, name);
    const stat = statSync(full);
    if (stat.isDirectory()) walk(full, files);
    else if (sourceExt.has(path.extname(name))) files.push(full);
  }
  return files;
}

export function checkStructure(root = defaultRoot) {
  const errors = [];
  const webDir = path.join(root, "apps/web/src");
  const apiDir = path.join(root, "apps/api/src");
  const sharedDir = path.join(root, "packages/shared/src");

  errors.push(
    ...unexpectedEntries(listNames(webDir), webFolders, webFiles).map(
      (name) => `unexpected apps/web/src entry: ${name}`,
    ),
  );
  errors.push(
    ...unexpectedEntries(listNames(apiDir), apiFolders, apiFiles).map(
      (name) => `unexpected apps/api/src entry: ${name}`,
    ),
  );
  errors.push(
    ...unexpectedEntries(listNames(sharedDir), sharedFolders, sharedFiles).map(
      (name) => `unexpected packages/shared/src entry: ${name}`,
    ),
  );

  for (const stale of stalePaths) {
    if (exists(root, stale)) errors.push(`stale path still present: ${stale}`);
  }

  for (const folder of ["kart", "chess", "wordle"]) {
    const dir = path.join(sharedDir, folder);
    if (!exists(root, path.relative(root, dir))) {
      errors.push(`missing packages/shared/src/${folder}`);
    }
  }
  if (!exists(root, "apps/api/src/questions/kart/kart.ts")) {
    errors.push("missing apps/api/src/questions/kart/kart.ts");
  }
  if (!exists(root, "apps/api/src/room/kart/kart-lobby.ts")) {
    errors.push("missing apps/api/src/room/kart/kart-lobby.ts");
  }
  if (!exists(root, "apps/web/src/play/controls/SubmitButton.tsx")) {
    errors.push("missing apps/web/src/play/controls/SubmitButton.tsx");
  }

  const scanRoots = [
    path.join(root, "apps/web/src"),
    path.join(root, "apps/api/src"),
    path.join(root, "packages/shared/src"),
  ];
  for (const scanRoot of scanRoots) {
    for (const file of walk(scanRoot)) {
      const fromFile = path.relative(root, file).replaceAll("\\", "/");
      let source = "";
      try {
        source = readFileSync(file, "utf8");
      } catch {
        continue;
      }
      for (const specifier of importSpecifiers(source)) {
        for (const problem of boundaryViolations(fromFile, specifier)) {
          errors.push(`${fromFile}: ${problem} (${specifier})`);
        }
      }
    }
  }

  return errors;
}

const invoked =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invoked) {
  const errors = checkStructure();
  if (errors.length > 0) {
    console.error("Structure check failed:\n");
    for (const error of errors) console.error(`- ${error}`);
    process.exit(1);
  }
  console.log("Structure check passed.");
}

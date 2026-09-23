import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const requiredRoot = path.resolve("apps/web/dist");
const optionalRoots = [path.resolve("apps/api/dist")];
const forbiddenNames = new Set([".env", ".dev.vars", "credentials.json"]);
const privateKey = /BEGIN [A-Z ]*PRIVATE KEY/;

async function walk(directory) {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return { missing: true, files: [] };
    }
    throw error;
  }

  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      const nested = await walk(fullPath);
      files.push(...nested.files);
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }
  return { missing: false, files };
}

const problems = [];
const required = await walk(requiredRoot);
if (required.missing) {
  problems.push(`${requiredRoot} is missing. Run the web build first.`);
}

const files = [...required.files];
for (const root of optionalRoots) {
  const result = await walk(root);
  files.push(...result.files);
}

for (const filePath of files) {
  const baseName = path.basename(filePath);
  if (
    forbiddenNames.has(baseName) ||
    baseName.startsWith(".env") ||
    baseName === ".dev.vars"
  ) {
    problems.push(`Forbidden file in build output: ${filePath}`);
    continue;
  }

  const contents = await readFile(filePath);
  const text = contents.toString("utf8");
  if (privateKey.test(text)) {
    problems.push(`Private key material in build output: ${filePath}`);
  }
  const normalised = filePath.split(path.sep).join("/");
  const clientBundle = normalised.includes("/assets/") && normalised.endsWith(".js");
  if (
    clientBundle &&
    (text.includes("internalAdapter") ||
      text.includes("local-development-only-not-a-deployed-secret") ||
      text.includes("createPgliteKysely") ||
      text.includes("demo-answer-key-v1") ||
      text.includes("truthNickname"))
  ) {
    problems.push(`Server-only quiz or auth code in client bundle: ${filePath}`);
  }
  if (clientBundle && text.includes("Illustrative demo: which of these is a circle?")) {
    problems.push(`Demo answer text in client bundle: ${filePath}`);
  }
}

if (problems.length > 0) {
  console.error(problems.join("\n"));
  process.exit(1);
}

console.log(
  `Checked ${files.length} build file${files.length === 1 ? "" : "s"} for secrets.`,
);

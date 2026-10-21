import { readdir, rm } from "node:fs/promises";
import path from "node:path";

const roots = [path.resolve("apps/web/dist"), path.resolve("apps/api/dist")];

function isGeneratedSecret(name) {
  return (
    name === ".dev.vars" || name.startsWith(".dev.vars.") || name.startsWith(".env")
  );
}

async function strip(directory) {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return [];
    }
    throw error;
  }

  const removed = [];
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      removed.push(...(await strip(fullPath)));
      continue;
    }
    if (entry.isFile() && isGeneratedSecret(entry.name)) {
      await rm(fullPath);
      removed.push(path.relative(process.cwd(), fullPath));
    }
  }
  return removed;
}

const removed = [];
for (const root of roots) {
  removed.push(...(await strip(root)));
}

if (removed.length === 0) {
  console.log("No generated secret files to strip from dist.");
} else {
  console.log(
    `Removed ${removed.length} generated secret file${removed.length === 1 ? "" : "s"} from dist.`,
  );
}

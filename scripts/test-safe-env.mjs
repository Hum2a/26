#!/usr/bin/env node
/**
 * Runs a command with `DATABASE_URL` blanked in apps/api/.dev.vars, then puts
 * the original line back, whatever happens. Local development may point at a
 * real Neon database; automated checks must never archive test games there.
 *
 *   node scripts/test-safe-env.mjs -- npx playwright test ...
 *
 * The file is read and rewritten in place. No value is printed.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const devVarsPath = path.join(root, "apps/api/.dev.vars");

/** The file text with every `DATABASE_URL=` line emptied. */
export function blankDatabaseUrl(text) {
  return text.replace(/^DATABASE_URL=.*$/gm, "DATABASE_URL=");
}

export function runSafely(command, args, file = devVarsPath) {
  const original = existsSync(file) ? readFileSync(file, "utf8") : undefined;
  let restored = false;
  const restore = () => {
    if (restored || original === undefined) return;
    restored = true;
    writeFileSync(file, original);
  };
  if (original !== undefined) writeFileSync(file, blankDatabaseUrl(original));
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: root,
      stdio: "inherit",
      shell: process.platform === "win32",
    });
    const forward = (signal) => child.kill(signal);
    process.on("SIGINT", forward);
    process.on("SIGTERM", forward);
    process.on("exit", restore);
    child.on("exit", (code, signal) => {
      restore();
      process.off("SIGINT", forward);
      process.off("SIGTERM", forward);
      resolve(code ?? (signal ? 1 : 0));
    });
    child.on("error", () => {
      restore();
      resolve(1);
    });
  });
}

const invoked =
  process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (invoked) {
  const separator = process.argv.indexOf("--");
  const [command, ...args] = process.argv.slice(separator === -1 ? 2 : separator + 1);
  if (!command) {
    console.error("Usage: node scripts/test-safe-env.mjs -- <command> [args...]");
    process.exit(2);
  }
  process.exitCode = await runSafely(command, args);
}

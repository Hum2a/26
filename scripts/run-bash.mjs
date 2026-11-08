#!/usr/bin/env node
/** Run a bash script with a real bash (Git Bash on Windows, never the WSL stub). */
import { spawnSync } from "node:child_process";
import { resolveBash } from "./command.mjs";

const bash = resolveBash();
const result = spawnSync(bash, process.argv.slice(2), {
  stdio: "inherit",
  windowsHide: true,
});
process.exit(result.status ?? 1);

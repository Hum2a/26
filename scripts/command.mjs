import { existsSync } from "node:fs";
import path from "node:path";

/**
 * Real bash for scripts and tests. On Windows, prefer Git Bash and never the
 * System32 WSL stub (`bash.exe`), which fails when WSL is not installed.
 */
export function resolveBash({
  platform = process.platform,
  env = process.env,
  exists = existsSync,
} = {}) {
  if (env.BASH && exists(env.BASH)) return env.BASH;
  if (platform !== "win32") return "bash";
  const paths = path.win32;
  const candidates = [
    env.PROGRAMFILES && paths.join(env.PROGRAMFILES, "Git", "bin", "bash.exe"),
    env.ProgramFiles && paths.join(env.ProgramFiles, "Git", "bin", "bash.exe"),
    env["ProgramFiles(x86)"] &&
      paths.join(env["ProgramFiles(x86)"], "Git", "bin", "bash.exe"),
    env.LOCALAPPDATA &&
      paths.join(env.LOCALAPPDATA, "Programs", "Git", "bin", "bash.exe"),
  ].filter(Boolean);
  for (const candidate of candidates) if (exists(candidate)) return candidate;
  for (const directory of (env.PATH ?? env.Path ?? "").split(";")) {
    if (!directory) continue;
    const candidate = paths.join(directory, "bash.exe");
    if (!exists(candidate)) continue;
    if (/\\Windows\\(?:System32|SysWOW64)\\bash\.exe$/i.test(candidate)) continue;
    return candidate;
  }
  throw new Error(
    "Cannot find Git Bash. Install Git for Windows, or set BASH to bash.exe.",
  );
}

/** Keep arguments out of a shell, including Windows npm/npx command shims. */
export function resolveCommand(
  command,
  args,
  {
    platform = process.platform,
    env = process.env,
    execPath = process.execPath,
    exists = existsSync,
  } = {},
) {
  if (platform !== "win32") return { command, args: [...args] };
  const paths = path.win32;
  const name = paths.basename(command).toLowerCase();
  if (/^(?:npm|npx)(?:\.cmd)?$/.test(name)) {
    const candidates = [];
    if (env.npm_execpath && /npm-cli\.js$/i.test(env.npm_execpath))
      candidates.push(env.npm_execpath);
    for (const directory of [
      paths.dirname(command),
      paths.dirname(execPath),
      ...(env.PATH ?? env.Path ?? "").split(";"),
    ]) {
      if (directory)
        candidates.push(paths.join(directory, "node_modules/npm/bin/npm-cli.js"));
    }
    const npmCli = candidates.find((candidate) => exists(candidate));
    const cli = npmCli
      ? name.startsWith("npx")
        ? paths.join(paths.dirname(npmCli), "npx-cli.js")
        : npmCli
      : undefined;
    if (!cli || !exists(cli))
      throw new Error("Cannot find the npm CLI. Run this command through npm.");
    return { command: execPath, args: [cli, ...args] };
  }
  if (/\.(?:cmd|bat)$/i.test(command))
    throw new Error("Pass the executable or Node script instead of a batch file.");
  return { command, args: [...args] };
}

import { existsSync } from "node:fs";
import path from "node:path";

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

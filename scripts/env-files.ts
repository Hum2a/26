import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const environments = ["local", "staging", "production"] as const;
export type TargetEnvironment = (typeof environments)[number];

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const KEY_LINE = /^(?:#\s*)?([A-Z][A-Z0-9_]*)=(.*)$/;

export type EnvTemplate = {
  header: string[];
  keys: string[];
  templateValues: Record<string, string>;
};

export type MergeResult = {
  path: string;
  created: boolean;
  updated: boolean;
  keysAdded: string[];
};

export function projectRoot(): string {
  return root;
}

export function readTargetEnvironment(
  argv: readonly string[] = process.argv,
): TargetEnvironment | undefined {
  const flag = argv.indexOf("--env");
  const fromFlag = argv[flag + 1];
  if (flag !== -1 && environments.includes(fromFlag as TargetEnvironment)) {
    return fromFlag as TargetEnvironment;
  }
  const positional = argv
    .slice(2)
    .find((arg) => environments.includes(arg as TargetEnvironment));
  return positional as TargetEnvironment | undefined;
}

export function readTargetEnvironments(
  argv: readonly string[] = process.argv,
): TargetEnvironment[] {
  const single = readTargetEnvironment(argv);
  return single ? [single] : [...environments];
}

export function devVarsExamplePath(): string {
  return path.join(root, "apps/api/.dev.vars.example");
}

export function devVarsPath(environment: TargetEnvironment): string {
  if (environment === "local") {
    return path.join(root, "apps/api/.dev.vars");
  }
  return path.join(root, `apps/api/.dev.vars.${environment}`);
}

export function envExamplePath(): string {
  return path.join(root, ".env.example");
}

export function envPath(environment: TargetEnvironment): string {
  return path.join(root, `.env.${environment}`);
}

export function parseEnvTemplate(filePath: string): EnvTemplate {
  const lines = readFileSync(filePath, "utf8").split(/\r?\n/);
  const header: string[] = [];
  const keys: string[] = [];
  const templateValues: Record<string, string> = {};
  let seenKey = false;

  for (const line of lines) {
    const match = line.match(KEY_LINE);
    if (!match) {
      if (!seenKey) {
        header.push(line);
      }
      continue;
    }
    seenKey = true;
    const key = match[1];
    if (!keys.includes(key)) {
      keys.push(key);
    }
    if (!line.trim().startsWith("#")) {
      templateValues[key] = unquote(match[2].trim());
    }
  }

  return { header, keys, templateValues };
}

export function readEnvValues(filePath: string): Record<string, string> {
  const values: Record<string, string> = {};
  if (!existsSync(filePath)) {
    return values;
  }
  for (const line of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const separator = trimmed.indexOf("=");
    if (separator === -1) {
      continue;
    }
    const key = trimmed.slice(0, separator).trim();
    values[key] = unquote(trimmed.slice(separator + 1).trim());
  }
  return values;
}

export function mergeEnvFile(
  templatePath: string,
  targetPath: string,
  defaults: Record<string, string> = {},
): MergeResult {
  const template = parseEnvTemplate(templatePath);
  const existing = readEnvValues(targetPath);
  const existedBefore = existsSync(targetPath);
  const keysAdded: string[] = [];
  const values: Record<string, string> = {};

  for (const key of template.keys) {
    if (!(key in existing)) {
      keysAdded.push(key);
    }
    values[key] =
      key in existing
        ? existing[key]
        : (defaults[key] ?? template.templateValues[key] ?? "");
  }

  const extras = Object.keys(existing).filter((key) => !template.keys.includes(key));
  const next = formatEnvFile({
    header: template.header,
    keys: template.keys,
    values,
    extras,
    existing,
  });

  const previous = existedBefore ? readFileSync(targetPath, "utf8") : "";
  const changed = !existedBefore || previous !== next;
  if (changed) {
    writeFileSync(targetPath, next, "utf8");
  }

  return {
    path: targetPath,
    created: !existedBefore,
    updated: existedBefore && changed,
    keysAdded,
  };
}

function formatEnvFile(input: {
  header: string[];
  keys: string[];
  values: Record<string, string>;
  extras: string[];
  existing: Record<string, string>;
}): string {
  const lines = [...input.header];
  if (lines.length > 0 && lines.at(-1)?.trim() !== "") {
    lines.push("");
  }
  lines.push("# Updated by npm run env:sync. Existing values are preserved.");
  lines.push("");

  for (const key of input.keys) {
    lines.push(formatEnvAssignment(key, input.values[key] ?? ""));
  }

  if (input.extras.length > 0) {
    lines.push("");
    lines.push("# Additional keys kept from the previous file.");
    for (const key of input.extras) {
      lines.push(formatEnvAssignment(key, input.existing[key] ?? ""));
    }
  }

  return `${lines.join("\n").replace(/\n+$/, "")}\n`;
}

export function formatEnvAssignment(key: string, value: string): string {
  return `${key}=${formatValue(value)}`;
}

export function setEnvValue(targetPath: string, key: string, value: string): void {
  if (!existsSync(targetPath)) {
    writeFileSync(targetPath, `${formatEnvAssignment(key, value)}\n`, "utf8");
    return;
  }

  const lines = readFileSync(targetPath, "utf8").split(/\r?\n/);
  let found = false;
  const next = lines.map((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
      return line;
    }
    const separator = trimmed.indexOf("=");
    const lineKey = trimmed.slice(0, separator).trim();
    if (lineKey !== key) {
      return line;
    }
    found = true;
    return formatEnvAssignment(key, value);
  });
  if (!found) {
    next.push(formatEnvAssignment(key, value));
  }
  writeFileSync(targetPath, `${next.join("\n").replace(/\n+$/, "")}\n`, "utf8");
}

function formatValue(value: string): string {
  if (!value) {
    return "";
  }
  if (/[\s#"'\\]/.test(value)) {
    return `"${value.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
  }
  return value;
}

function unquote(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

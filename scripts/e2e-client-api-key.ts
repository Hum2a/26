import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { clientApiKeyHeader } from "../packages/shared/src/client-api-key.ts";
import { projectRoot } from "./env-files.ts";

function readEnvValue(filePath: string, key: string): string {
  if (!existsSync(filePath)) {
    return "";
  }
  for (const line of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
      continue;
    }
    const separator = trimmed.indexOf("=");
    const lineKey = trimmed.slice(0, separator).trim();
    if (lineKey !== key) {
      continue;
    }
    let value = trimmed.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    return value;
  }
  return "";
}

export function clientApiKeyForTests(): string {
  const fromProcess = process.env.VITE_CLIENT_API_KEY?.trim();
  if (fromProcess) {
    return fromProcess;
  }
  return readEnvValue(path.join(projectRoot(), ".env.local"), "VITE_CLIENT_API_KEY");
}

export function clientApiHeadersForTests(
  extra: Record<string, string> = {},
): Record<string, string> {
  const key = clientApiKeyForTests();
  if (!key) {
    return extra;
  }
  return {
    [clientApiKeyHeader]: key,
    ...extra,
  };
}

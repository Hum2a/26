import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { clientApiKeyHeader, clientApiKeyQueryParam } from "@26/shared";

const devVarsPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../.dev.vars",
);

export const routingTestClientApiKey = "routing-test-client-api-key";

let cachedDevVars: Record<string, string> | undefined;

function readDevVars(filePath: string): Record<string, string> {
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
    values[trimmed.slice(0, separator).trim()] = trimmed.slice(separator + 1).trim();
  }
  return values;
}

export function readTestClientApiKey(bindingValue?: string, explicit?: string): string {
  const fromExplicit = explicit?.trim();
  if (fromExplicit) {
    return fromExplicit;
  }
  const fromBinding = bindingValue?.trim();
  if (fromBinding) {
    return fromBinding;
  }
  cachedDevVars ??= readDevVars(devVarsPath);
  return cachedDevVars.CLIENT_API_KEY?.trim() ?? "";
}

export function withClientApiKeyHeaders(
  headers: Record<string, string> = {},
  bindingValue?: string,
  explicit?: string,
): Record<string, string> {
  const configured = readTestClientApiKey(bindingValue, explicit);
  if (!configured) {
    return headers;
  }
  return {
    [clientApiKeyHeader]: configured,
    ...headers,
  };
}

export function withClientApiQuery(
  url: string,
  bindingValue?: string,
  explicit?: string,
): string {
  const configured = readTestClientApiKey(bindingValue, explicit);
  if (!configured) {
    return url;
  }
  const parsed = new URL(url);
  parsed.searchParams.set(clientApiKeyQueryParam, configured);
  return parsed.toString();
}

import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { clientApiKeyHeader, clientApiKeyQueryParam } from "@26/shared";
import { readEnvValues } from "../../../scripts/env-files.ts";

const devVarsPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../.dev.vars",
);

export const routingTestClientApiKey = "routing-test-client-api-key";

let cachedDevVars: Record<string, string> | undefined;

export function readTestClientApiKey(bindingValue?: string, explicit?: string): string {
  const fromExplicit = explicit?.trim();
  if (fromExplicit) {
    return fromExplicit;
  }
  const fromBinding = bindingValue?.trim();
  if (fromBinding) {
    return fromBinding;
  }
  if (!existsSync(devVarsPath)) {
    return "";
  }
  cachedDevVars ??= readEnvValues(devVarsPath);
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

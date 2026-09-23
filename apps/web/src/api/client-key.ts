import { clientApiKeyHeader, clientApiKeyQueryParam } from "@26/shared";

const configuredKey = import.meta.env.VITE_CLIENT_API_KEY?.trim() ?? "";

export function clientApiHeaders(
  extra: Record<string, string> = {},
): Record<string, string> {
  if (!configuredKey) {
    return extra;
  }
  return {
    [clientApiKeyHeader]: configuredKey,
    ...extra,
  };
}

export function withClientApiKey(url: string): string {
  if (!configuredKey) {
    return url;
  }
  const parsed = new URL(url, window.location.origin);
  parsed.searchParams.set(clientApiKeyQueryParam, configuredKey);
  return `${parsed.pathname}${parsed.search}${parsed.hash}`;
}

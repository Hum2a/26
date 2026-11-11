import { clientApiKeyHeader, clientApiKeyQueryParam } from "@26/shared";

export function resolveConfiguredClientKey(
  hostname = typeof window !== "undefined" ? window.location.hostname : "",
  env: {
    readonly VITE_CLIENT_API_KEY?: string;
    readonly VITE_CLIENT_API_KEY_STAGING?: string;
    readonly VITE_CLIENT_API_KEY_PRODUCTION?: string;
  } = import.meta.env,
): string {
  if (hostname === "26-staging.humza.website") {
    const stagingKey = env.VITE_CLIENT_API_KEY_STAGING?.trim();
    if (stagingKey) {
      return stagingKey;
    }
  }
  if (hostname === "26.humza.website") {
    const productionKey = env.VITE_CLIENT_API_KEY_PRODUCTION?.trim();
    if (productionKey) {
      return productionKey;
    }
  }
  return env.VITE_CLIENT_API_KEY?.trim() ?? "";
}

const configuredKey = resolveConfiguredClientKey();
const mediaRevisions = new Map<string, number>();
export function noteMediaDisplayRevision(gameId: string, revision = 0) {
  mediaRevisions.set(gameId.toUpperCase(), revision);
}

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
  const game = /\/api\/rooms\/([^/]+)\/(?:media|gallery)\//.exec(url)?.[1];
  const revision = game ? (mediaRevisions.get(game.toUpperCase()) ?? 0) : 0;
  if (!configuredKey && !revision) {
    return url;
  }
  const parsed = new URL(url, window.location.origin);
  if (configuredKey) parsed.searchParams.set(clientApiKeyQueryParam, configuredKey);
  if (revision) parsed.searchParams.set("display", String(revision));
  return `${parsed.pathname}${parsed.search}${parsed.hash}`;
}

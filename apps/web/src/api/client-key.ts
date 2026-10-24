import { clientApiKeyHeader, clientApiKeyQueryParam } from "@26/shared";

const configuredKey = import.meta.env.VITE_CLIENT_API_KEY?.trim() ?? "";
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

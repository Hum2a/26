import { env } from "cloudflare:test";
import {
  readTestClientApiKey,
  routingTestClientApiKey,
  withClientApiKeyHeaders as withHeaders,
  withClientApiQuery as withQuery,
} from "./client-api-key-values.ts";

export { routingTestClientApiKey };

export function configuredClientApiKey(key?: string): string {
  return readTestClientApiKey(env.CLIENT_API_KEY, key);
}

export function withClientApiKeyHeaders(
  headers: Record<string, string> = {},
  key?: string,
): Record<string, string> {
  return withHeaders(headers, env.CLIENT_API_KEY, key);
}

export function withClientApiQuery(url: string, key?: string): string {
  return withQuery(url, env.CLIENT_API_KEY, key);
}

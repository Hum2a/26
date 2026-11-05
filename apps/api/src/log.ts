/**
 * Structured, redacted server logs. Messages that could carry a connection
 * string, password or secret keep only the error name. Workers Logs (enabled
 * in wrangler.jsonc for staging and production) collects these lines.
 */
export type LogArea = "alarm" | "archive" | "email" | "socket" | "request" | "media";

const sensitive = ["://", "password", "secret", "token", "key=", "authorization"];

export function describeError(error: unknown): { name: string; message?: string } {
  if (!(error instanceof Error)) return { name: typeof error };
  const lower = error.message.toLowerCase();
  return sensitive.some((word) => lower.includes(word))
    ? { name: error.name }
    : { name: error.name, message: error.message.slice(0, 300) };
}

export function logError(
  area: LogArea,
  error: unknown,
  context: Record<string, string | number | boolean | undefined> = {},
): void {
  console.error(
    JSON.stringify({ level: "error", area, ...context, error: describeError(error) }),
  );
}

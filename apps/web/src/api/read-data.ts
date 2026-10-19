import { clientApiHeaders } from "./client-key";
type Schema<T> = {
  safeParse(value: unknown): { success: true; data: T } | { success: false };
};
export async function readSection<T>(
  path: string,
  schema: Schema<T>,
): Promise<T | { error: string }> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(path, {
      credentials: "same-origin",
      cache: "no-store",
      headers: clientApiHeaders(),
      signal: controller.signal,
    });
    const parsed = schema.safeParse(await response.json());
    return response.ok && parsed.success
      ? parsed.data
      : { error: "This information is unavailable. Try again." };
  } catch {
    return {
      error: "We couldn’t load this information. Check your connection and try again.",
    };
  } finally {
    window.clearTimeout(timer);
  }
}

import { apiErrorSchema, authFailureSchema } from "@26/shared";
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
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      return {
        error: response.ok
          ? "We couldn’t load this information. Check your connection and try again."
          : serverFailureMessage(undefined),
      };
    }
    if (!response.ok) {
      return { error: serverFailureMessage(body) };
    }
    const parsed = schema.safeParse(body);
    return parsed.success
      ? parsed.data
      : { error: "This information is unavailable. Try again." };
  } catch (error) {
    if (isAbortError(error)) {
      return {
        error: "We couldn’t load this information. Check your connection and try again.",
      };
    }
    return {
      error: "We couldn’t load this information. Check your connection and try again.",
    };
  } finally {
    window.clearTimeout(timer);
  }
}

function serverFailureMessage(body: unknown): string {
  const auth = authFailureSchema.safeParse(body);
  if (auth.success) {
    return auth.data.message;
  }
  const api = apiErrorSchema.safeParse(body);
  if (api.success) {
    return api.data.message;
  }
  if (
    body &&
    typeof body === "object" &&
    "message" in body &&
    typeof body.message === "string" &&
    body.message.trim()
  ) {
    return body.message;
  }
  return "This information is unavailable. Try again.";
}

function isAbortError(error: unknown): boolean {
  return (
    (error instanceof DOMException && error.name === "AbortError") ||
    (error instanceof Error && error.name === "AbortError")
  );
}

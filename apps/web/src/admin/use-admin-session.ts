import { useCallback, useEffect, useState } from "react";
import type { AdminSession } from "@26/shared";
import { fetchAdminSession } from "./admin-api";

type SessionState =
  | { state: "loading" }
  | { state: "ready"; session: AdminSession }
  | { state: "error"; message: string };

/**
 * Waits between quiet retries when sign-in could not be reached. A server that
 * is still starting, or a phone that just woke, usually answers within these.
 * A real answer from the server, signed in or not, is never retried.
 */
export const sessionRetryDelaysMs = [1_000, 2_000, 4_000];

export function useAdminSession() {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<SessionState>({ state: "loading" });
  useEffect(() => {
    let active = true;
    let timer: number | undefined;
    async function check(retry: number) {
      const session = await fetchAdminSession();
      if (!active) return;
      const delay = sessionRetryDelaysMs[retry];
      if ("error" in session && session.transient && delay !== undefined) {
        timer = window.setTimeout(() => void check(retry + 1), delay);
        return;
      }
      setResult(
        "error" in session
          ? { state: "error", message: session.error }
          : { state: "ready", session },
      );
    }
    void check(0);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [attempt]);
  const retry = useCallback(() => {
    setResult({ state: "loading" });
    setAttempt((current) => current + 1);
  }, []);
  return { ...result, retry };
}

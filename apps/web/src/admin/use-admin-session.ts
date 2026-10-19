import { useCallback, useEffect, useState } from "react";
import type { AdminSession } from "@26/shared";
import { fetchAdminSession } from "./admin-api";

type SessionState =
  | { state: "loading" }
  | { state: "ready"; session: AdminSession }
  | { state: "error"; message: string };

export function useAdminSession() {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<SessionState>({ state: "loading" });
  useEffect(() => {
    let active = true;
    void fetchAdminSession().then((session) => {
      if (active)
        setResult(
          "error" in session
            ? { state: "error", message: session.error }
            : { state: "ready", session },
        );
    });
    return () => {
      active = false;
    };
  }, [attempt]);
  const retry = useCallback(() => {
    setResult({ state: "loading" });
    setAttempt((current) => current + 1);
  }, []);
  return { ...result, retry };
}

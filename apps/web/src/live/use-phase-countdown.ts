import { useEffect, useState } from "react";
import { formatPhaseClock, remainingUntil, type LobbySnapshot } from "@26/shared";

export function usePhaseCountdown(
  snapshot: LobbySnapshot | undefined,
  observedAt: number,
): { label: string; value: string; note: string; remainingMs: number | null } | null {
  const deadlineAt = snapshot?.deadlineAt ?? null;
  const serverNow = snapshot?.serverNow ?? 0;
  const [now, setNow] = useState(observedAt);

  useEffect(() => {
    if (deadlineAt === null) {
      return;
    }
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timer = window.setInterval(
      () => {
        setNow(Date.now());
      },
      reduce ? 1000 : 250,
    );
    return () => {
      window.clearInterval(timer);
    };
  }, [deadlineAt, serverNow]);

  if (!snapshot) {
    return null;
  }
  if (snapshot.held) {
    return {
      label: "Waiting",
      value: "—",
      note: "Waiting for the host.",
      remainingMs: null,
    };
  }
  if (snapshot.paused) {
    return {
      label: "Paused",
      value: formatPhaseClock(snapshot.remainingMs ?? 0),
      note: "Paused.",
      remainingMs: null,
    };
  }
  if (deadlineAt === null) {
    return null;
  }
  const remainingMs = remainingUntil(deadlineAt, serverNow, observedAt, now);
  return {
    label: "Time left",
    value: formatPhaseClock(remainingMs),
    note: "Time left in this phase.",
    remainingMs,
  };
}

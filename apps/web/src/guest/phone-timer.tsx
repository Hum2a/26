import { useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import type { LobbySnapshot } from "@26/shared";
import { usePhaseCountdown } from "../live/use-phase-countdown";

const answerPhases = new Set(["collect", "vote", "predict"]);

/**
 * The room's clock on the phone. It only reads the server deadline; the room
 * still decides when time is up. A ring empties from the first reading seen
 * for this deadline, so a phone that joins late still shows a sensible ring.
 */
export function PhoneTimer({
  snapshot,
  observedAt,
}: {
  snapshot: LobbySnapshot | undefined;
  observedAt: number;
}) {
  const reduce = useReducedMotion();
  const clock = usePhaseCountdown(snapshot, observedAt);
  const [firstSeen, setFirstSeen] = useState<{
    deadline: number | null;
    total: number;
  }>({ deadline: null, total: 0 });
  const remaining = clock?.remainingMs ?? null;
  const deadline = snapshot?.deadlineAt ?? null;
  if (remaining !== null && firstSeen.deadline !== deadline) {
    setFirstSeen({ deadline, total: Math.max(remaining, 1) });
  }
  if (!snapshot || !clock || snapshot.phase === "lobby") return null;
  const answering = answerPhases.has(snapshot.phase);
  if (!answering && !snapshot.paused && !snapshot.held) return null;
  const fraction =
    remaining === null
      ? 1
      : Math.min(1, Math.max(0, remaining / Math.max(firstSeen.total, 1)));
  const urgent = remaining !== null && remaining > 0 && remaining <= 5_000;
  const state = snapshot.paused
    ? "paused"
    : snapshot.held
      ? "held"
      : urgent
        ? "urgent"
        : "running";
  const circumference = 2 * Math.PI * 9;
  return (
    <motion.div
      className="phone-timer glass"
      data-state={state}
      role="timer"
      aria-label={`${clock.label}: ${clock.value}`}
      initial={{ opacity: 0, scale: reduce ? 1 : 0.9 }}
      animate={
        urgent && !reduce
          ? { opacity: 1, scale: [1, 1.06, 1] }
          : { opacity: 1, scale: 1 }
      }
      transition={
        urgent && !reduce
          ? { scale: { duration: 1, repeat: Infinity, ease: "easeInOut" } }
          : { duration: 0.2 }
      }
    >
      <svg viewBox="0 0 24 24" className="phone-timer-ring" aria-hidden="true">
        <circle cx="12" cy="12" r="9" className="phone-timer-track" />
        <circle
          cx="12"
          cy="12"
          r="9"
          className="phone-timer-fill"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - fraction)}
        />
      </svg>
      <span className="phone-timer-value" aria-hidden="true">
        {snapshot.paused ? "Paused" : snapshot.held ? "Waiting" : clock.value}
      </span>
    </motion.div>
  );
}

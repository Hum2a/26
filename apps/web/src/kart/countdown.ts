import { resolveKartSettings, type LobbySnapshot } from "@26/shared";
import { usePhaseCountdown } from "../live/use-phase-countdown";

export type RaceCountdown = 3 | 2 | 1 | "GO" | null;

/** How long "GO" stays up once the room opens the race. */
export const goMs = 1_000;

/**
 * Pure: the countdown beat for a kart round. 3-2-1 covers the last three
 * seconds of the prompt phase, whose end the room schedules; GO shows while
 * the race clock is under a second. Nothing here starts or times the race.
 */
export function raceCountdown(input: {
  phase: string;
  remainingMs: number | null;
  raceElapsedMs?: number;
  paused: boolean;
  mode: "prompt-tail" | "none";
}): RaceCountdown {
  if (input.mode === "none" || input.paused) return null;
  if (input.phase === "prompt" && input.remainingMs !== null) {
    if (input.remainingMs <= 0 || input.remainingMs > 3_000) return null;
    return Math.max(1, Math.ceil(input.remainingMs / 1_000)) as 1 | 2 | 3;
  }
  if (
    input.phase === "collect" &&
    input.raceElapsedMs !== undefined &&
    input.raceElapsedMs < goMs
  )
    return "GO";
  return null;
}

export function useRaceCountdown(
  snapshot: LobbySnapshot | undefined,
  observedAt: number,
): RaceCountdown {
  const clock = usePhaseCountdown(snapshot, observedAt);
  if (!snapshot || snapshot.play?.question?.kind !== "kart") return null;
  return raceCountdown({
    phase: snapshot.phase,
    remainingMs: clock?.remainingMs ?? null,
    raceElapsedMs: snapshot.play.kart?.elapsedMs,
    paused: snapshot.paused || snapshot.held,
    mode: resolveKartSettings(snapshot.play.kart?.settings).countdown,
  });
}

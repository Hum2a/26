import { useEffect, useRef, useState } from "react";
import type { ChessGuestSnapshot } from "@26/shared";
import { serverOffset } from "../live/server-clock";

/** Under this, a running clock turns urgent and ticks. */
const lowTimeMs = 10_000;

function clockText(ms: number): string {
  const total = Math.ceil(ms / 1000);
  if (ms < lowTimeMs && ms > 0) {
    // Tenths in the last ten seconds, where they matter.
    return `0:${(ms / 1000).toFixed(1).padStart(4, "0")}`;
  }
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

/**
 * One side's clock. It counts down between room updates from the room's own
 * timestamps (`lastMoveAt` and the server clock offset), so it never drifts;
 * the room still decides when time has run out.
 */
export function ChessClock({
  snapshot,
  side,
  onLowTime,
}: {
  snapshot: ChessGuestSnapshot;
  side: "player" | "bot";
  /** Called once a second while this clock runs under ten seconds. */
  onLowTime?: () => void;
}) {
  const colour = side === "player" ? snapshot.playerColor : snapshot.botColor;
  const banked = side === "player" ? snapshot.playerTimeMs : snapshot.botTimeMs;
  const running =
    snapshot.sideToMove === colour && !snapshot.paused && !snapshot.isGameOver;
  const [now, setNow] = useState(Date.now);

  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => setNow(Date.now()), 100);
    return () => window.clearInterval(timer);
  }, [running]);

  const serverNow = now + (serverOffset(now) ?? 0);
  const left = running
    ? Math.max(0, banked - Math.max(0, serverNow - snapshot.lastMoveAt))
    : banked;
  const low = left < lowTimeMs && !snapshot.isGameOver;

  const second = Math.ceil(left / 1000);
  const ticked = useRef(second);
  useEffect(() => {
    if (ticked.current === second) return;
    ticked.current = second;
    if (running && low && second > 0) onLowTime?.();
  }, [second, running, low, onLowTime]);

  return (
    <div
      className="chess-clock"
      data-running={running || undefined}
      data-low={low || undefined}
      role="timer"
      aria-label={side === "player" ? "Your clock" : "Stockfish clock"}
    >
      {clockText(left)}
    </div>
  );
}

/** Both clocks side by side, for a screen that shows them on their own. */
export function ChessClocks({ snapshot }: { snapshot: ChessGuestSnapshot }) {
  return (
    <div className="chess-clocks">
      <ChessClock snapshot={snapshot} side="player" />
      <ChessClock snapshot={snapshot} side="bot" />
    </div>
  );
}

import { useEffect, useState } from "react";
import type { ChessGuestSnapshot } from "@26/shared";
import { serverOffset } from "../live/server-clock";

/**
 * Running chess clocks with server-time interpolation.
 * Uses lastMoveAt + serverOffset to avoid drift.
 */
export function ChessClocks({ snapshot }: { snapshot: ChessGuestSnapshot }) {
  const [now, setNow] = useState(Date.now);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(timer);
  }, []);

  // Calculate elapsed time since last move using server clock
  const offset = serverOffset(now) ?? 0;
  const serverNow = now + offset;
  const elapsed = snapshot.paused ? 0 : Math.max(0, serverNow - snapshot.lastMoveAt);

  // Subtract elapsed from the active clock
  const playerTime =
    snapshot.sideToMove === snapshot.playerColor
      ? Math.max(0, snapshot.playerTimeMs - elapsed)
      : snapshot.playerTimeMs;
  const botTime =
    snapshot.sideToMove === snapshot.botColor
      ? Math.max(0, snapshot.botTimeMs - elapsed)
      : snapshot.botTimeMs;

  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, "0")}`;
  };

  const playerActive = snapshot.sideToMove === snapshot.playerColor && !snapshot.paused;
  const botActive = snapshot.sideToMove === snapshot.botColor && !snapshot.paused;

  return (
    <div className="chess-clocks">
      <div className={`chess-clock ${playerActive ? "active" : ""}`}>
        <div className="clock-label">You ({snapshot.playerColor})</div>
        <div className="clock-time">{formatTime(playerTime)}</div>
      </div>
      <div className={`chess-clock ${botActive ? "active" : ""}`}>
        <div className="clock-label">Bot ({snapshot.botColor})</div>
        <div className="clock-time">{formatTime(botTime)}</div>
      </div>
    </div>
  );
}

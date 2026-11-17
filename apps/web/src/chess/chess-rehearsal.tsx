import { useEffect, useState } from "react";
import type { LobbySnapshot } from "@26/shared";
import { GuestChess } from "./guest-chess";
import {
  applySoloMove,
  createSoloSnapshot,
  expireSoloClock,
  resignSolo,
} from "./solo-game";

/** Explicit isolated admin adapter. No socket, persistence or party scores. */
export function ChessRehearsal({ snapshot }: { snapshot: LobbySnapshot }) {
  const [game, setGame] = useState(() =>
    createSoloSnapshot(Date.now(), "preview-chess"),
  );
  const blocked = snapshot.phase !== "collect" || snapshot.paused;
  const [wasBlocked, setWasBlocked] = useState(blocked);
  if (wasBlocked !== blocked) {
    const now = snapshot.serverNow;
    setWasBlocked(blocked);
    setGame((current) => ({
      ...current,
      paused: blocked,
      lastMoveAt: now,
      positionRevision: current.positionRevision + 1,
      playerTimeMs:
        !wasBlocked && current.sideToMove === "white"
          ? Math.max(0, current.playerTimeMs - (now - current.lastMoveAt))
          : current.playerTimeMs,
      botTimeMs:
        !wasBlocked && current.sideToMove === "black"
          ? Math.max(0, current.botTimeMs - (now - current.lastMoveAt))
          : current.botTimeMs,
    }));
  }
  useEffect(() => {
    if (blocked || game.isGameOver) return;
    const wait = game.sideToMove === "white" ? game.playerTimeMs : game.botTimeMs;
    const timer = window.setTimeout(
      () => setGame((current) => expireSoloClock(current, Date.now())),
      Math.max(0, wait),
    );
    return () => window.clearTimeout(timer);
  }, [blocked, game]);
  if (!snapshot.play) return null;
  return (
    <GuestChess
      snapshot={{
        ...snapshot,
        play: { ...snapshot.play, chess: { ...game, paused: blocked } },
      }}
      pending={false}
      onChessMove={({ from, to, promotion, positionRevision }) => {
        if (blocked) return;
        setGame((current) => {
          if (positionRevision !== current.positionRevision) return current;
          const next = applySoloMove(current, from, to, Date.now(), promotion);
          return "error" in next ? current : next;
        });
      }}
      onChessResign={() => {
        if (!blocked) setGame((current) => resignSolo(current, Date.now()));
      }}
    />
  );
}

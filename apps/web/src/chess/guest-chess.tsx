import { useEffect, useRef, useState } from "react";
import type { LobbySnapshot, ChessGuestSnapshot } from "@26/shared";
import { ChessGame } from "./chess-game";
import { ChessClocks } from "./chess-clocks";
import { QuestionExperience } from "../play/question-experience";
import type { ChessMoveParams, ChessResignParams } from "../live/room-socket";

export function GuestChess({
  snapshot,
  pending,
  onChessMove,
  onChessResign,
}: {
  snapshot: LobbySnapshot;
  pending: boolean;
  onChessMove: (params: ChessMoveParams) => void;
  onChessResign: (params: ChessResignParams) => void;
}) {
  const play = snapshot.play;
  // @ts-expect-error - play.chess not yet in LobbySnapshot type, but exists at runtime
  const chessSnapshot = play?.chess as ChessGuestSnapshot | undefined;
  const [engineError, setEngineError] = useState<string>();
  const pendingMoveRef = useRef<string | null>(null);

  // Block play if no chess snapshot yet (backend not ready)
  if (!chessSnapshot) {
    return (
      <QuestionExperience snapshot={snapshot} pending={false}>
        <div className="chess-blocked">
          <h2>Waiting for game to start</h2>
          <p className="text-muted">
            The server is preparing your chess game. This will only take a moment.
          </p>
        </div>
      </QuestionExperience>
    );
  }

  const open =
    snapshot.phase === "collect" &&
    !snapshot.paused &&
    !snapshot.held &&
    !chessSnapshot.isGameOver &&
    !pending;

  function handleMove(
    from: string,
    to: string,
    promotion?: "q" | "r" | "b" | "n",
    positionRevision?: number,
  ) {
    if (!chessSnapshot || !open) return;

    // Prevent duplicate submissions
    const moveKey = `${from}-${to}-${promotion ?? ""}`;
    if (pendingMoveRef.current === moveKey) return;
    pendingMoveRef.current = moveKey;

    // CRITICAL OWNERSHIP CONTRACT:
    // This phone owns ONE game (chessSnapshot.gameId) and submits BOTH
    // player AND bot moves for that SAME gameId. Server distinguishes
    // player vs bot using sideToMove from game state, NOT gameId ownership.
    // positionRevision must match snapshot to prevent stale moves.
    onChessMove({
      gameId: chessSnapshot.gameId, // ALWAYS own gameId, never opponent
      from,
      to,
      promotion,
      positionRevision: positionRevision ?? chessSnapshot.positionRevision,
    });
  }

  function handleResign() {
    if (!chessSnapshot || !open) return;
    onChessResign({
      gameId: chessSnapshot.gameId,
    });
  }

  // Clear pending flag when snapshot updates
  useEffect(() => {
    pendingMoveRef.current = null;
  }, [chessSnapshot?.fen, chessSnapshot?.status]);

  return (
    <QuestionExperience snapshot={snapshot} pending={pending}>
      <div className="chess-phone-container">
        <ChessClocks snapshot={chessSnapshot} />

        {engineError ? (
          <div className="chess-engine-error">
            <p className="text-destructive">{engineError}</p>
            <p className="text-muted text-sm">
              You can still play, but the computer won't respond automatically.
            </p>
          </div>
        ) : null}

        <ChessGame
          snapshot={chessSnapshot}
          onMove={handleMove}
          onResign={handleResign}
          disabled={!open || pending}
          onEngineError={setEngineError}
        />

        {pending ? (
          <p className="chess-status">Sending your move...</p>
        ) : snapshot.paused ? (
          <p className="chess-status">Game paused</p>
        ) : snapshot.held ? (
          <p className="chess-status">Round paused</p>
        ) : chessSnapshot.isGameOver ? (
          <p className="chess-status">
            {chessSnapshot.winner === "player"
              ? "You won!"
              : chessSnapshot.winner === "bot"
                ? "Computer won"
                : "Draw"}
          </p>
        ) : null}
      </div>
    </QuestionExperience>
  );
}

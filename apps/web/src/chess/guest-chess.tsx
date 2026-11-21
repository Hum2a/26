import { useEffect, useRef, useState } from "react";
import type { LobbySnapshot } from "@26/shared";
import { ChessGame } from "./chess-game";
import { ChessGuide } from "./chess-guide";
import { QuestionExperience } from "../play/question-experience";
import type { ChessMoveParams, ChessResignParams } from "../live/room-socket";

export function GuestChess({
  snapshot,
  pending,
  moveError,
  rejectedNonce,
  onChessMove,
  onChessResign,
}: {
  snapshot: LobbySnapshot;
  pending: boolean;
  moveError?: string;
  rejectedNonce?: number;
  onChessMove: (params: ChessMoveParams) => void;
  onChessResign: (params: ChessResignParams) => void;
}) {
  const play = snapshot.play;
  const chessSnapshot = play?.chess && "fen" in play.chess ? play.chess : undefined;
  const [engineError, setEngineError] = useState<string>();
  const pendingMoveRef = useRef<string | null>(null);
  const snapshotFen = chessSnapshot?.fen;
  const snapshotStatus = chessSnapshot?.status;
  const snapshotRevision = chessSnapshot?.positionRevision;

  useEffect(() => {
    pendingMoveRef.current = null;
  }, [snapshotFen, snapshotStatus, snapshotRevision, rejectedNonce, pending]);

  // Block play if no chess snapshot yet (backend not ready)
  if (!chessSnapshot) {
    return (
      <QuestionExperience snapshot={snapshot} pending={false}>
        <div className="chess-blocked">
          <h2>{play?.question.prompt ?? "Waiting for chess"}</h2>
          <p className="text-muted">The board opens when chess starts.</p>
        </div>
      </QuestionExperience>
    );
  }

  const open =
    snapshot.phase === "collect" &&
    !snapshot.paused &&
    !snapshot.held &&
    !chessSnapshot.isGameOver;

  function handleMove(
    from: string,
    to: string,
    promotion?: "q" | "r" | "b" | "n",
    positionRevision?: number,
  ) {
    if (!chessSnapshot || !open || pending) return;
    if (
      positionRevision !== undefined &&
      positionRevision !== chessSnapshot.positionRevision
    ) {
      return;
    }

    const revision = positionRevision ?? chessSnapshot.positionRevision;
    // Prevent duplicate submissions for the same position revision
    const moveKey = `${revision}:${from}-${to}-${promotion ?? ""}`;
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
      positionRevision: revision,
    });
  }

  function handleResign() {
    if (!chessSnapshot || !open || pending) return;
    onChessResign({
      gameId: chessSnapshot.gameId,
    });
  }

  return (
    <QuestionExperience snapshot={snapshot} pending={pending}>
      <div className="chess-phone-container">
        {engineError ? (
          <div className="chess-engine-error">
            <p className="text-destructive">{engineError}</p>
            <p className="text-muted text-sm">
              You can still play, but the computer won't respond automatically.
            </p>
          </div>
        ) : null}

        {moveError ? (
          <p className="chess-status text-destructive" role="status">
            {moveError}
          </p>
        ) : null}

        <ChessGame
          snapshot={chessSnapshot}
          onMove={handleMove}
          onResign={handleResign}
          disabled={!open}
          pending={pending}
          rejectedNonce={rejectedNonce}
          onEngineError={setEngineError}
        />

        <ChessGuide />

        {/* Sending and the result are drawn on the board itself. */}
        {snapshot.paused ? (
          <p className="chess-status">Game paused</p>
        ) : snapshot.held ? (
          <p className="chess-status">Round paused</p>
        ) : null}
      </div>
    </QuestionExperience>
  );
}

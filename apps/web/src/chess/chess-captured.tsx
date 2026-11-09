import type { ChessGuestSnapshot } from "@26/shared";

export function ChessCapturedScore({
  snapshot,
}: {
  snapshot: Pick<ChessGuestSnapshot, "capturedPoints" | "score" | "isGameOver">;
}) {
  const captured = `Captured: ${snapshot.capturedPoints} pts`;
  if (!snapshot.isGameOver) {
    return (
      <p className="chess-captured" role="status">
        {captured}
      </p>
    );
  }
  return (
    <p className="chess-captured" role="status">
      {captured}
      <span className="chess-captured-final">Final score: {snapshot.score} pts</span>
    </p>
  );
}

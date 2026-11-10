/**
 * Interactive chess board component for phone UI.
 * Displays position, handles move selection, shows clocks.
 */

import { useState, useCallback } from "react";
import type { ChessGuestSnapshot } from "@26/shared";

// Reserved for future rich board interaction
// type BoardSquare = {
//   file: string;
//   rank: number;
//   piece: string | null;
//   isLight: boolean;
//   isSelected: boolean;
//   isLegalMove: boolean;
// };

type ChessBoardProps = {
  snapshot: ChessGuestSnapshot;
  onMove: (from: string, to: string, promotion?: "q" | "r" | "b" | "n") => void;
  disabled?: boolean;
};

/**
 * Parse FEN to board state.
 */
function parseFen(fen: string): (string | null)[][] {
  const [position] = fen.split(" ");
  const ranks = position.split("/");
  const board: (string | null)[][] = [];

  for (const rank of ranks) {
    const row: (string | null)[] = [];
    for (const char of rank) {
      if (char >= "1" && char <= "8") {
        const empties = parseInt(char, 10);
        for (let i = 0; i < empties; i++) {
          row.push(null);
        }
      } else {
        row.push(char);
      }
    }
    board.push(row);
  }

  return board;
}

export function ChessBoard({ snapshot, onMove, disabled = false }: ChessBoardProps) {
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);

  const board = parseFen(snapshot.fen);
  const files = ["a", "b", "c", "d", "e", "f", "g", "h"];
  const ranks = [8, 7, 6, 5, 4, 3, 2, 1]; // Display from top (rank 8) to bottom (rank 1)

  const isPlayerTurn = snapshot.sideToMove === snapshot.playerColor;
  const isInteractive = !disabled && isPlayerTurn && !snapshot.isGameOver;

  const handleSquareClick = useCallback(
    (file: string, rank: number) => {
      if (!isInteractive) return;

      const square = `${file}${rank}`;

      // If a square is selected, attempt move
      if (selectedSquare) {
        // Let parent handle promotion detection and chooser
        onMove(selectedSquare, square);
        setSelectedSquare(null);
        return;
      }

      // Select a piece if it's the player's piece
      const clickedPiece = getPieceAt(board, square);
      if (clickedPiece) {
        const pieceColor =
          clickedPiece === clickedPiece.toUpperCase() ? "white" : "black";
        if (pieceColor === snapshot.playerColor) {
          setSelectedSquare(square);
          return;
        }
      }

      // Deselect
      setSelectedSquare(null);
    },
    [isInteractive, selectedSquare, board, snapshot, onMove],
  );

  return (
    <div className="chess-board-container">
      {/* Clocks */}
      <div className="chess-clocks">
        <div
          className={`chess-clock ${snapshot.sideToMove === snapshot.botColor ? "active" : ""}`}
        >
          <span className="clock-label">Bot</span>
          <span className="clock-time">{formatTime(snapshot.botTimeMs)}</span>
        </div>
        <div
          className={`chess-clock ${snapshot.sideToMove === snapshot.playerColor ? "active" : ""}`}
        >
          <span className="clock-label">You</span>
          <span className="clock-time">{formatTime(snapshot.playerTimeMs)}</span>
        </div>
      </div>

      {/* Status */}
      {snapshot.inCheck && !snapshot.isGameOver && (
        <div className="chess-status check">Check!</div>
      )}
      {snapshot.isGameOver && (
        <div className="chess-status game-over">
          {snapshot.winner === "player" && "You won!"}
          {snapshot.winner === "bot" && "Bot wins"}
          {snapshot.winner === "draw" && "Draw"}
        </div>
      )}

      {/* Board */}
      <div className="chess-board">
        {ranks.map((rank) => (
          <div key={rank} className="chess-rank">
            {files.map((file) => {
              const square = `${file}${rank}`;
              const piece = getPieceAt(board, square);
              const isLight = (files.indexOf(file) + rank) % 2 === 0;
              const isSelected = selectedSquare === square;

              return (
                <button
                  key={square}
                  type="button"
                  className={`chess-square ${isLight ? "light" : "dark"} ${
                    isSelected ? "selected" : ""
                  }`}
                  onClick={() => handleSquareClick(file, rank)}
                  disabled={!isInteractive}
                  aria-label={`${file}${rank}${piece ? ` ${getPieceName(piece)}` : ""}`}
                >
                  {piece && (
                    <span className="chess-piece">{getPieceSymbol(piece)}</span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* Turn indicator */}
      <div className="chess-turn-indicator">
        {!snapshot.isGameOver && (
          <span>
            {isPlayerTurn ? "Your turn" : "Bot is thinking..."}
            {!isPlayerTurn && <span className="thinking-spinner" />}
          </span>
        )}
        {snapshot.isGameOver && snapshot.terminationReason && (
          <span className="termination-reason">{snapshot.terminationReason}</span>
        )}
      </div>
    </div>
  );
}

function getPieceAt(board: (string | null)[][], square: string): string | null {
  const file = square.charCodeAt(0) - "a".charCodeAt(0);
  const rank = 8 - parseInt(square[1], 10);
  return board[rank]?.[file] ?? null;
}

function getPieceSymbol(piece: string): string {
  const symbols: Record<string, string> = {
    K: "♔",
    Q: "♕",
    R: "♖",
    B: "♗",
    N: "♘",
    P: "♙",
    k: "♚",
    q: "♛",
    r: "♜",
    b: "♝",
    n: "♞",
    p: "♟",
  };
  return symbols[piece] || piece;
}

function getPieceName(piece: string): string {
  const names: Record<string, string> = {
    K: "White King",
    Q: "White Queen",
    R: "White Rook",
    B: "White Bishop",
    N: "White Knight",
    P: "White Pawn",
    k: "Black King",
    q: "Black Queen",
    r: "Black Rook",
    b: "Black Bishop",
    n: "Black Knight",
    p: "Black Pawn",
  };
  return names[piece] || piece;
}

function formatTime(ms: number): string {
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

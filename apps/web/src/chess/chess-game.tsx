/**
 * Chess game phone UI - integrates board, engine, server commands.
 * Server authoritative for position, clocks, game state.
 * Client engine for bot moves only (casual trust).
 */

import { useState, useEffect, useRef, useCallback, type CSSProperties } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { contentColours } from "../theme/themes";
import { ChessBoard } from "./chess-board.tsx";
import { ChessClock } from "./chess-clocks.tsx";
import { StockfishEngine } from "./stockfish-worker.ts";
import { PromotionChooser } from "./promotion-chooser.tsx";
import { CapturedTray, ChessCapturedScore } from "./chess-captured.tsx";
import {
  applyPremovesToFen,
  fenAfter,
  normalizePremove,
  pieceSrc,
  resolvePremove,
  type BoardChange,
  type Premove,
} from "./board-model.ts";
import { createChessSound } from "./chess-sound.ts";
import "./chess.css";

/** The table keeps its wood, ivory and gold in every theme. */
const chessColours = {
  "--chess-ink": contentColours.chessInk,
  "--chess-ivory": contentColours.chessIvory,
  "--chess-gold": contentColours.chessGold,
  "--chess-select": contentColours.chessSelect,
  "--chess-check": contentColours.chessCheck,
  "--chess-win": contentColours.chessWin,
  "--chess-felt": contentColours.chessFelt,
  "--chess-light": contentColours.chessLight,
  "--chess-dark": contentColours.chessDark,
} as CSSProperties;
import type { ChessGuestSnapshot, ChessPromotionPiece } from "@26/shared";

export type ChessGameProps = {
  snapshot: ChessGuestSnapshot;
  onEngineError?: (error: string) => void;
  onMove: (
    from: string,
    to: string,
    promotion?: ChessPromotionPiece,
    positionRevision?: number,
  ) => void;
  onResign: () => void;
  disabled?: boolean;
  /** The player's move is on its way to the room. */
  pending?: boolean;
};

type PendingMove = {
  from: string;
  to: string;
  needsPromotion: boolean;
};

type SearchState = {
  generation: number;
  positionRevision: number;
  fen: string;
  startedAt: number;
};

export function ChessGame({
  snapshot,
  onMove,
  onResign,
  disabled = false,
  pending = false,
}: ChessGameProps) {
  const reduce = useReducedMotion() ?? false;
  // The move this phone last sent, and the position it was sent from.
  const [sent, setSent] = useState<{
    base: string;
    fen: string | null;
    move: Premove;
    revision: number;
    sawPending: boolean;
    fromPremove: boolean;
  } | null>(null);
  const [premoves, setPremoves] = useState<Premove[]>([]);
  const [processedRevision, setProcessedRevision] = useState<number | null>(null);
  const [trackedGameId, setTrackedGameId] = useState(snapshot.gameId);
  const [engineReady, setEngineReady] = useState(false);
  const [engineError, setEngineError] = useState<string | null>(null);
  const [retryAttempt, setRetryAttempt] = useState(0);
  const [pendingMove, setPendingMove] = useState<PendingMove | null>(null);
  const [showPromotionChooser, setShowPromotionChooser] = useState(false);

  // Instance refs (stable, not in dependencies)
  const engineInstanceRef = useRef<StockfishEngine | null>(null);
  const mountedRef = useRef(true);
  const dispatchedRevisionRef = useRef<number | null>(null);

  // Latest authoritative snapshot/handlers (for callbacks)
  const latestSnapshotRef = useRef(snapshot);
  const latestOnMoveRef = useRef(onMove);

  // Search state tracking
  const searchStateRef = useRef<SearchState | null>(null);
  const searchGenerationRef = useRef(0);

  // Keep callback refs current without reading them during render.
  useEffect(() => {
    latestSnapshotRef.current = snapshot;
    latestOnMoveRef.current = onMove;
  });

  // Engine lifecycle - stable init, no self-invalidating deps
  useEffect(() => {
    // Mark effect as active
    mountedRef.current = true;

    if (snapshot.isGameOver) {
      return;
    }

    // Guard: only one init attempt per mount+retry
    if (engineInstanceRef.current) {
      return;
    }

    // Effect-local cancellation tracking
    let cancelled = false;
    let capturedEngine: StockfishEngine | null = null;

    const initEngine = async () => {
      try {
        const newEngine = new StockfishEngine({
          elo: 1425,
          moveTimeMs: 2000,
          onReady: () => {
            // Handshake confirmation only. Ready state is set after this
            // effect still owns the instance and has stored it — never from
            // a callback that could race the effect's dependency array.
          },
          onBestMove: (from, to, promotion) => {
            if (!mountedRef.current) return;

            // Verify this bestmove is for current search
            const currentSearch = searchStateRef.current;
            if (!currentSearch) {
              console.warn("[Chess] Bestmove arrived but no active search");
              return;
            }

            // Guard: compare against captured immutable search state
            // AND verify latest snapshot still matches
            const latestSnap = latestSnapshotRef.current;
            if (
              currentSearch.fen !== latestSnap.fen ||
              currentSearch.positionRevision !== latestSnap.positionRevision
            ) {
              console.warn("[Chess] Stale bestmove - position changed", {
                searchFen: currentSearch.fen,
                latestFen: latestSnap.fen,
                searchRevision: currentSearch.positionRevision,
                latestRevision: latestSnap.positionRevision,
              });
              return;
            }

            // Submit with captured revision using latest handler
            latestOnMoveRef.current(
              from,
              to,
              promotion as ChessPromotionPiece | undefined,
              currentSearch.positionRevision,
            );
            searchStateRef.current = null;
          },
          onError: (error) => {
            if (mountedRef.current) {
              console.error("[Chess] Engine error:", error);
              setEngineError(error);
            }
          },
        });

        // Capture instance BEFORE await
        capturedEngine = newEngine;

        await newEngine.initialize();

        // Install the captured instance, then mark ready. Bot search depends
        // on engineReady; the ref must already be set when that state flips.
        if (!cancelled && mountedRef.current) {
          engineInstanceRef.current = newEngine;
          setEngineReady(true);
          setEngineError(null);
        } else {
          newEngine.terminate();
        }
      } catch (error) {
        if (!cancelled && mountedRef.current) {
          const message = error instanceof Error ? error.message : String(error);
          console.error("[Chess] Engine init failed:", message);
          setEngineError(message);
        }
      }
    };

    initEngine();

    return () => {
      // Mark effect as cancelled
      cancelled = true;
      mountedRef.current = false;

      // Terminate captured instance if init is pending
      if (capturedEngine) {
        capturedEngine.terminate();
      }

      // Clear ref only if it still holds this effect's instance
      if (engineInstanceRef.current === capturedEngine) {
        engineInstanceRef.current = null;
      }
    };
  }, [snapshot.isGameOver, retryAttempt]);

  // Retry handler - clears error and triggers new init
  const handleRetryEngine = useCallback(() => {
    setEngineError(null);
    setEngineReady(false);
    setRetryAttempt((prev) => prev + 1);

    // Terminate failed instance if exists
    if (engineInstanceRef.current) {
      engineInstanceRef.current.terminate();
      engineInstanceRef.current = null;
    }
  }, []);

  // Bot move trigger - when bot's turn and engine ready
  useEffect(() => {
    const engine = engineInstanceRef.current;
    if (!engine || !engineReady || snapshot.isGameOver) {
      return;
    }

    if (snapshot.sideToMove === snapshot.botColor) {
      // Cancel any previous search
      if (searchStateRef.current) {
        engine.stop();
        searchGenerationRef.current += 1;
      }

      // Calculate remaining time for bot (bounded)
      const botTimeRemaining = snapshot.botTimeMs;
      const moveTime = Math.max(100, Math.min(botTimeRemaining - 100, 2000));

      // Capture search state AT DISPATCH - immutable
      searchStateRef.current = {
        generation: searchGenerationRef.current,
        positionRevision: snapshot.positionRevision,
        fen: snapshot.fen,
        startedAt: Date.now(),
      };

      // Set position and start search
      engine.setPosition(snapshot.fen);
      engine.go(moveTime);

      // Watchdog: cancel if no response within reasonable time
      const watchdog = setTimeout(() => {
        if (searchStateRef.current?.generation === searchGenerationRef.current) {
          console.warn("[Chess] Search watchdog timeout");
          engine.stop();
          searchStateRef.current = null;
        }
      }, moveTime + 5000);

      return () => {
        clearTimeout(watchdog);
      };
    }
  }, [
    snapshot.fen,
    snapshot.positionRevision,
    snapshot.sideToMove,
    snapshot.botColor,
    snapshot.isGameOver,
    snapshot.botTimeMs,
    engineReady,
  ]);

  // Clear search state on position change
  useEffect(() => {
    return () => {
      const engine = engineInstanceRef.current;
      if (engine) {
        engine.stop();
      }
      searchStateRef.current = null;
    };
  }, [snapshot.positionRevision]);

  // The player asked for a move: a pawn reaching the last rank picks a piece first.
  const requestMove = useCallback(
    (from: string, to: string) => {
      if (
        disabled ||
        snapshot.isGameOver ||
        snapshot.paused ||
        snapshot.sideToMove !== snapshot.playerColor
      ) {
        return;
      }
      const piece = getPieceAt(snapshot.fen, from);
      const isPromotion =
        piece?.toLowerCase() === "p" &&
        ((snapshot.playerColor === "white" && to[1] === "8") ||
          (snapshot.playerColor === "black" && to[1] === "1"));
      if (isPromotion) {
        setPendingMove({ from, to, needsPromotion: true });
        setShowPromotionChooser(true);
        return;
      }
      const nextFen = fenAfter(snapshot.fen, from, to);
      dispatchedRevisionRef.current = snapshot.positionRevision;
      setProcessedRevision(snapshot.positionRevision);
      setSent({
        base: snapshot.fen,
        fen: nextFen,
        move: { from, to },
        revision: snapshot.positionRevision,
        sawPending: pending,
        fromPremove: false,
      });
      onMove(from, to, undefined, snapshot.positionRevision);
    },
    [disabled, pending, snapshot, onMove],
  );

  const handlePromotion = useCallback(
    (piece: ChessPromotionPiece) => {
      if (pendingMove) {
        const nextFen = fenAfter(snapshot.fen, pendingMove.from, pendingMove.to, piece);
        dispatchedRevisionRef.current = snapshot.positionRevision;
        setProcessedRevision(snapshot.positionRevision);
        setSent({
          base: snapshot.fen,
          fen: nextFen,
          move: { from: pendingMove.from, to: pendingMove.to, promotion: piece },
          revision: snapshot.positionRevision,
          sawPending: pending,
          fromPremove: false,
        });
        onMove(pendingMove.from, pendingMove.to, piece, snapshot.positionRevision);
        setPendingMove(null);
        setShowPromotionChooser(false);
      }
    },
    [pending, pendingMove, snapshot.fen, snapshot.positionRevision, onMove],
  );

  const handleCancelPromotion = useCallback(() => {
    setPendingMove(null);
    setShowPromotionChooser(false);
  }, []);

  if (trackedGameId !== snapshot.gameId) {
    setTrackedGameId(snapshot.gameId);
    setPremoves([]);
    setSent(null);
    setProcessedRevision(null);
    setPendingMove(null);
    setShowPromotionChooser(false);
  }

  if (snapshot.isGameOver && (premoves.length > 0 || showPromotionChooser)) {
    setPremoves([]);
    setPendingMove(null);
    setShowPromotionChooser(false);
  }

  if (sent && pending && !sent.sawPending) {
    setSent({ ...sent, sawPending: true });
  }

  if (sent && sent.sawPending && !pending && sent.base === snapshot.fen) {
    setSent(null);
    if (premoves.length > 0) {
      setPremoves([]);
    }
  }

  // The player's own move is drawn at once while the room confirms it. It is
  // marked as sending, and falls back if the room does not accept it.
  const showSent =
    sent !== null &&
    sent.fen !== null &&
    sent.base === snapshot.fen &&
    sent.revision === snapshot.positionRevision &&
    (pending || sent.fromPremove);

  const canExecutePremove =
    !disabled &&
    !pending &&
    !showSent &&
    !snapshot.isGameOver &&
    !snapshot.paused &&
    snapshot.sideToMove === snapshot.playerColor;

  if (
    canExecutePremove &&
    premoves.length > 0 &&
    processedRevision !== snapshot.positionRevision
  ) {
    setProcessedRevision(snapshot.positionRevision);
    const resolved = resolvePremove(snapshot.fen, premoves[0]!, snapshot.playerColor);
    if (resolved) {
      setPremoves(premoves.slice(1));
      setSent({
        base: snapshot.fen,
        fen: resolved.nextFen,
        move: {
          from: resolved.from,
          to: resolved.to,
          promotion: resolved.promotion,
        },
        revision: snapshot.positionRevision,
        sawPending: pending,
        fromPremove: true,
      });
    } else {
      setPremoves([]);
    }
  }

  useEffect(() => {
    if (
      sent &&
      sent.fromPremove &&
      sent.revision === snapshot.positionRevision &&
      dispatchedRevisionRef.current !== sent.revision
    ) {
      dispatchedRevisionRef.current = sent.revision;
      latestOnMoveRef.current(
        sent.move.from,
        sent.move.to,
        sent.move.promotion as ChessPromotionPiece | undefined,
        sent.revision,
      );
    }
  }, [sent, snapshot.positionRevision]);

  const boardFen = showSent ? sent.fen! : snapshot.fen;
  const white = snapshot.playerColor === "white";
  const own = white ? "w" : "b";

  const requestPremove = useCallback(
    (from: string, to: string) => {
      if (disabled || snapshot.isGameOver || snapshot.paused) {
        return;
      }
      setPremoves((current) => {
        const currentFen = applyPremovesToFen(boardFen, current, own);
        const next = normalizePremove(currentFen, from, to, own);
        if (!next) return current;
        return [...current, next];
      });
    },
    [disabled, snapshot.isGameOver, snapshot.paused, boardFen, own],
  );

  const clearPremoves = useCallback(() => {
    setPremoves([]);
  }, []);

  // Sound: optional, unlocked by the first touch, remembered when muted.
  const [sound] = useState(createChessSound);
  const [muted, setMuted] = useState(() => sound.muted);
  useEffect(() => () => sound.dispose(), [sound]);

  const onBoardChange = useCallback(
    (change: BoardChange) => {
      sound.play(
        change.kind === "capture"
          ? "capture"
          : change.kind === "castle"
            ? "castle"
            : change.kind === "promote"
              ? "promote"
              : "move",
      );
    },
    [sound],
  );
  useEffect(() => {
    if (snapshot.inCheck && !snapshot.isGameOver) sound.play("check");
  }, [snapshot.inCheck, snapshot.isGameOver, snapshot.plyCount, sound]);
  useEffect(() => {
    if (!snapshot.isGameOver) return;
    sound.play(snapshot.winner === "player" ? "win" : "lose");
  }, [snapshot.isGameOver, snapshot.winner, sound]);
  const onLowTime = useCallback(() => sound.play("low-time"), [sound]);

  const playerTurn = snapshot.sideToMove === snapshot.playerColor && !showSent;
  const interactive =
    !disabled &&
    !pending &&
    engineReady &&
    playerTurn &&
    !snapshot.isGameOver &&
    !snapshot.paused;
  const premovable =
    !disabled && !snapshot.isGameOver && !snapshot.paused && (!playerTurn || pending);

  const premoveLabel =
    premoves.length === 1
      ? "Premove queued"
      : premoves.length > 1
        ? `${premoves.length} premoves queued`
        : null;

  const status = snapshot.isGameOver
    ? ""
    : engineError
      ? "The computer could not start."
      : !engineReady
        ? premoveLabel
          ? `${premoveLabel} — Loading chess engine...`
          : "Loading chess engine..."
        : pending
          ? premoveLabel
            ? `Sending your move… (${premoveLabel.toLowerCase()})`
            : "Sending your move…"
          : snapshot.paused
            ? "Paused"
            : playerTurn
              ? snapshot.inCheck
                ? "Check! Your move."
                : "Your move"
              : premoveLabel
                ? `${premoveLabel} — Stockfish is thinking…`
                : "Stockfish is thinking…";

  return (
    <div className="chess-game" style={chessColours}>
      <div
        className="chess-plate"
        data-side="bot"
        data-active={!playerTurn || undefined}
      >
        <img
          className="chess-plate-face"
          src={pieceSrc(white ? "b" : "w", "k")}
          alt=""
          draggable={false}
        />
        <div className="chess-plate-who">
          <span className="chess-plate-name">Stockfish</span>
          <CapturedTray
            fen={boardFen}
            colour={white ? "w" : "b"}
            label="Taken from you"
          />
        </div>
        <ChessClock snapshot={snapshot} side="bot" />
      </div>

      <div className="chess-table">
        <ChessBoard
          fen={boardFen}
          playerColor={snapshot.playerColor}
          inCheck={snapshot.inCheck && !showSent}
          sideToMove={snapshot.sideToMove}
          interactive={interactive}
          premovable={premovable}
          premoves={premoves}
          sending={pending && showSent}
          onMove={requestMove}
          onPremove={requestPremove}
          onClearPremoves={clearPremoves}
          onChange={onBoardChange}
          onTouch={sound.unlock}
        />
        <AnimatePresence>
          {snapshot.isGameOver ? (
            <motion.div
              key="over"
              className="chess-over"
              data-result={snapshot.winner ?? "none"}
              role="status"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.35, ease: "easeOut" }}
            >
              {snapshot.winner === "player" && !reduce ? <Confetti /> : null}
              <motion.div
                className="chess-over-card"
                initial={{ opacity: 0, y: reduce ? 0 : 24, scale: reduce ? 1 : 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={
                  reduce
                    ? { duration: 0.2 }
                    : { type: "spring", stiffness: 320, damping: 22, delay: 0.15 }
                }
              >
                <p className="chess-over-title">{resultTitle(snapshot)}</p>
                {snapshot.terminationReason ? (
                  <p className="chess-over-reason">{snapshot.terminationReason}</p>
                ) : null}
                <p className="chess-over-score">
                  <strong>{snapshot.score}</strong> pts
                </p>
              </motion.div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      <div
        className="chess-plate"
        data-side="you"
        data-active={playerTurn || undefined}
      >
        <img
          className="chess-plate-face"
          src={pieceSrc(white ? "w" : "b", "k")}
          alt=""
          draggable={false}
        />
        <div className="chess-plate-who">
          <span className="chess-plate-name">You</span>
          <CapturedTray
            fen={boardFen}
            colour={white ? "b" : "w"}
            label="You have taken"
          />
        </div>
        <ChessClock snapshot={snapshot} side="player" onLowTime={onLowTime} />
      </div>

      <div className="chess-foot">
        <ChessCapturedScore snapshot={snapshot} />
        {!snapshot.isGameOver ? (
          <div className="engine-status" role="status" aria-live="polite">
            <motion.span
              key={status}
              className="chess-status-line"
              data-thinking={status.includes("Stockfish is thinking") || undefined}
              initial={{ opacity: 0, y: reduce ? 0 : 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18 }}
            >
              {status}
              {!engineReady && !engineError && retryAttempt > 0 ? (
                <span> (attempt {retryAttempt + 1})</span>
              ) : null}
            </motion.span>
            {engineError ? (
              <div className="engine-status-error">
                <p>Engine failed: {engineError}</p>
                <button
                  type="button"
                  onClick={handleRetryEngine}
                  className="engine-retry-button"
                  aria-label="Retry loading engine"
                >
                  Retry
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
        <div className="chess-controls">
          {!snapshot.isGameOver && premoves.length > 0 ? (
            <button
              type="button"
              onClick={clearPremoves}
              className="chess-tool chess-premove-cancel"
              aria-label="Cancel premove"
            >
              {premoves.length === 1
                ? "Cancel premove"
                : `Cancel premoves (${premoves.length})`}
            </button>
          ) : null}
          <button
            type="button"
            className="chess-tool"
            aria-pressed={!muted}
            onClick={() => {
              sound.unlock();
              sound.setMuted(!muted);
              setMuted(!muted);
            }}
          >
            {muted ? "Sound off" : "Sound on"}
          </button>
          {!snapshot.isGameOver ? (
            <button
              type="button"
              onClick={() => {
                clearPremoves();
                onResign();
              }}
              disabled={disabled}
              className="chess-tool chess-resign-button"
              aria-label="Resign from game"
            >
              Resign
            </button>
          ) : null}
        </div>
      </div>

      <AnimatePresence>
        {showPromotionChooser ? (
          <PromotionChooser
            key="promotion"
            color={snapshot.playerColor}
            onChoose={handlePromotion}
            onCancel={handleCancelPromotion}
          />
        ) : null}
      </AnimatePresence>
    </div>
  );
}

/** A short burst for a win. Decoration only; skipped under reduced motion. */
function Confetti() {
  return (
    <span className="chess-confetti" aria-hidden="true">
      {Array.from({ length: 28 }, (_, index) => (
        <i
          key={index}
          style={
            {
              "--angle": `${(index * 360) / 28 + (index % 3) * 7}deg`,
              "--reach": `${5 + (index % 5) * 1.2}rem`,
              "--tone": index % 4,
              "--delay": `${(index % 7) * 0.03}s`,
            } as CSSProperties
          }
        />
      ))}
    </span>
  );
}

function getPieceAt(fen: string, square: string): string | null {
  const [position] = fen.split(" ");
  const ranks = position.split("/");
  const file = square.charCodeAt(0) - "a".charCodeAt(0);
  const rank = 8 - parseInt(square[1], 10);

  let fileIndex = 0;
  for (const char of ranks[rank]) {
    if (char >= "1" && char <= "8") {
      fileIndex += parseInt(char, 10);
    } else {
      if (fileIndex === file) {
        return char;
      }
      fileIndex++;
    }
  }
  return null;
}

function resultTitle(snapshot: ChessGuestSnapshot): string {
  if (snapshot.winner === "player") return "You won!";
  if (snapshot.winner === "bot") return "Stockfish wins";
  if (snapshot.winner === "draw") return "Draw";
  return "Game over";
}

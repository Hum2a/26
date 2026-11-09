/**
 * Chess game phone UI - integrates board, engine, server commands.
 * Server authoritative for position, clocks, game state.
 * Client engine for bot moves only (casual trust).
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { ChessBoard } from "./chess-board.tsx";
import { StockfishEngine } from "./stockfish-worker.ts";
import { PromotionChooser } from "./promotion-chooser.tsx";
import type { ChessGuestSnapshot, ChessPromotionPiece } from "@26/shared";

export type ChessGameProps = {
  snapshot: ChessGuestSnapshot;
  onEngineError?: (error: string) => void;
  onMove: (from: string, to: string, promotion?: ChessPromotionPiece, positionRevision?: number) => void;
  onResign: () => void;
  disabled?: boolean;
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

export function ChessGame({ snapshot, onMove, onResign, disabled = false }: ChessGameProps) {
  const [engine, setEngine] = useState<StockfishEngine | null>(null);
  const [engineReady, setEngineReady] = useState(false);
  const [engineError, setEngineError] = useState<string | null>(null);
  const [initializingEngine, setInitializingEngine] = useState(false);
  const [retryAttempt, setRetryAttempt] = useState(0);
  const [pendingMove, setPendingMove] = useState<PendingMove | null>(null);
  const [showPromotionChooser, setShowPromotionChooser] = useState(false);
  
  // Search generation tracking - prevents stale bestmove from old searches
  const searchStateRef = useRef<SearchState | null>(null);
  const searchGenerationRef = useRef(0);
  const mountedRef = useRef(true);
  
  // Engine lifecycle - one worker per active phone, with retry on failure
  useEffect(() => {
    if (snapshot.isGameOver || engineReady || initializingEngine) {
      return;
    }

    mountedRef.current = true;
    setInitializingEngine(true);
    setEngineError(null);

    const initEngine = async () => {
      try {
        const newEngine = new StockfishEngine({
          elo: 1425,
          moveTimeMs: 2000, // Default, overridden per-move
          onReady: () => {
            if (mountedRef.current) {
              setEngineReady(true);
              setInitializingEngine(false);
              setRetryAttempt(0); // Reset on success
            }
          },
          onBestMove: (from, to, promotion) => {
            if (!mountedRef.current) return;
            
            // Verify this bestmove is for current search
            const currentSearch = searchStateRef.current;
            if (!currentSearch) {
              console.warn('[Chess] Bestmove arrived but no active search');
              return;
            }

            // Guard: only process if position unchanged since search started
            if (currentSearch.fen !== snapshot.fen || 
                currentSearch.positionRevision !== snapshot.positionRevision) {
              console.warn('[Chess] Stale bestmove - position changed', {
                searchFen: currentSearch.fen,
                currentFen: snapshot.fen,
                searchRevision: currentSearch.positionRevision,
                currentRevision: snapshot.positionRevision
              });
              return;
            }

            // Submit bot move to server with captured positionRevision
            onMove(from, to, promotion as ChessPromotionPiece | undefined, currentSearch.positionRevision);
            searchStateRef.current = null;
          },
          onError: (error) => {
            if (mountedRef.current) {
              console.error('[Chess] Engine error:', error);
              setEngineError(error);
              setInitializingEngine(false);
            }
          }
        });

        await newEngine.initialize();
        
        if (mountedRef.current) {
          setEngine(newEngine);
        } else {
          newEngine.terminate();
        }
      } catch (error) {
        if (mountedRef.current) {
          const message = error instanceof Error ? error.message : String(error);
          console.error('[Chess] Engine init failed:', message);
          setEngineError(message);
          setInitializingEngine(false);
        }
      }
    };

    initEngine();

    return () => {
      mountedRef.current = false;
      if (engine) {
        engine.terminate();
      }
    };
  }, [snapshot.isGameOver, engineReady, initializingEngine, retryAttempt]);

  // Retry handler - clears error and triggers new init
  const handleRetryEngine = useCallback(() => {
    setEngineError(null);
    setEngineReady(false);
    setInitializingEngine(false);
    setRetryAttempt((prev) => prev + 1);
    
    // Terminate failed engine if exists
    if (engine) {
      engine.terminate();
      setEngine(null);
    }
  }, [engine]);

  // Bot move trigger - when bot's turn and engine ready
  useEffect(() => {
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

      // Capture search state AT DISPATCH - not when bestmove returns
      searchStateRef.current = {
        generation: searchGenerationRef.current,
        positionRevision: snapshot.positionRevision,
        fen: snapshot.fen,
        startedAt: Date.now()
      };

      // Set position and start search
      engine.setPosition(snapshot.fen);
      engine.go(moveTime);

      // Watchdog: cancel if no response within reasonable time
      const watchdog = setTimeout(() => {
        if (searchStateRef.current?.generation === searchGenerationRef.current) {
          console.warn('[Chess] Search watchdog timeout');
          engine.stop();
          searchStateRef.current = null;
        }
      }, moveTime + 5000);

      return () => {
        clearTimeout(watchdog);
      };
    }
  }, [snapshot.fen, snapshot.positionRevision, snapshot.sideToMove, snapshot.botColor, 
      snapshot.isGameOver, snapshot.botTimeMs, engine, engineReady]);

  // Clear search state on unmount or position change
  useEffect(() => {
    return () => {
      if (engine) {
        engine.stop();
      }
      searchStateRef.current = null;
    };
  }, [snapshot.positionRevision]);

  const handleSquareClick = useCallback((from: string, to: string) => {
    if (disabled || snapshot.isGameOver || snapshot.sideToMove !== snapshot.playerColor) {
      return;
    }

    // Check if move needs promotion (pawn to 8th/1st rank)
    const piece = getPieceAt(snapshot.fen, from);
    const isPromotion = piece?.toLowerCase() === 'p' && 
                       ((snapshot.playerColor === 'white' && to[1] === '8') ||
                        (snapshot.playerColor === 'black' && to[1] === '1'));

    if (isPromotion) {
      setPendingMove({ from, to, needsPromotion: true });
      setShowPromotionChooser(true);
    } else {
      // Submit immediately with current positionRevision
      onMove(from, to, undefined, snapshot.positionRevision);
    }
  }, [disabled, snapshot, onMove]);

  const handlePromotion = useCallback((piece: ChessPromotionPiece) => {
    if (pendingMove) {
      onMove(pendingMove.from, pendingMove.to, piece, snapshot.positionRevision);
      setPendingMove(null);
      setShowPromotionChooser(false);
    }
  }, [pendingMove, snapshot.positionRevision, onMove]);

  const handleCancelPromotion = useCallback(() => {
    setPendingMove(null);
    setShowPromotionChooser(false);
  }, []);

  return (
    <div className="chess-game">
      {/* Engine status indicator */}
      {!snapshot.isGameOver && (
        <div className="engine-status" role="status" aria-live="polite">
          {engineError && (
            <div className="engine-status-error">
              <p className="text-destructive">
                <span role="img" aria-label="warning">⚠️</span> Engine failed: {engineError}
              </p>
              <button
                type="button"
                onClick={handleRetryEngine}
                className="engine-retry-button"
                aria-label="Retry loading engine"
              >
                Retry
              </button>
            </div>
          )}
          {initializingEngine && (
            <div className="engine-status-loading">
              <span role="img" aria-label="loading">⏳</span> Loading chess engine...
              {retryAttempt > 0 && <span> (attempt {retryAttempt + 1})</span>}
            </div>
          )}
          {engineReady && snapshot.sideToMove === snapshot.botColor && (
            <div className="engine-status-thinking">
              <span role="img" aria-label="bot thinking">🤖</span> Bot thinking...
            </div>
          )}
        </div>
      )}

      <ChessBoard
        snapshot={snapshot}
        onMove={handleSquareClick}
        disabled={disabled || !engineReady || snapshot.sideToMove !== snapshot.playerColor}
      />

      {/* Promotion chooser modal */}
      {showPromotionChooser && (
        <PromotionChooser
          color={snapshot.playerColor}
          onChoose={handlePromotion}
          onCancel={handleCancelPromotion}
        />
      )}

      {/* Game controls */}
      <div className="chess-controls">
        {!snapshot.isGameOver && (
          <button
            type="button"
            onClick={onResign}
            disabled={disabled || !engineReady}
            className="chess-resign-button"
            aria-label="Resign from game"
          >
            Resign
          </button>
        )}
        
        {snapshot.isGameOver && (
          <div className="chess-game-over" role="status">
            <p className="result">{formatGameResult(snapshot)}</p>
            {snapshot.terminationReason && (
              <p className="reason text-muted">{snapshot.terminationReason}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function getPieceAt(fen: string, square: string): string | null {
  const [position] = fen.split(' ');
  const ranks = position.split('/');
  const file = square.charCodeAt(0) - 'a'.charCodeAt(0);
  const rank = 8 - parseInt(square[1], 10);
  
  let fileIndex = 0;
  for (const char of ranks[rank]) {
    if (char >= '1' && char <= '8') {
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

function formatGameResult(snapshot: ChessGuestSnapshot): string {
  if (snapshot.winner === 'player') return '🎉 You won!';
  if (snapshot.winner === 'bot') return '😔 Bot wins';
  if (snapshot.winner === 'draw') return '🤝 Draw';
  return 'Game over';
}

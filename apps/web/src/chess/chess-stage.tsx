import type { ChessStageSnapshot } from "@26/shared";
import { motion, AnimatePresence } from "motion/react";
import "./chess.css";

export function ChessStage({ snapshot }: { snapshot: ChessStageSnapshot }) {
  const { totalGames, inProgress, finished, results, recentEvents } = snapshot;
  const latestEvents = recentEvents.slice(-5).reverse();

  return (
    <div className="chess-stage-container">
      <div className="chess-stage-header">
        <h1 className="chess-stage-title">Chess Round</h1>
        <p className="chess-stage-subtitle">Everyone vs Stockfish • 1+0 Blitz</p>
      </div>

      <div className="chess-stage-stats">
        <div className="chess-stat-card">
          <div className="chess-stat-value">{totalGames}</div>
          <div className="chess-stat-label">Total Games</div>
        </div>
        <div className="chess-stat-card chess-stat-highlight">
          <div className="chess-stat-value">{inProgress}</div>
          <div className="chess-stat-label">In Progress</div>
        </div>
        <div className="chess-stat-card">
          <div className="chess-stat-value">{finished}</div>
          <div className="chess-stat-label">Finished</div>
        </div>
      </div>

      <div className="chess-stage-results">
        <h2 className="chess-results-title">Results</h2>
        <div className="chess-results-grid">
          <div className="chess-result-item chess-result-win">
            <div className="chess-result-count">{results.playerWins}</div>
            <div className="chess-result-label">Player Wins</div>
          </div>
          <div className="chess-result-item chess-result-loss">
            <div className="chess-result-count">{results.botWins}</div>
            <div className="chess-result-label">Bot Wins</div>
          </div>
          <div className="chess-result-item chess-result-draw">
            <div className="chess-result-count">{results.draws}</div>
            <div className="chess-result-label">Draws</div>
          </div>
          <div className="chess-result-item chess-result-abort">
            <div className="chess-result-count">{results.aborts}</div>
            <div className="chess-result-label">Aborted</div>
          </div>
        </div>
      </div>

      {latestEvents.length > 0 ? (
        <div className="chess-stage-events">
          <h2 className="chess-events-title">Recent Finishes</h2>
          <AnimatePresence mode="popLayout">
            {latestEvents.map((event) => (
              <motion.div
                key={`${event.playerId}-${event.timestamp}`}
                className={`chess-event-card chess-event-${event.event}`}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.3 }}
              >
                <div className="chess-event-player">{event.nickname}</div>
                <div className="chess-event-type">
                  {event.event === "checkmate-win"
                    ? "Checkmate!"
                    : event.event === "checkmate-loss"
                      ? "Checkmated"
                      : event.event === "draw"
                        ? "Draw"
                        : event.event === "timeout"
                          ? "Time out"
                          : event.event === "resign"
                            ? "Resigned"
                            : "Aborted"}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      ) : null}
    </div>
  );
}

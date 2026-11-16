import type { CSSProperties } from "react";
import NumberFlow from "@number-flow/react";
import type { ChessControlSnapshot, ChessStageSnapshot } from "@26/shared";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { contentColours } from "../theme/themes";
import { PlayerAvatar } from "../ui/player-avatar";
import { pieceSrc, type PieceKind } from "./board-model";
import "./chess.css";
import "./chess-stage.css";

const hallColours = {
  "--chess-ink": contentColours.chessInk,
  "--chess-ivory": contentColours.chessIvory,
  "--chess-gold": contentColours.chessGold,
  "--chess-select": contentColours.chessSelect,
  "--chess-check": contentColours.chessCheck,
  "--chess-win": contentColours.chessWin,
  "--chess-felt": contentColours.chessFelt,
} as CSSProperties;

const crest: PieceKind[] = ["r", "n", "b", "q", "k", "b", "n", "r"];

const eventText = {
  "checkmate-win": "Checkmate!",
  "checkmate-loss": "Checkmated",
  draw: "Draw",
  timeout: "Time out",
  resign: "Resigned",
  abort: "Aborted",
} as const;

/**
 * The big screen during the chess round. The room sends totals, a points
 * table and recent finishes, never anyone's board, so this is a tournament
 * hall: who is ahead, who just finished, and how the room is doing against
 * Stockfish.
 */
export function ChessStage({
  snapshot,
}: {
  snapshot: ChessStageSnapshot | ChessControlSnapshot;
}) {
  const reduce = useReducedMotion() ?? false;
  const { totalGames, inProgress, finished, results, recentEvents, standings } =
    snapshot;
  const latestEvents = recentEvents.slice(-4).reverse();
  const control = "gameStatuses" in snapshot ? snapshot : null;
  const top = Math.max(
    1,
    ...standings.map((row) => Math.max(row.score, row.capturedPoints)),
  );

  return (
    <div className="chess-hall" style={hallColours}>
      <header className="chess-hall-head">
        <div className="chess-hall-crest" aria-hidden="true">
          {crest.map((kind, index) => (
            <motion.img
              key={index}
              src={pieceSrc(index < 4 ? "w" : "b", kind)}
              alt=""
              draggable={false}
              initial={{ opacity: 0, y: reduce ? 0 : 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={
                reduce
                  ? { duration: 0.2 }
                  : { type: "spring", stiffness: 300, damping: 20, delay: index * 0.06 }
              }
            />
          ))}
        </div>
        <h1 className="chess-hall-title">Chess Round</h1>
        <p className="chess-hall-subtitle">
          Everyone vs Stockfish · 1 minute each · Capture Black pieces for points
        </p>
      </header>

      <div className="chess-hall-stats">
        <Stat value={inProgress} label="Playing" live />
        <Stat value={finished} label="Finished" />
        <Stat value={results.playerWins} label="Beat the bot" tone="win" />
        <Stat value={results.botWins} label="Lost to the bot" tone="loss" />
        <Stat value={results.draws} label="Draws" />
        {results.aborts > 0 ? <Stat value={results.aborts} label="Aborted" /> : null}
      </div>
      <p className="chess-hall-total">
        <NumberFlow value={totalGames} /> {totalGames === 1 ? "board" : "boards"} in
        play
      </p>

      <div className="chess-hall-body">
        {standings.length > 0 ? (
          <section className="chess-hall-panel" aria-label="Captured points">
            <h2>Captured points</h2>
            <ol className="chess-hall-table">
              <AnimatePresence initial={false}>
                {standings.map((row, index) => {
                  const points = row.finished ? row.score : row.capturedPoints;
                  return (
                    <motion.li
                      key={row.playerId}
                      layout={reduce ? false : "position"}
                      className="chess-hall-row"
                      data-finished={row.finished || undefined}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ type: "spring", stiffness: 380, damping: 32 }}
                    >
                      <span className="chess-hall-place">{index + 1}</span>
                      <PlayerAvatar
                        playerId={row.playerId}
                        nickname={row.nickname}
                        size="sm"
                      />
                      <span className="chess-hall-name">{row.nickname}</span>
                      <span className="chess-hall-bar" aria-hidden="true">
                        <span style={{ transform: `scaleX(${points / top})` }} />
                      </span>
                      <span className="chess-hall-points">
                        {row.finished ? "" : "Captured: "}
                        <NumberFlow value={points} /> pts
                      </span>
                    </motion.li>
                  );
                })}
              </AnimatePresence>
            </ol>
          </section>
        ) : null}

        {latestEvents.length > 0 ? (
          <section className="chess-hall-panel" aria-label="Recent finishes">
            <h2>Recent finishes</h2>
            <AnimatePresence mode="popLayout" initial={false}>
              {latestEvents.map((event) => (
                <motion.div
                  key={`${event.playerId}-${event.timestamp}`}
                  layout={reduce ? false : "position"}
                  className="chess-hall-event"
                  data-event={event.event}
                  initial={{ opacity: 0, x: reduce ? 0 : -30 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ type: "spring", stiffness: 360, damping: 30 }}
                >
                  <img
                    src={pieceSrc(event.event === "checkmate-win" ? "w" : "b", "k")}
                    alt=""
                    draggable={false}
                  />
                  <span className="chess-hall-name">{event.nickname}</span>
                  <span className="chess-hall-verdict">
                    {eventText[event.event]}
                    {` · ${event.score} pts`}
                  </span>
                </motion.div>
              ))}
            </AnimatePresence>
          </section>
        ) : null}
      </div>

      {control ? (
        <section className="chess-hall-panel" aria-label="Boards">
          <h2>Boards</h2>
          <ol className="chess-hall-table">
            {control.gameStatuses.map((row) => (
              <li key={row.playerId} className="chess-hall-row">
                <span className="chess-hall-name">{row.nickname}</span>
                <span className="chess-hall-points">
                  Captured: {row.capturedPoints} pts · {row.score} pts
                </span>
              </li>
            ))}
          </ol>
        </section>
      ) : null}
    </div>
  );
}

function Stat({
  value,
  label,
  tone,
  live = false,
}: {
  value: number;
  label: string;
  tone?: "win" | "loss";
  live?: boolean;
}) {
  return (
    <div className="chess-hall-stat" data-tone={tone} data-live={live || undefined}>
      <span className="chess-hall-stat-value">
        <NumberFlow value={value} />
      </span>
      <span className="chess-hall-stat-label">{label}</span>
    </div>
  );
}

import NumberFlow from "@number-flow/react";
import type { ChessHighlights, ChessStageSnapshot } from "@26/shared";
import { motion, AnimatePresence } from "motion/react";
import { PlayerAvatar } from "../ui/player-avatar";

type StandingRow = ChessStageSnapshot["standings"][number];

export function seconds(ms: number): string {
  return `${(ms / 1000).toFixed(ms < 10_000 ? 1 : 0)}s`;
}

/**
 * The room's fun facts: totals across every board plus three named records.
 * Only aggregate counts and nicknames, never a board.
 */
export function Highlights({
  highlights,
  reduce,
}: {
  highlights: ChessHighlights;
  reduce: boolean;
}) {
  const cards = [
    { key: "captured", label: "Points stolen from Stockfish", value: highlights.roomCaptured },
    { key: "queens", label: "Queens taken", value: highlights.queensTaken },
    { key: "moves", label: "Moves played", value: highlights.movesPlayed },
    { key: "time", label: "Beat the bot on time", value: highlights.timeWins },
  ];
  const records = [
    highlights.biggestHaul && {
      key: "haul",
      label: "Biggest haul",
      who: highlights.biggestHaul.nickname,
      text: `${highlights.biggestHaul.value} pts`,
    },
    highlights.fastestWin && {
      key: "fastest",
      label: "Fastest win",
      who: highlights.fastestWin.nickname,
      text: seconds(highlights.fastestWin.value),
    },
    highlights.longestGame && {
      key: "longest",
      label: "Most moves",
      who: highlights.longestGame.nickname,
      text: `${highlights.longestGame.value} moves`,
    },
  ].filter((record) => Boolean(record)) as {
    key: string;
    label: string;
    who: string;
    text: string;
  }[];
  const spring = reduce
    ? { duration: 0.2 }
    : { type: "spring" as const, stiffness: 320, damping: 26 };
  return (
    <section className="chess-hall-highlights" aria-label="Highlights">
      {cards.map((card, index) => (
        <motion.div
          key={card.key}
          className="chess-hall-fact"
          initial={{ opacity: 0, y: reduce ? 0 : 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...spring, delay: reduce ? 0 : index * 0.05 }}
        >
          <span className="chess-hall-fact-value">
            <NumberFlow value={card.value} />
          </span>
          <span className="chess-hall-fact-label">{card.label}</span>
        </motion.div>
      ))}
      <AnimatePresence initial={false}>
        {records.map((record) => (
          <motion.div
            key={record.key}
            className="chess-hall-fact"
            data-record
            initial={{ opacity: 0, scale: reduce ? 1 : 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={spring}
          >
            <span className="chess-hall-fact-label">{record.label}</span>
            <motion.span
              key={`${record.who}-${record.text}`}
              className="chess-hall-fact-who"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
            >
              {record.who} · {record.text}
            </motion.span>
          </motion.div>
        ))}
      </AnimatePresence>
    </section>
  );
}

/**
 * Every board at a glance: one tile per guest with moves made and the clock
 * left at their last move. Tiles keep a stable order by nickname so they do
 * not jump on every move; finished boards dim and low clocks turn red.
 */
export function Progress({
  standings,
  reduce,
}: {
  standings: readonly StandingRow[];
  reduce: boolean;
}) {
  const rows = [...standings].sort((a, b) => a.nickname.localeCompare(b.nickname));
  return (
    <section className="chess-hall-panel" aria-label="Every board">
      <h2>Every board</h2>
      <ul className="chess-hall-progress">
        {rows.map((row) => {
          const clock = Math.min(1, (row.timeLeftMs ?? 60_000) / 60_000);
          const low = !row.finished && clock < 0.2;
          return (
            <li
              key={row.playerId}
              className="chess-hall-tile"
              data-finished={row.finished || undefined}
              data-low={low || undefined}
            >
              <PlayerAvatar playerId={row.playerId} nickname={row.nickname} size="sm" />
              <span className="chess-hall-tile-name">{row.nickname}</span>
              <span className="chess-hall-tile-meta">
                {row.finished ? "Done" : `${row.moves ?? 0} moves`} ·{" "}
                <NumberFlow value={row.finished ? row.score : row.capturedPoints} /> pts
              </span>
              <span className="chess-hall-clock" aria-hidden="true">
                <motion.span
                  initial={false}
                  animate={{ scaleX: clock }}
                  transition={
                    reduce ? { duration: 0.2 } : { duration: 0.6, ease: [0.2, 0, 0, 1] }
                  }
                />
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

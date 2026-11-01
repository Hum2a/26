import { useState, type ReactNode, type Ref } from "react";
import { AnimatePresence, motion, useIsPresent, useReducedMotion } from "motion/react";
import NumberFlow from "@number-flow/react";
import "./scoreboard.css";

export type ScoreboardEntry = {
  id: string;
  name: string;
  place: number;
  points?: number;
  detail?: string;
  badge?: ReactNode;
  meta?: string;
};

/** A window onto server-ordered results. Never sorts or calculates scores. */
export function Scoreboard({
  entries,
  title = "The standings",
  label = "Scoreboard",
  subtitle,
  compact = false,
}: {
  entries: readonly ScoreboardEntry[];
  title?: string;
  label?: string;
  subtitle?: string;
  compact?: boolean;
}) {
  const [page, setPage] = useState(0);
  const pages = Math.max(1, Math.ceil(entries.length / 10));
  const current = Math.min(page, pages - 1);
  // A smaller field moves us back once, rather than returning to an old page
  // unexpectedly when players are added again.
  if (current !== page) setPage(current);
  const start = current * 10;
  const end = Math.min(start + 10, entries.length);
  const reduced = useReducedMotion();
  const occurrences = new Map<string, number>();
  const keyed = entries.map((entry) => {
    const occurrence = occurrences.get(entry.id) ?? 0;
    occurrences.set(entry.id, occurrence + 1);
    return { entry, key: JSON.stringify([entry.id, occurrence]) };
  });
  return (
    <section
      className="scoreboard"
      data-compact={compact || undefined}
      aria-label={`${label} panel`}
    >
      <header className="scoreboard-heading">
        <div>
          <p className="scoreboard-eyebrow">
            {current === 0 ? "The leading ten" : "Every place counts"}
          </p>
          <h2>{title}</h2>
        </div>
        <span className="scoreboard-population">
          {entries.length}
          <small>players</small>
        </span>
      </header>
      {subtitle ? <p className="scoreboard-caption">{subtitle}</p> : null}
      <div className="scoreboard-columns" aria-hidden="true">
        <span>Place</span>
        <span>Player</span>
        <span>Result</span>
      </div>
      {entries.length ? (
        <motion.ol
          layout={!reduced}
          layoutDependency={keyed
            .slice(start, end)
            .map(({ key }) => key)
            .join("|")}
          className="scoreboard-rows"
          aria-label={label}
          start={start + 1}
        >
          <AnimatePresence initial={false} mode="popLayout">
            {keyed.slice(start, end).map(({ entry, key }, index) => (
              <ScoreRow key={key} entry={entry} index={index} />
            ))}
          </AnimatePresence>
        </motion.ol>
      ) : (
        <p className="scoreboard-empty">The first scores will appear here.</p>
      )}
      <footer className="scoreboard-navigation">
        <p role="status" aria-live="polite">
          {entries.length
            ? `${start + 1}–${end} of ${entries.length}`
            : "No scores yet"}
        </p>
        {pages > 1 ? (
          <nav aria-label={`Browse ${label.toLowerCase()}`}>
            <button
              type="button"
              aria-label="Back to leaders"
              disabled={current === 0}
              onClick={() => setPage(0)}
            >
              Top 10
            </button>
            <button
              type="button"
              aria-label="Previous players"
              disabled={current === 0}
              onClick={() => setPage(current - 1)}
            >
              ← <span>Previous</span>
            </button>
            <button
              type="button"
              aria-label="Next players"
              disabled={current === pages - 1}
              onClick={() => setPage(current + 1)}
            >
              <span>Next 10</span> →
            </button>
          </nav>
        ) : null}
      </footer>
    </section>
  );
}

function ScoreRow({
  entry,
  index,
  ref,
}: {
  entry: ScoreboardEntry;
  index: number;
  ref?: Ref<HTMLLIElement>;
}) {
  const present = useIsPresent();
  const reduced = useReducedMotion();
  return (
    <motion.li
      ref={ref}
      layout={!reduced ? "position" : false}
      layoutDependency={`${index}:${entry.place}`}
      aria-hidden={!present || undefined}
      className="scoreboard-row"
      data-podium={entry.place <= 3 ? entry.place : undefined}
      initial={{ opacity: 0, y: reduced ? 0 : 7 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: reduced ? 0 : -5 }}
      transition={{
        opacity: { duration: 0.16 },
        y: {
          duration: 0.22,
          ease: [0.2, 0, 0, 1],
          delay: present ? Math.min(index * 0.018, 0.09) : 0,
        },
        layout: { type: "spring", stiffness: 280, damping: 32 },
      }}
    >
      <span className="scoreboard-place" aria-label={`Place ${entry.place}`}>
        {String(entry.place).padStart(2, "0")}
      </span>
      <span className="scoreboard-player">
        {entry.badge}
        <span>
          <strong>{entry.name}</strong>
          {entry.meta ? <small>{entry.meta}</small> : null}
        </span>
      </span>
      <span className="scoreboard-result">
        {entry.points !== undefined ? (
          <strong>
            <span className="sr-only">{entry.points} points</span>
            <NumberFlow
              value={entry.points}
              animated={!reduced}
              aria-hidden="true"
              locales="en-GB"
            />
            <small aria-hidden="true">pts</small>
          </strong>
        ) : null}
        {entry.detail ? <span>{entry.detail}</span> : null}
      </span>
    </motion.li>
  );
}

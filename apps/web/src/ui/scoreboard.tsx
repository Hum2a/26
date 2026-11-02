import { useState, type CSSProperties, type ReactNode, type Ref } from "react";
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
  podium = false,
}: {
  entries: readonly ScoreboardEntry[];
  title?: string;
  label?: string;
  subtitle?: string;
  compact?: boolean;
  /** Raise the leading three onto a podium above the list (projector). */
  podium?: boolean;
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
  // Remember the places from the previous standings to show who moved.
  const placesKey = entries.map((entry) => `${entry.id}:${entry.place}`).join("|");
  const [places, setPlaces] = useState(() => ({
    key: placesKey,
    previous: new Map<string, number>(),
    current: new Map(entries.map((entry) => [entry.id, entry.place])),
  }));
  if (places.key !== placesKey) {
    setPlaces({
      key: placesKey,
      previous: places.current,
      current: new Map(entries.map((entry) => [entry.id, entry.place])),
    });
  }
  const moved = (entry: ScoreboardEntry) => {
    const before = places.previous.get(entry.id);
    return before === undefined ? 0 : before - entry.place;
  };
  const leader = Math.max(1, ...entries.map((entry) => entry.points ?? 0));
  const raised =
    podium && current === 0
      ? entries.filter((entry) => entry.place <= 3).slice(0, 3)
      : [];
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
      {raised.length > 0 ? (
        <div className="scoreboard-podium" aria-hidden="true">
          {raised.map((entry, index) => (
            <motion.div
              key={entry.id}
              layout={!reduced}
              className="scoreboard-podium-step glass"
              data-place={entry.place}
              initial={{ opacity: 0, y: reduced ? 0 : 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={
                reduced
                  ? { duration: 0.15 }
                  : {
                      type: "spring",
                      stiffness: 220,
                      damping: 22,
                      delay: 0.1 + index * 0.12,
                    }
              }
            >
              {entry.badge}
              <strong>{entry.name}</strong>
              {entry.points !== undefined ? (
                <span className="scoreboard-podium-points">
                  <NumberFlow
                    value={entry.points}
                    animated={!reduced}
                    locales="en-GB"
                  />
                  <small>pts</small>
                </span>
              ) : null}
              <span className="scoreboard-podium-block">{entry.place}</span>
            </motion.div>
          ))}
        </div>
      ) : null}
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
              <ScoreRow
                key={key}
                entry={entry}
                index={index}
                moved={moved(entry)}
                share={
                  entry.points === undefined ? 0 : Math.max(0, entry.points) / leader
                }
                onPodium={raised.includes(entry)}
              />
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
  moved = 0,
  share = 0,
  onPodium = false,
  ref,
}: {
  entry: ScoreboardEntry;
  index: number;
  moved?: number;
  share?: number;
  onPodium?: boolean;
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
      data-raised={onPodium || undefined}
      style={{ "--share": `${Math.round(share * 100)}%` } as CSSProperties}
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
        {moved !== 0 ? (
          <span
            className="scoreboard-move"
            data-direction={moved > 0 ? "up" : "down"}
            aria-label={`${moved > 0 ? "Up" : "Down"} ${Math.abs(moved)}`}
          >
            {moved > 0 ? "▲" : "▼"}
            {Math.abs(moved)}
          </span>
        ) : null}
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

import { memo, useEffect, useState, type CSSProperties } from "react";
import NumberFlow from "@number-flow/react";
import { AnimatePresence, motion, useAnimate, useReducedMotion } from "motion/react";
import { Icon } from "@iconify/react/dist/offline";
import crown from "@iconify-icons/lucide/crown";
import check from "@iconify-icons/lucide/check";
import eyeOff from "@iconify-icons/lucide/eye-off";
import {
  bubbleLimit,
  visibleVoters,
  voteShares,
  type PlaySnapshot,
  type VoteShare,
} from "@26/shared";
import { RosterAvatar } from "../ui/roster";
import { useRoster } from "../ui/roster-context";
import { QuestionOptionImage } from "./question-option-image";
import "./vote-board.css";

type ChoicePlay = PlaySnapshot & {
  question: Extract<PlaySnapshot["question"], { kind: "choice" }>;
};
type ChoiceReveal = Extract<NonNullable<PlaySnapshot["reveal"]>, { kind: "choice" }>;

const letters = "ABCDEFGHIJKLMNOP";

/**
 * The big-screen board for a choice question. Each option grows with its share
 * of the room, bumps when a vote lands and fills with the voters' faces.
 *
 * The room decides what is drawn: `play.voters` is only present when this
 * question (and the host) allow picks on screen. Without it the options stay
 * still until a reveal brings a tally. Nothing here knows the answer early.
 */
export function VoteBoard({ play }: { play: PlaySnapshot }) {
  if (play.question.kind !== "choice") return null;
  return <ChoiceBoard play={play as ChoicePlay} />;
}

function ChoiceBoard({ play }: { play: ChoicePlay }) {
  const options = play.question.options;
  const reveal = play.reveal?.kind === "choice" ? play.reveal : undefined;
  const voters = play.voters ?? null;
  const shares = voteShares(
    options.map((option) => option.id),
    voters,
    reveal?.tally,
  );
  const sized = voters !== null || Boolean(reveal?.tally);
  const limit = bubbleLimit(options.length);
  const rows =
    options.length <= 4
      ? [options.map((_, index) => index)]
      : splitRows(options.length);
  const mode = voters ? "live" : sized ? "count" : "quiet";

  return (
    <section
      className="vote-board"
      data-mode={mode}
      data-revealed={reveal ? "" : undefined}
      aria-label="Votes"
    >
      <BoardHeader play={play} mode={mode} />
      <div className="vote-board-rows">
        {rows.map((row, rowIndex) => (
          <ul className="vote-board-row" key={rowIndex}>
            {row.map((index) => {
              const option = options[index]!;
              return (
                <VoteOption
                  key={option.id}
                  index={index}
                  label={option.label}
                  image={option.image}
                  share={shares[index]!}
                  sized={sized}
                  named={voters !== null}
                  limit={limit}
                  result={resultFor(reveal, option.id)}
                />
              );
            })}
          </ul>
        ))}
      </div>
    </section>
  );
}

function BoardHeader({
  play,
  mode,
}: {
  play: ChoicePlay;
  mode: "live" | "count" | "quiet";
}) {
  const attribution = play.question.attribution;
  const note =
    mode !== "quiet" || play.reveal
      ? null
      : attribution === "never"
        ? "Picks stay private for this question."
        : attribution === "after"
          ? "Picks appear at the reveal."
          : "Picks are hidden on the big screen.";
  return (
    <header className="vote-board-head">
      <p className="vote-board-count" aria-live="polite">
        <NumberFlow value={play.submissionCount} />{" "}
        {play.submissionCount === 1 ? "answer in" : "answers in"}
      </p>
      <AnimatePresence initial={false}>
        {note ? (
          <motion.p
            key={note}
            className="vote-board-note"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
          >
            <Icon icon={eyeOff} aria-hidden="true" /> {note}
          </motion.p>
        ) : null}
      </AnimatePresence>
    </header>
  );
}

const VoteOption = memo(function VoteOption({
  index,
  label,
  image,
  share,
  sized,
  named,
  limit,
  result,
}: {
  index: number;
  label: string;
  image?: string;
  share: VoteShare;
  sized: boolean;
  named: boolean;
  limit: number;
  result: "correct" | "wrong" | undefined;
}) {
  const reduce = useReducedMotion() ?? false;
  const [scope, animate] = useAnimate<HTMLLIElement>();
  const burst = useVoteBurst(share.count);

  // A vote landing: the option bumps once. Reduced motion keeps a short fade.
  useEffect(() => {
    if (!burst || !scope.current) return;
    if (reduce) {
      void animate(scope.current, { opacity: [0.8, 1] }, { duration: 0.2 });
      return;
    }
    void animate(
      scope.current,
      { scale: [1, 1.045, 0.995, 1] },
      { duration: 0.55, ease: [0.2, 0, 0, 1] },
    );
  }, [burst, reduce, animate, scope]);

  const style = {
    "--vote-share": String(sized ? share.share : 0),
    "--vote-grow": String(sized ? share.grow : 0),
    "--vote-tone": String(index % 6),
    flexGrow: sized ? 1 + share.grow * 1.2 : 1,
  } as CSSProperties;
  const { shown, overflow } = visibleVoters(share.playerIds, limit);

  return (
    <li
      ref={scope}
      className="vote-option"
      style={style}
      data-tone={index % 6}
      data-leading={sized && share.leading && !result ? "" : undefined}
      data-result={result}
      data-empty={sized && share.count === 0 ? "" : undefined}
    >
      <span className="vote-option-fill" aria-hidden="true" />
      {image ? <QuestionOptionImage src={image} /> : null}
      <div className="vote-option-head">
        <span className="vote-option-letter" aria-hidden="true">
          {letters[index] ?? "•"}
        </span>
        <span className="vote-option-label">{label}</span>
        <AnimatePresence initial={false}>
          {result === "correct" ? (
            <motion.span
              key="correct"
              className="vote-option-badge"
              initial={{
                opacity: 0,
                scale: reduce ? 1 : 0.4,
                rotate: reduce ? 0 : -20,
              }}
              animate={{ opacity: 1, scale: 1, rotate: 0 }}
              transition={
                reduce
                  ? { duration: 0.2 }
                  : { type: "spring", stiffness: 420, damping: 18 }
              }
            >
              <Icon icon={check} aria-hidden="true" />
              <span className="sr-only">Correct</span>
            </motion.span>
          ) : sized && share.leading && !result ? (
            <motion.span
              key="lead"
              className="vote-option-crown"
              initial={{ opacity: 0, y: reduce ? 0 : -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: reduce ? 0 : -10 }}
              transition={{ duration: 0.3, ease: [0.2, 0, 0, 1] }}
            >
              <Icon icon={crown} aria-hidden="true" />
              <span className="sr-only">Most picked</span>
            </motion.span>
          ) : null}
        </AnimatePresence>
      </div>
      {sized ? (
        <div className="vote-option-stats">
          <span className="vote-option-total">
            <NumberFlow value={share.count} />
            <span className="sr-only">{share.count === 1 ? " vote" : " votes"}</span>
          </span>
          <span className="vote-option-share">
            <NumberFlow value={Math.round(share.share * 100)} suffix="%" />
          </span>
          <AnimatePresence>
            {burst ? (
              <motion.span
                key={burst.key}
                className="vote-option-plus"
                aria-hidden="true"
                initial={{ opacity: 0, y: reduce ? 0 : 12, scale: reduce ? 1 : 0.6 }}
                animate={{ opacity: 1, y: reduce ? 0 : -28, scale: 1 }}
                exit={{ opacity: 0, y: reduce ? 0 : -44 }}
                transition={{ duration: reduce ? 0.2 : 0.45, ease: "easeOut" }}
              >
                +{burst.gained}
              </motion.span>
            ) : null}
          </AnimatePresence>
        </div>
      ) : null}
      {named ? (
        <VoterBubbles playerIds={shown} overflow={overflow} total={share.count} />
      ) : null}
    </li>
  );
}, sameOption);

type VoteOptionProps = {
  index: number;
  label: string;
  image?: string;
  share: VoteShare;
  sized: boolean;
  named: boolean;
  limit: number;
  result: "correct" | "wrong" | undefined;
};

/** The board rebuilds shares on every patch; an option redraws only when its own numbers move. */
function sameOption(before: VoteOptionProps, after: VoteOptionProps): boolean {
  return (
    before.index === after.index &&
    before.label === after.label &&
    before.image === after.image &&
    before.sized === after.sized &&
    before.named === after.named &&
    before.limit === after.limit &&
    before.result === after.result &&
    before.share.count === after.share.count &&
    before.share.share === after.share.share &&
    before.share.grow === after.share.grow &&
    before.share.leading === after.share.leading &&
    before.share.playerIds.join() === after.share.playerIds.join()
  );
}

/**
 * The last rise in an option's count, held for a moment so a "+1" can float
 * up. Derived while rendering (no ref reads); a timer clears it.
 */
function useVoteBurst(count: number): { key: number; gained: number } | null {
  const [seen, setSeen] = useState(count);
  const [burst, setBurst] = useState<{ key: number; gained: number } | null>(null);
  if (count !== seen) {
    setSeen(count);
    setBurst(count > seen ? { key: count, gained: count - seen } : null);
  }
  useEffect(() => {
    if (!burst) return;
    const timer = window.setTimeout(() => setBurst(null), 900);
    return () => window.clearTimeout(timer);
  }, [burst]);
  return burst;
}

/** False for the first frame, so only bubbles already there on mount stagger in. */
function useSettled(): boolean {
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setSettled(true));
    return () => window.cancelAnimationFrame(frame);
  }, []);
  return settled;
}

/**
 * The faces of one option's voters. New voters pop in; voters who change their
 * mind float out. A busy option shrinks its bubbles and folds the oldest into
 * "+N" so the board never paints eighty photos in one box.
 */
export const VoterBubbles = memo(function VoterBubbles({
  playerIds,
  overflow = 0,
  total,
  className,
}: {
  playerIds: readonly string[];
  overflow?: number;
  total?: number;
  className?: string;
}) {
  const reduce = useReducedMotion() ?? false;
  const roster = useRoster();
  const settled = useSettled();
  const count = total ?? playerIds.length + overflow;
  const density = count <= 6 ? "roomy" : count <= 16 ? "cosy" : "packed";
  const size = density === "roomy" ? "lg" : density === "cosy" ? "md" : "sm";
  const names = playerIds
    .slice(-3)
    .map((id) => roster.get(id)?.nickname)
    .filter((name): name is string => Boolean(name));
  const label =
    count === 0
      ? "No picks yet"
      : `Picked by ${names.join(", ")}${count > names.length ? ` and ${count - names.length} more` : ""}`;

  return (
    <ul
      className={`vote-bubbles${className ? ` ${className}` : ""}`}
      data-density={density}
      aria-label={label}
    >
      <AnimatePresence initial={!reduce} mode="popLayout">
        {playerIds.map((playerId, order) => (
          <motion.li
            key={playerId}
            className="vote-bubble"
            layout={reduce || count > 30 ? false : "position"}
            initial={
              reduce
                ? { opacity: 0 }
                : { opacity: 0, scale: 0.2, y: 28, rotate: order % 2 ? 14 : -14 }
            }
            animate={{ opacity: 1, scale: 1, y: 0, rotate: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.3, y: -18 }}
            transition={
              reduce
                ? { duration: 0.2 }
                : {
                    type: "spring",
                    stiffness: 520,
                    damping: 22,
                    delay: settled ? 0 : Math.min(order * 0.025, 0.6),
                  }
            }
          >
            <RosterAvatar playerId={playerId} size={size} />
          </motion.li>
        ))}
        {overflow > 0 ? (
          <motion.li
            key="overflow"
            className="vote-bubble vote-bubble-more"
            layout={reduce ? false : "position"}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            +<NumberFlow value={overflow} />
          </motion.li>
        ) : null}
      </AnimatePresence>
    </ul>
  );
});

function resultFor(
  reveal: ChoiceReveal | undefined,
  optionId: string,
): "correct" | "wrong" | undefined {
  if (!reveal) return undefined;
  if (reveal.outcome === "poll") return undefined;
  const good =
    reveal.correctOptionId === optionId ||
    reveal.correctOptionIds?.includes(optionId) ||
    reveal.winners?.includes(optionId) ||
    reveal.everyone === true;
  const known =
    reveal.correctOptionId !== null ||
    (reveal.correctOptionIds?.length ?? 0) > 0 ||
    reveal.winners !== undefined ||
    reveal.everyone !== undefined;
  if (!known) return undefined;
  return good ? "correct" : "wrong";
}

function splitRows(count: number): number[][] {
  const first = Math.ceil(count / 2);
  const all = Array.from({ length: count }, (_, index) => index);
  return [all.slice(0, first), all.slice(first)];
}

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { emptyWordleBoard, type WordleBoard, type WordleMark } from "@26/shared";
import { Button } from "../../ui/primitives";
import type { PresentationProps } from "../presentation";
import { LiveCount, QuestionTag, StagePrompt, useDesignMotion } from "./kit";
import "./glyph.css";

const priority = { absent: 0, present: 1, correct: 2 };
const symbols = { absent: "×", present: "↔", correct: "✓" };
const meaning = {
  absent: "not in the word",
  present: "in another position",
  correct: "right position",
};

/** Classic single-board Glyph. Only the server's marks arrive here. */
export function Glyph(props: PresentationProps) {
  if (props.play.question.kind !== "wordle") return undefined;
  return props.surface === "phone" ? (
    <GlyphPhone {...props} />
  ) : (
    <GlyphStage {...props} />
  );
}

function GlyphPhone({
  play,
  controls,
  phase,
}: Extract<PresentationProps, { surface: "phone" }>) {
  const motionSet = useDesignMotion();
  const board =
    play.selfAnswer?.kind === "wordle" ? play.selfAnswer : emptyWordleBoard();
  const [entry, setEntry] = useState({ attempt: board.guesses.length, value: "" });
  // An acknowledgement snapshot clears only the accepted row. Rejections retain the draft.
  const draft = entry.attempt === board.guesses.length ? entry.value : "";
  const open = controls.open && board.status === "playing";
  const keys = new Map<string, WordleMark>();
  for (const guess of board.guesses)
    for (let i = 0; i < 5; i++) {
      const letter = guess.word[i]!,
        mark = guess.marks[i]!;
      if (!keys.has(letter) || priority[mark] > priority[keys.get(letter)!])
        keys.set(letter, mark);
    }
  function key(value: string) {
    if (!open) return;
    if (value === "Enter") {
      if (draft.length === 5) controls.onText(draft);
      return;
    }
    const next =
      value === "Backspace" ? draft.slice(0, -1) : `${draft}${value}`.slice(0, 5);
    setEntry({ attempt: board.guesses.length, value: next });
  }
  const reveal = play.reveal?.kind === "wordle" ? play.reveal : undefined;
  const status =
    board.status === "won"
      ? `Solved in ${board.guesses.length}! Watch the stage.`
      : board.status === "lost"
        ? "Six guesses used. The answer will appear on the stage."
        : phase === "collect"
          ? `Guess ${board.guesses.length + 1} of 6`
          : "Six guesses. Five letters. One word.";
  return (
    <section
      className="design-phone glyph"
      aria-label="Wordle game"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.ctrlKey || event.metaKey || event.altKey) return;
        if (
          /^[a-z]$/i.test(event.key) ||
          event.key === "Enter" ||
          event.key === "Backspace"
        ) {
          event.preventDefault();
          key(event.key.length === 1 ? event.key.toUpperCase() : event.key);
        }
      }}
    >
      <QuestionTag play={play}>The word lab</QuestionTag>
      <h1 className="phone-prompt">{play.question.prompt}</h1>
      <AnimatePresence mode="wait" initial={false}>
        <motion.p
          className="glyph-status"
          role="status"
          key={status}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={motionSet.soft}
        >
          {controls.pending ? "Checking your word…" : status}
        </motion.p>
      </AnimatePresence>
      <WordleGrid board={board} draft={draft} />
      <p className="glyph-legend">
        <span>✓ Right place</span>
        <span>↔ Wrong place</span>
        <span>× Not in word</span>
      </p>
      <AnimatePresence>
        {reveal ? (
          <motion.p
            className="glyph-answer"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={motionSet.soft}
          >
            The word was <strong>{reveal.answer}</strong>.
          </motion.p>
        ) : null}
      </AnimatePresence>
      <div
        className="glyph-keyboard"
        aria-label="Letter keyboard"
        aria-busy={controls.pending}
      >
        {["QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM"].map((row) => (
          <div className="glyph-key-row" key={row}>
            {[...row].map((letter) => (
              <Button
                key={letter}
                variant="secondary"
                className="glyph-key"
                data-mark={keys.get(letter)}
                disabled={!open}
                onClick={() => key(letter)}
                aria-label={
                  keys.has(letter) ? `${letter}, ${meaning[keys.get(letter)!]}` : letter
                }
              >
                {letter}
                <small aria-hidden="true">
                  {keys.has(letter) ? symbols[keys.get(letter)!] : ""}
                </small>
              </Button>
            ))}
          </div>
        ))}
        <div className="glyph-actions">
          <Button
            variant="secondary"
            disabled={!open || !draft}
            onClick={() => key("Backspace")}
          >
            Delete
          </Button>
          <Button disabled={!open || draft.length !== 5} onClick={() => key("Enter")}>
            {controls.pending ? "Checking…" : "Check word"}
          </Button>
        </div>
      </div>
    </section>
  );
}

export function WordleGrid({
  board,
  draft = "",
}: {
  board: WordleBoard;
  draft?: string;
}) {
  const motionSet = useDesignMotion();
  return (
    <div className="glyph-board" aria-label="Your six guesses">
      {Array.from({ length: 6 }, (_, row) => {
        const guess = board.guesses[row];
        const word = guess?.word ?? (row === board.guesses.length ? draft : "");
        return (
          <div
            className="glyph-row"
            key={row}
            aria-label={`Guess ${row + 1}${guess ? `: ${guess.word}` : ""}`}
          >
            {Array.from({ length: 5 }, (_, column) => {
              const letter = word[column] ?? "",
                mark = guess?.marks[column];
              return (
                <motion.span
                  key={`${column}-${mark ?? "draft"}`}
                  className="glyph-cell"
                  data-mark={mark}
                  aria-label={`${letter || "Empty"}${mark ? `, ${meaning[mark]}` : ""}`}
                  initial={{
                    opacity: mark ? 0.3 : 0.7,
                    rotateX: mark && !motionSet.reduce ? 80 : 0,
                  }}
                  animate={{ opacity: 1, rotateX: 0 }}
                  transition={{
                    ...motionSet.soft,
                    delay: mark ? motionSet.delay(column * 0.075) : 0,
                  }}
                >
                  {letter}
                  <small aria-hidden="true">{mark ? symbols[mark] : ""}</small>
                </motion.span>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

function GlyphStage({ play }: Extract<PresentationProps, { surface: "stage" }>) {
  const motionSet = useDesignMotion();
  const reveal = play.reveal?.kind === "wordle" ? play.reveal : undefined;
  return (
    <section className="glyph-stage design-stage">
      <QuestionTag play={play}>The word lab</QuestionTag>
      <StagePrompt text={play.question.prompt} />
      <div
        className="glyph-stage-word"
        aria-label={reveal ? `The word was ${reveal.answer}` : "Five mystery letters"}
      >
        {[...(reveal?.answer ?? "?????")].map((letter, index) => (
          <motion.span
            key={`${index}-${letter}`}
            initial={{ opacity: 0.4, y: motionSet.move(12) }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...motionSet.soft, delay: motionSet.delay(index * 0.1) }}
          >
            {letter}
          </motion.span>
        ))}
      </div>
      <p className="glyph-stage-instruction">
        {reveal
          ? "The word is out."
          : "Solve it on your phone. Six guesses. Two minutes."}
      </p>
      <p>✓ Right place · ↔ Wrong place · × Not in the word</p>
      {reveal ? (
        <p className="stage-answer">
          {reveal.solvedCount} of {reveal.responseCount} players who tried solved it.
        </p>
      ) : (
        <p className="glyph-stage-count">
          <LiveCount
            value={play.submissionCount}
            one="board finished"
            many="boards finished"
          />
        </p>
      )}
    </section>
  );
}

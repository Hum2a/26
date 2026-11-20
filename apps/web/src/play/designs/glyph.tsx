import { useState } from "react";
import { AnimatePresence, motion, useIsPresent } from "motion/react";
import { emptyWordleBoard, type WordleBoard, type WordleMark } from "@26/shared";
import { Button, Disclosure, TextField } from "../../ui/primitives";
import { PhoneDock } from "../../controller/phone-dock";
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
const wordLength = 5;
const emptyDraft = {
  letters: " ".repeat(wordLength),
  cursor: 0,
  tileSelected: false,
  notice: "",
};

/** Classic single-board Glyph. Only the server's marks arrive here. */
export function Glyph(props: PresentationProps) {
  if (props.play.question.kind !== "wordle") return undefined;
  return props.surface === "phone" ? (
    <GlyphPhone key={props.play.question.id} {...props} />
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
  const present = useIsPresent();
  const board =
    play.selfAnswer?.kind === "wordle" ? play.selfAnswer : emptyWordleBoard();
  const attempt = board.guesses.length;
  const [entry, setEntry] = useState({ attempt, ...emptyDraft });
  // An acknowledgement snapshot clears only the accepted row. Rejections retain the draft.
  const draft = entry.attempt === attempt ? entry : emptyDraft;
  const open = present && controls.open && board.status === "playing";
  const word = draft.letters.toUpperCase();
  const full = !word.includes(" ");
  const hasLetters = Boolean(draft.letters.trim());
  const duplicate = full && board.guesses.some((guess) => guess.word === word);
  const keys = new Map<string, WordleMark>();
  for (const guess of board.guesses)
    for (let i = 0; i < 5; i++) {
      const letter = guess.word[i]!,
        mark = guess.marks[i]!;
      if (!keys.has(letter) || priority[mark] > priority[keys.get(letter)!])
        keys.set(letter, mark);
    }
  function updateDraft(update: Partial<typeof emptyDraft>) {
    setEntry((current) => ({
      ...(current.attempt === attempt ? current : emptyDraft),
      attempt,
      ...update,
    }));
  }
  function replaceDraft(letters: string) {
    updateDraft({
      letters: letters.padEnd(wordLength, " "),
      cursor: letters.length,
      tileSelected: false,
      notice: "",
    });
  }
  function edit(value: string) {
    if (!open) return;
    controls.onWordleEdit?.();
    setEntry((current) => {
      const { letters, cursor, tileSelected } =
        current.attempt === attempt ? current : emptyDraft;
      const removing = value === "Backspace" || value === "Delete";
      const position = value === "Backspace" && !tileSelected ? cursor - 1 : cursor;
      if (position < 0 || position >= wordLength) return current;
      return {
        attempt,
        letters: `${letters.slice(0, position)}${removing ? " " : value}${letters.slice(position + 1)}`,
        cursor: removing ? position : position + 1,
        tileSelected: false,
        notice: "",
      };
    });
  }
  function submit() {
    if (!open || duplicate) return;
    if (!full) {
      updateDraft({ notice: "Fill all five tiles before checking." });
      return;
    }
    updateDraft({ notice: "" });
    controls.onText(word);
  }
  const reveal = play.reveal?.kind === "wordle" ? play.reveal : undefined;
  const status = reveal
    ? board.status === "won"
      ? `Solved in ${attempt}!`
      : "Puzzle complete."
    : board.status === "won"
      ? `Solved in ${board.guesses.length}! Watch the stage.`
      : board.status === "lost"
        ? "Six guesses used. The answer will appear on the stage."
        : phase === "collect"
          ? `Guess ${attempt + 1} of 6${open ? " · Tap a tile to edit it" : ""}`
          : "Six guesses. Five letters. One word.";
  const feedback = controls.pending
    ? "Checking your word…"
    : duplicate && open
      ? "You’ve already tried that word. Change a letter and try again."
      : (open && (draft.notice || controls.wordleFeedback)) || status;
  return (
    <section
      className="design-phone glyph"
      aria-label="Wordle game"
      tabIndex={0}
      onKeyDown={(event) => {
        if (
          !open ||
          event.defaultPrevented ||
          event.ctrlKey ||
          event.metaKey ||
          event.altKey ||
          event.nativeEvent.isComposing
        )
          return;
        const { key } = event;
        if (event.target instanceof HTMLInputElement && key !== "Enter") return;
        // Enter on a focused control should run that control's native action.
        if (
          key === "Enter" &&
          event.target instanceof Element &&
          event.target.closest("button")
        )
          return;
        if (key === "Enter") {
          if (!event.repeat) submit();
        } else if (key === "ArrowLeft" || key === "ArrowRight") {
          updateDraft({
            cursor: Math.max(
              0,
              Math.min(wordLength, draft.cursor + (key === "ArrowLeft" ? -1 : 1)),
            ),
            tileSelected: false,
          });
        } else if (key === "Backspace" || key === "Delete" || /^[a-z]$/i.test(key)) {
          edit(key.length === 1 ? key.toUpperCase() : key);
        } else return;
        event.preventDefault();
      }}
      onPaste={(event) => {
        if (!open) return;
        event.preventDefault();
        const pasted = event.clipboardData.getData("text/plain").trim();
        controls.onWordleEdit?.();
        if (!/^[a-z]{5}$/i.test(pasted)) {
          updateDraft({ notice: "Paste a single five-letter word." });
          return;
        }
        replaceDraft(pasted.toUpperCase());
      }}
    >
      <QuestionTag play={play}>The word lab</QuestionTag>
      <h1 className="phone-prompt">{play.question.prompt}</h1>
      <div className="glyph-status" role="status" aria-atomic="true">
        <span className="sr-only">{feedback}</span>
        <AnimatePresence initial={false} mode="popLayout">
          <motion.p
            key={feedback}
            aria-hidden="true"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={motionSet.soft}
          >
            {feedback}
          </motion.p>
        </AnimatePresence>
      </div>
      <WordleGrid
        board={board}
        draft={phase === "collect" && board.status === "playing" ? draft.letters : ""}
        cursor={draft.cursor}
        onEdit={
          open ? (cursor) => updateDraft({ cursor, tileSelected: true }) : undefined
        }
      />
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
      {!reveal && board.status === "playing" ? (
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
                  onClick={() => edit(letter)}
                  aria-label={
                    keys.has(letter)
                      ? `${letter}, ${meaning[keys.get(letter)!]}`
                      : letter
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
              disabled={!open || !hasLetters}
              onClick={() => edit("Backspace")}
            >
              Delete
            </Button>
            <Button
              variant="secondary"
              disabled={!open || !hasLetters}
              onClick={() => {
                controls.onWordleEdit?.();
                updateDraft(emptyDraft);
              }}
            >
              Clear word
            </Button>
          </div>
          {phase === "collect" ? (
            <Disclosure title="Type or paste a word">
              <TextField
                label="Your guess"
                hint="Type five letters or touch and hold to paste."
                value={draft.letters.trimEnd()}
                maxLength={wordLength}
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                enterKeyHint="go"
                disabled={!open}
                onChange={(event) => {
                  controls.onWordleEdit?.();
                  replaceDraft(
                    event.target.value.replace(/[^a-z ]/gi, "").slice(0, wordLength),
                  );
                }}
              />
            </Disclosure>
          ) : null}
        </div>
      ) : null}
      {phase === "collect" && board.status === "playing" ? (
        <PhoneDock>
          <Button
            type="button"
            disabled={!open || !full || duplicate}
            onClick={submit}
            aria-busy={controls.pending || undefined}
          >
            {controls.pending ? "Checking…" : "Check word"}
          </Button>
        </PhoneDock>
      ) : null}
    </section>
  );
}

export function WordleGrid({
  board,
  draft = "",
  cursor,
  onEdit,
}: {
  board: WordleBoard;
  draft?: string;
  cursor?: number;
  onEdit?: (column: number) => void;
}) {
  const motionSet = useDesignMotion();
  return (
    <div className="glyph-board" aria-label="Your six guesses">
      {Array.from({ length: 6 }, (_, row) => {
        const guess = board.guesses.at(row);
        const word = guess?.word ?? (row === board.guesses.length ? draft : "");
        return (
          <div
            className="glyph-row"
            key={row}
            aria-label={`Guess ${row + 1}${guess ? `: ${guess.word}` : ""}`}
          >
            {Array.from({ length: 5 }, (_, column) => {
              const letter = word[column]?.trim().toUpperCase() ?? "",
                mark = guess?.marks[column];
              const editable = !guess && row === board.guesses.length && onEdit;
              if (editable)
                return (
                  <button
                    type="button"
                    key={`${column}-draft`}
                    className="glyph-cell glyph-edit-cell"
                    data-cursor={cursor === column || undefined}
                    aria-label={`Edit letter ${column + 1}${letter ? `: ${letter}` : ": empty"}`}
                    aria-pressed={cursor === column}
                    onClick={() => editable(column)}
                  >
                    {letter}
                  </button>
                );
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
        data-revealed={reveal ? "" : undefined}
        aria-label={reveal ? `The word was ${reveal.answer}` : "Five mystery letters"}
      >
        {[...(reveal?.answer ?? "?????")].map((letter, index) => (
          <motion.span
            key={`${index}-${letter}`}
            initial={{
              opacity: reveal ? 0 : 0.4,
              y: motionSet.move(12),
              scale: reveal && !motionSet.reduce ? 0.85 : 1,
            }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ ...motionSet.soft, delay: motionSet.delay(index * 0.09) }}
          >
            {letter}
          </motion.span>
        ))}
      </div>
      <p className="glyph-stage-instruction">
        {reveal ? "The word is out." : "Solve it on your phone. You have six guesses."}
      </p>
      <p>✓ Right place · ↔ Wrong place · × Not in the word</p>
      {reveal ? (
        <p className="stage-answer">
          {reveal.responseCount === 0
            ? "No guesses were submitted."
            : `${reveal.solvedCount} of ${reveal.responseCount} ${reveal.responseCount === 1 ? "player" : "players"} who tried solved it.`}
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

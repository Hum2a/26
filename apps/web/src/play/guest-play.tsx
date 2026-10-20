import { GuestKart } from "../kart/GuestKart";
import type { KartInput } from "@26/shared";
import type { LobbySnapshot, PlaySnapshot } from "@26/shared";
import { QuestionOptionImage } from "./question-option-image";
import { OptionText } from "../rounds/OptionText";
import { SubmitButton } from "../rounds/SubmitButton";
import { roundSubmitState } from "../rounds/submit-state";
import { Button } from "../ui/primitives";
import { AnswerNames } from "./attributions";
import { GuestBallot } from "./guest-ballot";
import { GuestDuel } from "./guest-duel";
import { GuestMultiple } from "./guest-multiple";
import { GuestRank } from "./guest-rank";
import { GuestSlider } from "./guest-slider";
import { Glyph } from "./designs/glyph";
import { GuestText } from "./guest-text";
import { renderPresentation } from "./presentation";
import { QuestionExperience } from "./question-experience";
import { motion, useReducedMotion } from "motion/react";

export function GuestPlay({
  snapshot,
  selectedId,
  pending,
  onSelect,
  onSubmit,
  onEstimate,
  onRank,
  onText,
  onDraft,
  onBallot,
  onDuel,
  onKartInput,
  connected,
}: {
  snapshot: LobbySnapshot;
  onKartInput?: (input: KartInput) => void;
  connected?: boolean;
  selectedId?: string;
  pending: boolean;
  onSelect: (optionId: string) => void;
  onSubmit: () => void;
  onEstimate: (value: number) => void;
  onRank: (placements: { itemId: string; tierId: string }[]) => void;
  onText: (body: string) => void;
  onDraft?: (body: string) => void;
  onBallot: (candidateId: string) => void;
  onDuel: (value: number) => void;
}) {
  const reduce = useReducedMotion();
  const play = snapshot.play;
  if (!play) {
    return null;
  }
  if (play.question.kind === "kart")
    return (
      <QuestionExperience snapshot={snapshot} pending={false}>
        <GuestKart snapshot={snapshot} connected={connected} onInput={onKartInput} />
      </QuestionExperience>
    );
  const open =
    snapshot.phase === "collect" &&
    !snapshot.paused &&
    !snapshot.held &&
    (!play.selfAnswer ||
      (play.selfAnswer.kind === "wordle" && play.selfAnswer.status === "playing")) &&
    !pending;
  const choiceReveal = play.reveal?.kind === "choice" ? play.reveal : undefined;
  const dodge = snapshot.trolls.active.some(
    (effect) =>
      effect.kind === "yield" && effect.role === "target" && effect.status === "active",
  );
  const presentationProps = {
    surface: "phone" as const,
    phase: snapshot.phase,
    play,
    controls: {
      open,
      pending,
      selectedId,
      dodge,
      onSelect,
      onSubmit,
      onRank,
      onText,
    },
  };
  const custom =
    renderPresentation(play.question.presentation, presentationProps) ??
    (play.question.kind === "wordle" ? Glyph(presentationProps) : undefined);
  if (custom) {
    return (
      <QuestionExperience snapshot={snapshot} pending={pending}>
        {custom}
      </QuestionExperience>
    );
  }

  return (
    <QuestionExperience snapshot={snapshot} pending={pending}>
      <section
        className="question-standard"
        aria-label="Your question"
        aria-busy={pending}
      >
        {play.question.illustrative ||
        (play.question.kind === "choice" &&
          (play.question.speedBonus || play.question.outcome === "poll")) ? (
          <p className="question-standard-meta">
            {play.question.illustrative ? "Illustrative demo. " : null}
            {play.question.kind === "choice" && play.question.speedBonus
              ? " A faster answer can score a bonus."
              : ""}
            {play.question.kind === "choice" && play.question.outcome === "poll"
              ? " Just for fun. No points."
              : ""}
          </p>
        ) : null}
        <h1 className="phone-prompt">{play.question.prompt}</h1>
        {play.question.instructions ? (
          <p className="text-base text-muted">{play.question.instructions}</p>
        ) : null}
        {play.explanation ? <p>{play.explanation}</p> : null}
        {play.question.kind === "slider" ? (
          <GuestSlider
            play={play}
            open={open}
            pending={pending}
            onSubmit={onEstimate}
          />
        ) : null}
        {play.question.kind === "rank" ? (
          <GuestRank play={play} open={open} pending={pending} onSubmit={onRank} />
        ) : null}
        {play.question.kind === "typed" &&
        (snapshot.phase === "collect" || play.selfAnswer) ? (
          <GuestText
            play={play}
            blocked={
              snapshot.phase !== "collect" ||
              snapshot.paused ||
              snapshot.held ||
              pending
            }
            pending={pending}
            onSubmit={onText}
            label={
              play.question.scoring === "commonness"
                ? "Your made-up password"
                : "Your answer"
            }
            action="Send answer"
            maxLength={play.question.maxLength}
          />
        ) : null}
        {play.question.kind === "vote" && snapshot.phase === "collect" ? (
          <GuestText
            play={play}
            blocked={snapshot.paused || snapshot.held || pending}
            pending={pending}
            onSubmit={onText}
            onDraft={onDraft}
          />
        ) : null}
        {play.question.kind === "vote" && snapshot.phase === "vote" ? (
          <GuestBallot
            play={play}
            blocked={snapshot.paused || snapshot.held || pending}
            pending={pending}
            search={false}
            onSubmit={onBallot}
          />
        ) : null}
        {play.question.kind === "guess" ? (
          <GuestBallot
            play={play}
            blocked={snapshot.paused || snapshot.held || pending}
            pending={pending}
            search
            onSubmit={onBallot}
          />
        ) : null}
        {play.question.kind === "duel" || play.question.kind === "finale" ? (
          <GuestDuel
            play={play}
            blocked={snapshot.paused || snapshot.held || pending}
            pending={pending}
            onSubmit={onDuel}
            onPredict={onBallot}
          />
        ) : null}
        {play.question.kind === "choice" && play.question.outcome === "multiple" ? (
          <GuestMultiple
            key={play.question.id}
            play={play}
            open={open}
            pending={pending}
            onSubmit={onText}
          />
        ) : null}
        {play.question.kind === "choice" && play.question.outcome !== "multiple" ? (
          <div
            className="question-choice-grid"
            data-count={play.question.options.length}
          >
            {play.question.options.map((option, index) => {
              const selected =
                selectedId === option.id ||
                (play.selfAnswer?.kind === "choice" &&
                  play.selfAnswer.optionId === option.id);
              const note = choiceNote(choiceReveal, option.id);
              return (
                <motion.div
                  key={option.id}
                  className="question-choice-tile"
                  initial={{ opacity: 0.5, y: reduce ? 0 : 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.24,
                    delay: reduce ? 0 : index * 0.035,
                    ease: "easeOut",
                  }}
                >
                  <Button
                    key={option.id}
                    className="option-button"
                    variant={selected ? "primary" : "secondary"}
                    aria-pressed={selected}
                    disabled={!open}
                    onClick={() => onSelect(option.id)}
                  >
                    <span className="question-choice-mark" aria-hidden="true">
                      {String.fromCharCode(65 + index)}
                    </span>
                    {option.image ? <QuestionOptionImage src={option.image} /> : null}
                    <OptionText text={`${option.label}${note}`} />
                  </Button>
                </motion.div>
              );
            })}
          </div>
        ) : null}
        <AnswerNames play={play} />
        {play.question.kind === "choice" &&
        play.question.outcome !== "multiple" &&
        (open || pending || play.selfAnswer) ? (
          <SubmitButton
            className={dodge ? "troll-dodge" : ""}
            label="Send answer"
            state={roundSubmitState(Boolean(play.selfAnswer), pending)}
            disabled={!play.selfAnswer && !selectedId}
            onClick={onSubmit}
          />
        ) : null}
      </section>
    </QuestionExperience>
  );
}

/** Phone label suffix at the reveal: the right answer, or the room's count and who scored. */
export function choiceNote(
  reveal: Extract<NonNullable<PlaySnapshot["reveal"]>, { kind: "choice" }> | undefined,
  optionId: string,
): string {
  if (!reveal) {
    return "";
  }
  if (reveal.correctOptionId === optionId) {
    return " — the answer";
  }
  const count = reveal.tally?.find((row) => row.optionId === optionId)?.count;
  const tally =
    count === undefined ? "" : ` — ${count} ${count === 1 ? "vote" : "votes"}`;
  const scored =
    reveal.everyone || reveal.winners?.includes(optionId) ? ", scored" : "";
  return `${tally}${scored}`;
}

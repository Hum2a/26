import { motion } from "motion/react";
import { useDesignMotion } from "./designs/kit";
import { useState } from "react";
import type { PlaySnapshot } from "@26/shared";
import { OptionText } from "./controls/OptionText";
import { SubmitButton } from "./controls/SubmitButton";
import { Button, TextField } from "../ui/primitives";

export function GuestBallot({
  play,
  blocked,
  pending,
  search,
  onSubmit,
}: {
  play: PlaySnapshot;
  blocked: boolean;
  pending: boolean;
  search: boolean;
  onSubmit: (candidateId: string) => void;
}) {
  const motionKit = useDesignMotion();
  const cards = play.ballot?.cards ?? [];
  const accepted = play.selfBallot?.candidateId;
  return (
    <motion.div
      key={`${play.question.id}-${play.ballot?.epoch ?? "single"}`}
      initial={{ opacity: 0.5, y: motionKit.move(8) }}
      animate={{ opacity: 1, y: 0 }}
      transition={motionKit.soft}
    >
      <BallotCards
        key={`${play.question.id}-${play.ballot?.epoch ?? "single"}`}
        instruction={play.ballot?.instruction}
        label={play.ballot?.label}
        cards={cards}
        accepted={accepted}
        blocked={blocked || play.ballot?.reason !== "open" || accepted !== undefined}
        pending={pending}
        reason={play.ballot?.reason ?? "closed"}
        candidateMode={
          play.question.kind === "vote" ? play.question.candidateMode : "all"
        }
        isGuess={play.question.kind === "guess"}
        isNomineeVote={
          play.question.kind === "guess" && play.question.award === "nominees"
        }
        search={search}
        onSubmit={onSubmit}
      />
    </motion.div>
  );
}

function BallotCards({
  instruction,
  label,
  cards,
  accepted,
  blocked,
  pending,
  reason,
  candidateMode,
  isGuess,
  isNomineeVote,
  search,
  onSubmit,
}: {
  instruction?: string;
  label?: string;
  cards: NonNullable<PlaySnapshot["ballot"]>["cards"];
  accepted: string | undefined;
  blocked: boolean;
  pending: boolean;
  reason: NonNullable<PlaySnapshot["ballot"]>["reason"];
  candidateMode: "all" | "shortlist";
  isGuess: boolean;
  isNomineeVote: boolean;
  search: boolean;
  onSubmit: (candidateId: string) => void;
}) {
  const [selected, setSelected] = useState<string>();
  const [query, setQuery] = useState("");
  const needle = query.trim().toLocaleLowerCase("en-GB");
  const visible = needle
    ? cards.filter((card) => card.label.toLocaleLowerCase("en-GB").includes(needle))
    : cards;
  const chosen = accepted ?? selected;
  return (
    <div className="grid gap-3">
      {label ? (
        <h2 className="text-xl font-bold" aria-live="polite">
          {label}
        </h2>
      ) : null}
      {reason === "late" ? <p>You joined too late to vote in this round.</p> : null}
      {reason === "empty" ? (
        <p>
          {candidateMode === "shortlist"
            ? "The host has not chosen a ballot yet."
            : "No answers were submitted."}
        </p>
      ) : null}
      {search ? (
        <TextField
          label="Find a player"
          hint="The list stays in your order. Search only hides names."
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      ) : (
        <p>
          {instruction ??
            "One vote. You cannot choose your own line. A tie shares the win."}
        </p>
      )}
      <div className="grid gap-2" data-ballot="">
        {visible.map((card) => {
          const pressed = chosen === card.id;
          return (
            <Button
              key={card.id}
              type="button"
              className="option-button"
              variant={pressed ? "primary" : "secondary"}
              aria-pressed={pressed}
              disabled={blocked || !card.selectable}
              onClick={() => setSelected(card.id)}
            >
              <OptionText
                text={
                  card.own
                    ? isGuess
                      ? `${card.label} (you)`
                      : `${card.label} (your answer)`
                    : card.author
                      ? `${card.label} — ${card.author}`
                      : card.label
                }
              />
            </Button>
          );
        })}
      </div>
      {chosen ? (
        <p>
          Selected: {cards.find((card) => card.id === chosen)?.label ?? "your choice"}.
        </p>
      ) : null}
      <SubmitButton
        label={search && !isNomineeVote ? "Send guess" : "Send vote"}
        state={accepted ? "locked" : pending ? "sending" : "idle"}
        disabled={!accepted && (blocked || !selected)}
        onClick={() => selected && onSubmit(selected)}
      />
    </div>
  );
}

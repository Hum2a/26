import { useRef, useState } from "react";
import type { PlaySnapshot } from "@26/shared";
import { OptionText } from "../rounds/OptionText";
import { SubmitButton } from "../rounds/SubmitButton";
import { Button, TextField } from "../ui/primitives";

export function GuestDuel({
  play,
  blocked,
  pending,
  onSubmit,
  onPredict,
}: {
  play: PlaySnapshot;
  blocked: boolean;
  pending: boolean;
  onSubmit: (value: number) => void;
  onPredict: (contestantId: string) => void;
}) {
  if (play.question.kind !== "duel" && play.question.kind !== "finale") {
    return null;
  }
  const duel = play.duel;
  if (!duel) {
    return null;
  }
  if (duel.role === "late") {
    return <p>You joined too late for this duel.</p>;
  }
  if (duel.role === "spectator") {
    if (duel.reason === "waiting") {
      return (
        <div className="grid gap-3">
          <p>
            {play.selfBallot
              ? "The duel is on. Your prediction is in."
              : "The duel is on. Predictions are closed."}
          </p>
          {play.selfBallot ? (
            <SubmitButton
              label="Send prediction"
              state="locked"
              onClick={() => undefined}
            />
          ) : null}
        </div>
      );
    }
    return (
      <PredictionCards
        key={play.question.id}
        cards={duel.cards}
        accepted={play.selfBallot?.candidateId}
        blocked={blocked || duel.reason !== "open" || play.selfBallot !== null}
        pending={pending}
        onPredict={onPredict}
      />
    );
  }
  if (duel.reason === "waiting") {
    return <p>You are in the duel. Predictions close before you play.</p>;
  }
  const accepted = play.selfAnswer?.kind === "duel" ? play.selfAnswer.value : undefined;
  if (accepted !== undefined) {
    return (
      <div className="grid gap-3">
        <p>Your number: {accepted}</p>
        <SubmitButton label="Send number" state="locked" onClick={() => undefined} />
      </div>
    );
  }
  return (
    <NumberDraft
      key={play.question.id}
      blocked={blocked || duel.reason !== "open"}
      pending={pending}
      onSubmit={onSubmit}
    />
  );
}

function NumberDraft({
  blocked,
  pending,
  onSubmit,
}: {
  blocked: boolean;
  pending: boolean;
  onSubmit: (value: number) => void;
}) {
  const [draft, setDraft] = useState("");
  const submit = useRef<HTMLButtonElement>(null);
  const value = Number(draft);
  const ready = draft.trim().length > 0 && Number.isFinite(value);
  return (
    <form
      className="grid gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        submit.current?.click();
      }}
    >
      <TextField
        label="Your number"
        hint="Choose your number, then send it when you’re ready."
        inputMode="decimal"
        value={draft}
        disabled={blocked}
        onChange={(event) => setDraft(event.target.value)}
      />
      <SubmitButton
        ref={submit}
        label="Send number"
        state={pending ? "sending" : "idle"}
        disabled={blocked || !ready}
        onClick={() => {
          if (ready) {
            onSubmit(value);
          }
        }}
      />
    </form>
  );
}

function PredictionCards({
  cards,
  accepted,
  blocked,
  pending,
  onPredict,
}: {
  cards: NonNullable<PlaySnapshot["duel"]>["cards"];
  accepted: string | undefined;
  blocked: boolean;
  pending: boolean;
  onPredict: (contestantId: string) => void;
}) {
  const [selected, setSelected] = useState<string>();
  const chosen = accepted ?? selected;
  return (
    <div className="grid gap-3">
      <p>Back the contestant you think will win. This closes before they play.</p>
      {cards.length === 0 ? <p>The duel has no contestants.</p> : null}
      <div className="grid gap-2" data-duel="">
        {cards.map((card) => {
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
              <OptionText text={card.label} />
            </Button>
          );
        })}
      </div>
      <SubmitButton
        label="Send prediction"
        state={accepted ? "locked" : pending ? "sending" : "idle"}
        disabled={!accepted && (blocked || !selected)}
        onClick={() => selected && onPredict(selected)}
      />
    </div>
  );
}

import { useState } from "react";
import type { PlaySnapshot } from "@26/shared";
import { Button, TextField } from "../ui/primitives";

export function GuestDuel({
  play,
  blocked,
  onSubmit,
  onPredict,
}: {
  play: PlaySnapshot;
  blocked: boolean;
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
        <p>
          {play.selfBallot
            ? "The duel is on. Your prediction is in."
            : "The duel is on. Predictions are closed."}
        </p>
      );
    }
    return (
      <PredictionCards
        key={play.question.id}
        cards={duel.cards}
        accepted={play.selfBallot?.candidateId}
        blocked={blocked || duel.reason !== "open" || play.selfBallot !== null}
        onPredict={onPredict}
      />
    );
  }
  if (duel.reason === "waiting") {
    return <p>You are in the duel. Predictions close before you play.</p>;
  }
  const accepted = play.selfAnswer?.kind === "duel" ? play.selfAnswer.value : undefined;
  if (accepted !== undefined) {
    return <p>Your number: {accepted}</p>;
  }
  return (
    <NumberDraft
      key={play.question.id}
      blocked={blocked || duel.reason !== "open"}
      onSubmit={onSubmit}
    />
  );
}

function NumberDraft({
  blocked,
  onSubmit,
}: {
  blocked: boolean;
  onSubmit: (value: number) => void;
}) {
  const [draft, setDraft] = useState("");
  const value = Number(draft);
  const ready = draft.trim().length > 0 && Number.isFinite(value);
  return (
    <form
      className="grid gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (ready) {
          onSubmit(value);
        }
      }}
    >
      <TextField
        label="Your number"
        hint="Sending stores this number for your duel."
        inputMode="decimal"
        value={draft}
        disabled={blocked}
        onChange={(event) => setDraft(event.target.value)}
      />
      <Button type="submit" disabled={blocked || !ready}>
        Send number
      </Button>
    </form>
  );
}

function PredictionCards({
  cards,
  accepted,
  blocked,
  onPredict,
}: {
  cards: NonNullable<PlaySnapshot["duel"]>["cards"];
  accepted: string | undefined;
  blocked: boolean;
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
              variant={pressed ? "primary" : "secondary"}
              aria-pressed={pressed}
              disabled={blocked || !card.selectable}
              onClick={() => setSelected(card.id)}
            >
              {card.label}
            </Button>
          );
        })}
      </div>
      {accepted ? null : (
        <Button
          type="button"
          disabled={blocked || !selected}
          onClick={() => selected && onPredict(selected)}
        >
          Send prediction
        </Button>
      )}
    </div>
  );
}

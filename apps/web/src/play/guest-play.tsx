import type { LobbySnapshot } from "@26/shared";
import { Button } from "../ui/primitives";
import { AnswerNames } from "./attributions";
import { GuestBallot } from "./guest-ballot";
import { GuestDuel } from "./guest-duel";
import { GuestRank } from "./guest-rank";
import { GuestSlider } from "./guest-slider";
import { GuestText } from "./guest-text";

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
}: {
  snapshot: LobbySnapshot;
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
  const play = snapshot.play;
  if (!play) {
    return null;
  }
  const open =
    snapshot.phase === "collect" &&
    !snapshot.paused &&
    !snapshot.held &&
    !play.selfAnswer &&
    !pending;
  const revealed =
    play.reveal?.kind === "choice" ? play.reveal.correctOptionId : undefined;

  return (
    <section className="grid gap-4" aria-label="Your question" aria-busy={pending}>
      <p className="text-base text-muted">
        Illustrative demo. Question {play.question.index} of {play.question.total}.
        {play.question.kind === "choice" && play.question.speedBonus
          ? " A faster answer can score a bonus."
          : ""}
      </p>
      <p className="phone-prompt">{play.question.prompt}</p>
      {play.question.kind === "slider" ? (
        <GuestSlider play={play} open={open} onSubmit={onEstimate} />
      ) : null}
      {play.question.kind === "rank" ? (
        <GuestRank play={play} open={open} onSubmit={onRank} />
      ) : null}
      {play.question.kind === "vote" && snapshot.phase === "collect" ? (
        <GuestText
          play={play}
          blocked={snapshot.paused || snapshot.held || pending}
          onSubmit={onText}
          onDraft={onDraft}
        />
      ) : null}
      {play.question.kind === "vote" && snapshot.phase === "vote" ? (
        <GuestBallot
          play={play}
          blocked={snapshot.paused || snapshot.held || pending}
          search={false}
          onSubmit={onBallot}
        />
      ) : null}
      {play.question.kind === "guess" ? (
        <GuestBallot
          play={play}
          blocked={snapshot.paused || snapshot.held || pending}
          search
          onSubmit={onBallot}
        />
      ) : null}
      {play.question.kind === "duel" || play.question.kind === "finale" ? (
        <GuestDuel
          play={play}
          blocked={snapshot.paused || snapshot.held || pending}
          onSubmit={onDuel}
          onPredict={onBallot}
        />
      ) : null}
      {play.question.kind === "choice" ? (
        <div className="grid gap-3">
          {play.question.options.map((option) => {
            const selected =
              selectedId === option.id ||
              (play.selfAnswer?.kind === "choice" &&
                play.selfAnswer.optionId === option.id);
            const correct = revealed === option.id;
            return (
              <Button
                key={option.id}
                variant={selected ? "primary" : "secondary"}
                aria-pressed={selected}
                disabled={!open}
                onClick={() => onSelect(option.id)}
              >
                {option.label}
                {correct ? " — the answer" : ""}
              </Button>
            );
          })}
        </div>
      ) : null}
      <AnswerNames play={play} />
      {open && play.question.kind === "choice" ? (
        <Button
          className={
            snapshot.trolls.active.some(
              (effect) =>
                effect.kind === "yield" &&
                effect.role === "target" &&
                effect.status === "active",
            )
              ? "troll-dodge"
              : ""
          }
          disabled={!selectedId}
          onClick={onSubmit}
        >
          Send answer
        </Button>
      ) : null}
    </section>
  );
}

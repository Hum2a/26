import type { LobbySnapshot, PlaySnapshot, RoomPhaseName } from "@26/shared";
import { Panel } from "../ui/primitives";
import { AnswerNames } from "./attributions";

function stagePhaseTitle(phase: RoomPhaseName): string {
  switch (phase) {
    case "intro":
      return "Get ready";
    case "prompt":
      return "Read the question";
    case "collect":
      return "Answers are open";
    case "reveal":
      return "The reveal";
    case "scores":
      return "Standings";
    case "final":
      return "Final scores";
    case "podium":
      return "Podium";
    case "vote":
      return "Voting";
    case "predict":
      return "Predictions";
    default:
      return "Lobby";
  }
}

export function StagePlay({ snapshot }: { snapshot: LobbySnapshot }) {
  const play = snapshot.play;
  if (!play) {
    return null;
  }
  const leadBoard =
    snapshot.phase === "scores" ||
    snapshot.phase === "final" ||
    snapshot.phase === "podium";
  return (
    <Panel title={stagePhaseTitle(snapshot.phase)} display="stage">
      <div data-phase={snapshot.phase} hidden />
      {snapshot.finishAfterRound &&
      snapshot.phase !== "final" &&
      snapshot.phase !== "podium" ? (
        <p>This is the last question.</p>
      ) : null}
      {leadBoard ? <Standings play={play} /> : null}
      <QuestionView play={play} omitBoard={leadBoard} />
    </Panel>
  );
}

function QuestionView({ play, omitBoard }: { play: PlaySnapshot; omitBoard: boolean }) {
  if (play.question.kind === "slider") {
    return <SliderView play={play} omitBoard={omitBoard} />;
  }
  if (play.question.kind === "rank") {
    return <RankView play={play} omitBoard={omitBoard} />;
  }
  if (play.question.kind === "vote" || play.question.kind === "guess") {
    return <BallotView play={play} omitBoard={omitBoard} />;
  }
  if (play.question.kind === "duel" || play.question.kind === "finale") {
    return <DuelView play={play} omitBoard={omitBoard} />;
  }
  const reveal = play.reveal?.kind === "choice" ? play.reveal : undefined;
  const answer = reveal
    ? play.question.options.find((option) => option.id === reveal.correctOptionId)
    : undefined;
  const countLabel =
    play.submissionCount === 1 ? "1 answer in." : `${play.submissionCount} answers in.`;

  return (
    <div className="grid gap-4">
      <p>
        Illustrative demo. Question {play.question.index} of {play.question.total}.
      </p>
      <p className="stage-prompt">{play.question.prompt}</p>
      <ul className="grid gap-3">
        {play.question.options.map((option) => (
          <li key={option.id} className="stage-option">
            {option.label}
          </li>
        ))}
      </ul>
      <p>{countLabel}</p>
      <AnswerNames play={play} />
      {answer ? <p className="stage-answer">The answer is {answer.label}.</p> : null}
      {omitBoard ? null : <Standings play={play} />}
    </div>
  );
}

function SliderView({ play, omitBoard }: { play: PlaySnapshot; omitBoard: boolean }) {
  if (play.question.kind !== "slider") {
    return null;
  }
  const reveal = play.reveal?.kind === "slider" ? play.reveal : undefined;
  return (
    <div className="grid gap-4">
      <p className="stage-prompt">{play.question.prompt}</p>
      <p>
        {play.submissionCount === 1
          ? "1 estimate in."
          : `${play.submissionCount} estimates in.`}
      </p>
      {reveal ? (
        <p className="stage-answer">
          The answer is {reveal.truth} {reveal.unit}.
        </p>
      ) : null}
      {reveal ? (
        <ul className="grid gap-2">
          {reveal.guesses.map((guess) => (
            <li key={`${guess.nickname ?? "guest"}-${guess.value}`}>
              {guess.nickname
                ? `${guess.nickname} guessed ${guess.value} ${reveal.unit} and scored ${guess.points}.`
                : `A guess of ${guess.value} ${reveal.unit} scored ${guess.points}.`}
            </li>
          ))}
        </ul>
      ) : null}
      {omitBoard ? null : <Standings play={play} />}
    </div>
  );
}

function RankView({ play, omitBoard }: { play: PlaySnapshot; omitBoard: boolean }) {
  if (play.question.kind !== "rank") {
    return null;
  }
  const reveal = play.reveal?.kind === "rank" ? play.reveal : undefined;
  return (
    <div className="grid gap-4">
      <p className="stage-prompt">{play.question.prompt}</p>
      <ul className="grid gap-3">
        {play.question.items.map((item) => (
          <li key={item.id} className="stage-option">
            {item.label}
          </li>
        ))}
      </ul>
      <p>
        {play.submissionCount === 1
          ? "1 ranking in."
          : `${play.submissionCount} rankings in.`}
      </p>
      {reveal ? (
        <p className="stage-answer">
          The order is {orderLabels(play.question, reveal.order)}.
        </p>
      ) : null}
      {reveal ? (
        <ul className="grid gap-2">
          {reveal.rankings.map((ranking) => (
            <li
              key={
                ranking.nickname ??
                ranking.placements.map((item) => item.itemId).join("-")
              }
            >
              {ranking.nickname
                ? `${ranking.nickname} scored ${ranking.points}. `
                : `A ranking scored ${ranking.points}. `}
              {ranking.placements
                .map((placement) => {
                  const item =
                    play.question.kind === "rank"
                      ? play.question.items.find(
                          (entry) => entry.id === placement.itemId,
                        )?.label
                      : placement.itemId;
                  const tier =
                    play.question.kind === "rank"
                      ? play.question.tiers.find(
                          (entry) => entry.id === placement.tierId,
                        )?.label
                      : placement.tierId;
                  return `${item} ${tier}`;
                })
                .join(", ")}
            </li>
          ))}
        </ul>
      ) : null}
      {omitBoard ? null : <Standings play={play} />}
    </div>
  );
}

function orderLabels(
  question: Extract<PlaySnapshot["question"], { kind: "rank" }>,
  order: Extract<NonNullable<PlaySnapshot["reveal"]>, { kind: "rank" }>["order"],
): string {
  return order
    .flatMap((group) =>
      group.itemIds.map(
        (itemId) => question.items.find((item) => item.id === itemId)?.label ?? itemId,
      ),
    )
    .join(", ");
}

function BallotView({ play, omitBoard }: { play: PlaySnapshot; omitBoard: boolean }) {
  if (play.question.kind !== "vote" && play.question.kind !== "guess") {
    return null;
  }
  const reveal =
    play.reveal?.kind === "vote" || play.reveal?.kind === "guess"
      ? play.reveal
      : undefined;
  const total = play.ballot?.total ?? 0;
  const listingVotes =
    play.question.kind === "guess" ||
    play.reveal !== null ||
    play.ballot?.reason === "open" ||
    play.ballot?.reason === "late" ||
    play.ballot?.reason === "empty";
  const noun =
    play.question.kind === "guess" ? "guess" : listingVotes ? "vote" : "answer";
  const countLabel =
    play.submissionCount === 1
      ? `1 ${noun} in.`
      : `${play.submissionCount} ${noun}s in.`;
  return (
    <div className="grid gap-4">
      <p className="stage-prompt">{play.question.prompt}</p>
      <p>
        {total === 1
          ? "1 choice is on the ballot."
          : `${total} choices are on the ballot.`}
      </p>
      {total > (play.ballot?.cards.length ?? 0) ? (
        <p>The phones have the full list. This screen keeps a short one.</p>
      ) : null}
      <div className="grid gap-2">
        {play.ballot?.cards.map((card) => (
          <p key={card.id} className="stage-option">
            {card.label}
            {card.author ? ` — ${card.author}` : ""}
          </p>
        ))}
      </div>
      <p>{countLabel}</p>
      {reveal?.featured ? (
        <p>The stage is showing a host selection. Scores use every vote.</p>
      ) : null}
      {reveal?.kind === "guess" && reveal.truthLabel ? (
        <p className="stage-answer">The answer is {reveal.truthLabel}.</p>
      ) : null}
      {reveal ? (
        <ul className="grid gap-2">
          {reveal.cards.map((card) => (
            <li key={card.id}>
              {card.label} has {card.votes} {card.votes === 1 ? "vote" : "votes"}.
              {card.winning ? " Winning." : ""}
              {card.author ? ` ${card.author} wrote it.` : ""}
            </li>
          ))}
        </ul>
      ) : null}
      {reveal && reveal.winnerCount > 0 ? (
        <p>
          {reveal.winnerCount === 1
            ? "1 answer won"
            : `${reveal.winnerCount} answers won`}{" "}
          on the full tally
          {reveal.winners.length > 0
            ? `: ${reveal.winners.map((winner) => winner.label).join(", ")}`
            : ""}
          .
        </p>
      ) : null}
      {omitBoard ? null : <Standings play={play} />}
    </div>
  );
}

function DuelView({ play, omitBoard }: { play: PlaySnapshot; omitBoard: boolean }) {
  if (play.question.kind !== "duel" && play.question.kind !== "finale") {
    return null;
  }
  const target = play.question.target;
  const reveal =
    play.reveal?.kind === "duel" || play.reveal?.kind === "finale"
      ? play.reveal
      : undefined;
  const total = play.duel?.board?.total ?? reveal?.pairCount ?? 0;
  const rows = play.duel?.board?.rows ?? [];
  return (
    <div className="grid gap-4">
      <p className="stage-prompt">{play.question.prompt}</p>
      {play.question.kind === "finale" && play.question.tieBreak === "tied" ? (
        <p>This is the tie-break.</p>
      ) : null}
      <p>{total === 1 ? "1 duel." : `${total} duels.`}</p>
      {total > rows.length && rows.length > 0 ? (
        <p>
          Showing {rows.length} of {total} duels. Scores include every duel.
        </p>
      ) : null}
      {total > 8 && rows.length === 0 ? (
        <p>The phones have every match. This screen keeps a short list.</p>
      ) : null}
      <div className="grid gap-2">
        {reveal
          ? reveal.pairs.map((pair) => (
              <p
                key={`${pair.left}-${pair.right ?? "target"}`}
                className="stage-option"
              >
                {pair.right
                  ? `${pair.left} faces ${pair.right}`
                  : `${pair.left} faces the target ${target}`}
                {pair.leftValue !== null ? ` with ${pair.leftValue}` : ""}
                {pair.right && pair.rightValue !== null
                  ? ` against ${pair.rightValue}`
                  : ""}
                {pair.result === "tie" ? ". Tie." : ""}
                {pair.result === "left" ? `. ${pair.left} wins.` : ""}
                {pair.result === "right" && pair.right ? `. ${pair.right} wins.` : ""}
                {pair.result === "solo" ? ". Target met." : ""}
              </p>
            ))
          : rows.map((pair) => (
              <p
                key={`${pair.left}-${pair.right ?? "target"}`}
                className="stage-option"
              >
                {pair.right
                  ? `${pair.left} faces ${pair.right}`
                  : `${pair.left} faces the target ${target}`}
              </p>
            ))}
      </div>
      {reveal && reveal.pairCount > reveal.pairs.length ? (
        <p>
          Showing {reveal.pairs.length} of {reveal.pairCount} duels. Scores include
          every duel.
        </p>
      ) : null}
      {reveal?.kind === "finale" && reveal.backers ? (
        <ul className="grid gap-2">
          {reveal.backers.map((backer) => (
            <li key={`${backer.nickname}-${backer.contestant}`}>
              {backer.nickname} backed {backer.contestant}.
            </li>
          ))}
        </ul>
      ) : null}
      {omitBoard ? null : <Standings play={play} />}
    </div>
  );
}

function Standings({ play }: { play: PlaySnapshot }) {
  if (!play.standings) {
    return null;
  }
  return (
    <ol className="grid gap-3" aria-label="Scoreboard">
      {play.standings.map((row) => (
        <li key={`${row.place}-${row.nickname}`} className="stage-score">
          {row.place}. {row.nickname} — {row.points}
        </li>
      ))}
    </ol>
  );
}

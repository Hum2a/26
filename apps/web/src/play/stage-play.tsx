import { lazy, Suspense } from "react";
const KartGameWrapper = lazy(() => import("../kart/KartGameWrapper"));
import { motion } from "motion/react";
import type { LobbySnapshot, PlaySnapshot, RoomPhaseName } from "@26/shared";
import { QuestionOptionImage } from "./question-option-image";
import { Panel } from "../ui/primitives";
import { Glyph } from "./designs/glyph";
import { AnswerNames } from "./attributions";
import { renderPresentation } from "./presentation";
import { KartDriversProvider } from "../kart/KartDriversProvider";
import { KartCountdown } from "../kart/KartCountdown";
import { FunFactStage } from "./fun-fact";
import { Scoreboard } from "../ui/scoreboard";
import { GuestPush } from "./guest-push";
import { PlayerAvatar } from "../ui/player-avatar";

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
    case "facts":
      return "From your phones";
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

export function StagePlay({
  snapshot,
  observedAt,
}: {
  snapshot: LobbySnapshot;
  /** When this snapshot arrived, for screens that follow the room's clock. */
  observedAt?: number;
}) {
  if (snapshot.phase === "facts" && snapshot.funFact) {
    return <FunFactStage fact={snapshot.funFact} />;
  }
  const play = snapshot.play;
  if (!play) {
    return null;
  }
  if (
    play.question.kind === "kart" &&
    !["scores", "final", "podium"].includes(snapshot.phase)
  )
    return (
      <KartDriversProvider snapshot={snapshot}>
        <Suspense fallback={<p>Preparing the race…</p>}>
          <KartGameWrapper race={play.kart} paused={snapshot.paused || snapshot.held} />
        </Suspense>
        <KartCountdown
          snapshot={snapshot}
          observedAt={observedAt ?? snapshot.serverNow}
        />
      </KartDriversProvider>
    );
  const leadBoard =
    snapshot.phase === "scores" ||
    snapshot.phase === "final" ||
    snapshot.phase === "podium";
  if (leadBoard)
    return (
      <>
        <div data-phase={snapshot.phase} hidden />
        <Standings
          play={play}
          title={stagePhaseTitle(snapshot.phase)}
          players={snapshot.players}
          podium
        />
      </>
    );
  if (play.question.kind === "choice" && play.question.push) {
    return (
      <Panel title={stagePhaseTitle(snapshot.phase)} display="stage">
        <div data-phase={snapshot.phase} hidden />
        <h2 className="stage-question">{play.question.prompt}</h2>
        <GuestPush
          snapshot={snapshot}
          push={play.question.push}
          observedAt={observedAt ?? snapshot.serverNow}
          stage
        />
      </Panel>
    );
  }
  const custom = renderPresentation(play.question.presentation, {
    surface: "stage",
    phase: snapshot.phase,
    play,
  });
  return (
    <Panel title={stagePhaseTitle(snapshot.phase)} display="stage">
      <div data-phase={snapshot.phase} hidden />
      {snapshot.finishAfterRound &&
      snapshot.phase !== "final" &&
      snapshot.phase !== "podium" ? (
        <p>This is the last question.</p>
      ) : null}
      {custom ?? (
        <>
          <QuestionView play={play} omitBoard={false} />
          {play.explanation ? <p className="stage-answer">{play.explanation}</p> : null}
        </>
      )}
    </Panel>
  );
}

function QuestionView({ play, omitBoard }: { play: PlaySnapshot; omitBoard: boolean }) {
  if (play.question.kind === "kart")
    return omitBoard ? null : (
      <Suspense fallback={<p>Preparing the race…</p>}>
        <KartGameWrapper race={play.kart} />
      </Suspense>
    );
  if (play.question.kind === "wordle")
    return (
      <>
        <Glyph surface="stage" phase="collect" play={play} />
        {omitBoard ? null : <Standings play={play} />}
      </>
    );
  if (play.question.kind === "slider") {
    return <SliderView play={play} omitBoard={omitBoard} />;
  }
  if (play.question.kind === "rank") {
    return <RankView play={play} omitBoard={omitBoard} />;
  }
  if (play.question.kind === "typed") {
    return <TypedView play={play} omitBoard={omitBoard} />;
  }
  if (play.question.kind === "vote" || play.question.kind === "guess") {
    return (
      <motion.div
        key={`${play.question.id}-${play.ballot?.epoch ?? "single"}-${Boolean(play.reveal)}`}
        initial={{ opacity: 0.5 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.24, ease: "easeOut" }}
      >
        <BallotView play={play} omitBoard={omitBoard} />
      </motion.div>
    );
  }
  if (play.question.kind === "duel" || play.question.kind === "finale") {
    return <DuelView play={play} omitBoard={omitBoard} />;
  }
  const reveal = play.reveal?.kind === "choice" ? play.reveal : undefined;
  const options = play.question.options;
  const answer = reveal
    ? options.find((option) => option.id === reveal.correctOptionId)
    : undefined;
  const count = (optionId: string) =>
    reveal?.tally?.find((row) => row.optionId === optionId)?.count;
  const countLabel =
    play.submissionCount === 1 ? "1 answer in." : `${play.submissionCount} answers in.`;

  return (
    <div className="grid gap-4">
      <p>
        {play.question.illustrative ? "Illustrative demo. " : null}
        Question {play.question.index} of {play.question.total}.
      </p>
      <p className="stage-prompt">{play.question.prompt}</p>
      <ul
        className={
          options.length > 6 ? "stage-option-grid" : "stage-options grid gap-3"
        }
      >
        {options.map((option) => {
          const votes = count(option.id);
          return (
            <li key={option.id} className="stage-option">
              {option.image ? <QuestionOptionImage src={option.image} /> : null}
              {option.label}
              {votes === undefined
                ? ""
                : ` — ${votes} ${votes === 1 ? "vote" : "votes"}`}
            </li>
          );
        })}
      </ul>
      <p>{countLabel}</p>
      <AnswerNames play={play} />
      {answer ? <p className="stage-answer">The answer is {answer.label}.</p> : null}
      {reveal && !answer ? (
        <p className="stage-answer">{outcomeLine(reveal, options)}</p>
      ) : null}
      {omitBoard ? null : <Standings play={play} />}
    </div>
  );
}

export function outcomeLine(
  reveal: Extract<NonNullable<PlaySnapshot["reveal"]>, { kind: "choice" }>,
  options: readonly { id: string; label: string }[],
): string {
  const label = (id: string) => options.find((option) => option.id === id)?.label ?? id;
  if (reveal.outcome === "multiple")
    return `The answers are ${(reveal.correctOptionIds ?? []).map(label).join(", ")}.`;
  if (reveal.outcome === "poll") {
    const tally = reveal.tally ?? [];
    const top = Math.max(0, ...tally.map((row) => row.count));
    if (top === 0) {
      return "No votes were cast.";
    }
    const leaders = tally
      .filter((row) => row.count === top)
      .map((row) => label(row.optionId));
    return leaders.length === 1
      ? `${leaders[0]} wins the room.`
      : `A tie between ${leaders.join(" and ")}.`;
  }
  if (reveal.everyone) {
    return "Everyone who answered scores.";
  }
  const winners = (reveal.winners ?? []).map(label);
  return winners.length > 0 ? `${winners.join(" and ")} scores.` : "Nobody scores.";
}

function TypedView({ play, omitBoard }: { play: PlaySnapshot; omitBoard: boolean }) {
  if (play.question.kind !== "typed") {
    return null;
  }
  const reveal = play.reveal?.kind === "typed" ? play.reveal : undefined;
  return (
    <div className="grid gap-4">
      <p className="stage-prompt">{play.question.prompt}</p>
      <p>
        {play.submissionCount === 1
          ? "1 answer in."
          : `${play.submissionCount} answers in.`}
      </p>
      {reveal ? (
        <p className="stage-answer">
          {play.question.scoring === "commonness"
            ? reveal.answer
            : `The answer is ${reveal.answer}.`}
        </p>
      ) : null}
      {reveal?.groups ? (
        <ul className="grid gap-3">
          {reveal.groups
            .filter((group) => group.count > 1)
            .slice(0, 5)
            .map((group) => (
              <li key={group.body} className="stage-option">
                #{group.rank} · {group.body} · {group.count} matches · {group.points}{" "}
                points
              </li>
            ))}
        </ul>
      ) : null}
      {reveal && !reveal.groups ? (
        <p>
          {reveal.correctCount} of {reveal.responseCount} got it.
        </p>
      ) : null}
      {reveal?.correctNames && reveal.correctNames.length > 0 ? (
        <p>Got it: {reveal.correctNames.join(", ")}.</p>
      ) : null}
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
          {reveal.truth === null
            ? "No estimates this round."
            : `${play.question.scoring === "consensus" ? "The room’s middle ground" : "The answer"} is ${estimateLabel(reveal.truth, reveal.unit)}.`}
        </p>
      ) : null}
      {reveal ? (
        <ul className="grid gap-2">
          {(play.question.kind === "slider" && play.question.scoring
            ? [...reveal.guesses].sort((a, b) => b.points - a.points).slice(0, 5)
            : reveal.guesses
          ).map((guess) => (
            <li key={`${guess.nickname ?? "guest"}-${guess.value}`}>
              {guess.nickname
                ? `${guess.nickname} guessed ${estimateLabel(guess.value, reveal.unit)} and scored ${guess.points}.`
                : `A guess of ${estimateLabel(guess.value, reveal.unit)} scored ${guess.points}.`}
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
          {play.question.scoring === "consensus" ? "The room’s order" : "The order"} is{" "}
          {orderLabels(play.question, reveal.order)}.
        </p>
      ) : null}
      {reveal ? (
        <ul className="grid gap-2">
          {(play.question.kind === "rank" && play.question.scoring === "consensus"
            ? [...reveal.rankings].sort((a, b) => b.points - a.points).slice(0, 5)
            : reveal.rankings
          ).map((ranking) => (
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
  if (play.question.kind === "vote" && play.question.flow && reveal?.kind === "vote")
    return (
      <div className="grid gap-6">
        <p className="stage-prompt">{play.question.prompt}</p>
        {reveal.awards ? (
          reveal.awards.map((award) => (
            <section key={award.label} className="grid gap-2">
              <h2 className="stage-answer">{award.label}</h2>
              <p className="stage-option">
                {award.winners.length
                  ? award.winners
                      .slice(0, 2)
                      .map((w) => w.label)
                      .join(" · ")
                  : "No votes — no award"}
                {award.winnerCount > Math.min(2, award.winners.length)
                  ? ` · and ${award.winnerCount - Math.min(2, award.winners.length)} more tied winners`
                  : ""}
              </p>
            </section>
          ))
        ) : (
          <>
            <h2 className="stage-answer">
              {reveal.winners.length ? "The bracket winner" : "No votes — no winner"}
            </h2>
            <p className="stage-option">
              {reveal.winners.map((w) => w.label).join(" · ")}
            </p>
          </>
        )}
        <p>{reveal.totalBallots} votes across the round.</p>
        {omitBoard ? null : <Standings play={play} />}
      </div>
    );
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
      {play.ballot?.label ? <p className="stage-answer">{play.ballot.label}</p> : null}
      {play.ballot?.instruction ? <p>{play.ballot.instruction}</p> : null}
      {listingVotes ? (
        <p>
          {total === 1
            ? "1 choice is on the ballot."
            : `${total} choices are on the ballot.`}
        </p>
      ) : play.question.instructions ? (
        <p className="stage-answer">{play.question.instructions}</p>
      ) : null}
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

function Standings({
  play,
  title,
  players = [],
  podium = false,
}: {
  play: PlaySnapshot;
  title?: string;
  players?: readonly { playerId: string; nickname: string }[];
  podium?: boolean;
}) {
  if (!play.standings && !title) {
    return null;
  }
  return (
    <Scoreboard
      title={title ?? "The standings"}
      label="Scoreboard"
      podium={podium}
      entries={(play.standings ?? []).map((row) => ({
        id: row.nickname,
        name: row.nickname,
        place: row.place,
        points: row.points,
        badge: (
          <PlayerAvatar
            playerId={
              players.find((player) => player.nickname === row.nickname)?.playerId ??
              row.nickname
            }
            nickname={row.nickname}
            size="sm"
          />
        ),
      }))}
    />
  );
}

function estimateLabel(value: number, unit: string): string {
  return unit === "£"
    ? new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(
        value,
      )
    : `${value} ${unit}`;
}

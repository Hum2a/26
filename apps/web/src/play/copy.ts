import type { LobbySnapshot } from "@26/shared";

export function guestRoundCopy(snapshot: LobbySnapshot): string {
  if (snapshot.held && snapshot.phase !== "reveal" && snapshot.phase !== "scores") {
    return "Waiting for the host.";
  }
  if (snapshot.paused) {
    return "The game is paused.";
  }
  const standing = snapshot.play?.selfStanding;
  if (snapshot.phase === "podium" || snapshot.phase === "final") {
    return standing
      ? `The quiz has ended. You finished ${ordinal(standing.place)} with ${standing.points} points.`
      : "The quiz has ended.";
  }
  if (snapshot.phase === "reveal" || snapshot.phase === "scores") {
    const answer = snapshot.play?.selfAnswer;
    const reveal = snapshot.play?.reveal;
    const award = snapshot.play?.selfAward;
    const result = revealResult(
      answer,
      reveal,
      award,
      snapshot.play?.selfBallot,
      snapshot.play?.duel?.role,
    );
    return standing
      ? `${result} You are ${ordinal(standing.place)} with ${standing.points} points.`
      : result;
  }
  if (snapshot.play?.question.kind === "wordle" && snapshot.phase === "collect") {
    const board =
      snapshot.play.selfAnswer?.kind === "wordle"
        ? snapshot.play.selfAnswer
        : undefined;
    return board?.status === "won"
      ? "You solved it. Watch the stage."
      : board?.status === "lost"
        ? "Your board is finished. Watch the stage."
        : "Find the word in six guesses.";
  }
  if (snapshot.play?.selfAnswer && snapshot.phase !== "vote") {
    return standing
      ? `Answer accepted. You have ${standing.points} points.`
      : "Answer accepted.";
  }
  if (snapshot.phase === "predict") {
    if (snapshot.play?.duel?.role === "late") {
      return "You joined too late for this duel.";
    }
    if (snapshot.play?.duel?.role === "spectator") {
      return snapshot.play.selfBallot ? "Prediction accepted." : "Back a winner.";
    }
    return "You are in the duel. Predictions close before you play.";
  }
  if (snapshot.phase === "vote") {
    if (snapshot.play?.selfBallot) {
      return "Vote accepted.";
    }
    if (snapshot.play?.ballot?.reason === "late") {
      return "You joined too late to vote in this round.";
    }
    if (snapshot.play?.ballot?.reason === "empty") {
      return snapshot.play.question.kind === "vote" &&
        snapshot.play.question.candidateMode === "shortlist"
        ? "The host has not chosen a ballot yet."
        : "No answers were submitted.";
    }
    return "Choose one answer.";
  }
  if (snapshot.phase === "collect") {
    if (snapshot.play?.question.kind === "guess") {
      if (snapshot.play.selfBallot) {
        return "Answer accepted.";
      }
      if (snapshot.play.ballot?.reason === "late") {
        return "You joined too late to vote in this round.";
      }
      return "Choose a player.";
    }
    if (snapshot.play?.question.kind === "vote") {
      return snapshot.play.selfAnswer ? "Answer accepted." : "Write an answer.";
    }
    if (
      snapshot.play?.question.kind === "duel" ||
      snapshot.play?.question.kind === "finale"
    ) {
      if (snapshot.play.duel?.role === "late") {
        return "You joined too late for this duel.";
      }
      if (snapshot.play.duel?.role === "spectator") {
        return snapshot.play.selfBallot
          ? "The duel is on. Your prediction is in."
          : "The duel is on. Predictions are closed.";
      }
      if (snapshot.play.selfAnswer) {
        return "Answer accepted.";
      }
      if (snapshot.play.duel?.role === "solo") {
        return `Face the target ${snapshot.play.question.target} on your own.`;
      }
      return `You face ${snapshot.play.duel?.opponent ?? "your opponent"}. Send a number closer to ${snapshot.play.question.target}.`;
    }
    if (snapshot.play?.question.kind === "slider") {
      return "Send an estimate.";
    }
    if (snapshot.play?.question.kind === "typed") {
      return "Type your answer.";
    }
    if (
      snapshot.play?.question.kind === "choice" &&
      snapshot.play.question.outcome === "poll"
    ) {
      return "Cast your vote.";
    }
    if (snapshot.play?.question.kind === "rank") {
      return "Place the items, then send.";
    }
    return "Choose an answer.";
  }
  if (snapshot.phase === "prompt" || snapshot.phase === "intro") {
    const duel = snapshot.play?.duel;
    const question = snapshot.play?.question;
    if (question?.kind === "duel" || question?.kind === "finale") {
      if (duel?.role === "late") {
        return "You joined too late for this duel.";
      }
      if (duel?.role === "spectator") {
        return "You can back a winner when predictions open.";
      }
      if (duel?.role === "solo") {
        return `You face the target ${question.target} on your own.`;
      }
      if (duel?.opponent) {
        return `You face ${duel.opponent}.`;
      }
    }
    return "Look at the stage. Answers open when the countdown starts.";
  }
  return "Waiting for the next question.";
}

function revealResult(
  answer: NonNullable<LobbySnapshot["play"]>["selfAnswer"] | undefined,
  reveal: NonNullable<LobbySnapshot["play"]>["reveal"] | undefined,
  award: number | null | undefined,
  ballot: NonNullable<LobbySnapshot["play"]>["selfBallot"] | undefined,
  role: NonNullable<NonNullable<LobbySnapshot["play"]>["duel"]>["role"] | undefined,
): string {
  if (reveal?.kind === "finale" && role === "spectator") {
    if (!ballot) {
      return "No prediction was received.";
    }
    if (award === undefined || award === null) {
      return "Prediction accepted.";
    }
    return award > 0
      ? `You scored ${award} for that prediction.`
      : "That prediction scored 0.";
  }
  if (reveal?.kind === "duel" || reveal?.kind === "finale") {
    if (!answer) {
      return "No answer was received.";
    }
    if (award === undefined || award === null) {
      return "Answer accepted.";
    }
    return award > 0 ? `You scored ${award} for that duel.` : "That duel scored 0.";
  }
  if (reveal?.kind === "guess") {
    if (!ballot) {
      return "No answer was received.";
    }
    if (award === undefined || award === null) {
      return "Answer accepted.";
    }
    return award > 0 ? `You scored ${award} for that guess.` : "That guess scored 0.";
  }
  if (!answer) {
    return "No answer was received.";
  }
  if (reveal?.kind === "choice" && answer.kind === "choice") {
    if (reveal.outcome === "poll") {
      return "Your vote is in the count.";
    }
    if (reveal.outcome === "threshold") {
      return award ? `Your side scored. You got ${award}.` : "Your side scored 0.";
    }
    return answer.optionId === reveal.correctOptionId
      ? "You were right."
      : "That was not the answer.";
  }
  if (reveal?.kind === "wordle")
    return award
      ? `You solved it. You scored ${award}.`
      : "The word was not solved in time.";
  if (reveal?.kind === "typed") {
    if (award === undefined || award === null) {
      return "Answer accepted.";
    }
    return award > 0 ? `You got it. You scored ${award}.` : "That was not the answer.";
  }
  if (award === undefined || award === null) {
    return "Answer accepted.";
  }
  if (
    reveal?.kind === "slider" &&
    answer.kind === "slider" &&
    answer.value === reveal.truth
  ) {
    return `Exact. You scored ${award} on this question.`;
  }
  if (reveal?.kind === "slider") {
    return award > 0
      ? `Close. You scored ${award} on this question.`
      : "That estimate scored 0.";
  }
  if (reveal?.kind === "rank") {
    return `You scored ${award} for that ranking.`;
  }
  if (reveal?.kind === "vote") {
    return award > 0 ? `You scored ${award} for your line.` : "Your line scored 0.";
  }
  return "That was not the answer.";
}

function ordinal(place: number): string {
  const mod100 = place % 100;
  if (mod100 >= 11 && mod100 <= 13) {
    return `${place}th`;
  }
  const mod10 = place % 10;
  if (mod10 === 1) {
    return `${place}st`;
  }
  if (mod10 === 2) {
    return `${place}nd`;
  }
  if (mod10 === 3) {
    return `${place}rd`;
  }
  return `${place}th`;
}

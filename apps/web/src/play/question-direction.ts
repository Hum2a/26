import type { LobbySnapshot } from "@26/shared";

/** Copy follows the server phase and this guest's role; it never advances a round. */
export function questionDirection(snapshot: LobbySnapshot, pending: boolean): string {
  const play = snapshot.play;
  if (snapshot.paused) return "Hang tight — the host will carry on soon";
  if (snapshot.held) return "Waiting for the host";
  if (snapshot.phase === "facts") return "Watch the stage";
  if (pending && play?.question.kind !== "chess")
    return play?.question.kind === "wordle"
      ? "Checking your word…"
      : "Sending your answer…";
  if (!play) return "Watch the stage";
  if (snapshot.phase === "reveal" || snapshot.phase === "scores")
    return "The results are in";
  if (snapshot.phase === "final" || snapshot.phase === "podium")
    return "Time to celebrate";
  if (play.question.kind === "wordle" && snapshot.phase === "collect") {
    const board = play.selfAnswer?.kind === "wordle" ? play.selfAnswer : undefined;
    if (board?.status === "won") return "Solved — watch the stage";
    if (board?.status === "lost") return "Board finished — watch the stage";
    return "Type five letters, then check your word";
  }
  if (play.duel?.role === "late") return "You’re watching this round";
  if (
    snapshot.phase === "vote" ||
    snapshot.phase === "predict" ||
    play.question.kind === "guess"
      ? play.selfBallot
      : play.selfAnswer
  )
    return "Locked in — watch the stage";
  if (snapshot.phase === "intro") return "Listen to Baseer for the next cue.";
  if (snapshot.phase === "prompt")
    return play.question.kind === "kart"
      ? "Wait for Baseer to start the race."
      : "Read along. Wait for the signal to play.";
  if (snapshot.phase === "vote") return "Pick a line, then send your vote";
  if (snapshot.phase === "predict")
    return play.duel?.role === "spectator"
      ? "Back a winner, then send"
      : "You’re playing — wait for predictions to close";
  if (snapshot.phase !== "collect") return "Watch the stage";
  if (play.duel?.role === "spectator") return "Watch the duel on the stage";
  if (play.ballot && play.ballot.reason !== "open") return "Watch the stage";
  switch (play.question.kind) {
    case "kart":
      if (play.kart?.ended) return "Race complete. Watch the stage.";
      if (play.kart && !play.kart.selfPlayerId) return "Watch the race on the stage.";
      return "Accelerate to drive — race on your phone";
    case "chess":
      return play.chess && "fen" in play.chess && play.chess.isGameOver
        ? "Game finished — watch the stage"
        : "Play 1-minute blitz against Stockfish";
    case "choice":
      return play.question.outcome === "multiple"
        ? "Select all that apply, then send"
        : "Pick one, then send your answer";
    case "map-guess":
      return "Drop a pin, then send";
    case "slider":
      return play.question.input === "number"
        ? "Enter your price, then lock it in"
        : "Slide to your estimate, then send";
    case "rank":
      return "Place the items, then send your ranking";
    case "guess":
      return "Choose a player, then send your vote";
    case "duel":
    case "finale":
      return "Enter your number, then send";
    case "vote":
      return "Write your line, then send";
    case "wordle":
      return "Type five letters, then check your word";
    case "typed":
      return play.question.scoring === "commonness"
        ? "Make up a password, then send"
        : "Type your answer, then send";
  }
}

export function questionBeat(snapshot: LobbySnapshot, pending: boolean): string {
  if (snapshot.paused) return "Paused";
  if (snapshot.held) return "Waiting for a cue";
  const { phase, play } = snapshot;
  if (phase === "intro") return "Listen";
  if (phase === "prompt")
    return play?.question.kind === "kart" ? "Get ready to race" : "Read the question";
  if (phase === "reveal") return "Answers closed";
  if (phase === "scores") return "Standings";
  if (!play || !["collect", "vote", "predict"].includes(phase))
    return "Watch the stage";
  if (play.question.kind === "chess") {
    if (!play.chess || !("fen" in play.chess) || play.chess.isGameOver)
      return "Watch the stage";
    return pending ? "Waiting for move" : "Play chess";
  }
  const status = answerStatus(snapshot, pending);
  if (status === "sending") return "Sending";
  if (status === "accepted") return "Locked in";
  if (
    (play.duel &&
      (play.duel.role === "late" ||
        (phase === "predict"
          ? play.duel.role !== "spectator"
          : play.duel.role === "spectator"))) ||
    (play.ballot && play.ballot.reason !== "open")
  )
    return "Watch the stage";
  if (phase === "vote" || phase === "predict") return "Vote now";
  if (play.question.kind === "kart") {
    if (play.kart?.ended || (play.kart && !play.kart.selfPlayerId))
      return "Watch the stage";
    return "Race time";
  }
  return "Answer now";
}

/**
 * Where this phone's answer stands, from the server's own record only:
 * "accepted" once the snapshot carries it, "sending" while a request is in
 * flight, otherwise "open" or "closed". A local selection is never "accepted".
 */
export function answerStatus(
  snapshot: LobbySnapshot,
  pending: boolean,
): "open" | "sending" | "accepted" | "closed" {
  const play = snapshot.play;
  if (!play) return "closed";
  if (pending) return "sending";
  const ballotPhase =
    snapshot.phase === "vote" ||
    snapshot.phase === "predict" ||
    play.question.kind === "guess";
  const answer = ballotPhase ? play.selfBallot : play.selfAnswer;
  const stillPlaying =
    answer !== null &&
    "kind" in answer &&
    answer.kind === "wordle" &&
    answer.status === "playing" &&
    ((snapshot.phase !== "reveal" && snapshot.phase !== "scores") ||
      answer.guesses.length === 0);
  if (answer && !stillPlaying) {
    return "accepted";
  }
  return !snapshot.paused &&
    !snapshot.held &&
    ["collect", "vote", "predict"].includes(snapshot.phase)
    ? "open"
    : "closed";
}

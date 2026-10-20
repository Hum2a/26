import type { LobbySnapshot } from "@26/shared";

/** Copy follows the server phase and this guest's role; it never advances a round. */
export function questionDirection(snapshot: LobbySnapshot, pending: boolean): string {
  const play = snapshot.play;
  if (snapshot.paused) return "Paused — hang tight";
  if (snapshot.held) return "Waiting for the host";
  if (pending) return "Sending your answer…";
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
  if (snapshot.phase === "prompt" || snapshot.phase === "intro")
    return "Get ready — listen to the question";
  if (snapshot.phase === "vote") return "Pick a line, then send your vote";
  if (snapshot.phase === "predict")
    return play.duel?.role === "spectator"
      ? "Back a winner, then send"
      : "You’re playing — wait for predictions to close";
  if (snapshot.phase !== "collect") return "Watch the stage";
  if (play.duel?.role === "spectator") return "Watch the duel on the stage";
  switch (play.question.kind) {
    case "kart":
      return "Hold A to drive — race on your phone";
    case "choice":
      return play.question.outcome === "multiple"
        ? "Select all that apply, then send"
        : "Pick one, then send your answer";
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

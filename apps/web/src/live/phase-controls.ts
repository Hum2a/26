import type { LobbySnapshot } from "@26/shared";

/** Labels describe what the next server transition actually opens. */
export function nextPhaseLabel(snapshot: LobbySnapshot): string {
  const question = snapshot.play?.question;
  switch (snapshot.phase) {
    case "intro":
      return "Show question";
    case "prompt": {
      const sequence =
        question?.kind === "choice" ? question.optionSequence : undefined;
      if (sequence && sequence.shown < sequence.total)
        return `Reveal next option (${sequence.shown}/${sequence.total})`;
      if (question?.kind === "kart") return "Start race";
      if (question?.kind === "chess") return "Start chess";
      if (question?.kind === "finale") return "Open predictions";
      return "Open answering";
    }
    case "predict":
      return "Start duel";
    case "collect":
      return question?.kind === "kart" ? "End race" : "Close answering";
    case "vote":
      return "Close voting";
    case "reveal":
      return "Show standings";
    case "scores":
      return snapshot.finishAfterRound || (question && question.index >= question.total)
        ? "Show final scores"
        : "Next question";
    case "facts":
      return (snapshot.funFactList?.index ?? snapshot.funFact?.index ?? 0) + 1 >=
        (snapshot.funFactList?.total ?? snapshot.funFact?.total ?? Infinity)
        ? "Show the podium"
        : "Next fact";
    case "final":
      return "Continue to the finale";
    default:
      return "Advance";
  }
}

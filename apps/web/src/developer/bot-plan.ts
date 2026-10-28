import type { LobbySnapshot } from "@26/shared";

export type BotAction =
  | { name: "answer"; optionId: string }
  | { name: "estimate"; value: number }
  | { name: "duel"; value: number }
  | { name: "rank"; placements: { itemId: string; tierId: string }[] }
  | { name: "text"; body: string }
  | { name: "ballot"; candidateId: string; epoch?: number };

/** Only public guest fields enter the planner. No answers, targets or server imports. */
export function planBot(
  snapshot: LobbySnapshot,
  ordinal: number,
): { key: string; action: BotAction } | undefined {
  const play = snapshot.play;
  if (!play || snapshot.paused || snapshot.held) return;
  const q = play.question;
  const key = `${q.id}:${snapshot.phase}:${play.ballot?.epoch ?? 0}${snapshot.rehearsalRevision ? `:run${snapshot.rehearsalRevision}` : ""}`;
  const ballot = play.ballot ?? (snapshot.phase === "predict" ? play.duel : null);
  if (ballot && ballot.reason === "open" && !play.selfBallot) {
    const cards = ballot.cards.filter((card) => card.selectable);
    const card = cards[ordinal % cards.length];
    if (card)
      return {
        key,
        action: { name: "ballot", candidateId: card.id, epoch: play.ballot?.epoch },
      };
  }
  if (snapshot.phase !== "collect") return;
  if (q.kind === "wordle") {
    const board = play.selfAnswer?.kind === "wordle" ? play.selfAnswer : undefined;
    const guesses = board?.guesses.length ?? 0;
    if (board && board.status !== "playing") return;
    const words = ["CRANE", "SLATE", "AUDIO", "HOUSE", "PARTY", "BIRTH"];
    const word = words[(ordinal + guesses) % words.length];
    if (guesses < 6 && word)
      return { key: `${key}:${guesses}`, action: { name: "text", body: word } };
    return;
  }
  if (play.selfAnswer) return;
  const scaled = (minimum: number, maximum: number, step: number) =>
    Number(
      (
        minimum +
        (ordinal % (Math.round((maximum - minimum) / step) + 1)) * step
      ).toPrecision(12),
    );
  if (q.kind === "choice") {
    const optionId = q.options[ordinal % q.options.length]!.id;
    return {
      key,
      action:
        q.outcome === "multiple"
          ? { name: "text", body: JSON.stringify([optionId]) }
          : { name: "answer", optionId },
    };
  }
  if (q.kind === "slider")
    return {
      key,
      action: { name: "estimate", value: scaled(q.minimum, q.maximum, q.step) },
    };
  if (q.kind === "rank")
    return {
      key,
      action: {
        name: "rank",
        placements: (q.mode === "partial" && q.ties === "forbidden"
          ? q.items.slice(0, q.tiers.length)
          : q.items
        ).map((item, i) => ({
          itemId: item.id,
          tierId: q.tiers[(i + ordinal) % q.tiers.length]!.id,
        })),
      },
    };
  if (q.kind === "typed" || q.kind === "vote")
    return {
      key,
      action: {
        name: "text",
        body: `Bot answer ${ordinal + 1}`.slice(
          0,
          q.kind === "typed" ? q.maxLength : 80,
        ),
      },
    };
  if (
    (q.kind === "duel" || q.kind === "finale") &&
    play.duel?.reason === "open" &&
    (play.duel.role === "pair" || play.duel.role === "solo")
  )
    return {
      key,
      action: { name: "duel", value: scaled(q.minimum, q.maximum, q.step) },
    };
}

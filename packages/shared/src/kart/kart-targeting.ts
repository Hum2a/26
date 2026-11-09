export type KartTarget = {
  playerId: string;
  number: number;
  status: "RACING" | "FINISHED" | "DNF";
  progress: number;
};

/** One-lap race: the nearest eligible racer ahead, never a client-named victim. */
export function selectKartTarget(owner: KartTarget, actors: readonly KartTarget[]) {
  return actors
    .filter(
      (actor) =>
        actor.playerId !== owner.playerId &&
        actor.status === "RACING" &&
        Number.isFinite(actor.progress) &&
        actor.progress > owner.progress &&
        actor.progress < 1,
    )
    .sort((a, b) => a.progress - b.progress || a.number - b.number)[0]?.playerId;
}

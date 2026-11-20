export type TrollPlayer = {
  playerId: string;
  nickname: string;
};

/** Players other than this phone, A to Z, narrowed by the search box. */
export function trollChoices(
  players: readonly TrollPlayer[],
  selfId: string,
  query: string,
): TrollPlayer[] {
  const needle = query.trim().toLocaleLowerCase("en-GB");
  return players
    .filter((player) => player.playerId !== selfId)
    .filter((player) =>
      needle.length === 0
        ? true
        : player.nickname.toLocaleLowerCase("en-GB").includes(needle),
    )
    .slice()
    .sort((left, right) => left.nickname.localeCompare(right.nickname, "en-GB"));
}

/** The line above the target list: ready to send, or still recharging. */
export function trollTokenLabel(cooling: boolean): string {
  return cooling ? "Recharging" : "Troll ready";
}

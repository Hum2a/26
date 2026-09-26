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

/** The public question index is 1 for round one. The token unlocks on round two. */
export function trollPickerLocked(roundIndex: number, used: boolean): boolean {
  return used || roundIndex < 2;
}

export function trollTokenLabel(used: boolean): string {
  return used ? "Troll used" : "1 troll left";
}

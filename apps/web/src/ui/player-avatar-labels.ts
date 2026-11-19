/** A stable 0–5 hue for a player, so they keep one colour all night. */
export function playerHue(playerId: string): number {
  let hash = 0;
  for (const char of playerId) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return hash % 6;
}

/** Rehearsal bots are named "Bot 001" and so on by the developer tools. */
export function looksLikeBot(nickname: string): boolean {
  return /^Bot \d{1,3}$/.test(nickname);
}

export function initials(nickname: string): string {
  const words = nickname.trim().split(/\s+/).filter(Boolean);
  const letters =
    words.length > 1
      ? `${words[0]![0]}${words[1]![0]}`
      : [...(words[0] ?? "?")].slice(0, 2).join("");
  return letters.toLocaleUpperCase("en-GB");
}

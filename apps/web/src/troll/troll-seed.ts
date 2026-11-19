/** A stable number from an effect id, for seeded visuals. */
export function seedFrom(id: string): number {
  let hash = 0;
  for (const character of id) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  }
  return hash || 26;
}

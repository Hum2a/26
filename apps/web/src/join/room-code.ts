/** Hosts may choose any six letters or digits; generated codes stay unambiguous. */
export const roomAlphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

export function sanitizeRoomCode(value: string): string {
  const allowed = new Set(roomAlphabet);
  return value
    .toUpperCase()
    .split("")
    .filter((character) => allowed.has(character))
    .join("")
    .slice(0, 6);
}

/** A full code from `?room=`, or null when the query is missing or incomplete. */
export function roomCodeFromQuery(room: string | null): string | null {
  if (!room) {
    return null;
  }
  const code = sanitizeRoomCode(room);
  return code.length === 6 ? code : null;
}

export const nicknameStorageKey = "26-nickname";
export const nicknameLimit = 24;

export function readStoredNickname(): string {
  try {
    const stored = localStorage.getItem(nicknameStorageKey) ?? "";
    return stored.slice(0, nicknameLimit);
  } catch {
    return "";
  }
}

export function rememberNickname(nickname: string): void {
  try {
    localStorage.setItem(nicknameStorageKey, nickname.slice(0, nicknameLimit));
  } catch {
    // Private mode and blocked storage still let the guest join.
  }
}

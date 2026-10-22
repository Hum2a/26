const key = "26-admin-return";

/** Only known admin destinations; never tokens, queries, escapes or external URLs. */
export function safeAdminReturnTo(value: string | null): string {
  if (!value) return "/admin";
  return /^\/admin(?:\/(?:content(?:\/[a-z0-9-]{1,40}\/[a-z0-9-]{1,40})?|phone-preview\/[a-z0-9-]{1,40}\/[a-z0-9-]{1,40}|kart|trolls|settings|rooms(?:\/[A-Za-z0-9-]+(?:\/(?:live|players|media|results|health|trolls|wall|analytics))?)?))?$/.test(
    value,
  )
    ? value
    : "/admin";
}

export function rememberAdminReturn(value: string): void {
  try {
    // Non-sensitive navigation preference shared with an email opened in another tab.
    localStorage.setItem(key, safeAdminReturnTo(value));
  } catch {
    /* A blocked storage API must not prevent sign-in. */
  }
}

export function recalledAdminReturn(): string {
  try {
    return safeAdminReturnTo(localStorage.getItem(key));
  } catch {
    return "/admin";
  }
}

export function clearAdminReturn(): void {
  try {
    localStorage.removeItem(key);
  } catch {
    /* Storage is optional. */
  }
}

const screenKinds = [
  "netanyahu",
  "australia",
  "mirror",
  "jelly",
  "comic-sans",
  "lights-out",
  "bubble-wrap",
  "fake-crash",
  "forced-update",
  "captcha",
  "notification-storm",
  "confetti",
  "dvd",
  "invasion",
  "call",
  "crack",
  "sponsor",
  "screen-recording",
  "low-battery",
  "airdrop",
  "overheating",
  "answer-viewers",
  "typing-dots",
  "reshuffle",
  "translate",
  "slider-drift",
  "reverse-typing",
  "autocorrect",
  "char-limit",
  "haptic-storm",
  "fake-last",
  "fake-exit",
] as const;

export type ScreenTrollKind = (typeof screenKinds)[number];

export function isScreenTroll(kind: string): kind is ScreenTrollKind {
  return screenKinds.some((item) => item === kind);
}

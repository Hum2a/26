import type { RoomPhase } from "../room/lifecycle.ts";

export const implementedTrollKinds = [
  "invasion",
  "call",
  "crack",
  "yield",
  "swap",
  "hide-score",
  "double",
  "typing",
  "voice",
  "theme",
  "sponsor",
] as const;

/** Short demo sting. Replace the file at `apps/web/public/assets/demo-sting.wav`. */
export const demoStingAsset = "/assets/demo-sting.wav";

export const themeCueCap = 4;
export const draftGapMs = 200;

export type TrollKind = (typeof implementedTrollKinds)[number];

export const modifierOrder = ["double"] as const;

export type TrollDefinition = {
  kind: TrollKind;
  label: string;
  assetLabel: string;
  slot: "transient" | "persistent";
  durationMs: number | null;
  phases: readonly RoomPhase[];
  escape: string | null;
  disruptsSubmission: boolean;
  /** `now` captions immediately. `reveal` and `scores` wait for that phase. */
  announce: "now" | "reveal" | "scores";
  /** Persistent effects usually end with the question. A theme song continues. */
  survivesQuestions: boolean;
  cueMs: number;
};

const immediate = {
  announce: "now" as const,
  survivesQuestions: false,
  cueMs: 4_000,
};

export const trollDefinitions: Record<TrollKind, TrollDefinition> = {
  invasion: {
    kind: "invasion",
    label: "Screen invasion",
    assetLabel: "Demo face",
    slot: "transient",
    durationMs: 8_000,
    phases: ["prompt", "collect", "vote", "predict", "reveal"],
    escape: "Dismiss",
    disruptsSubmission: false,
    ...immediate,
  },
  call: {
    kind: "call",
    label: "Call from Mum",
    assetLabel: "Demo call from Mum",
    slot: "transient",
    durationMs: 8_000,
    phases: ["collect", "vote", "predict"],
    escape: "Decline",
    disruptsSubmission: false,
    ...immediate,
  },
  crack: {
    kind: "crack",
    label: "Cracked screen",
    assetLabel: "Demo crack",
    slot: "transient",
    durationMs: 12_000,
    phases: ["prompt", "collect", "vote", "predict", "reveal"],
    escape: "Dismiss",
    disruptsSubmission: false,
    ...immediate,
  },
  yield: {
    kind: "yield",
    label: "Dodging button",
    assetLabel: "Demo button",
    slot: "transient",
    durationMs: 3_000,
    phases: ["collect"],
    escape: "Answer anyway",
    disruptsSubmission: true,
    ...immediate,
  },
  swap: {
    kind: "swap",
    label: "Nickname swap",
    assetLabel: "Demo nickname swap",
    slot: "transient",
    durationMs: 15_000,
    phases: ["intro", "prompt", "collect", "vote", "predict", "reveal", "scores"],
    escape: null,
    disruptsSubmission: false,
    ...immediate,
  },
  "hide-score": {
    kind: "hide-score",
    label: "Hidden score",
    assetLabel: "Demo hidden score",
    slot: "transient",
    durationMs: 12_000,
    phases: ["reveal", "scores", "final"],
    escape: "Show my score",
    disruptsSubmission: false,
    ...immediate,
  },
  double: {
    kind: "double",
    label: "Double or nothing",
    assetLabel: "Double or nothing",
    slot: "persistent",
    durationMs: null,
    phases: ["collect"],
    escape: null,
    disruptsSubmission: false,
    ...immediate,
  },
  typing: {
    kind: "typing",
    label: "Live typing",
    assetLabel: "Demo typing",
    slot: "transient",
    durationMs: 12_000,
    phases: ["collect"],
    escape: null,
    disruptsSubmission: false,
    ...immediate,
  },
  voice: {
    kind: "voice",
    label: "Voice clip",
    assetLabel: "Demo voice",
    slot: "persistent",
    durationMs: null,
    phases: ["collect", "vote", "predict"],
    escape: null,
    disruptsSubmission: false,
    announce: "reveal",
    survivesQuestions: false,
    cueMs: 3_000,
  },
  theme: {
    kind: "theme",
    label: "Theme song",
    assetLabel: "Demo sting",
    slot: "persistent",
    durationMs: null,
    phases: ["intro", "prompt", "collect", "vote", "predict", "reveal", "scores"],
    escape: null,
    disruptsSubmission: false,
    announce: "scores",
    survivesQuestions: true,
    cueMs: 3_000,
  },
  sponsor: {
    kind: "sponsor",
    label: "Sponsor break",
    assetLabel: "Demo sponsor",
    slot: "transient",
    durationMs: 4_000,
    phases: ["intro", "prompt", "reveal", "scores"],
    escape: null,
    disruptsSubmission: false,
    ...immediate,
  },
};

export function isTrollKind(value: unknown): value is TrollKind {
  return implementedTrollKinds.some((kind) => kind === value);
}

export function slotDecision(input: {
  active: boolean;
  queued: boolean;
}): "start" | "queue" | "occupied" {
  if (!input.active) {
    return "start";
  }
  if (!input.queued) {
    return "queue";
  }
  return "occupied";
}

/**
 * A refund returns the one token only when the effect never started and has
 * not already been refunded. A later spend stays spent.
 */
export function nextTokenState(input: {
  token: "ready" | "spent";
  effectRefunded: boolean;
  started: boolean;
}): { token: "ready" | "spent"; refunded: boolean } {
  if (input.effectRefunded || input.started) {
    return { token: input.token, refunded: input.effectRefunded };
  }
  return { token: "ready", refunded: true };
}

/**
 * Modifiers run in `modifierOrder`. A modifier applies only when the question
 * lists it and an accepted effect of that kind is still active. Zero stays zero.
 */
export function applyScoreModifiers(
  points: number,
  detail: string,
  enabled: readonly string[],
  active: readonly string[],
): { points: number; detail: string } {
  let next = points;
  let text = detail;
  for (const name of modifierOrder) {
    if (!enabled.includes(name) || !active.includes(name)) {
      continue;
    }
    if (name === "double") {
      if (next > 0) {
        next *= 2;
        text = `${text}*double`;
      } else {
        text = `${text}*nothing`;
      }
    }
  }
  return { points: next, detail: text };
}

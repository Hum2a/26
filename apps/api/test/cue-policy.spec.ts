import { entertainmentCueDecision } from "@26/shared";
import { describe, expect, it } from "vitest";

describe("stage cue playback", () => {
  it("drops a cue that was already showing, already played, or muted", () => {
    expect(
      entertainmentCueDecision({
        cueId: "cue",
        muted: false,
        unlocked: true,
        playedIds: [],
        presentBeforeListening: true,
      }),
    ).toBe("drop");
    expect(
      entertainmentCueDecision({
        cueId: "cue",
        muted: false,
        unlocked: true,
        playedIds: ["cue"],
        presentBeforeListening: false,
      }),
    ).toBe("drop");
    expect(
      entertainmentCueDecision({
        cueId: "cue",
        muted: true,
        unlocked: true,
        playedIds: [],
        presentBeforeListening: false,
      }),
    ).toBe("drop");
  });

  it("waits for the unlock gesture and then plays a new cue once", () => {
    expect(
      entertainmentCueDecision({
        cueId: "cue",
        muted: false,
        unlocked: false,
        playedIds: [],
        presentBeforeListening: false,
      }),
    ).toBe("wait");
    expect(
      entertainmentCueDecision({
        cueId: "cue",
        muted: false,
        unlocked: true,
        playedIds: [],
        presentBeforeListening: false,
      }),
    ).toBe("play");
    expect(
      entertainmentCueDecision({
        cueId: null,
        muted: false,
        unlocked: true,
        playedIds: [],
        presentBeforeListening: false,
      }),
    ).toBe("drop");
  });
});

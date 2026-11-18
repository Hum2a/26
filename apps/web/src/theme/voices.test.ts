import { describe, expect, it } from "vitest";
import { themes, type ThemeId } from "./themes";
import { defaultVoice, voices } from "./voices";

const ids = Object.keys(themes) as ThemeId[];

describe("theme voices", () => {
  it("keeps 26 basic on the original wording", () => {
    expect(voices["26-basic"]).toEqual({
      waiting: "Waiting for the next question.",
      locked: "The room has your answer. Watch the stage.",
      won: "Nice. Check Ranks for your place.",
      missed: "Plenty more to come.",
      invite: "Join on your phone",
      glyph: "★",
    });
    expect(voices["26-basic"]).toBe(defaultVoice);
  });

  it("gives every theme its own short lines", () => {
    for (const id of ids) {
      const voice = voices[id];
      for (const [line, text] of Object.entries(voice)) {
        expect(text.trim().length, `${id}.${line}`).toBeGreaterThan(0);
        // Long enough to say something, short enough for one phone line.
        expect(text.length, `${id}.${line}`).toBeLessThanOrEqual(
          line === "glyph" ? 2 : 48,
        );
      }
    }
    const won = new Set(ids.map((id) => voices[id].won));
    expect(won.size).toBe(ids.length);
  });

  it("never replaces the state words a guest relies on", () => {
    for (const id of ids) {
      // Won and missed sit right beside "+N points" and "No points this time".
      const { locked, waiting, won, missed } = voices[id];
      expect(`${locked} ${waiting} ${won} ${missed}`, id).not.toMatch(
        /\bSending\b|\+\d+ points/,
      );
    }
  });
});

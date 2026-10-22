import { describe, expect, it } from "vitest";
import { trollKinds } from "@26/shared";
import { sponsorLine } from "../src/troll/engine.ts";
import { trollDefinitions } from "../src/troll/catalogue.ts";

describe("troll catalogue", () => {
  it("defines every kind the shared list names, within the snapshot limits", () => {
    for (const kind of trollKinds) {
      const definition = trollDefinitions[kind];
      expect(definition, kind).toBeDefined();
      expect(definition.kind).toBe(kind);
      // lobbySnapshotSchema caps both at 40 characters.
      expect(definition.label.length, kind).toBeLessThanOrEqual(40);
      expect(definition.assetLabel.length, kind).toBeLessThanOrEqual(40);
      expect(definition.phases.length, kind).toBeGreaterThan(0);
      expect(definition.assetLabel, kind).not.toMatch(/^Demo /);
    }
  });

  it("marks input sabotage as disrupting, and only for questions it can affect", () => {
    for (const kind of [
      "reshuffle",
      "translate",
      "slider-drift",
      "reverse-typing",
      "autocorrect",
      "char-limit",
    ] as const) {
      const definition = trollDefinitions[kind];
      expect(definition.disruptsSubmission, kind).toBe(true);
      expect(definition.questionKinds?.length, kind).toBeGreaterThan(0);
      expect(definition.phases, kind).toContain("collect");
    }
    expect(trollDefinitions["slider-drift"].questionKinds).toEqual(["slider"]);
  });

  it("picks the same sponsor line for the same troll", () => {
    const line = sponsorLine("Amina", "00000000-0000-4000-8000-000000000001");
    expect(line).toContain("Amina");
    expect(sponsorLine("Amina", "00000000-0000-4000-8000-000000000001")).toBe(line);
  });
});

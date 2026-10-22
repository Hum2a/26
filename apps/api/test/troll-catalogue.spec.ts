import { describe, expect, it } from "vitest";
import { trollKinds } from "@26/shared";
import { sponsorLine } from "../src/troll/engine.ts";
import { adminTrollCatalogue } from "../src/room/admin-content.ts";
import { applyPointTransfers, trollDefinitions } from "../src/troll/catalogue.ts";

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

  it("only offers point-moving trolls on choice questions that opt in", () => {
    for (const kind of ["steal", "robin-hood", "share"] as const) {
      expect(trollDefinitions[kind].modifier, kind).toBe(true);
      expect(trollDefinitions[kind].questionKinds, kind).toEqual(["choice"]);
      expect(trollDefinitions[kind].slot, kind).toBe("persistent");
    }
  });

  it("moves points in a fixed order without creating any", () => {
    const awards = new Map([
      ["amina", { points: 100, detail: "correct" }],
      ["bilal", { points: 0, detail: "miss" }],
      ["chen", { points: 51, detail: "correct" }],
      ["dee", { points: 10, detail: "correct" }],
    ]);
    const total = (map: Map<string, { points: number }>) =>
      [...map.values()].reduce((sum, award) => sum + award.points, 0);

    const stolen = applyPointTransfers(
      awards,
      [{ kind: "steal", actorId: "bilal", targetId: "amina" }],
      () => null,
    );
    expect(stolen.get("amina")).toEqual({ points: 50, detail: "correct*stolen" });
    expect(stolen.get("bilal")).toEqual({ points: 50, detail: "miss*stole" });
    expect(total(stolen)).toBe(total(awards));

    const robbed = applyPointTransfers(
      awards,
      [{ kind: "robin-hood", actorId: "bilal", targetId: "amina" }],
      (exclude) => (exclude === "dee" ? "bilal" : "dee"),
    );
    expect(robbed.get("amina")?.points).toBe(0);
    expect(robbed.get("dee")?.points).toBe(110);

    const shared = applyPointTransfers(
      awards,
      [{ kind: "share", actorId: "dee", targetId: "chen" }],
      () => null,
    );
    // 61 split: the odd point goes to the target.
    expect(shared.get("dee")?.points).toBe(30);
    expect(shared.get("chen")?.points).toBe(31);

    // Order is steal, then Robin Hood, then share, whatever order they were sent.
    const both = applyPointTransfers(
      awards,
      [
        { kind: "share", actorId: "dee", targetId: "amina" },
        { kind: "steal", actorId: "bilal", targetId: "amina" },
      ],
      () => null,
    );
    expect(both.get("bilal")?.points).toBe(50);
    expect(both.get("amina")?.points).toBe(30);
    expect(both.get("dee")?.points).toBe(30);
    expect(total(both)).toBe(total(awards));

    // Nothing to take from a zero or negative award.
    expect(
      applyPointTransfers(awards, [{ kind: "steal", actorId: "amina", targetId: "bilal" }], () => null).get(
        "amina",
      )?.points,
    ).toBe(100);
  });

  it("builds the admin Trolls page data for every troll without the schema refusing it", () => {
    // This page broke once when a new catalogue field leaked into a strict schema.
    const catalogue = adminTrollCatalogue();
    expect(catalogue.trolls.map((troll) => troll.kind)).toEqual([...trollKinds]);
    expect(catalogue.trolls.find((troll) => troll.kind === "slider-drift")?.questionKinds).toEqual([
      "slider",
    ]);
    expect(catalogue.trolls.find((troll) => troll.kind === "steal")?.modifier).toBe(true);
    expect(catalogue.trolls.find((troll) => troll.kind === "double")?.modifier).toBe(true);
    expect(catalogue.trolls.find((troll) => troll.kind === "confetti")?.modifier).toBe(false);
  });

  it("picks the same sponsor line for the same troll", () => {
    const line = sponsorLine("Amina", "00000000-0000-4000-8000-000000000001");
    expect(line).toContain("Amina");
    expect(sponsorLine("Amina", "00000000-0000-4000-8000-000000000001")).toBe(line);
  });
});

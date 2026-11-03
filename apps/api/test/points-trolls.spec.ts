import { expect, it } from "vitest";
import { birthdayPack } from "../src/questions/packs/birthday/manifest.ts";

it("lets the points trolls run on every scored birthday choice and no poll", () => {
  const ordered = birthdayPack.order.map((id) =>
    birthdayPack.catalogue.find((question) => question.id === id)!,
  );
  const scored = ordered.filter(
    (question) => question.kind === "choice" && question.outcome.kind === "correct",
  );
  expect(scored.length).toBeGreaterThan(5);
  for (const question of scored) {
    expect(question.kind === "choice" && question.modifiers).toEqual(
      expect.arrayContaining(["steal", "robin-hood", "share"]),
    );
  }
  for (const question of ordered) {
    if (question.kind === "choice" && question.outcome.kind !== "correct") {
      expect(question.modifiers ?? []).not.toContain("steal");
    }
  }
});

import { expect, it } from "vitest";
import { estimateRoundMs, fixedBeatsMs } from "../src/questions/runtime";
import { adminContent } from "../src/room/admin-content";

it("estimates each round from its fixed beats and its own windows", () => {
  expect(estimateRoundMs({})).toBe(fixedBeatsMs);
  expect(estimateRoundMs({ collectMs: 20_000 })).toBe(fixedBeatsMs + 20_000);
  expect(estimateRoundMs({ collectMs: 20_000, voteMs: 15_000 })).toBe(
    fixedBeatsMs + 35_000,
  );
});

it("gives the admin running order an estimate for every birthday round", () => {
  const birthday = adminContent()?.packs.find((pack) => pack.id === "birthday");
  expect(birthday).toBeTruthy();
  for (const question of birthday!.questions) {
    expect(question.estimatedSeconds).toBeGreaterThanOrEqual(fixedBeatsMs / 1000);
    expect(question.estimatedSeconds).toBeLessThanOrEqual(3600);
  }
  const kart = birthday!.questions.find((q) => q.mechanic === "kart");
  expect(kart?.estimatedSeconds).toBeGreaterThanOrEqual(180 + fixedBeatsMs / 1000);
});

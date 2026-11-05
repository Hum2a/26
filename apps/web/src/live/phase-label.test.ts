import { expect, it } from "vitest";
import { roomPhaseSchema } from "@26/shared";
import { phaseLabel } from "./phase-label";

it("has plain words for every room phase", () => {
  for (const phase of roomPhaseSchema.options) {
    expect(phaseLabel(phase)).not.toBe(phase);
    expect(phaseLabel(phase)).toMatch(/^[A-Z]/);
  }
  expect(phaseLabel("collect")).toBe("Answers open");
  expect(phaseLabel("something-new")).toBe("something-new");
});

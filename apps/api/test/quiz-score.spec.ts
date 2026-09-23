import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  assertCollectWindow,
  demoAnswerKeyMarker,
  demoQuestions,
} from "../src/questions/demo-set.ts";
import { pointsFor } from "../src/questions/multiple-choice.ts";

const webSource = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../web/src",
);

describe("multiple-choice scoring", () => {
  it("scores from the server receipt and ignores a missing answer", () => {
    const speed = demoQuestions[0];
    if (!speed || speed.kind !== "choice" || !speed.speedBonus) {
      throw new Error("The first illustrative question has a speed bonus.");
    }
    const opened = 1_000;
    const deadline = opened + speed.collectMs;
    expect(
      pointsFor(speed, {
        optionId: speed.correctOptionId,
        receivedAt: opened,
        deadlineAt: deadline,
      }).points,
    ).toBe(speed.points + speed.speedBonus.maxPoints);
    expect(
      pointsFor(speed, {
        optionId: speed.correctOptionId,
        receivedAt: deadline - 1_000,
        deadlineAt: deadline,
      }).points,
    ).toBe(
      speed.points + Math.floor((speed.speedBonus.maxPoints * 1_000) / speed.collectMs),
    );
    expect(
      pointsFor(speed, {
        optionId: "square",
        receivedAt: opened,
        deadlineAt: deadline,
      }).points,
    ).toBe(0);
    expect(pointsFor(speed, undefined).points).toBe(0);

    const plain = demoQuestions[1];
    if (!plain || plain.kind !== "choice" || plain.speedBonus) {
      throw new Error("The second illustrative question has no speed bonus.");
    }
    expect(
      pointsFor(plain, {
        optionId: plain.correctOptionId,
        receivedAt: opened,
        deadlineAt: opened + plain.collectMs,
      }).points,
    ).toBe(plain.points);
  });

  it("keeps collection windows between 15 and 45 seconds", () => {
    for (const question of demoQuestions) {
      expect(question.collectMs).toBeGreaterThanOrEqual(15_000);
      expect(question.collectMs).toBeLessThanOrEqual(45_000);
    }
    expect(() => assertCollectWindow(10_000)).toThrow(/15 and 45/);
  });

  it("keeps the answer key out of the web source", async () => {
    const files = await walk(webSource);
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const text = await readFile(file, "utf8");
      expect(text).not.toContain(demoAnswerKeyMarker);
      expect(text).not.toContain("Illustrative demo: which of these is a circle?");
    }
  });
});

async function walk(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(fullPath)));
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }
  return files;
}

import { retiredBirthdayQuestions } from "../src/questions/packs/birthday/retired.ts";
import { expect, it } from "vitest";
import { birthdayPack } from "../src/questions/packs/birthday/manifest.ts";
import { toPlayable } from "../src/questions/authoring.ts";
import { validatePack } from "../src/questions/validate.ts";

it("saves all eight concepts without inventing a Reddit ending, local post, listing or special mechanic", () => {
  for (const id of ["tribunal-reddit"]) {
    const q = [...birthdayPack.catalogue, ...retiredBirthdayQuestions].find(
      (q) => q.id === id,
    )!;
    expect(birthdayPack.order).not.toContain(id);
    expect(q.status).toBe("draft");
    expect(toPlayable(q)).toBeUndefined();
  }
  const nextdoor = birthdayPack.catalogue.find((q) => q.id === "nextdoor-paranoia")!;
  expect(birthdayPack.order).toContain(nextdoor.id);
  expect(nextdoor.status).toBe("ready");
  expect(toPlayable(nextdoor)).toMatchObject({
    kind: "choice",
    correctOptionId: "newspapers",
  });
  expect(nextdoor.prompt).not.toMatch(/hoodie/i);
  if (nextdoor.kind !== "choice") throw new Error("Choice required");
  expect(nextdoor.options.map((option) => option.id)).toEqual([
    "newspapers",
    "police",
    "parent",
    "burglary",
  ]);
  const listing = birthdayPack.catalogue.find(
    (q) => q.id === "property-price-roulette",
  )!;
  expect(birthdayPack.order).toContain(listing.id);
  expect(listing.status).toBe("ready");
  expect(toPlayable(listing)).toMatchObject({
    kind: "slider",
    scoring: "under",
    truth: 750,
    minimum: 250,
    maximum: 3000,
  });
  const figurine = birthdayPack.catalogue.find((q) => q.id === "group-chat-figurine")!;
  expect(figurine.status).toBe("ready");
  expect(birthdayPack.order).toContain("group-chat-figurine");
  expect(toPlayable(figurine)).toMatchObject({
    kind: "guess",
    scoring: "majority",
    selfVote: "allowed",
    selfVoteBonus: "double",
  });
  expect(
    retiredBirthdayQuestions.filter((q) => q.id.startsWith("council-")).length,
  ).toBe(5);
  for (const id of [
    "council-broadwater-farm",
    "council-blackbird-leys",
    "council-thamesmead-south",
  ])
    expect(
      toPlayable(
        [...birthdayPack.catalogue, ...retiredBirthdayQuestions].find(
          (q) => q.id === id,
        ),
      ),
    ).toMatchObject({
      correctOptionId: "council",
    });
  const apology = birthdayPack.catalogue.find((q) => q.id === "apology-video-auction")!;
  expect(toPlayable(apology)).toMatchObject({
    kind: "vote",
    flow: { kind: "tournament" },
    collectMs: 30_000,
  });
  expect(
    toPlayable(
      retiredBirthdayQuestions.find((q) => q.id === "council-redoubt-new-babylon"),
    ),
  ).toMatchObject({ correctOptionId: "dystopia" });
  expect(validatePack(birthdayPack).filter((i) => i.level === "error")).toEqual([]);
  expect(birthdayPack.release).toBe("draft");
  expect(birthdayPack.order.at(-1)).toBe("best-dressed");
});

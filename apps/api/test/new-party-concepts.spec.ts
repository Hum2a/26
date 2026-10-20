import { expect, it } from "vitest";
import { birthdayPack } from "../src/questions/packs/birthday/manifest.ts";
import { toPlayable } from "../src/questions/authoring.ts";
import { questionPreview } from "../src/room/question-preview.ts";
import { validatePack } from "../src/questions/validate.ts";

it("saves all eight concepts without inventing a Reddit ending, local post, listing or special mechanic", () => {
  for (const id of [
    "tribunal-reddit",
    "nextdoor-paranoia",
    "group-chat-figurine",
    "defend-indefensible",
    "cursed-search-history",
    "property-price-roulette",
  ]) {
    const q = birthdayPack.catalogue.find((q) => q.id === id)!;
    expect(q.status).toBe("draft");
    expect(toPlayable(q)).toBeUndefined();
    if (
      ["group-chat-figurine", "defend-indefensible", "cursed-search-history"].includes(
        id,
      )
    )
      expect(questionPreview(birthdayPack, q).interactive).toBe(false);
  }
  expect(birthdayPack.catalogue.filter((q) => q.id.startsWith("council-")).length).toBe(
    5,
  );
  for (const id of [
    "council-broadwater-farm",
    "council-blackbird-leys",
    "council-thamesmead-south",
  ])
    expect(toPlayable(birthdayPack.catalogue.find((q) => q.id === id))).toMatchObject({
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
      birthdayPack.catalogue.find((q) => q.id === "council-redoubt-new-babylon"),
    ),
  ).toMatchObject({ correctOptionId: "dystopia" });
  expect(validatePack(birthdayPack).filter((i) => i.level === "error")).toEqual([]);
  expect(birthdayPack.release).toBe("draft");
  expect(birthdayPack.order).toEqual([]);
});

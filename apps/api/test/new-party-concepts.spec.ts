import { expect, it } from "vitest";
import { birthdayPack } from "../src/questions/packs/birthday/manifest.ts";
import { toPlayable } from "../src/questions/authoring.ts";
import { validatePack } from "../src/questions/validate.ts";

it("saves all eight concepts without inventing a Reddit ending, local post, listing or special mechanic", () => {
  for (const id of [
    "tribunal-reddit",
    "nextdoor-paranoia",
    "property-price-roulette",
  ]) {
    const q = birthdayPack.catalogue.find((q) => q.id === id)!;
    expect(birthdayPack.order).not.toContain(id);
    expect(q.status).toBe("draft");
    expect(toPlayable(q)).toBeUndefined();
  }
  const figurine = birthdayPack.catalogue.find((q) => q.id === "group-chat-figurine")!;
  expect(figurine.status).toBe("ready");
  expect(birthdayPack.order).not.toContain("group-chat-figurine");
  expect(toPlayable(figurine)).toMatchObject({
    kind: "guess",
    scoring: "majority",
    selfVote: "allowed",
    selfVoteBonus: "double",
  });
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
  expect(birthdayPack.order.at(-1)).toBe("kart-sprint");
});

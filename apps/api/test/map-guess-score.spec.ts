import { describe, expect, it } from "vitest";
import {
  mapGuessPoints,
  mapPinSchema,
  pinDistanceKm,
  publicQuestionSchema,
} from "@26/shared";

import { mapGuessQuestion, toPlayable } from "../src/questions/authoring.ts";
import { birthdayPack } from "../src/questions/packs/birthday/manifest.ts";
import { publicMapQuestion } from "../src/questions/map-guess.ts";
import { publicQuestionCore, publicQuestionImage } from "../src/questions/project.ts";

describe("map guessing", () => {
  it("rejects a directly authored audio clue and projects only photos", () => {
    const draft = mapGuessQuestion({
      id: "map-fixture",
      title: "Map fixture",
      prompt: "Where are we?",
      target: { known: { lat: 0, lng: 0, label: "Fixture location" } },
    });
    const audio = {
      name: "question",
      kind: "audio",
      required: true,
      asset: "/clue.mp3",
      credit: "Test",
    } as const;
    const photo = {
      name: "question",
      kind: "image",
      required: true,
      asset: "/clue.jpg",
      credit: "Test",
    } as const;
    expect(
      mapGuessQuestion({ ...draft, status: undefined, media: [audio] }).status,
    ).toBe("draft");
    expect(toPlayable({ ...draft, status: "ready", media: [audio] })).toBeUndefined();
    expect(publicQuestionImage({ media: [audio, photo] })).toMatchObject({
      image: { src: "/clue.jpg" },
    });
  });

  it("measures the short path across the date line", () => {
    expect(pinDistanceKm({ lat: 0, lng: 179 }, { lat: 0, lng: -179 })).toBeCloseTo(
      222.39,
      1,
    );
  });
  it("rejects invalid coordinates and gives more points to closer pins", () => {
    expect(mapPinSchema.safeParse({ lat: 91, lng: 0 }).success).toBe(false);
    expect(mapGuessPoints(0, 100)).toBe(100);
    expect(mapGuessPoints(693, 100)).toBe(50);
    expect(mapGuessPoints(8000, 100)).toBe(0);
  });

  it("keeps the birthday map target off the public projection and credit", () => {
    const authored = birthdayPack.catalogue.find((q) => q.id === "where-are-we");
    expect(authored?.status).toBe("ready");
    expect(authored?.kind).toBe("map-guess");
    const playable = toPlayable(authored);
    expect(playable?.kind).toBe("map-guess");
    if (playable?.kind !== "map-guess") throw new Error("map-guess required");
    expect(playable.target).toEqual({
      lat: 30.4083,
      lng: -9.60199,
      label: "Agadir seafront, Morocco",
    });
    const publicQuestion = publicMapQuestion(playable, 1, 1);
    expect(publicQuestionSchema.parse(publicQuestion).kind).toBe("map-guess");
    const payload = JSON.stringify({
      ...publicQuestion,
      ...publicQuestionCore(playable, 1, 1),
    });
    expect(payload).not.toContain("Agadir");
    expect(payload).not.toContain("30.4083");
    expect(payload).not.toContain("-9.60199");
    expect(payload).not.toContain("target");
    expect(publicQuestion.image?.credit).not.toMatch(/agadir/i);
    expect(publicQuestion.image?.alt).not.toMatch(/agadir/i);
    expect(publicQuestion.image?.src).toBe("/assets/questions/where-are-we/photo.webp");
    expect(birthdayPack.order).toContain("where-are-we");
    expect(birthdayPack.order).toContain("apology-video-auction");
    expect(birthdayPack.order).toContain("heathrow-search-query");
  });
});

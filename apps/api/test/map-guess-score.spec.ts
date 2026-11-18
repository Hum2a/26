import { describe, expect, it } from "vitest";
import { mapGuessPoints, mapPinSchema, pinDistanceKm } from "@26/shared";

import { mapGuessQuestion, toPlayable } from "../src/questions/authoring.ts";
import { publicQuestionImage } from "../src/questions/project.ts";

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
});

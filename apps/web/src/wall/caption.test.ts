import { expect, it } from "vitest";
import { cleanWallCaption, wallCaptionMax } from "@26/shared";

it("removes unsafe controls without damaging emoji or ordinary captions", () => {
  expect(cleanWallCaption(" \u0000Cake\n\u001f time\u007f 🎂 ")).toBe("Cake time 🎂");
  expect(cleanWallCaption("\u0000\u001f\u007f")).toBeNull();
  expect(cleanWallCaption({ caption: "not text" })).toBeNull();
  expect(cleanWallCaption("🎂".repeat(wallCaptionMax + 5))).toBe(
    "🎂".repeat(wallCaptionMax),
  );
});

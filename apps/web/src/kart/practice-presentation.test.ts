import { kartLookPresets } from "@26/shared";
import { expect, it } from "vitest";
import { defaultKartVfxPreset } from "@26/shared";
it("allows metadata-only updates to preserve a face but requires explicit null to clear it", () => {
  const metadata = {
    kind: practicePresentationKind,
    style: "royal",
    effects: defaultKartVfxPreset,
  };
  expect(readPracticePresentation(metadata)).not.toHaveProperty("face");
  expect(readPracticePresentation({ ...metadata, face: null })?.face).toBeNull();
  expect(readPracticePresentation({ ...metadata, face: undefined })).toBeUndefined();
});
import {
  readPracticePresentation,
  practicePresentationKind,
  practiceFaceLimit,
} from "./practice-presentation";
it("accepts only an explicit driver and bounded image bytes, never room data or image URLs", () => {
  const base = { kind: practicePresentationKind, style: "royal", face: null };
  expect(readPracticePresentation(base)).toEqual({ style: "royal", face: null });
  const face = new Blob(["image"], { type: "image/webp" });
  expect(readPracticePresentation({ ...base, face })?.face).toBe(face);
  for (const change of [
    { credential: "room-secret" },
    { face: "/media/private" },
    { style: "unknown" },
    { face: new Blob(["svg"], { type: "image/svg+xml" }) },
    { face: new Blob([new Uint8Array(practiceFaceLimit + 1)], { type: "image/png" }) },
  ])
    expect(readPracticePresentation({ ...base, ...change })).toBeUndefined();
});

it("accepts a cloned validated local effects preset or an explicit reset, without relaxing message privacy", () => {
  const base = { kind: practicePresentationKind, style: "royal", face: null };
  const preset = {
    ...defaultKartVfxPreset,
    effects: { ...defaultKartVfxPreset.effects },
  };
  const result = readPracticePresentation({ ...base, effects: preset });
  expect(result?.effects).toEqual(preset);
  expect(result?.effects).not.toBe(preset);
  preset.effects.flame = false;
  expect(result?.effects?.effects.flame).toBe(true);
  expect(readPracticePresentation({ ...base, effects: null })?.effects).toBeNull();
  for (const effects of [
    undefined,
    { ...preset, version: 2 },
    { ...preset, rate: Infinity },
    { ...preset, credential: "room-secret" },
    { ...preset, effects: { ...preset.effects, privateMediaUrl: "/private" } },
  ])
    expect(readPracticePresentation({ ...base, effects })).toBeUndefined();
  expect(
    readPracticePresentation({ ...base, effects: preset, gameId: "room" }),
  ).toBeUndefined();
});

it("validates and clones optional look presets, including combined effects and explicit reset", () => {
  const look = kartLookPresets.daylight;
  const result = readPracticePresentation({
    kind: practicePresentationKind,
    style: "racer",
    look,
    effects: defaultKartVfxPreset,
  });
  expect(result?.look).toEqual(look);
  expect(result?.look).not.toBe(look);
  expect(result?.effects).toEqual(defaultKartVfxPreset);
  expect(
    readPracticePresentation({
      kind: practicePresentationKind,
      style: "racer",
      look: undefined,
    }),
  ).toBeUndefined();
  expect(
    readPracticePresentation({
      kind: practicePresentationKind,
      style: "racer",
      look: { ...look, roomId: "private" },
    }),
  ).toBeUndefined();
  expect(
    readPracticePresentation({
      kind: practicePresentationKind,
      style: "racer",
      look: null,
    })?.look,
  ).toBeNull();
});

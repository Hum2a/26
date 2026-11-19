import { expect, it } from "vitest";
import {
  edOrHumzaPhotoCredit,
  edOrHumzaPhotos,
  edOrHumzaPreloadPaths,
  isEdOrHumzaPerson,
} from "./ed-or-humza-photos";

it("keeps Ed and Humza on distinct local files with guest-safe alt text", () => {
  expect(edOrHumzaPhotos.ed.avatar.src).toBe("/assets/questions/ed-or-humza/ed.webp");
  expect(edOrHumzaPhotos.humza.avatar.src).toBe(
    "/assets/questions/ed-or-humza/humza.webp",
  );
  expect(edOrHumzaPhotos.ed.portrait.src).not.toBe(edOrHumzaPhotos.humza.portrait.src);
  expect(edOrHumzaPhotos.ed.avatar.alt).toBe("Ed");
  expect(edOrHumzaPhotos.humza.avatar.alt).toBe("Humza");
  expect(edOrHumzaPhotoCredit).toBe("Photo supplied by Humza (private use)");
  expect(edOrHumzaPreloadPaths("phone")).toEqual([
    edOrHumzaPhotos.ed.avatar.src,
    edOrHumzaPhotos.humza.avatar.src,
  ]);
  expect(edOrHumzaPreloadPaths("stage")).toEqual([
    ...edOrHumzaPreloadPaths("phone"),
    edOrHumzaPhotos.ed.portrait.src,
    edOrHumzaPhotos.humza.portrait.src,
  ]);
  expect(isEdOrHumzaPerson("ed")).toBe(true);
  expect(isEdOrHumzaPerson("quote-01")).toBe(false);
});

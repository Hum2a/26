import { afterEach, describe, expect, it, vi } from "vitest";
import type { LobbySnapshot } from "@26/shared";
import { roomFixture } from "../admin/room-fixture.test-support";
import { preloadImages, questionImages } from "./preload";

afterEach(() => vi.unstubAllGlobals());

function withOptions(
  options: { id: string; label: string; image?: string }[],
): LobbySnapshot {
  return {
    ...roomFixture,
    phase: "intro",
    play: {
      question: { id: "q", kind: "choice", options },
    } as unknown as LobbySnapshot["play"],
  };
}

describe("question preloading", () => {
  it("lists only the pictures of the question already announced", () => {
    const snapshot = withOptions([
      { id: "a", label: "A", image: "/assets/questions/a.png" },
      { id: "b", label: "B" },
    ]);
    expect(questionImages(snapshot)).toEqual(["/assets/questions/a.png"]);
    expect(questionImages({ ...roomFixture, play: null })).toEqual([]);
  });

  it("requests each picture once", () => {
    const created: string[] = [];
    class FakeImage {
      decoding = "";
      set src(value: string) {
        created.push(value);
      }
      decode() {
        return Promise.resolve();
      }
    }
    vi.stubGlobal("Image", FakeImage);
    preloadImages(["/assets/questions/once.png", "/assets/questions/once.png"]);
    preloadImages(["/assets/questions/once.png"]);
    expect(created).toEqual(["/assets/questions/once.png"]);
  });
});

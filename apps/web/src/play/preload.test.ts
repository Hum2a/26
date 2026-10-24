import { afterEach, describe, expect, it, vi } from "vitest";
import type { LobbySnapshot } from "@26/shared";
import { roomFixture } from "../admin/room-fixture.test-support";
import { preloadImages, questionImages, warmKart } from "./preload";

const moduleLoads = vi.hoisted(() => ({ canvas: vi.fn(), stage: vi.fn() }));
vi.mock("../kart/KartCanvas", () => {
  moduleLoads.canvas();
  return { default: () => null };
});
vi.mock("../kart/KartGameWrapper", () => {
  moduleLoads.stage();
  return { default: () => null };
});

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
  it("warms only the renderer used by each screen, and does so once", async () => {
    warmKart("stage");
    warmKart("stage");
    await vi.dynamicImportSettled();
    expect(moduleLoads.stage).toHaveBeenCalledTimes(1);
    expect(moduleLoads.canvas).not.toHaveBeenCalled();
    warmKart("phone");
    warmKart("phone");
    await vi.dynamicImportSettled();
    expect(moduleLoads.canvas).toHaveBeenCalledTimes(1);
    expect(moduleLoads.stage).toHaveBeenCalledTimes(1);
  });
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

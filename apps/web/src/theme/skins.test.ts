import { describe, expect, it } from "vitest";
import { applyTheme } from "./install";
import { plainSkin, skinFor, skinnedThemeIds } from "./skins";

describe("theme skins", () => {
  it("keeps 26 basic on the plain chrome", () => {
    expect(skinFor("26-basic")).toEqual(plainSkin);
    applyTheme("26-basic");
    expect(document.documentElement.dataset.skin).toBe("plain");
    expect(document.documentElement.dataset.ground).toBe("flat");
    expect(document.documentElement.dataset.shape).toBe("round");
    expect(document.documentElement.dataset.mark).toBe("numeral");
  });

  it("gives the six trials a distinct ground, shape, and mark", () => {
    expect(skinnedThemeIds).toHaveLength(6);
    expect(skinFor("persona-5-take-your-time")).toMatchObject({
      id: "persona-5",
      ground: "slash",
      shape: "sharp",
      mark: "mask",
    });
    expect(skinFor("ps2-memory-card")).toMatchObject({
      ground: "grid",
      shape: "chunky",
      mark: "card",
    });
    expect(skinFor("cafe-leblanc-but-make-it-tea")).toMatchObject({
      ground: "split",
      shape: "soft",
      mark: "cup",
    });
    expect(skinFor("pitbull-mr-worldwide")).toMatchObject({
      ground: "stripes",
      shape: "round",
      mark: "shades",
    });
    expect(skinFor("spoon-world-portsmouth-edition")).toMatchObject({
      ground: "tiles",
      shape: "ticket",
      mark: "spoon",
    });
    expect(skinFor("gta-vi-vice-birthday")).toMatchObject({
      ground: "sunset",
      shape: "cut",
      mark: "skyline",
    });
  });

  it("writes the skin onto the document when a trial theme is chosen", () => {
    applyTheme("gta-vi-vice-birthday");
    expect(document.documentElement.dataset.theme).toBe("gta-vi-vice-birthday");
    expect(document.documentElement.dataset.skin).toBe("vice");
    expect(document.documentElement.dataset.ground).toBe("sunset");
    expect(document.documentElement.dataset.shape).toBe("cut");
    expect(document.documentElement.dataset.mark).toBe("skyline");
  });
});

import { describe, expect, it } from "vitest";
import { applyTheme } from "./install";
import { plainSkin, skinFor, skinnedThemeIds } from "./skins";
import { themes, type ThemeId } from "./themes";

describe("theme skins", () => {
  it("keeps 26 basic on the plain chrome", () => {
    expect(skinFor("26-basic")).toEqual(plainSkin);
    applyTheme("26-basic");
    expect(document.documentElement.dataset.skin).toBe("plain");
    expect(document.documentElement.dataset.ground).toBe("flat");
    expect(document.documentElement.dataset.shape).toBe("round");
    expect(document.documentElement.dataset.mark).toBe("numeral");
    expect(document.documentElement.dataset.finish).toBe("solid");
    expect(document.documentElement.dataset.motif).toBe("none");
    expect(document.documentElement.dataset.motifIcon).toBeUndefined();
  });

  it("gives the six trials a distinct ground, shape, and mark", () => {
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

  it("skins every theme except 26 basic", () => {
    const ids = Object.keys(themes) as ThemeId[];
    expect(skinnedThemeIds).toHaveLength(ids.length - 1);
    for (const id of ids) {
      if (id === "26-basic") {
        expect(skinFor(id).id).toBe("plain");
      } else {
        expect(skinnedThemeIds).toContain(id);
        expect(skinFor(id).id).not.toBe("plain");
      }
    }
    expect(skinFor("the-velvet-room").ground).toBe("glow");
    expect(skinFor("your-name-twilight-thread")).toMatchObject({
      ground: "horizon",
      mark: "sun",
    });
    expect(skinFor("wallington-grammar-school-arc").ground).toBe("ruled");
    expect(skinFor("fratton-park-matchday-shift")).toMatchObject({
      ground: "floodlight",
      mark: "beam",
    });
    expect(skinFor("26-karat")).toMatchObject({ ground: "foil", mark: "star" });
    expect(skinFor("absolutely-rigged").ground).toBe("tape");
    expect(skinFor("nissan-leaf")).toMatchObject({
      ground: "charge",
      shape: "soft",
      mark: "leaf",
    });
    expect(skinFor("toyota-prius-plus")).toMatchObject({
      ground: "horizon",
      shape: "soft",
      mark: "plus",
    });
    expect(skinFor("the-velvet-room").finish).toBe("glass");
    expect(skinFor("persona-5-take-your-time").finish).toBe("cartoon");
    expect(skinFor("fratton-park-matchday-shift").finish).toBe("realistic");
    expect(skinFor("humza-os").finish).toBe("minimal");
    expect(skinFor("26-karat").finish).toBe("extravagant");
    expect(skinFor("wallington-grammar-school-arc").finish).toBe("solid");
    expect(skinFor("humza-os").motif).toBe("none");
    expect(skinFor("nissan-leaf")).toMatchObject({ motif: "crest", icon: "nissan" });
    expect(skinFor("26-karat")).toMatchObject({ motif: "scatter", icon: "star" });
    expect(skinFor("persona-5-take-your-time")).toMatchObject({
      motif: "bleed",
      icon: "mask",
    });
  });

  it("writes the skin onto the document when a trial theme is chosen", () => {
    applyTheme("gta-vi-vice-birthday");
    expect(document.documentElement.dataset.theme).toBe("gta-vi-vice-birthday");
    expect(document.documentElement.dataset.skin).toBe("vice");
    expect(document.documentElement.dataset.ground).toBe("sunset");
    expect(document.documentElement.dataset.shape).toBe("cut");
    expect(document.documentElement.dataset.mark).toBe("skyline");
    expect(document.documentElement.dataset.finish).toBe("extravagant");
  });
});

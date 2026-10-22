import { describe, expect, it } from "vitest";
import { deepFamilies, deepSkinFor, plainDeep } from "./deep-skins";
import { applyTheme } from "./install";
import { skinFor } from "./skins";
import { themes, type ThemeId } from "./themes";

describe("deep skins", () => {
  it("gives every skinned family a deep layer, and keeps 26 basic plain", () => {
    const families = new Set(
      (Object.keys(themes) as ThemeId[]).map((id) => skinFor(id).id).filter((id) => id !== "plain"),
    );
    for (const family of families) {
      expect(deepFamilies, family).toContain(family);
    }
    expect(deepSkinFor(skinFor("26-basic"))).toEqual(plainDeep);
  });

  it("makes families genuinely different, not just recoloured", () => {
    const signatures = new Set(
      deepFamilies.map((family) => {
        const deep = deepSkinFor({ id: family });
        return [deep.scene, deep.control, deep.panel, deep.heading].join("/");
      }),
    );
    // Only the two car skins deliberately share a road scene and controls.
    expect(signatures.size).toBeGreaterThanOrEqual(deepFamilies.length - 1);
  });

  it("writes the deep layer onto the document and adds one texture layer", () => {
    applyTheme("humza-os");
    const root = document.documentElement.dataset;
    expect(root).toMatchObject({
      type: "mono",
      scene: "code",
      texture: "crt",
      control: "bracket",
      panel: "terminal",
      heading: "prompt",
      motion: "glitchy",
      align: "left",
    });
    applyTheme("persona-5-take-your-time");
    expect(document.documentElement.dataset.heading).toBe("ransom");
    expect(document.documentElement.dataset.scene).toBe("shards");
    expect(document.querySelectorAll(".deep-texture")).toHaveLength(1);
    expect(document.querySelector(".deep-texture")?.getAttribute("aria-hidden")).toBe("true");
    applyTheme("26-basic");
    expect(document.documentElement.dataset.scene).toBe("none");
    expect(document.documentElement.dataset.texture).toBe("none");
  });
});

import { describe, expect, it } from "vitest";
import { deepScenes } from "./deep-skins";
import {
  celebrations,
  identityDimensions,
  identityFor,
  markStyles,
  numeralStyles,
  optionMark,
  ornamentGlyphs,
  sceneStrengths,
  themeIdsWithFlavour,
  transitions,
} from "./identity";
import { themes, type ThemeId } from "./themes";
import deepCss from "./theme-deep.css?raw";
import identityCss from "./theme-identity.css?raw";
import scenesCss from "./theme-scenes.css?raw";

/**
 * Two themes must differ in at least this many visible dimensions (scene,
 * type, controls, marks, celebration, transition, numerals, ornament…), on top
 * of their colours and voice. This is what stops a theme being a recolour.
 */
const minimumDifferences = 5;

const ids = Object.keys(themes) as ThemeId[];

/**
 * True when a live rule for `selector` exists: outside a comment, followed
 * (perhaps after more of a selector list) by a block with a declaration.
 */
function draws(css: string, selector: string): boolean {
  const live = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`${escaped}[^{};]*\\{[^}]*:`).test(live);
}

describe("theme identities", () => {
  it("gives every theme an identity", () => {
    expect([...themeIdsWithFlavour].sort()).toEqual([...ids].sort());
  });

  it(`keeps every pair of themes at least ${minimumDifferences} visible dimensions apart`, () => {
    const close: string[] = [];
    for (let a = 0; a < ids.length; a += 1) {
      for (let b = a + 1; b < ids.length; b += 1) {
        const left = identityFor(ids[a]!);
        const right = identityFor(ids[b]!);
        const differ = identityDimensions.filter(
          (dimension) => left[dimension] !== right[dimension],
        );
        if (differ.length < minimumDifferences) {
          close.push(`${ids[a]} ~ ${ids[b]} (${differ.length}: ${differ.join(", ")})`);
        }
      }
    }
    expect(close).toEqual([]);
  });

  it("draws every scene, celebration, numeral style, ornament and strength", () => {
    const sheets = [deepCss, scenesCss, identityCss].join("\n");
    const expectDrawn = (attribute: string, values: readonly string[]) => {
      for (const value of values) {
        expect(draws(sheets, `[data-${attribute}="${value}"]`), value).toBe(true);
      }
    };
    expectDrawn(
      "scene",
      deepScenes.filter((value) => value !== "none"),
    );
    expectDrawn("celebrate", celebrations);
    expectDrawn(
      "numerals",
      numeralStyles.filter((value) => value !== "plain"),
    );
    expectDrawn(
      "ornament",
      Object.keys(ornamentGlyphs).filter((value) => value !== "none"),
    );
    expectDrawn(
      "strength",
      sceneStrengths.filter((value) => value !== "normal"),
    );
  });

  it("does not count a rule that only survives in a comment", () => {
    const selector = '[data-scene="moon"]';
    expect(draws(`/* html${selector} .x { opacity: 1; } */`, selector)).toBe(false);
    expect(draws(`html${selector} .x {}`, selector)).toBe(false);
    expect(
      draws(`html${selector} .x,\nhtml${selector} .y {\n  opacity: 1;\n}`, selector),
    ).toBe(true);
  });

  it("uses every scene and new dimension value at least once", () => {
    const used = (dimension: (typeof identityDimensions)[number]) =>
      new Set(ids.map((id) => identityFor(id)[dimension]));
    const scenes = used("scene");
    for (const scene of deepScenes.filter((value) => value !== "none")) {
      expect(scenes.has(scene), scene).toBe(true);
    }
    expect(used("celebrate").size).toBe(celebrations.length);
    expect(used("transition").size).toBe(transitions.length);
    expect(used("numerals").size).toBe(numeralStyles.length);
    expect(used("ornament").size).toBe(Object.keys(ornamentGlyphs).length);
    expect(used("strength").size).toBe(sceneStrengths.length);
    const marks = used("marks");
    for (const style of markStyles) expect(marks.has(style), style).toBe(true);
  });

  it("keeps 26 basic on the plain chrome", () => {
    expect(identityFor("26-basic")).toMatchObject({
      scene: "none",
      marks: "classic",
      transition: "rise",
      ornament: "none",
      numerals: "plain",
    });
  });
});

describe("option marks", () => {
  it("keeps the classic phone shapes and projector letters", () => {
    expect(optionMark("classic", 0, "phone")).toBe("▲");
    expect(optionMark("classic", 0, "stage")).toBe("A");
    expect(optionMark("classic", 6, "phone")).toBe("▲");
  });

  it("matches the phone and the projector for every other style", () => {
    for (const style of markStyles.filter((value) => value !== "classic")) {
      for (let index = 0; index < 8; index += 1) {
        expect(optionMark(style, index, "phone")).toBe(
          optionMark(style, index, "stage"),
        );
      }
    }
    expect(optionMark("roman", 3, "phone")).toBe("IV");
    expect(optionMark("buttons", 1, "stage")).toBe("○");
    expect(optionMark("players", 0, "phone")).toBe("P1");
  });

  it("continues a short set with numbers and keeps symbols as text", () => {
    expect(optionMark("buttons", 4, "phone")).toBe("5");
    // A variation selector stops a suit turning into a colour emoji.
    expect(optionMark("suits", 0, "phone")).toBe("♠︎");
  });
});

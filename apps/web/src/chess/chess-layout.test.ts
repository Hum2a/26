import { describe, expect, it } from "vitest";
import chessCss from "./chess.css?raw";
import controllerCss from "../controller/controller.css?raw";

/** The declarations of the first rule whose selector list is exactly `selector`. */
function rule(css: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(`(?:^|\\n)${escaped}\\s*\\{([^}]*)\\}`).exec(css);
  if (!match) throw new Error(`No rule for ${selector}`);
  return match[1]!;
}

/** Specificity as [ids, classes/attributes, elements] for a simple compound selector. */
function specificity(selector: string): [number, number, number] {
  const ids = selector.match(/#[\w-]+/g)?.length ?? 0;
  const classes = selector.match(/\.[\w-]+|\[[^\]]+\]/g)?.length ?? 0;
  const elements = selector
    .replace(/#[\w-]+|\.[\w-]+|\[[^\]]+\]/g, " ")
    .split(/\s+/)
    .filter(Boolean).length;
  return [ids, classes, elements];
}

function beats(a: [number, number, number], b: [number, number, number]): boolean {
  for (let index = 0; index < 3; index += 1) {
    if (a[index] !== b[index]) return a[index]! > b[index]!;
  }
  return false;
}

describe("phone chess board layout", () => {
  it("keeps the phone controller's 48px tap-target floor on ordinary buttons", () => {
    // If this floor moves or goes, revisit the chess opt-out below.
    expect(controllerCss).toMatch(/\.controller-root button,/);
    expect(controllerCss).toMatch(/min-width:\s*48px/);
    expect(controllerCss).toMatch(/min-height:\s*48px/);
  });

  it("lets every square shrink to an eighth of a phone-width board", () => {
    const optOut = ".chess-board .chess-square";
    const declarations = rule(chessCss, optOut);
    expect(declarations).toMatch(/min-width:\s*0/);
    expect(declarations).toMatch(/min-height:\s*0/);
    // It must win over `.controller-root button` regardless of stylesheet order.
    expect(beats(specificity(optOut), specificity(".controller-root button"))).toBe(
      true,
    );
  });

  it("sizes the square grid in equal tracks that content cannot widen", () => {
    const grid = rule(chessCss, ".chess-squares");
    expect(grid).toMatch(/grid-template-columns:\s*repeat\(8,\s*minmax\(0,\s*1fr\)\)/);
    expect(grid).toMatch(/grid-template-rows:\s*repeat\(8,\s*minmax\(0,\s*1fr\)\)/);
  });

  it("keeps the game to one column that cannot grow past the phone", () => {
    expect(rule(chessCss, ".chess-game")).toMatch(
      /grid-template-columns:\s*minmax\(0,\s*1fr\)/,
    );
    expect(rule(chessCss, ".chess-controls")).toMatch(/flex-wrap:\s*wrap/);
  });

  it("caps the board by the viewport height for a short landscape phone", () => {
    expect(rule(chessCss, ".chess-table")).toMatch(/max-width:[^;]*100dvh/);
  });
});

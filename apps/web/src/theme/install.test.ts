import { afterEach, describe, expect, it } from "vitest";
import { applyTheme } from "./install";
import { themeDocumentHead, themes } from "./themes";

const chromeSelector =
  'meta[name="theme-color"], meta[name="color-scheme"], meta[name="supported-color-schemes"]';

describe("browser chrome", () => {
  afterEach(() => {
    for (const node of document.head.querySelectorAll(chromeSelector)) {
      node.remove();
    }
  });

  it("publishes the default background for light and dark browser chrome", () => {
    const { chrome, themeColor } = themeDocumentHead();
    const background = themes["26-basic"].colors.background;
    expect(themeColor).toBe(background);
    expect(chrome.match(/name="theme-color"/g)).toHaveLength(3);
    expect(chrome).toContain(`name="theme-color" content="${background}"`);
    expect(chrome).toContain(
      `name="theme-color" content="${background}" media="(prefers-color-scheme: light)"`,
    );
    expect(chrome).toContain(
      `name="theme-color" content="${background}" media="(prefers-color-scheme: dark)"`,
    );
    expect(chrome).toContain('name="color-scheme" content="dark"');
    expect(chrome).toContain('name="supported-color-schemes" content="dark"');
  });

  it("repaints every theme-color tag when the party theme changes", () => {
    document.head.insertAdjacentHTML(
      "beforeend",
      `<meta name="theme-color" content="#000000" />`,
    );

    applyTheme("26-basic");
    const dark = themes["26-basic"].colors.background;
    expect(themeColors()).toEqual([dark, dark, dark]);
    expect(scheme()).toBe("dark");
    expect(document.querySelectorAll('meta[name="theme-color"]')).toHaveLength(3);

    applyTheme("confetti-department");
    const light = themes["confetti-department"].colors.background;
    expect(themeColors()).toEqual([light, light, light]);
    expect(scheme()).toBe("light");
    expect(
      document
        .querySelector('meta[name="supported-color-schemes"]')
        ?.getAttribute("content"),
    ).toBe("light");
    expect(
      [...document.querySelectorAll('meta[name="theme-color"]')].map((tag) =>
        tag.getAttribute("media"),
      ),
    ).toEqual([
      null,
      "(prefers-color-scheme: light)",
      "(prefers-color-scheme: dark)",
    ]);

    applyTheme("26-basic");
    expect(document.querySelectorAll('meta[name="theme-color"]')).toHaveLength(3);
    expect(themeColors()).toEqual([dark, dark, dark]);
  });
});

function themeColors(): (string | null)[] {
  return [...document.querySelectorAll('meta[name="theme-color"]')].map((tag) =>
    tag.getAttribute("content"),
  );
}

function scheme(): string | null {
  return (
    document.querySelector('meta[name="color-scheme"]')?.getAttribute("content") ?? null
  );
}

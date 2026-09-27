import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import indexHtml from "../../index.html?raw";
import manifest from "../../public/manifest.webmanifest?raw";
import indexCss from "../index.css?raw";
import { PhoneShell } from "../guest/phone-shell";
import { Button } from "../ui/primitives";
import { ControllerRoot } from "./ControllerRoot";

describe("controller viewport", () => {
  it("keeps the root from scrolling the document and makes taps at least 48px", () => {
    render(
      <ControllerRoot>
        <Button>Join</Button>
      </ControllerRoot>,
    );
    const root = document.querySelector(".controller-root");
    expect(root).not.toBeNull();
    const rootStyle = getComputedStyle(root as Element);
    expect(rootStyle.overscrollBehavior).toBe("none");
    expect(rootStyle.height).toBe("100dvh");
    expect(document.documentElement.style.overscrollBehavior).toBe("none");

    const css = [...document.querySelectorAll("style")]
      .map((style) => style.textContent ?? "")
      .join("\n");
    expect(css).toContain("touch-action: manipulation");
    expect(css).toContain("env(safe-area-inset-top)");
    expect(css).toContain("env(safe-area-inset-right)");
    expect(css).toContain("env(safe-area-inset-bottom)");
    expect(css).toContain("env(safe-area-inset-left)");

    const button = screen.getByRole("button", { name: "Join" });
    const buttonStyle = getComputedStyle(button);
    expect(Number.parseFloat(buttonStyle.minHeight)).toBeGreaterThanOrEqual(48);
    expect(Number.parseFloat(buttonStyle.minWidth)).toBeGreaterThanOrEqual(48);
    expect(buttonStyle.userSelect).toBe("none");
  });

  it("covers the screen, presses in, and lifts the dock above the keyboard", () => {
    expect(indexHtml).toContain("viewport-fit=cover");
    expect(indexHtml).toContain("interactive-widget=resizes-content");
    expect(indexHtml).toContain('name="theme-color"');
    expect(indexHtml).toContain('name="apple-mobile-web-app-capable"');
    expect(indexCss).toContain("scale(0.98)");
    expect(indexCss).not.toContain("transition: none");
    expect(manifest).toContain('"display": "standalone"');
    expect(manifest).not.toContain("serviceWorker");

    const viewport = {
      height: 400,
      offsetTop: 0,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    const previousHeight = window.innerHeight;
    const previousViewport = window.visualViewport;
    Object.defineProperty(window, "visualViewport", {
      configurable: true,
      value: viewport,
    });
    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      value: 800,
    });

    try {
      render(
        <PhoneShell connection="idle">
          <p>Question</p>
        </PhoneShell>,
      );
      expect(document.querySelector("nav[aria-label='Surfaces']")).toBeNull();
      expect(document.querySelector(".phone-scroll")).not.toBeNull();
      expect(document.documentElement.classList.contains("phone-lock")).toBe(true);
      expect(document.documentElement.style.getPropertyValue("--keyboard-inset")).toBe(
        "400px",
      );
    } finally {
      Object.defineProperty(window, "visualViewport", {
        configurable: true,
        value: previousViewport,
      });
      Object.defineProperty(window, "innerHeight", {
        configurable: true,
        value: previousHeight,
      });
    }
  });
});

afterEach(() => {
  document.documentElement.style.removeProperty("--keyboard-inset");
  document.documentElement.classList.remove("phone-lock");
});

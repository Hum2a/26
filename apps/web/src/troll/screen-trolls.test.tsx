import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { isScreenTroll, ScreenTroll } from "./screen-trolls";

describe("screen trolls", () => {
  it("knows which kinds the phone draws", () => {
    expect(isScreenTroll("bubble-wrap")).toBe(true);
    expect(isScreenTroll("call")).toBe(false);
  });

  it("escapes bubble wrap once every bubble is popped", () => {
    const onEscape = vi.fn();
    render(
      <ScreenTroll kind="bubble-wrap" label="Pop" escape="Pop them all" onEscape={onEscape} />,
    );
    for (const bubble of screen.getAllByRole("button", { name: "Pop bubble" })) {
      fireEvent.click(bubble);
    }
    expect(onEscape).toHaveBeenCalledTimes(1);
  });

  it("moves the captcha until the last attempt", () => {
    const onEscape = vi.fn();
    render(
      <ScreenTroll kind="captcha" label="Captcha" escape="I'm not a robot" onEscape={onEscape} />,
    );
    for (let attempt = 0; attempt < 4; attempt += 1) {
      fireEvent.click(screen.getByRole("button", { name: /not a robot/ }));
    }
    expect(onEscape).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /not a robot/ }));
    expect(onEscape).toHaveBeenCalledTimes(1);
  });

  it("warps the page only while mounted", () => {
    const view = render(<ScreenTroll kind="australia" label="Australia" escape={null} />);
    expect(document.documentElement.classList.contains("troll-page-australia")).toBe(true);
    view.unmount();
    expect(document.documentElement.classList.contains("troll-page-australia")).toBe(false);
  });
});

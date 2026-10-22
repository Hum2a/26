import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { isScreenTroll, ScreenTroll } from "./screen-trolls";

describe("screen trolls", () => {
  it("knows which kinds the phone draws", () => {
    for (const kind of ["bubble-wrap", "call", "invasion", "crack", "sponsor", "airdrop"]) {
      expect(isScreenTroll(kind), kind).toBe(true);
    }
    expect(isScreenTroll("yield")).toBe(false);
    expect(isScreenTroll("swap")).toBe(false);
  });

  it("floods the screen with the troller's face, or their name without one", () => {
    const { unmount } = render(
      <ScreenTroll
        kind="invasion"
        label="Your face, everywhere"
        escape="Dismiss"
        from={{ nickname: "Bilal", faceSrc: "/face.jpg" }}
      />,
    );
    const faces = document.querySelectorAll("img.troll-invasion-face");
    expect(faces.length).toBeGreaterThan(10);
    expect(faces[0]?.getAttribute("src")).toBe("/face.jpg");
    expect(screen.getByText("Bilal was here")).toBeTruthy();
    unmount();
    render(
      <ScreenTroll
        kind="invasion"
        label="Your face, everywhere"
        escape="Dismiss"
        from={{ nickname: "Chen", faceSrc: null }}
      />,
    );
    expect(document.querySelectorAll("img.troll-invasion-face")).toHaveLength(0);
    expect(screen.getAllByText("Chen").length).toBeGreaterThan(10);
  });

  it("lets Mum be declined, or answered until the call ends", () => {
    vi.useFakeTimers();
    try {
      const declined = vi.fn();
      const view = render(
        <ScreenTroll kind="call" label="Incoming call" escape="Decline" onEscape={declined} />,
      );
      fireEvent.click(screen.getByRole("button", { name: "Decline" }));
      expect(declined).toHaveBeenCalledTimes(1);
      view.unmount();

      const ended = vi.fn();
      render(<ScreenTroll kind="call" label="Incoming call" escape="Decline" onEscape={ended} />);
      fireEvent.click(screen.getByRole("button", { name: "Answer" }));
      expect(screen.getByText("Hello? Hello? Can you hear me?")).toBeTruthy();
      expect(ended).not.toHaveBeenCalled();
      for (let step = 0; step < 6; step += 1) {
        act(() => {
          vi.advanceTimersByTime(1_400);
        });
      }
      expect(ended).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps AirDrop coming back after it is declined", () => {
    vi.useFakeTimers();
    try {
      render(<ScreenTroll kind="airdrop" label="AirDrop" escape={null} />);
      expect(screen.getByText(/IMG_0420\.jpg/)).toBeTruthy();
      fireEvent.click(screen.getByRole("button", { name: "Decline" }));
      expect(screen.queryByRole("dialog")).toBeNull();
      act(() => {
        vi.advanceTimersByTime(2_000);
      });
      expect(screen.getByText(/your_baby_photos\.zip/)).toBeTruthy();
    } finally {
      vi.useRealTimers();
    }
  });

  it("puts the target at the bottom of a fake leaderboard of real names", () => {
    render(
      <ScreenTroll
        kind="fake-last"
        label="You are last"
        escape={null}
        others={["Amina", "Bilal", "Chen"]}
      />,
    );
    const rows = screen.getAllByRole("listitem").map((row) => row.textContent);
    expect(rows).toEqual(["1.Amina", "2.Bilal", "3.Chen", "LASTYou"]);
  });

  it("tells the target they have left, then that it was a joke", () => {
    vi.useFakeTimers();
    try {
      render(<ScreenTroll kind="fake-exit" label="You have left the party" escape={null} />);
      expect(screen.getByText("You have left the party")).toBeTruthy();
      act(() => {
        vi.advanceTimersByTime(3_600);
      });
      expect(screen.getByText("Only joking 😜")).toBeTruthy();
    } finally {
      vi.useRealTimers();
    }
  });

  it("draws a shattered screen that can be dismissed", () => {
    const onEscape = vi.fn();
    render(
      <ScreenTroll kind="crack" label="Shattered screen" escape="Dismiss" onEscape={onEscape} seed={7} />,
    );
    expect(screen.getByRole("status", { name: "Shattered screen" }).querySelectorAll("path").length).toBeGreaterThan(9);
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(onEscape).toHaveBeenCalledTimes(1);
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

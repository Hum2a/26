import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { StageShortcuts } from "./shortcuts";

describe("stage shortcuts", () => {
  it("sends the existing play actions, ignores inputs, and toggles the list", () => {
    const onCommand = vi.fn();
    render(
      <>
        <StageShortcuts onCommand={onCommand} />
        <input aria-label="Join code" />
      </>,
    );

    fireEvent.keyDown(window, { key: " " });
    fireEvent.keyDown(window, { key: "p" });
    fireEvent.keyDown(window, { key: "H" });
    expect(onCommand.mock.calls.map((call) => call[0])).toEqual([
      "advance",
      "pause",
      "hide",
    ]);

    fireEvent.keyDown(screen.getByLabelText("Join code"), { key: " " });
    fireEvent.keyDown(screen.getByLabelText("Join code"), { key: "p" });
    fireEvent.keyDown(screen.getByLabelText("Join code"), { key: "?" });
    expect(onCommand).toHaveBeenCalledTimes(3);
    expect(screen.queryByRole("dialog", { name: "Shortcuts" })).toBeNull();

    fireEvent.keyDown(window, { key: "?" });
    expect(screen.getByRole("dialog", { name: "Shortcuts" }).textContent).toContain(
      "Space advances.",
    );
    fireEvent.keyDown(window, { key: "?" });
    expect(screen.queryByRole("dialog", { name: "Shortcuts" })).toBeNull();
  });
});

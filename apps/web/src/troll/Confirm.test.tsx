import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TrollConfirm } from "./Confirm";

describe("TrollConfirm", () => {
  it("sends the troll once from confirm, and cancel sends nothing", () => {
    const useTroll = vi.fn();
    const onCancel = vi.fn();
    render(
      <TrollConfirm
        nickname="Sam"
        troll="Fake Call"
        onCancel={onCancel}
        onConfirm={useTroll}
      />,
    );

    expect(screen.getByRole("dialog", { name: "Confirm troll" }).textContent).toContain(
      "Troll Sam with Fake Call?",
    );
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(useTroll).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    expect(useTroll).toHaveBeenCalledTimes(1);
  });
});

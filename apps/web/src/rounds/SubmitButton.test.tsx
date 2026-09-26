import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SubmitButton } from "./SubmitButton";

describe("SubmitButton", () => {
  it("moves from idle to sending to locked, and a double tap sends once", () => {
    const onClick = vi.fn();
    const { rerender } = render(
      <SubmitButton label="Send answer" state="idle" onClick={onClick} />,
    );

    const idle = screen.getByRole("button", { name: "Send answer" });
    fireEvent.click(idle);
    fireEvent.click(idle);
    expect(onClick).toHaveBeenCalledTimes(1);

    rerender(<SubmitButton label="Send answer" state="sending" onClick={onClick} />);
    const sending = screen.getByRole("button", { name: "Sending" });
    expect((sending as HTMLButtonElement).disabled).toBe(true);
    expect(sending.getAttribute("aria-busy")).toBe("true");
    expect(sending.querySelector(".submit-spinner")).toBeTruthy();

    rerender(<SubmitButton label="Send answer" state="locked" onClick={onClick} />);
    const locked = screen.getByRole("button", { name: "Locked in ✓" });
    expect((locked as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(locked);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

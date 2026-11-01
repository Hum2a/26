import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { JoinMark } from "./join-mark";
afterEach(() => vi.unstubAllGlobals());
function clipboard(writeText: (text: string) => Promise<void>) {
  vi.stubGlobal("navigator", { clipboard: { writeText } });
}
it("copies the exact guest URL only after the browser confirms it", async () => {
  let finish!: () => void;
  const write = vi.fn(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  clipboard(write);
  render(<JoinMark code="ABCDEF" allowCopy />);
  fireEvent.click(screen.getByRole("button", { name: "Copy guest link" }));
  expect(screen.queryByText("Link copied. Ready to share.")).toBeNull();
  expect(write).toHaveBeenCalledWith(`${location.origin}/j/ABCDEF`);
  finish();
  await screen.findByText("Link copied. Ready to share.");
});
it("retains a selectable link when copying is refused", async () => {
  clipboard(vi.fn().mockRejectedValue(new Error("Denied")));
  render(<JoinMark code="ABCDEF" allowCopy />);
  fireEvent.click(screen.getByRole("button", { name: "Copy guest link" }));
  await screen.findByText(/Copying is unavailable/);
  const input = screen.getByRole("textbox", {
    name: "Guest join link",
  }) as HTMLInputElement;
  fireEvent.focus(input);
  await waitFor(() => expect(input.selectionEnd).toBe(input.value.length));
  expect(input.selectionStart).toBe(0);
  expect(screen.queryByText("Link copied. Ready to share.")).toBeNull();
});
it("keeps projector QR codes free of copy controls", () => {
  render(<JoinMark code="ABCDEF" />);
  expect(screen.queryByRole("button")).toBeNull();
  expect(screen.queryByRole("textbox")).toBeNull();
});

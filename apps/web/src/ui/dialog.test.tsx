import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, it } from "vitest";
import { Dialog } from "./primitives";

beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
    this.querySelector<HTMLElement>("[autofocus]")?.focus();
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  };
});

it("opens from its trigger and closes from its Close button", () => {
  render(
    <Dialog title="Guest join link" triggerLabel="Show guest QR code">
      <p>Scan to join.</p>
    </Dialog>,
  );

  expect(screen.queryByRole("dialog")).toBeNull();

  const trigger = screen.getByRole("button", { name: "Show guest QR code" });
  fireEvent.click(trigger);

  const dialog = screen.getByRole("dialog", { name: "Guest join link" });
  expect(dialog.hasAttribute("open")).toBe(true);

  const closeButton = screen.getByRole("button", { name: "Close" });
  expect(closeButton.getAttribute("type")).toBe("submit");
  fireEvent.click(closeButton);

  expect(screen.queryByRole("dialog")).toBeNull();
  expect(dialog.hasAttribute("open")).toBe(false);
  expect(document.activeElement).toBe(trigger);
});

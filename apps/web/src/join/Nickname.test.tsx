import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NicknameField } from "./Nickname";
import { nicknameStorageKey } from "./nickname-storage";

const collision = "That nickname is already in this room. Choose another.";

describe("Nickname", () => {
  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("prefills from the last used name", () => {
    localStorage.setItem(nicknameStorageKey, "Amina");
    render(<NicknameField />);
    expect((screen.getByLabelText("Nickname") as HTMLInputElement).value).toBe("Amina");
  });

  it("stays empty when storage throws", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("storage blocked");
    });
    expect(() => render(<NicknameField />)).not.toThrow();
    expect((screen.getByLabelText("Nickname") as HTMLInputElement).value).toBe("");
  });

  it("updates the character counter", () => {
    render(<NicknameField />);
    fireEvent.change(screen.getByLabelText("Nickname"), { target: { value: "Bo" } });
    expect(screen.getByText("2/24")).toBeTruthy();
  });

  it("shows a collision inline and keeps focus in the field", () => {
    const { rerender } = render(<NicknameField />);
    const field = screen.getByLabelText("Nickname");
    rerender(<NicknameField error={collision} />);
    expect(screen.getByRole("alert").textContent).toBe(collision);
    expect(document.activeElement).toBe(field);
  });
});

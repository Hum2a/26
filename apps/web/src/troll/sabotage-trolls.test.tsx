import { act, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
vi.mock("../device/haptics", () => ({ buzz: vi.fn() }));
import {
  autocorrect,
  Autocorrect,
  CharacterLimit,
  pigLatin,
  ReshuffledOptions,
  ReverseTyping,
  TranslatedOptions,
} from "./sabotage-trolls";

/** A controlled text answer, like the real question inputs. */
function Answer() {
  const [value, setValue] = useState("");
  return (
    <>
      <input
        type="text"
        aria-label="Answer"
        value={value}
        onChange={(event) => setValue(event.target.value)}
      />
      <p data-testid="state">{value}</p>
    </>
  );
}

function Options() {
  return (
    <div>
      <ul className="options">
        {["Apple", "Banana", "Cherry"].map((label) => (
          <li key={label}>
            <button type="button" aria-pressed={false}>
              {label}
            </button>
          </li>
        ))}
      </ul>
      <div data-troll="">
        <button type="button" aria-pressed={false}>
          Troll panel
        </button>
      </div>
    </div>
  );
}

describe("input sabotage", () => {
  it("speaks Pig Latin and autocorrects finished words", () => {
    expect(pigLatin("Party time apple")).toBe("Artypay imetay appleway");
    expect(autocorrect("I love ")).toBe("I tolerate ");
    expect(autocorrect("happy birthday!")).toBe("happy bathday!");
    expect(autocorrect("still typing")).toBe("still typing");
  });

  it("translates option text and restores it, leaving the troll panel alone", () => {
    render(<Options />);
    const view = render(<TranslatedOptions label="Lost in translation" />);
    expect(screen.getByRole("button", { name: "Appleway" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Troll panel" })).toBeTruthy();
    view.unmount();
    expect(screen.getByRole("button", { name: "Apple" })).toBeTruthy();
  });

  it("moves options around and puts them back", () => {
    render(<Options />);
    const view = render(<ReshuffledOptions label="Shuffled" />);
    const items = [...document.querySelectorAll<HTMLElement>(".options > li")];
    expect(items.every((item) => item.style.order !== "")).toBe(true);
    view.unmount();
    expect(items.every((item) => item.style.order === "")).toBe(true);
  });

  it("types backwards into a controlled answer", () => {
    render(<Answer />);
    render(<ReverseTyping label="Reverse typing" />);
    const input = screen.getByLabelText("Answer");
    for (const letter of ["a", "b", "c"]) {
      const event = new InputEvent("beforeinput", {
        inputType: "insertText",
        data: letter,
        bubbles: true,
        cancelable: true,
      });
      act(() => {
        input.dispatchEvent(event);
      });
      expect(event.defaultPrevented).toBe(true);
    }
    expect(screen.getByTestId("state").textContent).toBe("cba");
  });

  it("autocorrects a controlled answer as each word is finished", () => {
    render(<Answer />);
    render(<Autocorrect label="Autocorrect" />);
    // Typing fires `input`, which is what autocorrect listens for.
    fireEvent.input(screen.getByLabelText("Answer"), { target: { value: "cake " } });
    expect(screen.getByTestId("state").textContent).toBe("cheesecake ");
  });

  it("cuts answers to twelve characters, then lifts the limit", () => {
    render(<Answer />);
    const input = screen.getByLabelText<HTMLInputElement>("Answer");
    fireEvent.change(input, { target: { value: "a very long answer indeed" } });
    const view = render(<CharacterLimit label="Character limit" />);
    expect(screen.getByTestId("state").textContent).toBe("a very long ");
    expect(input.maxLength).toBe(12);
    view.unmount();
    expect(input.hasAttribute("maxlength")).toBe(false);
  });
});

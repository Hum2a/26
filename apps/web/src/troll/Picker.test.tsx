import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TrollPicker } from "./Picker";

const players = [
  { playerId: "self", nickname: "Amina" },
  { playerId: "sam", nickname: "Sam" },
  { playerId: "zoe", nickname: "Zoe" },
];

describe("TrollPicker", () => {
  it("filters the list, drops this phone, and locks before round two and after use", () => {
    const onSelect = vi.fn();
    const { rerender } = render(
      <TrollPicker
        players={players}
        selfId="self"
        roundIndex={3}
        used={false}
        onSelect={onSelect}
      />,
    );

    expect(screen.getByText("1 troll left")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Troll Amina" })).toBeNull();
    expect(screen.getByRole("button", { name: "Troll Sam" })).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Find a player"), {
      target: { value: "zo" },
    });
    expect(screen.queryByRole("button", { name: "Troll Sam" })).toBeNull();
    expect(screen.getByRole("button", { name: "Troll Zoe" })).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Find a player"), {
      target: { value: "" },
    });
    rerender(
      <TrollPicker
        players={players}
        selfId="self"
        roundIndex={1}
        used={false}
        onSelect={onSelect}
      />,
    );
    const early = screen.getByRole("button", {
      name: "Troll Sam",
    }) as HTMLButtonElement;
    expect(early.disabled).toBe(true);
    expect((screen.getByLabelText("Find a player") as HTMLInputElement).disabled).toBe(
      true,
    );
    expect(screen.getByText("1 troll left")).toBeTruthy();

    rerender(
      <TrollPicker
        players={players}
        selfId="self"
        roundIndex={3}
        used
        onSelect={onSelect}
      />,
    );
    const spent = screen.getByRole("button", {
      name: "Troll Sam",
    }) as HTMLButtonElement;
    expect(spent.disabled).toBe(true);
    expect(screen.getByText("Troll used")).toBeTruthy();
  });
});

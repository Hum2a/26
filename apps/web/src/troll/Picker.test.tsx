import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TrollPicker } from "./Picker";

const players = [
  { playerId: "self", nickname: "Amina" },
  { playerId: "sam", nickname: "Sam" },
  { playerId: "zoe", nickname: "Zoe" },
];

describe("TrollPicker", () => {
  it("filters the list, drops this phone, locks while closed and stays open while recharging", () => {
    const onSelect = vi.fn();
    const { rerender } = render(
      <TrollPicker
        players={players}
        selfId="self"
        locked={false}
        cooling={false}
        onSelect={onSelect}
      />,
    );

    expect(screen.getByText("Troll ready")).toBeTruthy();
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
        locked
        cooling={false}
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

    rerender(
      <TrollPicker
        players={players}
        selfId="self"
        locked={false}
        cooling
        onSelect={onSelect}
      />,
    );
    const recharging = screen.getByRole("button", {
      name: "Troll Sam",
    }) as HTMLButtonElement;
    expect(recharging.disabled).toBe(false);
    expect(screen.getByText("Recharging")).toBeTruthy();
  });
});

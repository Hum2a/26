import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { OperatorHud } from "./OperatorHud";
import { connectedCount } from "./presence";

describe("OperatorHud", () => {
  it("stays hidden, opens with D, and follows joins and leaves", () => {
    expect(connectedCount([])).toBe(0);
    expect(connectedCount(["PLAYER_JOINED", "PLAYER_JOINED"])).toBe(2);
    expect(connectedCount(["PLAYER_JOINED", "PLAYER_JOINED", "PLAYER_LEFT"])).toBe(1);
    expect(connectedCount(["PLAYER_LEFT"])).toBe(0);

    const { rerender } = render(
      <OperatorHud
        count={connectedCount(["PLAYER_JOINED"])}
        phase="collect"
        socket="open"
      />,
    );
    expect(screen.queryByRole("status", { name: "Operator" })).toBeNull();

    fireEvent.keyDown(window, { key: "D" });
    expect(screen.getByRole("status", { name: "Operator" }).textContent).toContain(
      "Connected 1",
    );

    rerender(
      <OperatorHud
        count={connectedCount(["PLAYER_JOINED", "PLAYER_JOINED"])}
        phase="collect"
        socket="open"
      />,
    );
    expect(screen.getByRole("status", { name: "Operator" }).textContent).toContain(
      "Connected 2",
    );

    rerender(
      <OperatorHud
        count={connectedCount(["PLAYER_JOINED", "PLAYER_JOINED", "PLAYER_LEFT"])}
        phase="vote"
        socket="closed"
      />,
    );
    const hud = screen.getByRole("status", { name: "Operator" });
    expect(hud.textContent).toContain("Connected 1");
    expect(hud.textContent).toContain("Phase vote");
    expect(hud.textContent).toContain("Socket closed");

    fireEvent.keyDown(window, { key: "d" });
    expect(screen.queryByRole("status", { name: "Operator" })).toBeNull();
  });
});

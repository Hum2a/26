import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TierAssign } from "./TierAssign";

const items = [
  { id: "alpha", label: "Alpha" },
  { id: "beta", label: "Beta" },
];

const tiers = [
  { id: "top", label: "Top" },
  { id: "mid", label: "Mid" },
];

function count(name: string): string {
  return (
    screen.getByRole("button", { name }).querySelector(".tier-count")?.textContent ?? ""
  );
}

describe("TierAssign", () => {
  it("highlights a tap, deselects it, counts a tier, and undoes the last assignment", () => {
    render(<TierAssign items={items} tiers={tiers} ties="shared" open />);

    const alpha = screen.getByRole("button", { name: "Alpha" });
    fireEvent.click(alpha);
    expect(alpha.getAttribute("aria-pressed")).toBe("true");
    expect(alpha.className).toContain("tier-selected");

    fireEvent.click(alpha);
    expect(alpha.getAttribute("aria-pressed")).toBe("false");
    expect(alpha.className).not.toContain("tier-selected");

    fireEvent.click(alpha);
    fireEvent.click(screen.getByRole("button", { name: "Top" }));
    expect(count("Top")).toBe("1");
    expect(count("Mid")).toBe("0");

    fireEvent.click(screen.getByRole("button", { name: "Beta" }));
    fireEvent.click(screen.getByRole("button", { name: "Top" }));
    expect(count("Top")).toBe("2");

    fireEvent.click(screen.getByRole("button", { name: "Undo last" }));
    expect(count("Top")).toBe("1");
    expect(screen.getByText("Alpha · Top")).toBeTruthy();
    expect(screen.queryByText("Beta · Top")).toBeNull();
  });
});

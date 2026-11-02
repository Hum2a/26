import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { expect, it } from "vitest";
import { PhoneShell, type PhoneTab } from "./phone-shell";

function Harness({ badges }: { badges?: Partial<Record<PhoneTab, string>> }) {
  const [active, setActive] = useState<PhoneTab>("play");
  return (
    <PhoneShell
      connection="open"
      tabs={{
        active,
        onChange: setActive,
        badges,
        pages: {
          ranks: <p>Leaderboard page</p>,
          troll: <p>Troll page</p>,
          snap: <p>Snap page</p>,
        },
      }}
    >
      <p>Question page</p>
    </PhoneShell>
  );
}

it("switches pages from the tab bar and keeps hidden pages inert", () => {
  render(<Harness />);
  const nav = screen.getByRole("navigation", { name: "Game sections" });
  expect(nav).toBeTruthy();
  const play = screen.getByRole("button", { name: "Play" });
  expect(play.getAttribute("aria-current")).toBe("page");
  const ranksPage = screen.getByText("Leaderboard page").closest(".phone-page")!;
  expect(ranksPage.hasAttribute("inert")).toBe(true);

  fireEvent.click(screen.getByRole("button", { name: "Ranks" }));
  expect(
    screen.getByRole("button", { name: "Ranks" }).getAttribute("aria-current"),
  ).toBe("page");
  expect(ranksPage.hasAttribute("inert")).toBe(false);
  expect(ranksPage.id).toBe("content");
  const playPage = screen.getByText("Question page").closest(".phone-page")!;
  expect(playPage.hasAttribute("inert")).toBe(true);
  // The send dock belongs to Play only.
  expect(document.querySelector(".phone-dock")?.hasAttribute("inert")).toBe(true);
});

it("announces a badge on a tab", () => {
  render(<Harness badges={{ troll: "1" }} />);
  expect(screen.getByRole("button", { name: "Troll (1 new)" })).toBeTruthy();
});

it("renders a single page without tabs for previews", () => {
  render(
    <PhoneShell connection="idle">
      <p>Preview page</p>
    </PhoneShell>,
  );
  expect(screen.queryByRole("navigation", { name: "Game sections" })).toBeNull();
  expect(screen.getByText("Preview page").closest("main")?.id).toBe("content");
});

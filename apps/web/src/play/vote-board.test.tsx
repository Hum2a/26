import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { PlaySnapshot } from "@26/shared";
import { RosterProvider } from "../ui/roster";
import { VoteBoard } from "./vote-board";

const amina = "00000000-0000-4000-8000-000000000001";
const bilal = "00000000-0000-4000-8000-000000000002";
const cara = "00000000-0000-4000-8000-000000000003";

function play(
  overrides: Partial<PlaySnapshot> = {},
  attribution = "live",
): PlaySnapshot {
  return {
    question: {
      kind: "choice",
      id: "q",
      index: 1,
      total: 3,
      prompt: "Pick one",
      points: 100,
      illustrative: true,
      attribution,
      presentation: "standard",
      options: [
        { id: "one", label: "One" },
        { id: "two", label: "Two" },
        { id: "three", label: "Three" },
      ],
      speedBonus: false,
      modifiers: [],
      suppressSpeedBonus: false,
    },
    submissionCount: 3,
    selfAnswer: null,
    selfBallot: null,
    ballot: null,
    duel: null,
    reveal: null,
    selfAward: null,
    selfStanding: null,
    standings: null,
    liveSample: null,
    attributions: null,
    explanation: null,
    voters: [
      { optionId: "one", playerIds: [amina, bilal] },
      { optionId: "two", playerIds: [cara] },
      { optionId: "three", playerIds: [] },
    ],
    ...overrides,
  } as PlaySnapshot;
}

function draw(snapshot: PlaySnapshot) {
  return render(
    <RosterProvider
      gameId="ABCDEFGH"
      players={[
        {
          playerId: amina,
          nickname: "Amina",
          avatarMediaId: "00000000-0000-4000-8000-0000000000f1",
        },
        { playerId: bilal, nickname: "Bilal" },
        { playerId: cara, nickname: "Cara" },
      ]}
    >
      <VoteBoard play={snapshot} />
    </RosterProvider>,
  );
}

function option(label: string) {
  return screen.getByText(label).closest("li")!;
}

describe("vote board", () => {
  it("fills each option with its voters' faces and grows the leader", () => {
    draw(play());
    expect(
      within(option("One")).getByRole("list", { name: "Picked by Amina, Bilal" }),
    ).toBeTruthy();
    expect(
      within(option("Two")).getByRole("list", { name: "Picked by Cara" }),
    ).toBeTruthy();
    expect(
      within(option("Three")).getByRole("list", { name: "No picks yet" }),
    ).toBeTruthy();
    // A face is drawn from the roster's photo; others keep their initials.
    expect(option("One").querySelector("img")?.getAttribute("src")).toContain(
      "/api/rooms/ABCDEFGH/media/00000000-0000-4000-8000-0000000000f1",
    );
    expect(within(option("Two")).getByText("CA")).toBeTruthy();
    expect(option("One").hasAttribute("data-leading")).toBe(true);
    expect(within(option("One")).getByText("Most picked")).toBeTruthy();
    expect(Number(option("One").style.flexGrow)).toBeGreaterThan(
      Number(option("Two").style.flexGrow),
    );
    expect(option("Three").hasAttribute("data-empty")).toBe(true);
  });

  it("keeps the options still and says why when picks are not on screen", () => {
    draw(play({ voters: null }, "after"));
    expect(screen.getByText("Picks appear at the reveal.")).toBeTruthy();
    expect(screen.queryByRole("list", { name: /Picked by/ })).toBeNull();
    expect(option("One").style.flexGrow).toBe("1");
  });

  it("marks the answer at the reveal without hiding the other options", () => {
    draw(play({ reveal: { kind: "choice", correctOptionId: "two" } }));
    expect(option("Two").getAttribute("data-result")).toBe("correct");
    expect(within(option("Two")).getByText("Correct")).toBeTruthy();
    expect(option("One").getAttribute("data-result")).toBe("wrong");
    expect(screen.getByText("One")).toBeTruthy();
    // The crown gives way to the answer.
    expect(option("One").hasAttribute("data-leading")).toBe(false);
  });

  it("sizes a poll reveal from its tally when names stay private", () => {
    draw(
      play(
        {
          voters: null,
          reveal: {
            kind: "choice",
            correctOptionId: null,
            outcome: "poll",
            tally: [
              { optionId: "one", count: 1 },
              { optionId: "two", count: 4 },
              { optionId: "three", count: 0 },
            ],
          },
        },
        "never",
      ),
    );
    expect(option("Two").hasAttribute("data-leading")).toBe(true);
    expect(screen.queryByRole("list", { name: /Picked by/ })).toBeNull();
  });

  it("folds a crowded option into +N", () => {
    const crowd = Array.from(
      { length: 50 },
      (_, index) => `00000000-0000-4000-8000-${String(index + 100).padStart(12, "0")}`,
    );
    draw(play({ voters: [{ optionId: "one", playerIds: crowd }] }));
    // Three options share a 72-bubble budget: 24 faces, then +26.
    expect(within(option("One")).getAllByRole("listitem")).toHaveLength(25);
    expect(within(option("One")).getByText("+", { exact: false })).toBeTruthy();
  });
});

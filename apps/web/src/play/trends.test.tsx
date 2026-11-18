import { act, cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { QuestionTrends, TrendCard } from "@26/shared";
import { PhoneTrends, StageTrends, trendRotateMs } from "./trends";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function card(id: string, headline: string, extra: Partial<TrendCard> = {}): TrendCard {
  return {
    id,
    facet: id,
    tone: "device",
    icon: "apple",
    headline,
    detail: `${headline} detail.`,
    figure: { value: "71%", caption: "of iPhone users" },
    bars: [
      { label: "iPhone users", value: 71, display: "71%", highlight: true },
      { label: "Android users", value: 30, display: "30%", highlight: false },
    ],
    ...extra,
  };
}

const trends: QuestionTrends = {
  questionId: "favourite-pokemon",
  responses: 24,
  cards: [
    card("one", "Team iPhone picked Mudkip"),
    card("two", "The dark side picked Tepig", { icon: "moon", bars: [] }),
  ],
};

describe("answer trends", () => {
  it("shows one card on the projector, then rotates to the next", async () => {
    vi.useFakeTimers();
    render(<StageTrends trends={trends} />);
    const panel = screen.getByRole("complementary", { name: "How the room answered" });
    expect(within(panel).getByText("24 answers")).toBeTruthy();
    expect(within(panel).getByText("Team iPhone picked Mudkip")).toBeTruthy();
    expect(within(panel).getByText("71%", { selector: "strong" })).toBeTruthy();
    expect(within(panel).getByRole("list", { name: "Comparison" })).toBeTruthy();
    expect(within(panel).getByLabelText("Card 1 of 2")).toBeTruthy();
    await act(async () => {
      vi.advanceTimersByTime(trendRotateMs + 50);
    });
    await act(async () => {
      vi.advanceTimersByTime(1_000);
    });
    expect(within(panel).getByText("The dark side picked Tepig")).toBeTruthy();
    expect(within(panel).getByLabelText("Card 2 of 2")).toBeTruthy();
  });

  it("does not rotate a single card", () => {
    render(<StageTrends trends={{ ...trends, cards: [trends.cards[0]!] }} />);
    expect(screen.queryByLabelText(/Card 1 of/)).toBeNull();
  });

  it("lists a guest's own comparison lines on the phone", () => {
    render(
      <PhoneTrends
        trends={{
          questionId: "favourite-pokemon",
          lines: [
            { icon: "trophy", text: "You were one of the 38% who got it right." },
            { icon: "zap", text: "Faster than 80% of the room." },
          ],
        }}
      />,
    );
    const section = screen.getByRole("region", { name: "You and the room" });
    expect(within(section).getAllByRole("listitem")).toHaveLength(2);
    expect(within(section).getByText("Faster than 80% of the room.")).toBeTruthy();
  });
});

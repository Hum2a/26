import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
vi.mock("./rooms-api", () => ({ readAdminRoom: vi.fn() }));
vi.mock("../live/room-socket", () => ({ openRoomSocket: vi.fn() }));
vi.mock("../live/room-api", () => ({ playRoom: vi.fn(), issueTransfer: vi.fn() }));
import type { LobbySnapshot, TrendControl } from "@26/shared";
import { playRoom } from "../live/room-api";
import { AnalyticsPage } from "./analytics-page";
import { mountControls, playingFixture, setupControls } from "./controls.test-support";

function control(overrides: Partial<TrendControl> = {}): TrendControl {
  return {
    stage: "shown",
    phones: "shown",
    hiddenCards: [],
    history: [],
    current: {
      questionId: "favourite-pokemon",
      prompt: "Favourite Pokémon",
      responses: 24,
      classified: 22,
      cards: [
        {
          id: "favourite-pokemon:platform:pick:mudkip:iphone",
          facet: "platform",
          tone: "device",
          icon: "apple",
          headline: "Team iPhone picked Mudkip",
          detail: "71% of iPhone users picked Mudkip; only 30% of Android users did.",
          figure: { value: "71%", caption: "of iPhone users" },
          bars: [],
          score: 72,
          hidden: false,
          onStage: true,
        },
        {
          id: "favourite-pokemon:theme:pick:tepig:dark",
          facet: "theme",
          tone: "device",
          icon: "moon",
          headline: "The dark side picked Tepig",
          detail: "60% of dark-mode people picked Tepig.",
          figure: null,
          bars: [],
          score: 40,
          hidden: true,
          onStage: false,
        },
      ],
    },
    recent: [
      {
        questionId: "car-name",
        prompt: "What do I call my car?",
        responses: 20,
        headlines: ["Near-unanimous: 80% picked Hagakure"],
      },
    ],
    ...overrides,
  };
}

function fixture(trendControl: TrendControl): LobbySnapshot {
  return { ...playingFixture, phase: "reveal", trendControl };
}

beforeEach(() => setupControls(fixture(control())));

it("lists every candidate card and what the big screen shows, with earlier questions", async () => {
  await mountControls(<AnalyticsPage />);
  const current = screen.getByRole("region", { name: "Trends for this question" });
  expect(within(current).getByText("Team iPhone picked Mudkip")).toBeTruthy();
  expect(within(current).getByText("On the big screen")).toBeTruthy();
  expect(within(current).getByText("Hidden")).toBeTruthy();
  expect(within(current).getByText("24 answers · 22 with a known device")).toBeTruthy();
  const earlier = screen.getByRole("region", { name: "Earlier questions" });
  expect(within(earlier).getByText("Near-unanimous: 80% picked Hagakure")).toBeTruthy();
});

it.each([
  ["shown", "Hide trends on the big screen", "trends-stage-hidden"],
  ["hidden", "Show trends on the big screen", "trends-stage-shown"],
] as const)("sends the projector switch from %s", async (stage, label, action) => {
  setupControls(fixture(control({ stage })));
  await mountControls(<AnalyticsPage />);
  fireEvent.click(screen.getByRole("button", { name: label }));
  await waitFor(() =>
    expect(playRoom).toHaveBeenCalledWith(expect.objectContaining({ action })),
  );
});

it("sends the phone switch", async () => {
  await mountControls(<AnalyticsPage />);
  fireEvent.click(screen.getByRole("button", { name: "Hide trends on phones" }));
  await waitFor(() =>
    expect(playRoom).toHaveBeenCalledWith(
      expect.objectContaining({ action: "trends-phones-hidden" }),
    ),
  );
});

it("hides and restores a card by its id", async () => {
  await mountControls(<AnalyticsPage />);
  const current = screen.getByRole("region", { name: "Trends for this question" });
  fireEvent.click(within(current).getByRole("button", { name: "Hide card" }));
  await waitFor(() =>
    expect(playRoom).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "trends-card-hide",
        trendCardId: "favourite-pokemon:platform:pick:mudkip:iphone",
      }),
    ),
  );
  fireEvent.click(within(current).getByRole("button", { name: "Restore card" }));
  await waitFor(() =>
    expect(playRoom).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "trends-card-restore",
        trendCardId: "favourite-pokemon:theme:pick:tepig:dark",
      }),
    ),
  );
});

it("rehearses the real projector and phone cards on stand-ins without calling the room", async () => {
  setupControls(fixture(control({ current: null, recent: [] })));
  await mountControls(<AnalyticsPage />);
  vi.mocked(playRoom).mockClear();
  expect(screen.getByText(/Trends appear here when a question is revealed/)).toBeTruthy();
  const rehearsal = screen.getByRole("region", { name: "Trend rehearsal" });
  expect(within(rehearsal).getByText(/24 stand-in players/)).toBeTruthy();
  expect(
    within(rehearsal).getByRole("complementary", { name: "How the room answered" }),
  ).toBeTruthy();
  expect(within(rehearsal).getByRole("region", { name: "You and the room" })).toBeTruthy();
  for (const label of ["Price guess", "Kart race", "Shuffle stand-ins"]) {
    fireEvent.click(within(rehearsal).getByRole("button", { name: label }));
  }
  expect(within(rehearsal).getByText(/candidate cards/)).toBeTruthy();
  expect(playRoom).not.toHaveBeenCalled();
});

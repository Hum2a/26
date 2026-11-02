import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
vi.mock("@number-flow/react", () => ({
  default: ({ value }: { value: number }) => <span>{value}</span>,
}));
import type { LobbySnapshot } from "@26/shared";
import { playingFixture, playerId } from "../admin/controls.test-support";
import { RanksTab } from "./ranks-tab";

function scored(overrides: Partial<NonNullable<LobbySnapshot["play"]>>): LobbySnapshot {
  return {
    ...playingFixture,
    phase: "scores",
    play: { ...playingFixture.play!, ...overrides },
  };
}

const standings = [
  { place: 1, nickname: "Zoe", points: 300 },
  { place: 2, nickname: "Amina", points: 200 },
  { place: 3, nickname: "Sam", points: 100 },
  { place: 4, nickname: "Jo", points: 50 },
];

it("shows this phone's place, points and the room's leaders", () => {
  render(
    <RanksTab
      nickname="Amina"
      snapshot={scored({
        standings,
        selfStanding: { place: 2, points: 200, players: 4 },
        selfAward: 120,
      })}
    />,
  );
  expect(screen.getByText("Place 2 of 4")).toBeTruthy();
  expect(screen.getByText("200 points")).toBeTruthy();
  expect(screen.getByText("+120 on the last question")).toBeTruthy();
  expect(screen.getByRole("region", { name: "Top three" })).toBeTruthy();
  expect(screen.getByRole("list", { name: "Leaderboard" }).textContent).toContain("Jo");
});

it("keeps the last standings when the next question starts", () => {
  const view = render(
    <RanksTab
      nickname="Amina"
      snapshot={scored({
        standings,
        selfStanding: { place: 2, points: 200, players: 4 },
      })}
    />,
  );
  view.rerender(<RanksTab nickname="Amina" snapshot={playingFixture} />);
  expect(screen.getByText("Place 2 of 4")).toBeTruthy();
  expect(screen.getByRole("list", { name: "Leaderboard" })).toBeTruthy();
});

it("shows movement after the place changes", () => {
  const view = render(
    <RanksTab
      nickname="Amina"
      snapshot={scored({
        standings,
        selfStanding: { place: 3, points: 100, players: 4 },
      })}
    />,
  );
  view.rerender(
    <RanksTab
      nickname="Amina"
      snapshot={scored({
        standings,
        selfStanding: { place: 1, points: 400, players: 4 },
      })}
    />,
  );
  expect(screen.getByText(/▲ 2 places/)).toBeTruthy();
});

it("respects a hidden-score troll", () => {
  render(
    <RanksTab
      nickname="Amina"
      snapshot={{
        ...scored({ standings: null }),
        trolls: {
          ...playingFixture.trolls,
          active: [
            {
              effectId: "00000000-0000-4000-8000-000000000099",
              kind: "hide-score",
              role: "target",
              status: "active",
              expiresAt: null,
              label: "Hidden score",
              escape: null,
              assetLabel: "Hidden score",
              fromPlayerId: playerId,
            },
          ],
        },
      }}
    />,
  );
  expect(screen.getByText(/hid your score/)).toBeTruthy();
});

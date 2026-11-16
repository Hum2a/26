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

it("calls a poll just for fun instead of repeating the previous round's points", () => {
  const view = render(
    <RanksTab
      nickname="Amina"
      snapshot={scored({
        standings,
        selfStanding: { place: 2, points: 200, players: 4 },
        selfAward: 120,
      })}
    />,
  );
  expect(screen.getByText("+120 on the last question")).toBeTruthy();
  view.rerender(
    <RanksTab
      nickname="Amina"
      snapshot={scored({
        standings,
        selfStanding: { place: 2, points: 200, players: 4 },
        question: { ...playingFixture.play!.question, id: "poll-round" },
        selfAward: null,
      })}
    />,
  );
  expect(screen.getByText("The last round was just for fun")).toBeTruthy();
  expect(screen.queryByText("+120 on the last question")).toBeNull();
});

it("keeps the last standings across a reload of the same game", () => {
  sessionStorage.clear();
  const first = render(
    <RanksTab
      nickname="Amina"
      snapshot={scored({
        standings,
        selfStanding: { place: 2, points: 200, players: 4 },
        selfAward: 120,
      })}
    />,
  );
  first.unmount();
  // A reload mid-question: no standings in the snapshot yet.
  render(<RanksTab nickname="Amina" snapshot={playingFixture} />);
  expect(screen.getByText("Place 2 of 4")).toBeTruthy();
  expect(screen.getByText("+120 on the last question")).toBeTruthy();
});

it("links to the full results once the podium is up", () => {
  const view = render(<RanksTab nickname="Amina" snapshot={playingFixture} />);
  expect(screen.queryByRole("link", { name: /full results/ })).toBeNull();
  view.rerender(
    <RanksTab nickname="Amina" snapshot={{ ...playingFixture, phase: "podium" }} />,
  );
  expect(screen.getByRole("link", { name: /full results/ }).getAttribute("href")).toBe(
    `/r/${playingFixture.gameId}`,
  );
});

it("skips storage writes on unchanged snapshots and separates games on gameId change", () => {
  sessionStorage.clear();
  const setItemSpy = vi.spyOn(Storage.prototype, "setItem");
  const snapA = scored({
    standings,
    selfStanding: { place: 2, points: 200, players: 4 },
    selfAward: 120,
  });
  const view = render(<RanksTab nickname="Amina" snapshot={snapA} />);
  expect(setItemSpy).toHaveBeenCalledTimes(1);

  // New object identities with identical values should not write again.
  view.rerender(
    <RanksTab
      nickname="Amina"
      snapshot={scored({
        standings: standings.map((row) => ({ ...row })),
        selfStanding: { place: 2, points: 200, players: 4 },
        selfAward: 120,
      })}
    />,
  );
  expect(setItemSpy).toHaveBeenCalledTimes(1);

  // Switching to another room clears previous game's remembered standings.
  view.rerender(
    <RanksTab
      nickname="Amina"
      snapshot={{ ...playingFixture, gameId: "NEWROOM1" }}
    />,
  );
  expect(screen.queryByText("Place 2 of 4")).toBeNull();
  setItemSpy.mockRestore();
});

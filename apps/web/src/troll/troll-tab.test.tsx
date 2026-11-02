import { fireEvent, render, screen, within } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import type { LobbySnapshot } from "@26/shared";
import { playingFixture, playerId, secondId } from "../admin/controls.test-support";
import { TrollTab } from "./troll-tab";

const ready: LobbySnapshot = {
  ...playingFixture,
  players: [
    { playerId, nickname: "Amina" },
    { playerId: secondId, nickname: "Sam" },
  ],
  play: {
    ...playingFixture.play!,
    question: { ...playingFixture.play!.question, index: 2 },
  },
  trolls: {
    token: "ready",
    offers: [
      { kind: "crack", label: "Cracked screen", enabled: true },
      { kind: "mirror", label: "Mirror world", enabled: false },
      { kind: "swap", label: "Nickname swap", enabled: true },
    ],
    active: [],
    announcement: null,
  },
};

it("groups trolls, then picks a target and confirms before sending", async () => {
  const onSend = vi.fn();
  render(
    <TrollTab
      snapshot={ready}
      gameId="ABCDEFGH"
      selfId={playerId}
      pending={false}
      onSend={onSend}
    />,
  );
  const groups = screen.getByRole("group", { name: "Troll groups" });
  expect(within(groups).getByRole("button", { name: /Phone chaos/ })).toBeTruthy();
  expect(
    (screen.getByRole("button", { name: /Mirror world/ }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);

  fireEvent.click(within(groups).getByRole("button", { name: /Identity/ }));
  fireEvent.click(screen.getByRole("button", { name: /Nickname swap/ }));
  fireEvent.click(await screen.findByRole("button", { name: "Troll Sam" }));
  expect(screen.queryByRole("button", { name: "Troll Amina" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Send to Sam" }));
  expect(onSend).not.toHaveBeenCalled();
  const confirm = await screen.findByRole("dialog", { name: "Confirm troll" });
  fireEvent.click(within(confirm).getByRole("button", { name: "Confirm" }));
  expect(onSend).toHaveBeenCalledWith("swap", secondId);
});

it("explains when the troll is locked or used", () => {
  const view = render(
    <TrollTab
      snapshot={{
        ...ready,
        trolls: { ...ready.trolls, token: "locked" },
        play: playingFixture.play,
      }}
      gameId="ABCDEFGH"
      selfId={playerId}
      pending={false}
      onSend={vi.fn()}
    />,
  );
  expect(screen.getByText("Your troll unlocks from question 2.")).toBeTruthy();
  view.rerender(
    <TrollTab
      snapshot={{ ...ready, trolls: { ...ready.trolls, token: "spent" } }}
      gameId="ABCDEFGH"
      selfId={playerId}
      pending={false}
      onSend={vi.fn()}
    />,
  );
  expect(screen.getByText("You have used your troll for tonight.")).toBeTruthy();
  expect(screen.queryByRole("group", { name: "Troll groups" })).toBeNull();
});

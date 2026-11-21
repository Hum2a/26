import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { trollCooldownMs, type LobbySnapshot } from "@26/shared";
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
    cooldownUntil: null,
    offers: [
      { kind: "crack", label: "Cracked screen", enabled: true },
      { kind: "mirror", label: "Mirror world", enabled: false },
      { kind: "swap", label: "Nickname swap", enabled: true },
    ],
    active: [],
    announcement: null,
  },
};

function renderTab(
  onSend: (kind: string, targetId: string, mediaId?: string) => void,
  extra: { pending?: boolean; snapshot?: LobbySnapshot; error?: string } = {},
) {
  return (
    <TrollTab
      snapshot={extra.snapshot ?? ready}
      gameId="ABCDEFGH"
      selfId={playerId}
      pending={extra.pending ?? false}
      error={extra.error}
      onSend={onSend}
    />
  );
}

it("groups trolls, then picks a target and confirms before sending", async () => {
  const onSend = vi.fn();
  const view = render(renderTab(onSend));
  const groups = screen.getByRole("group", { name: "Troll groups" });
  expect(within(groups).getByRole("button", { name: /Phone chaos/ })).toBeTruthy();
  expect(
    (screen.getByRole("button", { name: /Mirror world/ }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);

  expect(screen.getByRole("list", { name: "Steps" })).toBeTruthy();
  expect(screen.getByText("Pick a troll")).toBeTruthy();
  fireEvent.click(within(groups).getByRole("button", { name: /Identity/ }));
  fireEvent.click(screen.getByRole("button", { name: /Nickname swap/ }));
  fireEvent.click(await screen.findByRole("button", { name: "Troll Sam" }));
  expect(screen.queryByRole("button", { name: "Troll Amina" })).toBeNull();
  expect(onSend).not.toHaveBeenCalled();
  const confirm = await screen.findByRole("dialog", { name: "Confirm troll" });
  expect(within(confirm).getByRole("button", { name: "Confirm" })).toHaveProperty(
    "disabled",
    false,
  );
  fireEvent.click(within(confirm).getByRole("button", { name: "Confirm" }));
  expect(onSend).toHaveBeenCalledWith("swap", secondId);
  expect(navigator.vibrate).not.toHaveBeenCalled();
  expect(screen.queryByText("Sent. Watch their phone.")).toBeNull();
  view.rerender(renderTab(onSend, { pending: true }));
  expect(screen.getByText("Sending your troll…")).toBeTruthy();
  view.rerender(renderTab(onSend, { pending: false }));
  expect(navigator.vibrate).toHaveBeenCalled();
  expect(screen.getByText("Sent. Watch their phone.")).toBeTruthy();
});

it("does not celebrate a troll the room refused", async () => {
  const onSend = vi.fn();
  const view = render(renderTab(onSend));
  fireEvent.click(
    within(screen.getByRole("group", { name: "Troll groups" })).getByRole("button", {
      name: /Identity/,
    }),
  );
  fireEvent.click(screen.getByRole("button", { name: /Nickname swap/ }));
  fireEvent.click(await screen.findByRole("button", { name: "Troll Sam" }));
  fireEvent.click(
    within(await screen.findByRole("dialog", { name: "Confirm troll" })).getByRole(
      "button",
      { name: "Confirm" },
    ),
  );
  expect(onSend).toHaveBeenCalledWith("swap", secondId);
  view.rerender(renderTab(onSend, { pending: true }));
  view.rerender(renderTab(onSend, { pending: false, error: "Trolls are closed." }));
  expect(navigator.vibrate).not.toHaveBeenCalled();
  expect(screen.queryByText("Sent. Watch their phone.")).toBeNull();
  expect(
    within(screen.getByRole("dialog", { name: "Confirm troll" })).getByRole("button", {
      name: "Confirm",
    }),
  ).toHaveProperty("disabled", false);
});

afterEach(() => {
  vi.useRealTimers();
  vi.mocked(navigator.vibrate).mockClear();
});

it("explains when trolls are not open yet", () => {
  render(
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
  expect(screen.getByText("Trolls open once the questions start.")).toBeTruthy();
  expect(screen.getByRole("list", { name: "Steps" })).toBeTruthy();
  expect(
    (screen.getByRole("button", { name: /Cracked screen/ }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
  expect(screen.getAllByText("Waiting for the first question.").length).toBeGreaterThan(
    0,
  );
});

it("counts down the cooldown and flips to ready on its own when it ends", () => {
  vi.useFakeTimers();
  vi.setSystemTime(100_000);
  render(
    <TrollTab
      snapshot={{
        ...ready,
        trolls: { ...ready.trolls, token: "cooling", cooldownUntil: 165_000 },
      }}
      gameId="ABCDEFGH"
      selfId={playerId}
      pending={false}
      onSend={vi.fn()}
    />,
  );
  expect(screen.getByText("Next troll in 1:05.")).toBeTruthy();
  // The guest can still browse and line up a troll while recharging.
  expect(
    (screen.getByRole("button", { name: /Cracked screen/ }) as HTMLButtonElement)
      .disabled,
  ).toBe(false);
  act(() => vi.advanceTimersByTime(5_000));
  expect(screen.getByText("Next troll in 1:00.")).toBeTruthy();
  act(() => vi.advanceTimersByTime(60_000));
  expect(screen.getByText("Troll ready. Send one whenever you like.")).toBeTruthy();
});

it("holds the send button until the cooldown ends", async () => {
  const onSend = vi.fn();
  const cooling = (cooldownUntil: number): LobbySnapshot => ({
    ...ready,
    trolls: { ...ready.trolls, token: "cooling", cooldownUntil },
  });
  const view = render(
    <TrollTab
      snapshot={cooling(Date.now() + trollCooldownMs)}
      gameId="ABCDEFGH"
      selfId={playerId}
      pending={false}
      onSend={onSend}
    />,
  );
  fireEvent.click(
    within(screen.getByRole("group", { name: "Troll groups" })).getByRole("button", {
      name: /Identity/,
    }),
  );
  fireEvent.click(screen.getByRole("button", { name: /Nickname swap/ }));
  fireEvent.click(await screen.findByRole("button", { name: "Troll Sam" }));
  const confirm = await screen.findByRole("dialog", { name: "Confirm troll" });
  const waiting = within(confirm).getByRole("button", {
    name: "Confirm",
  }) as HTMLButtonElement;
  expect(waiting.disabled).toBe(true);
  expect(waiting.getAttribute("aria-disabled")).toBe("true");
  expect(screen.getByText(/^Ready in /)).toBeTruthy();

  // A stale "cooling" snapshot whose time has passed is ready on the phone.
  view.rerender(
    <TrollTab
      snapshot={cooling(Date.now() - 1_000)}
      gameId="ABCDEFGH"
      selfId={playerId}
      pending={false}
      onSend={onSend}
    />,
  );
  const send = within(confirm).getByRole("button", {
    name: "Confirm",
  }) as HTMLButtonElement;
  expect(send.disabled).toBe(false);
  fireEvent.click(send);
  expect(onSend).toHaveBeenCalledWith("swap", secondId);
});

it("previews the troll on the victim's stand-in phone before confirming", async () => {
  render(renderTab(vi.fn()));
  fireEvent.click(screen.getByRole("button", { name: /Cracked screen/ }));
  fireEvent.click(await screen.findByRole("button", { name: "Preview what it does" }));
  expect(
    screen.getByRole("region", { name: "Preview: what your victim sees" }),
  ).toBeTruthy();
  fireEvent.click(await screen.findByRole("button", { name: "Troll Sam" }));
  const preview = await screen.findByRole("region", { name: "Preview: what Sam sees" });
  expect(within(preview).getByText("Preview · what Sam will see")).toBeTruthy();
  expect(within(preview).getByText("Cracked screen")).toBeTruthy();
});

it("says trolls wait while the game is paused and blocks the send", async () => {
  const onSend = vi.fn();
  render(renderTab(onSend, { snapshot: { ...ready, paused: true } }));
  expect(
    screen.getByText("The game is paused. Trolls wait until it resumes."),
  ).toBeTruthy();
  expect(
    (screen.getByRole("button", { name: /Cracked screen/ }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
  expect(onSend).not.toHaveBeenCalled();
});

it("shows the room's reason when a troll is refused", async () => {
  const view = render(renderTab(vi.fn()));
  fireEvent.click(screen.getByRole("button", { name: /Cracked screen/ }));
  fireEvent.click(await screen.findByRole("button", { name: "Troll Sam" }));
  view.rerender(renderTab(vi.fn(), { error: "The game is paused." }));
  expect(await screen.findByText("Not sent: The game is paused.")).toBeTruthy();
});

it("explains a switched-off card by what the question lacks, not a vague limit", () => {
  render(renderTab(vi.fn()));
  const mirror = screen.getByRole("button", { name: /Mirror world/ });
  expect(within(mirror).getByText("Opens again on the next question.")).toBeTruthy();
});

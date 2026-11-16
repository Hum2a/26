import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
vi.mock("./rooms-api", () => ({ readAdminRoom: vi.fn() }));
vi.mock("../live/room-socket", () => ({ openRoomSocket: vi.fn() }));
vi.mock("../live/room-api", () => ({
  playRoom: vi.fn(),
  issueTransfer: vi.fn(),
  readDiagnostics: vi.fn(),
  downloadScoreSummary: vi.fn(),
}));
import { playRoom } from "../live/room-api";
import { LiveConsole } from "./live-console";
import { roomFixture } from "./room-fixture.test-support";
import {
  mountControls,
  playingFixture,
  setupControls,
  socket,
  success,
  update,
  playerId,
  secondId,
} from "./controls.test-support";
beforeEach(() => setupControls());

it("pins an advance and its uncertain retry to the phase the host saw", async () => {
  setupControls({ ...playingFixture, phaseGeneration: 4 });
  vi.mocked(playRoom)
    .mockResolvedValueOnce({ error: "Receipt lost", uncertain: true })
    .mockResolvedValueOnce(success);
  await mountControls(<LiveConsole />);
  fireEvent.click(screen.getByRole("button", { name: "Advance" }));
  await screen.findByText("Receipt lost");
  expect(playRoom).toHaveBeenCalledWith(
    expect.objectContaining({ action: "advance", expectedPhaseGeneration: 4 }),
  );
  update({ ...playingFixture, phase: "reveal", phaseGeneration: 5 });
  fireEvent.click(screen.getByRole("button", { name: "Retry the same action" }));
  await waitFor(() => expect(playRoom).toHaveBeenCalledTimes(2));
  expect(vi.mocked(playRoom).mock.calls[1]).toEqual(vi.mocked(playRoom).mock.calls[0]);
});

it("starts only the frozen race in a kart lobby and blocks its controls offline", async () => {
  setupControls({ ...roomFixture, kartLobby: { createdAt: 1000 } });
  await mountControls(<LiveConsole />);
  expect(screen.queryByRole("button", { name: "Start birthday game" })).toBeNull();
  expect(
    screen.queryByRole("button", { name: "Start the illustrative demo instead" }),
  ).toBeNull();
  expect(
    screen.queryByRole("button", { name: "Start local kart rehearsal" }),
  ).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Start kart race" }));
  // Starting asks first, naming what freezes.
  const dialog = await screen.findByRole("dialog");
  expect(dialog.textContent).toContain("The starting grid freezes now");
  expect(playRoom).not.toHaveBeenCalled();
  fireEvent.click(within(dialog).getByRole("button", { name: "Start kart race" }));
  await waitFor(() =>
    expect(playRoom).toHaveBeenCalledWith(
      expect.objectContaining({ action: "start-kart" }),
    ),
  );
  await screen.findByText("The kart race has started. The starting grid is frozen.");
  act(() => socket().onConnection("closed"));
  expect(
    (screen.getByRole("button", { name: "Start kart race" }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
});

it("starts the saved birthday script from the lobby", async () => {
  setupControls(roomFixture);
  await mountControls(<LiveConsole />);
  fireEvent.click(screen.getByRole("button", { name: "Start birthday game" }));
  const dialog = await screen.findByRole("dialog");
  expect(dialog.textContent).toContain("The running order freezes now");
  expect(playRoom).not.toHaveBeenCalled();
  fireEvent.click(within(dialog).getByRole("button", { name: "Start birthday game" }));
  await waitFor(() =>
    expect(playRoom).toHaveBeenCalledWith(
      expect.objectContaining({ action: "start-birthday" }),
    ),
  );
});

it("asks before the demo start and sends nothing when cancelled", async () => {
  setupControls(roomFixture);
  await mountControls(<LiveConsole />);
  fireEvent.click(
    screen.getByRole("button", { name: "Start the illustrative demo instead" }),
  );
  const dialog = await screen.findByRole("dialog");
  expect(dialog.textContent).toContain("not the birthday game");
  fireEvent.click(within(dialog).getByRole("button", { name: /Cancel|Close|Keep/ }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(playRoom).not.toHaveBeenCalled();
});

it("offers lobby actions without misleading phase controls", async () => {
  setupControls(roomFixture);
  await mountControls(<LiveConsole />);
  expect(
    (
      screen.getByRole("button", {
        name: "Start the illustrative demo instead",
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(false);
  expect(screen.queryByRole("button", { name: "Pause" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Reveal nickname votes" }));
  await waitFor(() =>
    expect(playRoom).toHaveBeenCalledWith(
      expect.objectContaining({ action: "reveal-names" }),
    ),
  );
});
it("renders server round information and waits for snapshots after pause/resume", async () => {
  await mountControls(<LiveConsole />);
  expect(
    screen.getByText("1 of 1 connected players answered · 1 in the room"),
  ).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Pause" }));
  await screen.findByText("The quiz is paused.");
  // An HTTP receipt must not replace authoritative socket state.
  expect(screen.queryByRole("button", { name: "Resume" })).toBeNull();
  update({ ...playingFixture, paused: true });
  fireEvent.click(screen.getByRole("button", { name: "Resume" }));
  await waitFor(() =>
    expect(playRoom).toHaveBeenLastCalledWith(
      expect.objectContaining({ action: "resume" }),
    ),
  );
  act(() => socket().onConnection("closed"));
  expect(
    (screen.getByRole("button", { name: "Resume" }) as HTMLButtonElement).disabled,
  ).toBe(true);
  update({ ...playingFixture, phase: "reveal", paused: false, stateVersion: 5 });
  act(() => socket().onConnection("open"));
  expect(
    (screen.getByRole("button", { name: "Hide stage content" }) as HTMLButtonElement)
      .disabled,
  ).toBe(false);
});
it("confirms skip, rejects a stale question and restores keyboard focus", async () => {
  await mountControls(<LiveConsole />);
  fireEvent.click(screen.getByRole("button", { name: /More controls/ }));
  const trigger = await screen.findByRole("button", { name: "Skip question" });
  trigger.focus();
  fireEvent.click(trigger);
  const dialog = screen.getByRole("dialog", { name: "Skip this question?" });
  expect(playRoom).not.toHaveBeenCalled();
  update({ ...playingFixture, phase: "reveal" });
  expect(
    (within(dialog).getByRole("button", { name: "Skip question" }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
  fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
  expect(document.activeElement).toBe(trigger);
  fireEvent.click(trigger);
  fireEvent.click(
    within(screen.getByRole("dialog")).getByRole("button", { name: "Skip question" }),
  );
  await waitFor(() =>
    expect(playRoom).toHaveBeenCalledWith(expect.objectContaining({ action: "skip" })),
  );
});
it("keeps finish-after-question semantics and confirms the final primary action", async () => {
  await mountControls(<LiveConsole />);
  fireEvent.keyDown(window, { key: "f" });
  expect(
    screen.getByRole("dialog", { name: "Finish after this question?" }).textContent,
  ).toContain("current question will finish first");
  fireEvent.click(screen.getByRole("button", { name: "Finish after this question" }));
  await waitFor(() =>
    expect(playRoom).toHaveBeenCalledWith(
      expect.objectContaining({ action: "finish" }),
    ),
  );
  update({ ...playingFixture, phase: "final" });
  fireEvent.click(screen.getByRole("button", { name: "Finish quiz" }));
  expect(screen.getByRole("dialog", { name: "Finish the quiz?" })).toBeTruthy();
  expect(playRoom).toHaveBeenCalledTimes(1);
});
it("suppresses shortcuts in fields, dialogs and repeated key events", async () => {
  await mountControls(
    <>
      <input aria-label="Test field" />
      <LiveConsole />
    </>,
  );
  fireEvent.keyDown(screen.getByLabelText("Test field"), { key: "p" });
  fireEvent.keyDown(window, { key: "p", repeat: true });
  fireEvent.keyDown(window, { key: "f" });
  fireEvent.keyDown(window, { key: "ArrowRight" });
  expect(playRoom).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  fireEvent.keyDown(window, { key: "p" });
  await waitFor(() => expect(playRoom).toHaveBeenCalledTimes(1));
});
it("blocks duplicates and retries the exact uncertain intent with the same ID", async () => {
  vi.mocked(playRoom)
    .mockResolvedValueOnce({ error: "Receipt lost", uncertain: true })
    .mockResolvedValueOnce(success);
  await mountControls(<LiveConsole />);
  const pause = screen.getByRole("button", { name: "Pause" });
  fireEvent.click(pause);
  fireEvent.click(pause);
  await screen.findByText("Receipt lost");
  expect((pause as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Retry the same action" }));
  await screen.findByText("The quiz is paused.");
  expect(playRoom).toHaveBeenCalledTimes(2);
  expect(vi.mocked(playRoom).mock.calls[0]).toEqual(vi.mocked(playRoom).mock.calls[1]);
  expect((pause as HTMLButtonElement).disabled).toBe(false);
});
it("steps fun facts and shows the next line only on this screen", async () => {
  await mountControls(<LiveConsole />);
  update({
    ...playingFixture,
    phase: "facts",
    funFactList: {
      index: 0,
      total: 2,
      cards: [
        {
          id: "fun:browser:firefox",
          illustrative: false,
          text: "1 person used Firefox.",
        },
        {
          id: "fun:scheme:dark",
          illustrative: false,
          text: "60% of you use dark mode.",
        },
      ],
    },
  });
  expect(screen.getByRole("button", { name: "Next fact" })).toBeTruthy();
  expect(screen.getByRole("heading", { name: "1 person used Firefox." })).toBeTruthy();
  expect(screen.getByText("Next: 60% of you use dark mode.")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Next fact" }));
  await waitFor(() =>
    expect(playRoom).toHaveBeenCalledWith(
      expect.objectContaining({ action: "advance" }),
    ),
  );
  update({
    ...playingFixture,
    phase: "facts",
    funFactList: {
      index: 1,
      total: 2,
      cards: [
        {
          id: "fun:browser:firefox",
          illustrative: false,
          text: "1 person used Firefox.",
        },
        {
          id: "fun:scheme:dark",
          illustrative: false,
          text: "60% of you use dark mode.",
        },
      ],
    },
  });
  fireEvent.click(screen.getByRole("button", { name: "Show the podium" }));
  await waitFor(() =>
    expect(playRoom).toHaveBeenCalledWith(
      expect.objectContaining({ action: "advance" }),
    ),
  );
});

it("counts only connected players in the round line", async () => {
  setupControls({
    ...playingFixture,
    players: [
      { playerId, nickname: "Amina" },
      { playerId: secondId, nickname: "Sam" },
    ],
    adminPlayers: [
      ...playingFixture.adminPlayers!,
      {
        playerId: secondId,
        nickname: "Sam",
        points: 0,
        connected: false,
        removed: false,
        answered: false,
      },
    ],
  });
  await mountControls(<LiveConsole />);
  expect(
    screen.getByText("1 of 1 connected players answered · 2 in the room"),
  ).toBeTruthy();
});

it("previews the next round for the operator", async () => {
  setupControls({
    ...playingFixture,
    nextQuestion: { title: "Guess the tab", kind: "slider" },
  });
  await mountControls(<LiveConsole />);
  expect(screen.getByText("Round 1 of 2 · Next: Guess the tab")).toBeTruthy();
});

function voteFixture(
  phase: "collect" | "vote" | "reveal",
  question: { candidateMode: "all" | "shortlist"; flow?: "tournament" },
) {
  return {
    ...playingFixture,
    phase,
    play: {
      ...playingFixture.play!,
      question: {
        id: "toast",
        index: 1,
        total: 2,
        prompt: "Write a toast.",
        points: 60,
        illustrative: true,
        attribution: "after" as const,
        presentation: "standard" as const,
        kind: "vote" as const,
        selfVote: "forbidden" as const,
        votes: 1 as const,
        tie: "shared" as const,
        award: "authors" as const,
        lateJoin: "ineligible" as const,
        ...question,
      },
      hostResponses: [
        { playerId, nickname: "Amina", summary: "Cheers all", included: true },
        {
          playerId: secondId,
          nickname: "Bilal",
          summary: "Rude line",
          included: false,
        },
      ],
    },
  } as typeof playingFixture;
}

it("hides and restores written answers on an all-answer ballot", async () => {
  setupControls(voteFixture("vote", { candidateMode: "all" }));
  await mountControls(<LiveConsole />);
  expect(
    screen.getByText(/Rude line \(hidden from guests and the stage\)/),
  ).toBeTruthy();
  expect(screen.getByText(/Votes already cast for it stop counting/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Hide Amina's answer" }));
  await waitFor(() =>
    expect(playRoom).toHaveBeenCalledWith(
      expect.objectContaining({ action: "exclude", playerId }),
    ),
  );
  await screen.findByText(
    "That answer is hidden from guests and the stage. It is still stored.",
  );
  fireEvent.click(screen.getByRole("button", { name: "Restore Bilal's answer" }));
  await waitFor(() =>
    expect(playRoom).toHaveBeenCalledWith(
      expect.objectContaining({ action: "include", playerId: secondId }),
    ),
  );
});

it("offers no answer moderation once a bracket is voting or a result is settled", async () => {
  setupControls(voteFixture("vote", { candidateMode: "all", flow: "tournament" }));
  await mountControls(<LiveConsole />);
  expect(screen.queryByRole("button", { name: "Hide Amina's answer" })).toBeNull();
  update(voteFixture("reveal", { candidateMode: "all" }));
  await waitFor(() =>
    expect(screen.queryByRole("button", { name: "Hide Amina's answer" })).toBeNull(),
  );
  expect(screen.queryByRole("button", { name: "Restore Bilal's answer" })).toBeNull();
});

it("keeps shortlist Include and Remove instead of Hide", async () => {
  setupControls(voteFixture("collect", { candidateMode: "shortlist" }));
  await mountControls(<LiveConsole />);
  expect(screen.getByText(/Rude line \(not on the ballot\)/)).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Hide Amina's answer" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Include Bilal" }));
  await waitFor(() =>
    expect(playRoom).toHaveBeenCalledWith(
      expect.objectContaining({ action: "include", playerId: secondId }),
    ),
  );
});

it("hides a typed answer from a commonness reveal", async () => {
  setupControls({
    ...playingFixture,
    phase: "reveal",
    play: {
      ...playingFixture.play!,
      question: {
        id: "common-password",
        index: 1,
        total: 2,
        prompt: "Most common password?",
        points: 100,
        illustrative: false,
        attribution: "never",
        presentation: "standard",
        kind: "typed",
        maxLength: 40,
        scoring: "commonness",
      },
      hostResponses: [
        { playerId, nickname: "Amina", summary: "Submitted: hunter2", included: true },
      ],
    },
  } as typeof playingFixture);
  await mountControls(<LiveConsole />);
  fireEvent.click(screen.getByRole("button", { name: "Hide Amina's answer" }));
  await waitFor(() =>
    expect(playRoom).toHaveBeenCalledWith(
      expect.objectContaining({ action: "exclude", playerId }),
    ),
  );
});

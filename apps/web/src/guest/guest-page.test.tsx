import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, expect, it, vi } from "vitest";
import type { LobbySnapshot } from "@26/shared";
import { openRoomSocket } from "../live/room-socket";
import { playingFixture, playerId, secondId } from "../admin/controls.test-support";
import { GuestPage } from "./guest-page";

vi.mock("../live/room-api", async (original) => ({
  ...(await original<typeof import("../live/room-api")>()),
  resumeGuest: vi.fn(async () => undefined),
  leaveLobby: vi.fn(async () => undefined),
  redeemTransfer: vi.fn(),
}));
vi.mock("../live/room-socket", () => ({ openRoomSocket: vi.fn() }));
import { leaveLobby, redeemTransfer } from "../live/room-api";

type Options = Parameters<typeof openRoomSocket>[0];
let options: Options;
const socket = {
  close: vi.fn(),
  submitAnswer: vi.fn(() => "answer-1"),
  submitText: vi.fn(() => "wordle-1"),
  submitTroll: vi.fn(() => "troll-1"),
  submitTrollEscape: vi.fn(() => "escape-1"),
  submitDraft: vi.fn(),
};

const ready: LobbySnapshot = {
  ...playingFixture,
  players: [
    { playerId, nickname: "Amina" },
    { playerId: secondId, nickname: "Sam" },
  ],
  play: {
    ...playingFixture.play!,
    selfAnswer: null,
    question: { ...playingFixture.play!.question, index: 2 },
  },
  trolls: {
    token: "ready",
    offers: [{ kind: "swap", label: "Nickname swap", enabled: true }],
    active: [],
    announcement: null,
  },
};

beforeEach(() => {
  vi.mocked(openRoomSocket).mockReset();
  vi.mocked(openRoomSocket).mockImplementation((next) => {
    options = next;
    return socket as unknown as ReturnType<typeof openRoomSocket>;
  });
  Object.values(socket).forEach((fn) => fn.mockClear());
});

function tabButton(name: RegExp) {
  return within(screen.getByRole("navigation", { name: "Game sections" })).getByRole(
    "button",
    { name },
  );
}

async function sendTroll() {
  fireEvent.click(tabButton(/^Troll/));
  const groups = await screen.findByRole("group", { name: "Troll groups" });
  fireEvent.click(within(groups).getByRole("button", { name: /Identity/ }));
  fireEvent.click(screen.getByRole("button", { name: /Nickname swap/ }));
  // The picker eases in after the troll is chosen, and role queries on this page are slow.
  fireEvent.click(
    await screen.findByRole("button", { name: "Troll Sam" }, { timeout: 15_000 }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Send to Sam" }));
  const confirm = await screen.findByRole("dialog");
  fireEvent.click(within(confirm).getByRole("button", { name: "Confirm" }));
}

it("keeps answering open while a troll is still in flight, and tracks each separately", async () => {
  render(
    <MemoryRouter>
      <GuestPage
        rehearsalSession={{
          gameId: "ABCDEFGH",
          playerId,
          nickname: "Amina",
          joinCode: "ABCDEF",
          stateVersion: 2,
        }}
        rehearsalCredential={{ playerId, secret: "rehearsal" }}
      />
    </MemoryRouter>,
  );
  await waitFor(() => expect(openRoomSocket).toHaveBeenCalled());
  act(() => {
    options.onConnection("open");
    options.onSnapshot(ready);
  });

  await sendTroll();
  expect(socket.submitTroll).toHaveBeenCalledWith("swap", secondId, undefined);

  // The troll has not been acknowledged, yet the answer still sends.
  fireEvent.click(tabButton(/^Play/));
  fireEvent.click(await screen.findByRole("button", { name: /One/ }));
  const send = screen.queryByRole("button", { name: /Send/ });
  if (send) fireEvent.click(send);
  await waitFor(() => expect(socket.submitAnswer).toHaveBeenCalledWith("one"));
  expect(await screen.findByText("Sending your answer.")).toBeTruthy();

  // The troll's acknowledgement does not release or reject the answer.
  act(() => options.onAck({ requestId: "troll-1", accepted: true }));
  expect(screen.getByText("Sending your answer.")).toBeTruthy();

  // The answer's own acknowledgement does.
  act(() => options.onAck({ requestId: "answer-1", accepted: true }));
  await waitFor(() => expect(screen.queryByText("Sending your answer.")).toBeNull());
}, 20_000);

it("reports a refused troll without touching the answer", async () => {
  render(
    <MemoryRouter>
      <GuestPage
        rehearsalSession={{
          gameId: "ABCDEFGH",
          playerId,
          nickname: "Amina",
          joinCode: "ABCDEF",
          stateVersion: 2,
        }}
        rehearsalCredential={{ playerId, secret: "rehearsal" }}
      />
    </MemoryRouter>,
  );
  await waitFor(() => expect(openRoomSocket).toHaveBeenCalled());
  act(() => {
    options.onConnection("open");
    options.onSnapshot(ready);
  });
  await sendTroll();
  expect(await screen.findByText("Sending your troll.")).toBeTruthy();
  act(() =>
    options.onAck({
      requestId: "troll-1",
      accepted: false,
      error: "Trolls are closed.",
    }),
  );
  expect(await screen.findByText("Trolls are closed.")).toBeTruthy();
  expect(socket.submitAnswer).not.toHaveBeenCalled();
}, 20_000);

it("shows Leave lobby in the You menu and returns to the join form", async () => {
  render(
    <MemoryRouter>
      <GuestPage
        rehearsalSession={{
          gameId: "ABCDEFGH",
          playerId,
          nickname: "Amina",
          joinCode: "ABCDEF",
          stateVersion: 2,
        }}
      />
    </MemoryRouter>,
  );
  await waitFor(() => expect(openRoomSocket).toHaveBeenCalled());
  act(() => {
    options.onConnection("open");
    options.onSnapshot({
      ...ready,
      phase: "lobby",
      play: null,
      mode: "kart",
    } as LobbySnapshot);
  });
  fireEvent.click(await screen.findByRole("button", { name: "You: Amina" }));
  const leaveButtons = await screen.findAllByRole("button", { name: "Leave lobby" });
  expect(leaveButtons.length).toBeGreaterThanOrEqual(1);
  fireEvent.click(leaveButtons[0]!);
  await waitFor(() => expect(leaveLobby).toHaveBeenCalled());
  expect(await screen.findByRole("heading", { name: "Join the room" })).toBeTruthy();
  expect(
    await screen.findByText(
      "You left the lobby. Enter a new join code when you are ready.",
    ),
  ).toBeTruthy();
}, 20_000);

it("does not ask for nickname votes in a kart-only lobby", async () => {
  render(
    <MemoryRouter>
      <GuestPage
        rehearsalSession={{
          gameId: "ABCDEFGH",
          playerId,
          nickname: "Amina",
          joinCode: "ABCDEF",
          stateVersion: 2,
        }}
        rehearsalCredential={{ playerId, secret: "rehearsal" }}
      />
    </MemoryRouter>,
  );
  await waitFor(() => expect(openRoomSocket).toHaveBeenCalled());
  const lobby = {
    ...ready,
    phase: "lobby",
    play: null,
    cloud: [{ playerId: secondId, nickname: "Sam", likes: 0, dislikes: 0 }],
  } as unknown as LobbySnapshot;
  act(() => {
    options.onConnection("open");
    options.onSnapshot(lobby);
  });
  expect(await screen.findByText("Sam")).toBeTruthy();
  act(() => options.onSnapshot({ ...lobby, mode: "kart" } as LobbySnapshot));
  await waitFor(() => expect(screen.queryByText("Sam")).toBeNull());
}, 20_000);

const wordleSession = {
  gameId: "ABCDEFGH",
  playerId,
  nickname: "Amina",
  joinCode: "ABCDEF",
  stateVersion: 2,
};

function wordleRound(index: number): LobbySnapshot {
  return {
    ...ready,
    play: {
      ...ready.play!,
      question: {
        ...ready.play!.question,
        index,
        id: `wordle-${index}`,
        prompt: `Wordle ${index}`,
        presentation: "glyph",
        kind: "wordle",
        wordLength: 5,
        maxGuesses: 6,
      },
    },
  };
}

async function openWordle() {
  render(
    <MemoryRouter>
      <GuestPage rehearsalSession={wordleSession} />
    </MemoryRouter>,
  );
  await waitFor(() => expect(openRoomSocket).toHaveBeenCalled());
  act(() => {
    options.onConnection("open");
    options.onSnapshot(wordleRound(1));
  });
}

async function sendWord() {
  const board = await screen.findByRole("region", { name: "Wordle game" });
  fireEvent.paste(board, { clipboardData: { getData: () => "ZZZZZ" } });
  fireEvent.click(screen.getByRole("button", { name: "Check word" }));
}

it("ignores a late Wordle rejection after the room advances", async () => {
  await openWordle();
  socket.submitText.mockReturnValueOnce("previous-word");
  await sendWord();
  expect(socket.submitText).toHaveBeenCalledWith("ZZZZZ");
  act(() => options.onSnapshot(wordleRound(2)));
  await screen.findByRole("heading", { name: "Wordle 2" });
  act(() =>
    options.onAck({
      requestId: "previous-word",
      accepted: false,
      error: "Previous error",
    }),
  );
  expect(screen.queryByText("Previous error")).toBeNull();
  await sendWord();
  expect(socket.submitText).toHaveBeenCalledTimes(2);
}, 20_000);

it("clears a Wordle rejection when a transfer replaces the same phone session", async () => {
  await openWordle();
  await sendWord();
  act(() =>
    options.onAck({ requestId: "wordle-1", accepted: false, error: "Old rejection" }),
  );
  expect(await screen.findAllByText("Old rejection")).not.toHaveLength(0);

  vi.mocked(redeemTransfer).mockResolvedValueOnce(wordleSession);
  fireEvent.click(screen.getByRole("button", { name: "You: Amina" }));
  fireEvent.click(await screen.findByRole("button", { name: "Changed phones?" }));
  fireEvent.change(screen.getByLabelText("Transfer code"), {
    target: { value: "RECOVER1" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Use this phone" }));
  await waitFor(() => expect(openRoomSocket).toHaveBeenCalledTimes(2));
  act(() => {
    options.onConnection("open");
    options.onSnapshot(wordleRound(1));
  });
  const board = await screen.findByRole("region", { name: "Wordle game" });
  expect(within(board).getByRole("status").textContent).toContain("Guess 1 of 6");
  await waitFor(() => expect(screen.queryByText("Old rejection")).toBeNull());
}, 20_000);

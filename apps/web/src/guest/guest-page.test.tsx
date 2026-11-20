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
vi.mock("../chess/stockfish-worker", () => ({
  StockfishEngine: class {
    private callbacks: { onReady: () => void };
    constructor(callbacks: { onReady: () => void }) {
      this.callbacks = callbacks;
    }
    async initialize() {
      this.callbacks.onReady();
    }
    setPosition() {}
    go() {}
    stop() {}
    terminate() {}
  },
}));
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
  submitChessMove: vi.fn(() => "chess-move-1"),
  submitChessResign: vi.fn(() => "chess-resign-1"),
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

it("returns a kart phone from the ranks to Play when the next race opens", async () => {
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
    options.onSnapshot({ ...ready, mode: "kart" });
  });
  act(() => options.onSnapshot({ ...ready, mode: "kart", phase: "podium" }));
  expect(tabButton(/^Ranks/).getAttribute("aria-current")).toBe("page");
  act(() =>
    options.onSnapshot({
      ...ready,
      mode: "kart",
      phase: "lobby",
      play: null,
    } as LobbySnapshot),
  );
  expect(tabButton(/^Play/).getAttribute("aria-current")).toBe("page");
});

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

it("submits chess moves in quiz mode without quiz pending banners and shows the score on reveal", async () => {
  await import("../chess/guest-chess");
  const chessCollect: LobbySnapshot = {
    ...ready,
    phase: "collect",
    deadlineAt: Date.now() + 120_000,
    play: {
      ...ready.play!,
      question: {
        kind: "chess",
        id: "chess-battle",
        index: 1,
        total: 1,
        prompt: "Play 1-minute blitz against the Humza bot!",
        points: 40,
        illustrative: false,
        attribution: "never",
        presentation: "default",
        playerTimeMs: 60_000,
        botTimeMs: 60_000,
      },
      chess: {
        gameId: "ABCDEFGH-chess",
        fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
        pgn: "",
        status: "in-progress",
        playerColor: "white",
        botColor: "black",
        playerTimeMs: 60_000,
        botTimeMs: 60_000,
        sideToMove: "white",
        plyCount: 0,
        positionRevision: 0,
        lastMoveAt: Date.now(),
        paused: false,
        inCheck: false,
        isGameOver: false,
        capturedPoints: 0,
        score: 0,
      },
      selfAnswer: null,
      selfBallot: null,
      selfAward: null,
      selfStanding: null,
    },
  };

  render(
    <MemoryRouter>
      <GuestPage rehearsalSession={wordleSession} />
    </MemoryRouter>,
  );
  await waitFor(() => expect(openRoomSocket).toHaveBeenCalled());
  act(() => {
    options.onConnection("open");
    options.onSnapshot(chessCollect);
  });
  await act(async () => {
    await vi.dynamicImportSettled();
  });
  const collectScope = await waitFor(
    () => {
      const node = document.querySelector('[data-phase="collect"]');
      expect(node).toBeTruthy();
      expect(node?.textContent).toContain("Your move");
      return node as HTMLElement;
    },
    { timeout: 5_000 },
  );

  // 1. Play e2 -> e4 and confirm ack-before-snapshot keeps the move on board without quiz banners.
  fireEvent.click(within(collectScope).getByRole("button", { name: "e2 White Pawn" }));
  fireEvent.click(within(collectScope).getByRole("button", { name: "e4" }));
  expect(socket.submitChessMove).toHaveBeenCalledWith({
    gameId: "ABCDEFGH-chess",
    from: "e2",
    to: "e4",
    promotion: undefined,
    positionRevision: 0,
  });
  expect(screen.queryByText("Sending your answer.")).toBeNull();
  expect(screen.queryByText("Sending…")).toBeNull();

  act(() => options.onAck({ requestId: "chess-move-1", accepted: true }));
  expect(screen.queryByText("That answer was not accepted.")).toBeNull();
  expect(within(collectScope).getByRole("button", { name: "e4 White Pawn" })).toBeTruthy();

  // 2. Snapshot advances to revision 1; resigning sends chess-resign and surfaces chess-specific rejection.
  act(() =>
    options.onSnapshot({
      ...chessCollect,
      play: {
        ...chessCollect.play!,
        chess: {
          ...chessCollect.play!.chess!,
          fen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1",
          pgn: "1. e4",
          sideToMove: "black",
          plyCount: 1,
          positionRevision: 1,
        },
      },
    }),
  );

  const resign = within(collectScope).getByRole("button", { name: /Resign/i });
  fireEvent.click(resign);
  expect(socket.submitChessResign).toHaveBeenCalledWith({
    gameId: "ABCDEFGH-chess",
  });
  expect(screen.queryByText("Sending your answer.")).toBeNull();
  expect(screen.queryByText("Sending…")).toBeNull();

  act(() =>
    options.onAck({
      requestId: "chess-resign-1",
      accepted: false,
      error: "Rejected resignation",
    }),
  );
  expect(screen.getByText("Rejected resignation")).toBeTruthy();
  expect(screen.queryByText("That answer was not accepted.")).toBeNull();

  act(() =>
    options.onSnapshot({
      ...chessCollect,
      phase: "reveal",
      play: {
        ...chessCollect.play!,
        selfAward: 40,
        selfStanding: { place: 1, points: 40, players: 2 },
        chess: {
          ...chessCollect.play!.chess!,
          status: "checkmate",
          winner: "player",
          isGameOver: true,
          score: 40,
        } as never,
      },
    }),
  );

  expect(await screen.findByText("+40 points")).toBeTruthy();
  expect(screen.queryByText("Rejected resignation")).toBeNull();
  expect(screen.queryByText("No answer from you")).toBeNull();
}, 20_000);

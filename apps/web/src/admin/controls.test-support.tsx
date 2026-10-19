import { act, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { vi } from "vitest";
import type { ReactNode } from "react";
import type { LobbySnapshot } from "@26/shared";
import { readAdminRoom } from "./rooms-api";
import { openRoomSocket } from "../live/room-socket";
import { playRoom, issueTransfer } from "../live/room-api";
import { AdminRoomProvider } from "./room-provider";
import { roomFixture } from "./room-fixture.test-support";

export const playerId = "00000000-0000-4000-8000-000000000001";
export const secondId = "00000000-0000-4000-8000-000000000002";
export const playingFixture: LobbySnapshot = {
  ...roomFixture,
  phase: "collect",
  players: [{ playerId, nickname: "Amina" }],
  adminPlayers: [
    {
      playerId,
      nickname: "Amina",
      points: 100,
      connected: true,
      removed: false,
      answered: true,
    },
  ],
  play: {
    question: {
      id: "test-question",
      index: 1,
      total: 2,
      prompt: "A test question?",
      points: 100,
      illustrative: true,
      attribution: "never",
      presentation: "standard",
      kind: "choice",
      speedBonus: false,
      modifiers: [],
      suppressSpeedBonus: false,
      options: [
        { id: "one", label: "One" },
        { id: "two", label: "Two" },
      ],
    },
    submissionCount: 1,
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
    presenterNotes: "Private presenter detail",
  },
};
export const success = {
  ok: true as const,
  phase: "collect" as const,
  paused: false,
  held: false,
  stateVersion: 2,
};

export function setupControls(snapshot: LobbySnapshot = playingFixture) {
  vi.resetAllMocks();
  vi.mocked(readAdminRoom).mockResolvedValue(snapshot);
  vi.mocked(playRoom).mockResolvedValue(success);
  vi.mocked(issueTransfer).mockResolvedValue({
    code: "ABCDEF",
    playerId,
    expiresAt: new Date(Date.now() + 120_000).toISOString(),
  });
  vi.mocked(openRoomSocket).mockReturnValue({
    close: vi.fn(),
    requestSnapshot: vi.fn(),
    submitAnswer: vi.fn(),
    submitEstimate: vi.fn(),
    submitRank: vi.fn(),
    submitText: vi.fn(),
    submitBallot: vi.fn(),
    submitDuel: vi.fn(),
    submitTroll: vi.fn(),
    submitDraft: vi.fn(),
    submitTrollEscape: vi.fn(),
    submitReaction: vi.fn(),
  });
  // jsdom does not implement native dialog methods; reflect browser open/close semantics.
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
    this.querySelector<HTMLElement>("[autofocus]")?.focus();
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  };
}
export async function mountControls(children: ReactNode) {
  const view = render(
    <MemoryRouter>
      <AdminRoomProvider gameId="ABCDEFGH">{children}</AdminRoomProvider>
    </MemoryRouter>,
  );
  await screen.findByRole("heading", { level: 1 });
  await waitFor(() => {
    if (!vi.mocked(openRoomSocket).mock.calls.length)
      throw new Error("The room socket is not mounted yet.");
  });
  act(() => socket().onConnection("open"));
  return view;
}
export function socket() {
  return vi.mocked(openRoomSocket).mock.calls.at(-1)![0];
}
export function update(snapshot: LobbySnapshot) {
  act(() => socket().onSnapshot(snapshot));
}

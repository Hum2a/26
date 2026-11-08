import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
vi.mock("./rooms-api", () => ({ readAdminRoom: vi.fn() }));
vi.mock("../live/room-socket", () => ({ openRoomSocket: vi.fn() }));
vi.mock("../live/room-api", () => ({ playRoom: vi.fn(), issueTransfer: vi.fn() }));
import type { LobbySnapshot } from "@26/shared";
import { playRoom } from "../live/room-api";
import { WallPage } from "./wall-page";
import {
  mountControls,
  playerId,
  playingFixture,
  setupControls,
} from "./controls.test-support";

const id = (n: number) => `00000000-0000-4000-8000-0000000000a${n}`;

const fixture: LobbySnapshot = {
  ...playingFixture,
  wall: {
    enabled: true,
    placement: "breaks",
    waiting: 1,
    now: {
      postId: id(1),
      mediaId: id(2),
      nickname: "Amina",
      caption: "On now",
      frame: "polaroid",
      untilAt: Date.now() + 5_000,
      reactions: [],
    },
    queue: [
      {
        postId: id(3),
        mediaId: id(4),
        nickname: "Amina",
        caption: "Please approve",
        frame: "wanted",
        playerId,
        status: "pending",
        position: null,
      },
      {
        postId: id(5),
        mediaId: id(6),
        nickname: "Amina",
        caption: null,
        frame: "polaroid",
        playerId,
        status: "queued",
        position: 1,
      },
    ],
    recent: [],
    settings: { moderation: "approve", showMs: 8_000, captions: true },
    muted: [],
  },
};

beforeEach(() => setupControls(fixture));

const sent = () => vi.mocked(playRoom).mock.calls.map(([intent]) => intent);

it("approves a waiting photo with its button", async () => {
  await mountControls(<WallPage />);
  const card = screen.getByRole("article", { name: "Amina's photo" });
  fireEvent.click(card.querySelector("button")!);
  await waitFor(() =>
    expect(sent()).toContainEqual(
      expect.objectContaining({ action: "wall-approve", postId: id(3) }),
    ),
  );
});

it("declines the first waiting photo with the D key", async () => {
  await mountControls(<WallPage />);
  fireEvent.keyDown(window, { key: "d" });
  await waitFor(() =>
    expect(sent()).toContainEqual(
      expect.objectContaining({ action: "wall-decline", postId: id(3) }),
    ),
  );
});

it("says which photo the big screen could not display, and keeps Skip", async () => {
  setupControls({
    ...fixture,
    wall: {
      ...fixture.wall!,
      now: { ...fixture.wall!.now!, displayFailed: true },
      recent: [
        {
          postId: id(7),
          mediaId: id(8),
          nickname: "Bilal",
          caption: null,
          frame: "polaroid",
          playerId,
          status: "shown",
          reactions: 0,
          displayFailed: true,
        },
        {
          postId: id(9),
          mediaId: id(0),
          nickname: "Cara",
          caption: null,
          frame: "polaroid",
          playerId,
          status: "shown",
          reactions: 2,
        },
      ],
    },
  });
  await mountControls(<WallPage />);
  expect(
    screen
      .getByRole("region", { name: "On screen now" })
      .textContent?.includes("Couldn't display on the big screen"),
  ).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Skip" }));
  await waitFor(() =>
    expect(sent()).toContainEqual(expect.objectContaining({ action: "wall-skip" })),
  );
  // In the history, only the photo that failed is marked.
  fireEvent.click(screen.getByRole("button", { name: /Shown so far \(2\)/ }));
  const marked = await screen.findAllByText("Couldn't display");
  expect(marked).toHaveLength(1);
  expect(marked[0].closest("li")?.textContent).toContain("Bilal");
});

it("pulls the photo on screen and changes settings", async () => {
  await mountControls(<WallPage />);
  fireEvent.click(screen.getByRole("button", { name: "Pull it" }));
  await waitFor(() =>
    expect(sent()).toContainEqual(
      expect.objectContaining({ action: "wall-pull", postId: id(1) }),
    ),
  );
  fireEvent.click(screen.getByLabelText("Straight to the big screen"));
  await waitFor(() =>
    expect(sent()).toContainEqual(
      expect.objectContaining({
        action: "wall-settings",
        wallSettings: { moderation: "direct" },
      }),
    ),
  );
  expect(
    screen.getByRole("button", { name: /Show next now \(1 in the queue\)/ }),
  ).toBeTruthy();
});

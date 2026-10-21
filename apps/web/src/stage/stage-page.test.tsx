import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, expect, it, vi } from "vitest";
import { StagePage } from "./stage-page";
import { stageShow } from "./audio";
import { lookupStage, playRoom } from "../live/room-api";
import { openRoomSocket } from "../live/room-socket";
import { requestStageFullscreen, exitStageFullscreen } from "../device/fullscreen";
import { roomFixture } from "../admin/room-fixture.test-support";
import { playingFixture } from "../admin/controls.test-support";
vi.mock("../live/room-api", () => ({ lookupStage: vi.fn(), playRoom: vi.fn() }));
vi.mock("../live/room-socket", () => ({ openRoomSocket: vi.fn() }));
vi.mock("../device/fullscreen", () => ({
  requestStageFullscreen: vi.fn(),
  exitStageFullscreen: vi.fn(),
}));
vi.mock("./audio", () => ({
  stageShow: {
    setMuted: vi.fn(),
    unlock: vi.fn(),
    unlocked: false,
    playUrl: vi.fn().mockResolvedValue(false),
  },
}));
beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  vi.mocked(lookupStage).mockResolvedValue(roomFixture);
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
    submitKartInput: vi.fn(),
    submitTrollEscape: vi.fn(),
    submitReaction: vi.fn(),
    reconnectNow: vi.fn(),
  });
});
function socket() {
  return vi.mocked(openRoomSocket).mock.calls.at(-1)![0];
}
async function connect() {
  render(
    <MemoryRouter initialEntries={["/screen?code=ABCDEF"]}>
      <StagePage />
    </MemoryRouter>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Connect room" }));
  await waitFor(() => expect(openRoomSocket).toHaveBeenCalled());
}
async function present() {
  await connect();
  act(() => socket().onConnection("open"));
  fireEvent.click(screen.getByRole("button", { name: "Present on this screen" }));
  await screen.findByRole("main", { name: "Projector presentation" });
}
it("requires a scoped room lookup and an open socket before presentation", async () => {
  await connect();
  expect(lookupStage).toHaveBeenCalledWith("ABCDEF");
  expect(
    (
      screen.getByRole("button", {
        name: "Present on this screen",
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(true);
  act(() => socket().onConnection("open"));
  fireEvent.click(screen.getByRole("button", { name: "Present on this screen" }));
  expect(screen.getByRole("heading", { name: "In the lobby" })).toBeTruthy();
  expect(screen.queryByRole("navigation")).toBeNull();
  expect(screen.queryByRole("textbox")).toBeNull();
  expect(screen.queryByRole("link", { name: "Open admin" })).toBeNull();
  expect(requestStageFullscreen).not.toHaveBeenCalled();
});
it("clears a failed lookup, preserves the entered code and allows a retry", async () => {
  vi.mocked(lookupStage).mockResolvedValueOnce({
    error: "Projector access is required.",
  });
  render(
    <MemoryRouter>
      <StagePage />
    </MemoryRouter>,
  );
  fireEvent.change(screen.getByLabelText("Join code"), { target: { value: "abcdef" } });
  fireEvent.click(screen.getByRole("button", { name: "Connect room" }));
  await screen.findByText("Projector access is required.");
  expect((screen.getByLabelText("Join code") as HTMLInputElement).value).toBe("abcdef");
  expect(
    (screen.getByRole("button", { name: "Connect room" }) as HTMLButtonElement)
      .disabled,
  ).toBe(false);
  fireEvent.click(screen.getByRole("button", { name: "Connect room" }));
  await waitFor(() => expect(openRoomSocket).toHaveBeenCalledOnce());
});
it("has display shortcuts only and returns to setup with Escape", async () => {
  vi.mocked(lookupStage).mockResolvedValue(playingFixture);
  await present();
  expect(screen.getByText("A test question?")).toBeTruthy();
  expect(screen.queryByText("Private presenter detail")).toBeNull();
  for (const key of [" ", "p", "h", "d", "o"]) fireEvent.keyDown(window, { key });
  expect(playRoom).not.toHaveBeenCalled();
  expect(document.querySelector(".stage-safe-outline")).toBeNull();
  expect(screen.queryByText(/Operator|diagnostic/i)).toBeNull();
  fireEvent.keyDown(window, { key: "f" });
  expect(requestStageFullscreen).toHaveBeenCalledOnce();
  fireEvent.keyDown(window, { key: "Escape" });
  await screen.findByRole("heading", { name: "Projector setup" });
  expect(exitStageFullscreen).toHaveBeenCalledOnce();
  expect(document.activeElement).toBe(
    screen.getByRole("button", { name: "Present on this screen" }),
  );
});
it("hides a stale question on disconnect, restores snapshots and honours host hiding", async () => {
  vi.mocked(lookupStage).mockResolvedValue(playingFixture);
  await present();
  act(() => socket().onConnection("closed"));
  expect(stageShow.setMuted).toHaveBeenLastCalledWith(true);
  expect(screen.queryByText("A test question?")).toBeNull();
  expect(
    screen.getByRole("heading", { name: "Reconnecting to the room." }),
  ).toBeTruthy();
  act(() => {
    socket().onSnapshot({ ...playingFixture, stageHidden: true, play: null });
    socket().onConnection("open");
  });
  expect(screen.getByRole("heading", { name: "Hidden by the host." })).toBeTruthy();
  expect(stageShow.setMuted).toHaveBeenLastCalledWith(true);
  act(() => socket().onSnapshot(playingFixture));
  expect(await screen.findByText("A test question?")).toBeTruthy();
});
it("keeps replacement details in setup and can reconnect the same room", async () => {
  await present();
  act(() => socket().onReplaced?.("Private access replacement detail"));
  expect(screen.queryByText(/Private access replacement detail/)).toBeNull();
  expect(
    screen.getByRole("heading", { name: "Reconnecting to the room." }),
  ).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Projector setup" }));
  fireEvent.click(screen.getByRole("button", { name: "Connect room" }));
  await waitFor(() => expect(openRoomSocket).toHaveBeenCalledTimes(2));
  act(() => socket().onConnection("open"));
  expect(
    (
      screen.getByRole("button", {
        name: "Present on this screen",
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(false);
});
it("returns to setup when the browser leaves full screen", async () => {
  await present();
  const descriptor = Object.getOwnPropertyDescriptor(document, "fullscreenElement");
  try {
    Object.defineProperty(document, "fullscreenElement", {
      configurable: true,
      value: document.documentElement,
    });
    act(() => document.dispatchEvent(new Event("fullscreenchange")));
    Object.defineProperty(document, "fullscreenElement", {
      configurable: true,
      value: null,
    });
    act(() => document.dispatchEvent(new Event("fullscreenchange")));
    await screen.findByRole("heading", { name: "Projector setup" });
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Present on this screen" }),
    );
  } finally {
    if (descriptor) Object.defineProperty(document, "fullscreenElement", descriptor);
    else Reflect.deleteProperty(document, "fullscreenElement");
  }
});

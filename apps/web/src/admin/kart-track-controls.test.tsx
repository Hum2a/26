import { fireEvent, screen, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
vi.mock("./rooms-api", () => ({ readAdminRoom: vi.fn() }));
vi.mock("../live/room-socket", () => ({ openRoomSocket: vi.fn() }));
vi.mock("../live/room-api", () => ({ playRoom: vi.fn(), issueTransfer: vi.fn() }));
import { playRoom } from "../live/room-api";
import {
  setupControls,
  mountControls,
  playingFixture,
  update,
} from "./controls.test-support";
import { KartTrackControls } from "./kart-track-controls";
it("shows committed course/history, sends the scoped receipted choice and links actual rehearsal", async () => {
  setupControls({
    ...playingFixture,
    phase: "lobby",
    kartLobby: {
      createdAt: 100,
      trackId: "mario-circuit-v1",
      history: [{ atMs: 200, trackId: "mario-circuit-v1", source: "host" }],
    },
  });
  await mountControls(
    <>
      <h1>Live controls</h1>
      <KartTrackControls />
    </>,
  );
  expect(await screen.findByText(/Saved course: Mario circuit/)).toBeTruthy();
  fireEvent.change(screen.getByLabelText("Course for this race"), {
    target: { value: "26-park-v1" },
  });
  update({
    ...playingFixture,
    phase: "lobby",
    kartLobby: {
      createdAt: 100,
      trackId: "mario-circuit-v1",
      history: [{ atMs: 200, trackId: "mario-circuit-v1", source: "host" }],
    },
  });
  expect(
    (screen.getByLabelText("Course for this race") as HTMLSelectElement).value,
  ).toBe("26-park-v1");
  expect(screen.getByText(/Saved course: Mario circuit/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Save course" }));
  await waitFor(() =>
    expect(playRoom).toHaveBeenCalledWith(
      expect.objectContaining({ action: "kart-track", kartTrack: "26-park-v1" }),
    ),
  );
  expect(
    screen.getByRole("list", { name: "Course selection history" }).textContent,
  ).toContain("Host chose Mario circuit");
  expect(
    screen
      .getByRole("link", { name: "Rehearse courses without guests" })
      .getAttribute("href"),
  ).toBe("/admin/kart?view=tracks");
});
it("freezes controls after the start while preserving committed course and history", async () => {
  setupControls({
    ...playingFixture,
    kartLobby: { createdAt: 100, trackId: "26-park-v1", history: [] },
  });
  await mountControls(
    <>
      <h1>Live controls</h1>
      <KartTrackControls />
    </>,
  );
  expect(await screen.findByText(/Saved course: 26 Park/)).toBeTruthy();
  expect(
    (screen.getByRole("button", { name: "Save course" }) as HTMLButtonElement).disabled,
  ).toBe(true);
  expect(
    (screen.getByLabelText("Course for this race") as HTMLSelectElement).disabled,
  ).toBe(true);
  expect(playRoom).not.toHaveBeenCalled();
});
it("keeps an unsaved choice through fresh-lobby snapshots and follows an accepted host choice", async () => {
  const lobby = {
    ...playingFixture,
    phase: "lobby" as const,
    kartLobby: { createdAt: 100 },
  };
  setupControls(lobby);
  await mountControls(
    <>
      <h1>Live controls</h1>
      <KartTrackControls />
    </>,
  );
  const select = screen.getByLabelText("Course for this race") as HTMLSelectElement;
  fireEvent.change(select, { target: { value: "26-park-v1" } });
  update({ ...lobby, stateVersion: lobby.stateVersion + 1 });
  expect(select.value).toBe("26-park-v1");
  fireEvent.click(screen.getByRole("button", { name: "Save course" }));
  await waitFor(() =>
    expect(playRoom).toHaveBeenCalledWith(
      expect.objectContaining({ action: "kart-track", kartTrack: "26-park-v1" }),
    ),
  );
  update({ ...lobby, kartLobby: { createdAt: 100, trackId: "party-ring-v1" } });
  expect(
    (screen.getByLabelText("Course for this race") as HTMLSelectElement).value,
  ).toBe("party-ring-v1");
  expect(screen.getByText(/Saved course: Party ring/)).toBeTruthy();
});

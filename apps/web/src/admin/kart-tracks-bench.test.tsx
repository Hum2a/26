import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { expect, it, vi } from "vitest";
vi.mock("./sections-api", () => ({ readKartTracks: vi.fn() }));
vi.mock("../kart/KartDriverView", () => ({
  KartDriverView: ({
    race,
  }: {
    race: { trackId: string; selfPlayerId: string | null };
  }) => (
    <p>
      Real renderer input: {race.trackId} · {race.selfPlayerId}
    </p>
  ),
}));
import { readKartTracks } from "./sections-api";
import { KartTracksBench } from "./kart-tracks-bench";
import { kartTrackPreview } from "@26/shared";
it("rehearses actual selected grid/recovery inputs, mode availability and real renderer controls without saving a room", async () => {
  vi.mocked(readKartTracks).mockImplementation(async (selection) =>
    kartTrackPreview(selection),
  );
  render(
    <MemoryRouter>
      <KartTracksBench />
    </MemoryRouter>,
  );
  await screen.findByText(/Mario circuit · Imported circuit/);
  expect(
    screen
      .getByRole("link", { name: "Open existing solo practice" })
      .getAttribute("href"),
  ).toBe("/kart");
  fireEvent.change(screen.getByLabelText("Preview track"), {
    target: { value: "party-ring-v1" },
  });
  fireEvent.change(screen.getByLabelText("Starting-grid slot"), {
    target: { value: "80" },
  });
  fireEvent.change(screen.getByLabelText("Preview state"), {
    target: { value: "recovery" },
  });
  await waitFor(() =>
    expect(readKartTracks).toHaveBeenLastCalledWith({
      track: "party-ring-v1",
      slot: 80,
      beat: "recovery",
    }),
  );
  await screen.findByText(/Party ring · Original party course/);
  expect(
    screen.getByRole("list", { name: "Course mode availability" }).textContent,
  ).toContain("Free drive · Pending");
  expect(
    screen.queryByRole("link", { name: "Open existing solo practice" }),
  ).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Open 3D grid preview" }));
  await screen.findByText("Real renderer input: party-ring-v1 · stand-in-80");
  fireEvent.click(screen.getByRole("button", { name: "Close 3D grid preview" }));
  await waitFor(() => expect(screen.queryByText(/Real renderer input/)).toBeNull());
  fireEvent.click(screen.getByRole("button", { name: "Reload catalogue" }));
  await waitFor(() => expect(readKartTracks).toHaveBeenCalledTimes(5));
});
it("rehearses the original park and finite actual driving while public modes remain honestly pending", async () => {
  vi.mocked(readKartTracks).mockImplementation(async (selection) =>
    kartTrackPreview(selection),
  );
  render(
    <MemoryRouter>
      <KartTracksBench />
    </MemoryRouter>,
  );
  await screen.findByText(/Mario circuit · Imported/);
  fireEvent.change(screen.getByLabelText("Preview track"), {
    target: { value: "26-park-v1" },
  });
  await screen.findByText(/26 Park · Original party course/);
  fireEvent.change(screen.getByLabelText("Preview state"), {
    target: { value: "drive" },
  });
  await screen.findByText(/actual shared driving after three seconds/);
  expect(readKartTracks).toHaveBeenLastCalledWith({
    track: "26-park-v1",
    slot: 1,
    beat: "drive",
  });
  expect(
    screen.getByRole("list", { name: "Course mode availability" }).textContent,
  ).toContain("Connected race · Pending");
  expect(document.querySelector('[data-track-road="26-park-v1"]')).toBeTruthy();
});
it("shows failed validated reads honestly and allows retry", async () => {
  vi.mocked(readKartTracks)
    .mockReset()
    .mockResolvedValue({ error: "Catalogue unavailable" });
  render(
    <MemoryRouter>
      <KartTracksBench />
    </MemoryRouter>,
  );
  await screen.findByText("Catalogue unavailable");
  expect(screen.queryByText(/Mario circuit · Imported/)).toBeNull();
  vi.mocked(readKartTracks).mockResolvedValue(kartTrackPreview({}));
  fireEvent.click(screen.getByRole("button", { name: "Reload catalogue" }));
  await screen.findByText(/Mario circuit · Imported circuit/);
});

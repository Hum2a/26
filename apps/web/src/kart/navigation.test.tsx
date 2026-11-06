import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { createKartRace, projectKartRace } from "@26/shared";
import { KartMap } from "./KartMap";
import { KartDriverView } from "./KartDriverView";
import { mapHeadingPath, mapSectorPoint, nextMapSector } from "./navigation";

vi.mock("./KartCanvas", () => ({ default: () => <canvas /> }));
function sample(trackId: "mario-circuit-v1" | "party-ring-v1" = "mario-circuit-v1") {
  return projectKartRace(
    createKartRace("nav", [{ playerId: "p", name: "Stand-in" }], { trackId }),
    "p",
    0,
  );
}
it("guides the accepted next sector and finish on both public tracks, never raw proximity", () => {
  for (const track of ["mario-circuit-v1", "party-ring-v1"] as const) {
    const race = sample(track),
      self = race.participants[0]!;
    self.x = 10000;
    self.z = 10000;
    expect(nextMapSector(race)).toEqual({ sector: 1, ...mapSectorPoint(track, 1) });
    self.checkpoint = 7;
    expect(nextMapSector(race)).toEqual({ sector: 8, ...mapSectorPoint(track, 8) });
    self.status = "FINISHED";
    expect(nextMapSector(race)).toBeUndefined();
    self.status = "RACING";
    race.ended = true;
    expect(nextMapSector(race)).toBeUndefined();
    race.selfPlayerId = null;
    expect(nextMapSector(race)).toBeUndefined();
  }
  expect(mapSectorPoint("party-ring-v1", 8)).toMatchObject({ x: 42, z: 0 });
  expect(() => mapSectorPoint("party-ring-v1", 0)).toThrow(RangeError);
});
it("shows heading/next-sector guidance only on personal maps and keeps the stage public", async () => {
  expect(mapHeadingPath(0)).toBe("M8 0L4 -2.5L4 2.5Z");
  const north = mapHeadingPath(-Math.PI / 2).match(/^M([^ ]+) ([^L]+)/)!;
  expect(Number(north[1])).toBeCloseTo(0, 8);
  expect(Number(north[2])).toBeCloseTo(-8, 8);
  const race = sample();
  const view = render(<KartMap race={race} personal />);
  expect(screen.getByLabelText("Your heading")).toBeTruthy();
  expect(screen.getByLabelText("Next sector: 1")).toBeTruthy();
  view.rerender(<KartMap race={race} />);
  expect(screen.queryByLabelText("Your heading")).toBeNull();
  await waitFor(() => expect(screen.queryByLabelText("Next sector: 1")).toBeNull());
});
it("reuses one public map for the optional inset without making a loading renderer usable", () => {
  const ready = vi.fn();
  const view = render(
    <KartDriverView race={sample()} reducedMotion onReadiness={ready} />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Show small map" }));
  expect(
    view.container.querySelector('[data-inset="true"][data-view="chase"]'),
  ).toBeTruthy();
  expect(view.container.querySelectorAll("svg.kart-broadcast-map")).toHaveLength(1);
  expect(ready).toHaveBeenLastCalledWith("nav", false);
  fireEvent.click(screen.getByRole("button", { name: "Use lightweight map" }));
  expect(ready).toHaveBeenLastCalledWith("nav", true);
  expect(screen.queryByRole("button", { name: "Hide small map" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Use 3D driving view" }));
  fireEvent.click(screen.getByRole("button", { name: "Hide small map" }));
  expect(view.container.querySelector('[data-inset="false"]')).toBeTruthy();
});

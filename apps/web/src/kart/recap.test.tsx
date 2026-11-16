import { render, screen, within } from "@testing-library/react";
import { expect, it } from "vitest";
import { kartRaceRecap, projectKartRace, type LobbySnapshot } from "@26/shared";
import { KartRecapPanel } from "./KartRecapPanel";
import { kartRecapRehearsal } from "./recap-rehearsal";
import { GuestKart } from "./GuestKart";
import KartGameWrapper from "./KartGameWrapper";
it("renders accepted splits/recovery and host-ending reasons using the real phone and stage", () => {
  const race = kartRecapRehearsal("host-ended");
  const view = projectKartRace(race, "stand-in-a", 100);
  const snapshot = {
    phase: "reveal",
    paused: false,
    held: false,
    play: { kart: view, question: { kind: "kart" } },
  } as unknown as LobbySnapshot;
  const phone = render(<GuestKart snapshot={snapshot} />);
  expect(screen.getByRole("heading", { name: "Race ended" })).toBeTruthy();
  expect(
    screen.getByText("The host ended this race. Thanks for driving."),
  ).toBeTruthy();
  expect(
    within(screen.getByRole("region", { name: "Race recap" })).getAllByText(
      "DNF — host ended race",
    ),
  ).toHaveLength(1);
  phone.unmount();
  render(<KartGameWrapper race={projectKartRace(race, null, 100)} />);
  expect(screen.getByText(/The host ended the race/)).toBeTruthy();
  expect(screen.queryByLabelText(/sector splits/)).toBeNull();
});
it("shows actual complete split sums and honest older/unknown history", () => {
  const race = kartRecapRehearsal("recovery");
  const recap = kartRaceRecap(race)!;
  const view = render(<KartRecapPanel recap={recap} />);
  expect(screen.getByText(/Back to track 1 time/)).toBeTruthy();
  view.rerender(
    <KartRecapPanel
      recap={{ ...recap, drivers: [{ ...recap.drivers[0]!, sectorsMs: [null] }] }}
    />,
  );
  expect(screen.getByText("Sector 1: not recorded")).toBeTruthy();
  view.rerender(<KartRecapPanel recap={undefined} />);
  expect(screen.getByText(/not recorded for this older race/)).toBeTruthy();
});

it("does not label an older early ending as a timeout or invent a missing finish time", () => {
  const race = kartRecapRehearsal("host-ended");
  delete race.recapVersion;
  delete race.endReason;
  const snapshot = () =>
    ({
      phase: "reveal",
      paused: false,
      held: false,
      play: {
        question: { kind: "kart" },
        kart: projectKartRace(race, "stand-in-a", 100),
      },
    }) as unknown as LobbySnapshot;
  const view = render(<GuestKart snapshot={snapshot()} />);
  expect(screen.getByRole("heading", { name: "Race ended" })).toBeTruthy();
  expect(
    screen.getByText("This race ended before you finished. Thanks for driving."),
  ).toBeTruthy();
  race.drivers[0]!.status = "FINISHED";
  race.drivers[0]!.lapTimeMs = null;
  view.rerender(<GuestKart snapshot={snapshot()} />);
  expect(screen.getByText("Time unavailable")).toBeTruthy();
});

import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
vi.mock("./rooms-api", () => ({ readAdminRoom: vi.fn() }));
vi.mock("../live/room-socket", () => ({ openRoomSocket: vi.fn() }));
vi.mock("../live/room-api", () => ({ playRoom: vi.fn(), issueTransfer: vi.fn() }));
import { createKartRace, projectKartRace } from "@26/shared";
import { playRoom } from "../live/room-api";
import { setupControls, mountControls, playingFixture } from "./controls.test-support";
import { KartCourseControls } from "./kart-course-controls";

beforeEach(() => setupControls());
for (const [mode, label] of [
  ["map", "Return stage to map"],
  ["overview", "3D stage overview"],
  ["follow", "Follow race leader"],
  ["director", "Start stage director"],
] as const)
  it(`sends stage ${mode} through the room command path and shows history`, async () => {
    const race = createKartRace("stage", []);
    setupControls({
      ...playingFixture,
      kartStageHistory: [{ atMs: 1000, mode }],
      play: { ...playingFixture.play!, kart: projectKartRace(race, null, 100) },
    });
    await mountControls(
      <>
        <h1>Live controls</h1>
        <KartCourseControls />
      </>,
    );
    expect(screen.getByRole("list", { name: "Stage view history" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: label }));
    await waitFor(() =>
      expect(playRoom).toHaveBeenCalledWith(
        expect.objectContaining({
          action: `kart-stage-${mode}`,
          requestId: expect.any(String),
        }),
      ),
    );
  });

it("keeps decoration off available for a finished race while refusing to enable it", async () => {
  const race = createKartRace("ended-effects", []);
  race.ended = true;
  race.effectsEnabled = true;
  setupControls({
    ...playingFixture,
    phase: "reveal",
    play: { ...playingFixture.play!, kart: projectKartRace(race, null, 100) },
  });
  await mountControls(
    <>
      <h1>Live controls</h1>
      <KartCourseControls />
    </>,
  );
  expect(
    (
      screen.getByRole("button", {
        name: "Switch new kart effects on",
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(true);
  expect(
    (
      screen.getByRole("button", {
        name: "Switch kart decoration off",
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(false);
});
for (const enabled of [false, true])
  it(`sends the receipted effects ${enabled ? "on" : "off"} command and shows private history`, async () => {
    const race = createKartRace("effects", []);
    race.effectsEnabled = !enabled;
    setupControls({
      ...playingFixture,
      kartEffectsHistory: [{ atMs: 1000, enabled: !enabled }],
      play: { ...playingFixture.play!, kart: projectKartRace(race, null, 100) },
    });
    await mountControls(
      <>
        <h1>Live controls</h1>
        <KartCourseControls />
      </>,
    );
    expect(screen.getByText(/Host switched decoration/)).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", {
        name: enabled ? "Switch new kart effects on" : "Switch kart decoration off",
      }),
    );
    await screen.findByText(
      enabled ? "New kart effects are on." : "Kart decoration is off.",
    );
    expect(playRoom).toHaveBeenCalledWith(
      expect.objectContaining({
        action: enabled ? "kart-effects-on" : "kart-effects-off",
        requestId: expect.any(String),
      }),
    );
    expect(
      screen
        .getByRole("link", { name: "Rehearse and tune effects with stand-ins" })
        .getAttribute("href"),
    ).toBe("/admin/kart?view=effects");
  });
for (const enabled of [false, true])
  it(`sends the scoped nearby-racer ${enabled ? "off" : "on"} command and shows host history`, async () => {
    const race = createKartRace("opponents", []);
    race.opponentsEnabled = enabled;
    setupControls({
      ...playingFixture,
      kartOpponentHistory: [{ atMs: 1000, enabled }],
      play: { ...playingFixture.play!, kart: projectKartRace(race, null, 100) },
    });
    await mountControls(
      <>
        <h1>Live controls</h1>
        <KartCourseControls />
      </>,
    );
    expect(screen.getByText(/Host switched nearby racers/)).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", {
        name: enabled ? "Hide nearby racers" : "Show nearby racers",
      }),
    );
    await screen.findByText(
      enabled
        ? "Nearby racers are hidden on phones."
        : "Nearby racers are visible on phones.",
    );
    expect(playRoom).toHaveBeenCalledWith(
      expect.objectContaining({
        action: enabled ? "kart-opponents-off" : "kart-opponents-on",
        requestId: expect.any(String),
      }),
    );
  });
for (const enabled of [false, true])
  it(`sends the receipted course ${enabled ? "off" : "on"} command and shows history`, async () => {
    const race = createKartRace("course", []);
    race.courseEnabled = enabled;
    race.courseHistory = [{ atMs: 1000, enabled }];
    setupControls({
      ...playingFixture,
      kartCourseHistory: race.courseHistory,
      play: { ...playingFixture.play!, kart: projectKartRace(race, null, 100) },
    });
    await mountControls(
      <>
        <h1>Live controls</h1>
        <KartCourseControls />
      </>,
    );
    expect(screen.getByText(/Host switched features/)).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", {
        name: `Switch course features ${enabled ? "off" : "on"}`,
      }),
    );
    await screen.findByText(
      enabled
        ? "Course features are off. Airborne karts have landed."
        : "Floor boosts, ramps and sweepers are on.",
    );
    expect(playRoom).toHaveBeenCalledWith(
      expect.objectContaining({
        action: enabled ? "kart-course-off" : "kart-course-on",
        requestId: expect.any(String),
      }),
    );
  });

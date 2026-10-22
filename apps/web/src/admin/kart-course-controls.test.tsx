import { fireEvent, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
vi.mock("./rooms-api", () => ({ readAdminRoom: vi.fn() }));
vi.mock("../live/room-socket", () => ({ openRoomSocket: vi.fn() }));
vi.mock("../live/room-api", () => ({ playRoom: vi.fn(), issueTransfer: vi.fn() }));
import { createKartRace, projectKartRace } from "@26/shared";
import { playRoom } from "../live/room-api";
import { setupControls, mountControls, playingFixture } from "./controls.test-support";
import { KartCourseControls } from "./kart-course-controls";

beforeEach(() => setupControls());
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

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { LobbyDriver } from "@26/shared";
import { DriverPicker } from "./DriverPicker";
import { KartLeaderboard } from "./KartLeaderboard";
import { KartDriversProvider } from "./KartDriversProvider";
import { createKartRace, projectKartRace } from "@26/shared";
import { roomFixture } from "../admin/room-fixture.test-support";

vi.mock("../photo/CaptureFlow", () => ({ CaptureFlow: () => <p>Camera</p> }));

const face = "7c0b7d0e-1f9b-4b39-9d6e-2a6f9a1a0c11";

function picker(driver: LobbyDriver | undefined, onChoose = vi.fn()) {
  render(
    <DriverPicker
      gameId="ABCDEFGH"
      nickname="Amina"
      driver={driver}
      pending={false}
      onChoose={onChoose}
    />,
  );
  return onChoose;
}

describe("driver picker", () => {
  it("saves a new style and keeps the current face", () => {
    const onChoose = picker({ style: "racer", faceMediaId: face });
    fireEvent.click(screen.getByRole("radio", { name: /Royalty/ }));
    expect(onChoose).toHaveBeenCalledWith("royal", face);
  });

  it("explains where the photo appears before the camera opens", () => {
    picker({ style: "racer" });
    expect(screen.getByText(/shown on your kart and on the big screen/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Remove my photo" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Use my photo" }));
    expect(screen.getByText("Camera")).toBeTruthy();
  });

  it("removes the photo without changing the style", () => {
    const onChoose = picker({ style: "dj", faceMediaId: face });
    fireEvent.click(screen.getByRole("button", { name: "Remove my photo" }));
    expect(onChoose).toHaveBeenCalledWith("dj", null);
  });
});

describe("stage leaderboard drivers", () => {
  it("shows each driver's face, or their style emblem without one", () => {
    const amina = "11111111-1111-4111-8111-111111111111";
    const bilal = "22222222-2222-4222-8222-222222222222";
    const race = projectKartRace(
      createKartRace("race", [
        { playerId: amina, name: "Amina" },
        { playerId: bilal, name: "Bilal" },
      ]),
      null,
      100,
    );
    render(
      <KartDriversProvider
        snapshot={{
          ...roomFixture,
          players: [
            {
              playerId: amina,
              nickname: "Amina",
              driver: { style: "party", faceMediaId: face },
            },
            { playerId: bilal, nickname: "Bilal", driver: { style: "royal" } },
          ],
        }}
      >
        <KartLeaderboard race={race} paused={false} />
      </KartDriversProvider>,
    );
    const photo = screen.getByRole("img", { name: "Amina’s driver" });
    expect(photo.getAttribute("src")).toContain(`/api/rooms/ABCDEFGH/media/${face}`);
    expect(
      screen.getByRole("img", { name: "Bilal’s driver" }).tagName.toLowerCase(),
    ).toBe("svg");
  });
});

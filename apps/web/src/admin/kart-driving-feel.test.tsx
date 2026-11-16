import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
vi.mock("./rooms-api", () => ({ readAdminRoom: vi.fn() }));
vi.mock("../live/room-socket", () => ({ openRoomSocket: vi.fn() }));
vi.mock("../live/room-api", () => ({ playRoom: vi.fn(), issueTransfer: vi.fn() }));
import { createKartRace, projectKartRace, type LobbySnapshot } from "@26/shared";
import { playRoom } from "../live/room-api";
import { setupControls, mountControls, playingFixture } from "./controls.test-support";
import { roomFixture } from "./room-fixture.test-support";
import { KartDrivingFeel } from "./kart-driving-feel";

beforeEach(() => setupControls());

function kartRound(settings?: Record<string, string>): LobbySnapshot {
  const view = projectKartRace(createKartRace("feel", []), null, 100);
  return {
    ...playingFixture,
    play: {
      ...playingFixture.play!,
      question: { ...playingFixture.play!.question, kind: "kart" } as never,
      kart: { ...view, ...(settings ? { settings } : {}) },
    },
    kartSettingsHistory: [{ atMs: 1000, key: "prediction", value: "off" }],
  } as LobbySnapshot;
}

async function mount(snapshot: LobbySnapshot) {
  setupControls(snapshot);
  await mountControls(
    <>
      <h1>Live controls</h1>
      <KartDrivingFeel />
    </>,
  );
}

it("shows the current choice, sends a receipted kart-setting command and lists history", async () => {
  await mount(kartRound({ prediction: "off" }));
  const group = screen.getByRole("group", { name: "Own-kart prediction" });
  expect(
    within(group).getByRole("button", { name: "Off" }).getAttribute("aria-pressed"),
  ).toBe("true");
  fireEvent.click(within(group).getByRole("button", { name: "Conservative" }));
  await waitFor(() =>
    expect(playRoom).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "kart-setting",
        kartSetting: { key: "prediction", value: "on-conservative" },
        requestId: expect.any(String),
      }),
    ),
  );
  expect(
    screen.getByRole("list", { name: "Driving feel history" }).textContent,
  ).toContain("Own-kart prediction: Off");
});

it("sends every setting's options and does not resend the current one", async () => {
  await mount(kartRound());
  for (const [group, option, key, value] of [
    ["Other karts glide", "Off", "glide", "off"],
    ["Sideways steering default", "Slider", "steering", "slider"],
    ["Phone frame rate", "30 fps", "frameCap", "30"],
  ] as const) {
    fireEvent.click(
      within(screen.getByRole("group", { name: group })).getByRole("button", {
        name: option,
      }),
    );
    await waitFor(() =>
      expect(playRoom).toHaveBeenCalledWith(
        expect.objectContaining({ kartSetting: { key, value } }),
      ),
    );
  }
  const calls = vi.mocked(playRoom).mock.calls.length;
  // Defaults: prediction is already on.
  fireEvent.click(
    within(screen.getByRole("group", { name: "Own-kart prediction" })).getByRole(
      "button",
      { name: "On" },
    ),
  );
  expect(vi.mocked(playRoom).mock.calls.length).toBe(calls);
});

it("appears in a kart lobby and stays hidden for ordinary quiz rounds", async () => {
  await mount({
    ...roomFixture,
    kartLobby: { createdAt: 1000 },
    kartSettings: { glide: "off" },
  });
  expect(
    within(screen.getByRole("group", { name: "Other karts glide" }))
      .getByRole("button", { name: "Off" })
      .getAttribute("aria-pressed"),
  ).toBe("true");
});

it("is absent outside kart rooms", async () => {
  await mount(playingFixture);
  expect(screen.queryByRole("region", { name: "Kart driving feel" })).toBeNull();
});

import { fireEvent, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
vi.mock("./rooms-api", () => ({ readAdminRoom: vi.fn() }));
vi.mock("../live/room-socket", () => ({ openRoomSocket: vi.fn() }));
vi.mock("../live/room-api", () => ({ playRoom: vi.fn(), issueTransfer: vi.fn() }));
import { playRoom } from "../live/room-api";
import { setupControls, mountControls, playingFixture } from "./controls.test-support";
import { KartCourseControls } from "./kart-course-controls";
import { KartHandlingControls } from "./kart-handling-controls";

beforeEach(() => setupControls());
it("reports a handling choice once beside the course controls on the same page", async () => {
  setupControls({
    ...playingFixture,
    phase: "intro",
    kartHandling: { next: "slide-v1", current: "slide-v1", frozen: false },
  });
  await mountControls(
    <>
      <h1>Live controls</h1>
      <KartHandlingControls />
      <KartCourseControls />
    </>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Use arcade bounce handling" }));
  const notice =
    "Kart handling saved for the next race. An open starting grid updates before racing.";
  await screen.findByText(notice);
  expect(screen.getAllByText(notice)).toHaveLength(1);
});
for (const preset of ["slide-v1", "bounce-v1"] as const)
  it(`shows the grid/history and sends the scoped receipted ${preset} command`, async () => {
    setupControls({
      ...playingFixture,
      phase: "intro",
      kartHandling: {
        next: preset === "slide-v1" ? "bounce-v1" : "slide-v1",
        current: "slide-v1",
        frozen: false,
      },
      kartHandlingHistory: [{ atMs: 1000, preset: "slide-v1" }],
    });
    await mountControls(
      <>
        <h1>Live controls</h1>
        <KartHandlingControls />
      </>,
    );
    expect(screen.getByText("Starting grid: Original slide.")).toBeTruthy();
    expect(
      screen.getByRole("list", { name: "Kart handling history" }).textContent,
    ).toContain("Host selected Original slide");
    fireEvent.click(
      screen.getByRole("button", {
        name:
          preset === "slide-v1"
            ? "Use original slide handling"
            : "Use arcade bounce handling",
      }),
    );
    await screen.findByText(
      "Kart handling saved for the next race. An open starting grid updates before racing.",
    );
    expect(playRoom).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "kart-handling",
        handlingPreset: preset,
        requestId: expect.any(String),
      }),
    );
    expect(
      screen
        .getByRole("link", { name: "Rehearse both handling profiles without guests" })
        .getAttribute("href"),
    ).toBe("/admin/kart?view=collisions");
  });

it("locks running or paused races and allows changing only the next race after the finish", async () => {
  setupControls({
    ...playingFixture,
    paused: true,
    kartHandling: { next: "bounce-v1", current: "bounce-v1", frozen: true },
  });
  const view = await mountControls(
    <>
      <h1>Live controls</h1>
      <KartHandlingControls />
    </>,
  );
  expect(
    (
      screen.getByRole("button", {
        name: "Use original slide handling",
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(true);
  view.unmount();
  setupControls({
    ...playingFixture,
    phase: "reveal",
    kartHandling: { next: "slide-v1", current: "bounce-v1", frozen: true },
  });
  await mountControls(
    <>
      <h1>Live controls</h1>
      <KartHandlingControls />
    </>,
  );
  expect(
    (
      screen.getByRole("button", {
        name: "Use arcade bounce handling",
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(false);
  expect(screen.getByText("Frozen race: Arcade bounce.")).toBeTruthy();
  expect(screen.getByText("Next race: Original slide.")).toBeTruthy();
});

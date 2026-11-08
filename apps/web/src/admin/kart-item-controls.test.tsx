import { fireEvent, screen, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
vi.mock("./rooms-api", () => ({ readAdminRoom: vi.fn() }));
vi.mock("../live/room-socket", () => ({ openRoomSocket: vi.fn() }));
vi.mock("../live/room-api", () => ({ playRoom: vi.fn(), issueTransfer: vi.fn() }));
import { createKartRace, projectKartRace } from "@26/shared";
import { playRoom } from "../live/room-api";
import { setupControls, mountControls, playingFixture } from "./controls.test-support";
import { KartItemControls } from "./kart-item-controls";

async function mount(spawning = true, phase: "intro" | "collect" = "intro") {
  setupControls({
    ...playingFixture,
    phase,
    play: {
      ...playingFixture.play!,
      kart: projectKartRace(createKartRace("items", []), null, 100),
    },
    kartItems: {
      next: { version: 1 },
      current: { version: 1 },
      frozen: phase === "collect",
      spawning,
      held: [
        { playerId: playingFixture.players[0]!.playerId, number: 1, item: "treat" },
      ],
      projectiles: 1,
      oils: 2,
      tracked: true,
      history: [
        { eventId: 1, atMs: 200, kind: "use", projectileId: "all", item: "treat" },
      ],
      rulesHistory: [],
    },
  });
  await mountControls(
    <>
      <h1>Live controls</h1>
      <KartItemControls />
    </>,
  );
}
for (const [label, action, spawning] of [
  ["Stop item spawning", "kart-items-off", true],
  ["Resume item spawning", "kart-items-on", false],
  ["Clear track items", "kart-items-clear", true],
  ["Use original items", "kart-item-rules", true],
] as const)
  it(`sends ${action} from its real control`, async () => {
    await mount(spawning);
    fireEvent.click(screen.getByRole("button", { name: label }));
    await waitFor(() =>
      expect(playRoom).toHaveBeenCalledWith(
        expect.objectContaining({
          action,
          ...(action === "kart-item-rules" ? { itemRules: { version: 1 } } : {}),
        }),
      ),
    );
  });
it("saves the selected expanded catalogue and shows named held items and history", async () => {
  await mount();
  expect(screen.getByText(/Kart 1 · Amina/)).toBeTruthy();
  expect(screen.getByText(/0.20s · use/)).toBeTruthy();
  const luck = screen.getByRole("checkbox", { name: /Position luck/ });
  const checkboxes = screen
    .getAllByRole("checkbox")
    .filter((checkbox) => checkbox !== luck);
  for (const checkbox of checkboxes) fireEvent.click(checkbox);
  fireEvent.click(screen.getByRole("button", { name: "Save expanded items" }));
  await waitFor(() =>
    expect(playRoom).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "kart-item-rules",
        itemRules: { version: 2, allowed: [] },
      }),
    ),
  );
  // Position luck travels with either set of rules.
  fireEvent.click(luck);
  fireEvent.click(screen.getByRole("button", { name: "Use original items" }));
  await waitFor(() =>
    expect(playRoom).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "kart-item-rules",
        itemRules: { version: 1, luck: "position" },
      }),
    ),
  );
});
it("freezes rules during collect but retains the safety controls and real rehearsal link", async () => {
  await mount(true, "collect");
  expect(
    screen
      .getByRole("group", { name: "Expanded item selection" })
      .hasAttribute("disabled"),
  ).toBe(true);
  expect(
    screen.getByRole("button", { name: "Clear track items" }).hasAttribute("disabled"),
  ).toBe(false);
  expect(
    screen
      .getByRole("link", { name: "Rehearse items without guests" })
      .getAttribute("href"),
  ).toBe("/admin/kart?view=items");
});

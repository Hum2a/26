import { fireEvent, screen, within } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
vi.mock("./rooms-api", () => ({
  listRooms: vi.fn(),
  readCurrentRoom: vi.fn(),
  readAdminRoom: vi.fn(),
}));
vi.mock("../live/room-socket", () => ({ openRoomSocket: vi.fn() }));
vi.mock("../live/room-api", () => ({
  createLobby: vi.fn(),
  seedSampleRoom: vi.fn(),
  playRoom: vi.fn(),
  issueTransfer: vi.fn(),
}));
import { RoomOverview } from "./rooms-page";
import { mountControls, setupControls } from "./controls.test-support";
import { roomFixture } from "./room-fixture.test-support";

beforeEach(() => setupControls(roomFixture));

it("opens and closes the guest join link modal", async () => {
  await mountControls(<RoomOverview />);

  expect(screen.queryByRole("dialog", { name: "Guest join link" })).toBeNull();

  fireEvent.click(screen.getByRole("button", { name: "Show guest QR code" }));

  const dialog = screen.getByRole("dialog", { name: "Guest join link" });
  expect(dialog.textContent).toContain(
    "Guests can scan this code or copy the link below.",
  );

  fireEvent.click(within(dialog).getByRole("button", { name: "Close" }));

  expect(screen.queryByRole("dialog", { name: "Guest join link" })).toBeNull();
});

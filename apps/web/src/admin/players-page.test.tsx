import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
vi.mock("./rooms-api", () => ({ readAdminRoom: vi.fn() }));
vi.mock("../live/room-socket", () => ({ openRoomSocket: vi.fn() }));
vi.mock("../live/room-api", () => ({ playRoom: vi.fn(), issueTransfer: vi.fn() }));
import { issueTransfer, playRoom } from "../live/room-api";
import { PlayersPage } from "./players-page";
import {
  mountControls,
  playerId,
  secondId,
  playingFixture,
  setupControls,
  success,
  update,
} from "./controls.test-support";
beforeEach(() => setupControls());
async function select() {
  await mountControls(<PlayersPage />);
  fireEvent.click(screen.getByRole("button", { name: `Select Amina, ${playerId}` }));
}
function confirm(name: string) {
  fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name }));
}

it("searches duplicate names by stable ID and keeps the selected record", async () => {
  const fixture = {
    ...playingFixture,
    adminPlayers: [
      ...playingFixture.adminPlayers!,
      { ...playingFixture.adminPlayers![0]!, playerId: secondId },
    ],
  };
  setupControls(fixture);
  await select();
  fireEvent.change(screen.getByLabelText("Find a player"), {
    target: { value: secondId },
  });
  expect(screen.getAllByRole("button", { name: /^Select/ })).toHaveLength(1);
  expect(screen.getByRole("region", { name: "Player details" }).textContent).toContain(
    playerId,
  );
  update({
    ...fixture,
    adminPlayers: fixture.adminPlayers.map((row) =>
      row.playerId === playerId ? { ...row, nickname: "Mina" } : row,
    ),
  });
  expect(screen.getByRole("region", { name: "Player details" }).textContent).toContain(
    "Mina",
  );
});
it("reviews a rename and rejects confirmation after the selected identity changes", async () => {
  await select();
  fireEvent.change(screen.getByLabelText("New nickname"), {
    target: { value: "Mina" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Review rename" }));
  expect(playRoom).not.toHaveBeenCalled();
  update({
    ...playingFixture,
    adminPlayers: [
      { ...playingFixture.adminPlayers![0]!, nickname: "Changed elsewhere" },
    ],
  });
  expect(
    (
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Rename player",
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(true);
  confirm("Cancel");
  fireEvent.click(screen.getByRole("button", { name: "Review rename" }));
  confirm("Rename player");
  await waitFor(() =>
    expect(playRoom).toHaveBeenCalledWith(
      expect.objectContaining({ action: "rename", playerId, nickname: "Mina" }),
    ),
  );
});
it("requires signed whole points and a reason, and shows the private history", async () => {
  await select();
  fireEvent.click(screen.getByRole("button", { name: "Score" }));
  await screen.findByRole("button", { name: "Review score change" });
  fireEvent.click(screen.getByRole("button", { name: "Review score change" }));
  expect(screen.getByText(/Enter a non-zero whole number/)).toBeTruthy();
  expect(playRoom).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("Score adjustment", { exact: true }), {
    target: { value: "-25" },
  });
  fireEvent.change(screen.getByLabelText("Reason"), {
    target: { value: "Operator correction" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Review score change" }));
  expect(screen.getByRole("dialog").textContent).toContain("-25 points");
  confirm("Confirm score adjustment");
  await waitFor(() =>
    expect(playRoom).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "adjust",
        playerId,
        points: -25,
        reason: "Operator correction",
      }),
    ),
  );
  update({
    ...playingFixture,
    adjustments: [
      { playerId, nickname: "Amina", points: -25, reason: "Operator correction" },
    ],
  });
  expect(screen.getByRole("region", { name: "Player details" }).textContent).toContain(
    "-25 · Operator correction",
  );
});
it("issues a private transfer only after review, and hides the code on request", async () => {
  await select();
  fireEvent.click(screen.getByRole("button", { name: "Phones" }));
  fireEvent.click(await screen.findByRole("button", { name: "Transfer Amina" }));
  expect(issueTransfer).not.toHaveBeenCalled();
  confirm("Create transfer code");
  await screen.findByRole("heading", { name: "Private device code" });
  expect(issueTransfer).toHaveBeenCalledWith(expect.objectContaining({ playerId }));
  expect(screen.getByText("ABCDEF", { selector: ".admin-side-code" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Hide code" }));
  expect(screen.queryByText("ABCDEF")).toBeNull();
});
it("keeps removed players recoverable and never puts a code in global feedback", async () => {
  setupControls({
    ...playingFixture,
    players: [],
    adminPlayers: [
      { ...playingFixture.adminPlayers![0]!, removed: true, connected: false },
    ],
  });
  vi.mocked(playRoom).mockResolvedValue({ ...success, transferCode: "SECRET" });
  await select();
  expect(screen.queryByRole("button", { name: "Transfer Amina" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Recover Amina" }));
  confirm("Recover player");
  await screen.findByRole("heading", { name: "Private recovery code" });
  expect(document.querySelector(".admin-command-feedback")?.textContent).not.toContain(
    "SECRET",
  );
  fireEvent.click(screen.getByRole("button", { name: "Hide code" }));
  expect(screen.queryByText("SECRET")).toBeNull();
});
it("does not swap a target whose nickname changed while confirmation was open", async () => {
  setupControls({
    ...playingFixture,
    adminPlayers: [
      ...playingFixture.adminPlayers!,
      { ...playingFixture.adminPlayers![0]!, playerId: secondId, nickname: "Bilal" },
    ],
  });
  await select();
  fireEvent.change(screen.getByLabelText("Swap with"), { target: { value: secondId } });
  fireEvent.click(screen.getByRole("button", { name: "Review swap" }));
  update({
    ...playingFixture,
    adminPlayers: [
      ...playingFixture.adminPlayers!,
      { ...playingFixture.adminPlayers![0]!, playerId: secondId, nickname: "New name" },
    ],
  });
  expect(
    (
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Swap nicknames",
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(true);
  expect(playRoom).not.toHaveBeenCalled();
});

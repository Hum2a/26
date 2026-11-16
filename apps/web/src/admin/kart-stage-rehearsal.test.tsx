import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { createKartRace, projectKartRace } from "@26/shared";
vi.mock("./sections-api", () => ({ readKartPreview: vi.fn() }));
vi.mock("../kart/KartGameWrapper", () => ({
  default: ({ race }: { race: { spectator: { mode: string } } }) => (
    <p>Stage renderer: {race.spectator.mode}</p>
  ),
}));
import { readKartPreview } from "./sections-api";
import { KartStageRehearsal } from "./kart-stage-rehearsal";
it("rehearses every camera mode with validated sample poses and resets without a room", async () => {
  const race = projectKartRace(
    createKartRace("sample", [{ playerId: "stand-in-1", name: "Stand-in1" }]),
    null,
    100,
  );
  vi.mocked(readKartPreview).mockResolvedValue({
    label: "Stand-in drivers — isolated rendering rehearsal",
    phone: race,
    stage: race,
  });
  render(<KartStageRehearsal />);
  await screen.findByText("Stage renderer: map");
  for (const mode of ["overview", "follow", "director"]) {
    fireEvent.click(screen.getByRole("button", { name: `Rehearse ${mode}` }));
    expect(screen.getByText(`Stage renderer: ${mode}`)).toBeTruthy();
  }
  fireEvent.click(screen.getByRole("button", { name: "Reset stage rehearsal" }));
  await waitFor(() => expect(readKartPreview).toHaveBeenCalledTimes(2));
  await screen.findByText("Stage renderer: map");
});

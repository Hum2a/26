import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { createKartRace, projectKartRace } from "@26/shared";
vi.mock("./sections-api", () => ({ readKartPreview: vi.fn() }));
vi.mock("../kart/KartDriverView", () => ({
  KartDriverView: () => <p>Actual viewport adapter boundary</p>,
}));
import { readKartPreview } from "./sections-api";
import { KartVehicleRehearsal } from "./kart-vehicle-rehearsal";
const race = projectKartRace(
  createKartRace("sample", [{ playerId: "stand-in-41", name: "Stand-in41" }]),
  "stand-in-41",
  100,
);
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(readKartPreview).mockResolvedValue({
    label: "Stand-in drivers — isolated rendering rehearsal",
    phone: race,
    stage: race,
  });
});
it("reads validated server poses, changes pose, selects a driver and resets without a room", async () => {
  render(<KartVehicleRehearsal />);
  await screen.findByText("Actual viewport adapter boundary");
  expect(readKartPreview).toHaveBeenCalledWith("grid");
  fireEvent.change(screen.getByLabelText("Sample kart pose"), {
    target: { value: "boost" },
  });
  await waitFor(() => expect(readKartPreview).toHaveBeenCalledWith("boost"));
  await screen.findByText("Actual viewport adapter boundary");
  fireEvent.change(screen.getByLabelText("Rehearsal driver"), {
    target: { value: "royal" },
  });
  expect((screen.getByLabelText("Rehearsal driver") as HTMLSelectElement).value).toBe(
    "royal",
  );
  fireEvent.click(screen.getByRole("button", { name: "Reset vehicle preview" }));
  await waitFor(() => expect(readKartPreview).toHaveBeenCalledTimes(3));
});
it("shows failed preview reads and retries without inventing public data", async () => {
  vi.mocked(readKartPreview).mockResolvedValueOnce({ error: "Preview unavailable" });
  render(<KartVehicleRehearsal />);
  await screen.findAllByText("Preview unavailable");
  expect(screen.queryByText("Actual viewport adapter boundary")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Reset vehicle preview" }));
  await screen.findByText("Actual viewport adapter boundary");
});

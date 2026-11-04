import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { createKartRace, projectKartRace, kartLookPresetSchema } from "@26/shared";
vi.mock("./sections-api", () => ({ readKartPreview: vi.fn() }));
vi.mock("../kart/KartCanvas", () => ({
  default: ({
    lookPreset,
    paused,
    graphicsTier,
  }: {
    lookPreset: {
      grading: { brightness: number; temperature: number };
      environment: { enabled: boolean; shadows: boolean };
    };
    paused: boolean;
    graphicsTier: string;
  }) => (
    <p
      data-temperature={lookPreset.grading.temperature}
      data-tier={graphicsTier}
      data-environment={String(lookPreset.environment.enabled)}
      data-shadows={String(lookPreset.environment.shadows)}
    >
      Real look adapter: {lookPreset.grading.brightness} / {String(paused)}
    </p>
  ),
}));
import { readKartPreview } from "./sections-api";
import { EnvironmentBench } from "./environment-bench";
it("tunes only validated real grading settings, before/after, neutral reset and export without room actions", async () => {
  const race = projectKartRace(
    createKartRace("look", [{ playerId: "p", name: "Stand-in" }]),
    "p",
    0,
  );
  vi.mocked(readKartPreview).mockResolvedValue({
    label: "Stand-in drivers — isolated rendering rehearsal",
    phone: race,
    stage: race,
  });
  render(<EnvironmentBench />);
  await screen.findByText("Real look adapter: 0 / true");
  fireEvent.click(screen.getByLabelText("Enable environment"));
  fireEvent.click(screen.getByLabelText("Follow light shadows"));
  expect(
    screen.getByText("Real look adapter: 0 / true").getAttribute("data-environment"),
  ).toBe("true");
  expect(
    screen.getByText("Real look adapter: 0 / true").getAttribute("data-shadows"),
  ).toBe("true");
  fireEvent.change(screen.getByLabelText("Brightness"), { target: { value: "0.2" } });
  expect(screen.getByText("Real look adapter: 0.2 / true")).toBeTruthy();
  fireEvent.click(screen.getByLabelText("Show original before grading"));
  expect(screen.getByText("Real look adapter: 0 / true")).toBeTruthy();
  fireEvent.click(screen.getByLabelText("Show original before grading"));
  fireEvent.change(screen.getByLabelText("red from blue"), {
    target: { value: "0.2" },
  });
  fireEvent.change(screen.getByLabelText("orange hue"), { target: { value: "10" } });
  fireEvent.click(screen.getByRole("button", { name: "Export look preset" }));
  const json = screen.getByLabelText("Look preset JSON") as HTMLTextAreaElement;
  const preset = kartLookPresetSchema.parse(JSON.parse(json.value));
  expect(preset.grading.brightness).toBe(0.2);
  expect(preset.grading.mixer[2]).toBe(0.2);
  expect(preset.grading.hsl.orange.hue).toBe(10);
  fireEvent.change(json, {
    target: { value: JSON.stringify({ ...preset, roomId: "private" }) },
  });
  fireEvent.click(screen.getByRole("button", { name: "Apply look preset" }));
  expect(
    screen.getByText("This is not a supported version 1 look preset."),
  ).toBeTruthy();
  expect(screen.getByText("Real look adapter: 0.2 / true")).toBeTruthy();
  fireEvent.change(screen.getByLabelText("Look preset"), { target: { value: "warm" } });
  expect(
    screen.getByText("Real look adapter: 0 / true").getAttribute("data-temperature"),
  ).toBe("0.3");
  fireEvent.change(screen.getByLabelText("Look quality"), { target: { value: "low" } });
  expect(
    screen.getByText("Real look adapter: 0 / true").getAttribute("data-tier"),
  ).toBe("low");
  fireEvent.click(screen.getByRole("button", { name: "Resume look sample" }));
  expect(screen.getByText("Real look adapter: 0 / false")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Reset to neutral look" }));
  expect(screen.queryByRole("status")).toBeNull();
});

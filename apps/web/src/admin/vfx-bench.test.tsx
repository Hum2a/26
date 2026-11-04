import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import {
  createKartRace,
  projectKartRace,
  defaultKartVfxPreset,
  kartVfxPresetSchema,
} from "@26/shared";
vi.mock("./sections-api", () => ({ readKartPreview: vi.fn() }));
vi.mock("../kart/SoloPracticeFrame", () => ({
  SoloPracticeFrame: ({
    effectsPreset,
  }: {
    effectsPreset: { enabled: boolean } | null;
  }) => <p>{effectsPreset ? "Native solo preset" : "Legacy solo effects"}</p>,
}));
vi.mock("../kart/KartCanvas", () => ({
  default: ({
    vfxPreset,
    paused,
    graphicsTier,
    vfxRehearsal,
  }: {
    vfxPreset: { enabled: boolean };
    paused: boolean;
    graphicsTier: string;
    vfxRehearsal?: { script: string; run: number };
  }) => (
    <p
      data-tier={graphicsTier}
      data-script={vfxRehearsal?.script}
      data-run={vfxRehearsal?.run}
    >
      Actual viewport adapter: {String(vfxPreset.enabled)} / {String(paused)}
    </p>
  ),
}));
import { readKartPreview } from "./sections-api";
import { VfxBench } from "./vfx-bench";
it("rehearses real renderer settings, validates export/import and keeps invalid presets out of the viewport", async () => {
  const race = projectKartRace(
    createKartRace("sample", [{ playerId: "p1", name: "Stand-in" }]),
    "p1",
    0,
  );
  vi.mocked(readKartPreview).mockResolvedValue({
    label: "Stand-in drivers — isolated rendering rehearsal",
    phone: race,
    stage: race,
  });
  render(<VfxBench />);
  await screen.findByText("Actual viewport adapter: true / false");
  fireEvent.change(screen.getByLabelText("Effects script"), {
    target: { value: "finish" },
  });
  const viewport = screen.getByText("Actual viewport adapter: true / false");
  expect(viewport.getAttribute("data-script")).toBe("finish");
  const run = viewport.getAttribute("data-run");
  fireEvent.click(screen.getByRole("button", { name: "Restart effects script" }));
  expect(viewport.getAttribute("data-run")).not.toBe(run);
  fireEvent.change(screen.getByLabelText("Effects quality"), {
    target: { value: "low" },
  });
  expect(
    screen.getByText("Actual viewport adapter: true / false").getAttribute("data-tier"),
  ).toBe("low");
  fireEvent.click(screen.getByRole("button", { name: "Pause effects sample" }));
  expect(screen.getByText("Actual viewport adapter: true / true")).toBeTruthy();
  fireEvent.click(screen.getByLabelText("Enable sample effects"));
  expect(screen.getByText("Actual viewport adapter: false / true")).toBeTruthy();
  fireEvent.change(screen.getByLabelText("Emission rate"), { target: { value: "32" } });
  fireEvent.click(screen.getByRole("button", { name: "Export effects preset" }));
  const exported = screen.getByLabelText("VFX preset export") as HTMLTextAreaElement;
  const preset = kartVfxPresetSchema.parse(JSON.parse(exported.value));
  expect(preset.rate).toBe(32);
  expect(preset.enabled).toBe(false);
  fireEvent.change(exported, {
    target: { value: JSON.stringify({ ...defaultKartVfxPreset, version: 9 }) },
  });
  fireEvent.click(screen.getByRole("button", { name: "Apply exported preset" }));
  await screen.findByText(/not a supported version 1/);
  expect(screen.getByText("Actual viewport adapter: false / true")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Reset effects preset" }));
  expect(screen.getByText("Actual viewport adapter: true / false")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Open solo effects rehearsal" }));
  expect(screen.getByText("Native solo preset")).toBeTruthy();
  fireEvent.click(screen.getByLabelText("Use new effects in solo rehearsal"));
  expect(screen.getByText("Legacy solo effects")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Close solo effects rehearsal" }));
  expect(screen.queryByText("Legacy solo effects")).toBeNull();
});

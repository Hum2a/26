import { beforeEach, expect, it } from "vitest";
import { defaultRehearsalConfig } from "@26/shared";
import { builtInProfiles, deleteProfile, readProfiles, saveProfile } from "./profiles";
beforeEach(() => localStorage.clear());
it("validates saved setups, replaces names and keeps at most ten", () => {
  expect(builtInProfiles.map((p) => p.config.botCount)).toEqual([10, 25, 50, 75, 100]);
  for (let i = 0; i < 12; i++) saveProfile(`Setup ${i}`, defaultRehearsalConfig);
  expect(readProfiles()).toHaveLength(10);
  saveProfile("Setup 11", { ...defaultRehearsalConfig, botCount: 100 });
  expect(readProfiles()[0]?.config.botCount).toBe(100);
  expect(readProfiles()).toHaveLength(10);
  deleteProfile("Setup 11");
  expect(readProfiles()).toHaveLength(9);
  localStorage.setItem(
    "26-rehearsal-profiles-v1",
    JSON.stringify([
      { name: "Invalid", config: { ...defaultRehearsalConfig, botCount: 101 } },
    ]),
  );
  expect(readProfiles()).toEqual([]);
  localStorage.setItem("26-rehearsal-profiles-v1", "broken");
  expect(readProfiles()).toEqual([]);
});

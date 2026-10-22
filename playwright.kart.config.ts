import { defineConfig, devices } from "@playwright/test";

// Exercise the real built engine without the party server or room credentials.
export default defineConfig({
  testDir: "./apps/web/e2e",
  testMatch: "kart-drift.spec.ts",
  reporter: "list",
  outputDir: "artifacts/kart-browser-checks",
  use: { baseURL: "http://localhost:4173", ...devices["Desktop Chrome"] },
  webServer: {
    command:
      "npm run build -w @26/kart-solo && npm exec -w @26/kart-solo -- vite preview --port 4173 --strictPort",
    url: "http://localhost:4173/kart-engine/index.html",
    reuseExistingServer: false,
    timeout: 120_000,
  },
});

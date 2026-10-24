import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.KART_TEST_PORT) || 4173;

// Exercise the real built engine without the party server or room credentials.
export default defineConfig({
  testDir: "./apps/web/e2e",
  testMatch: "kart-drift.spec.ts",
  reporter: "list",
  outputDir: "artifacts/kart-browser-checks",
  use: { baseURL: `http://localhost:${port}`, ...devices["Desktop Chrome"] },
  webServer: {
    command:
      (process.env.KART_PREBUILT === "1" ? "" : "npm run build -w @26/kart-solo && ") +
      `npm exec -w @26/kart-solo -- vite preview --port ${port} --strictPort`,
    url: `http://localhost:${port}/kart-engine/index.html`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});

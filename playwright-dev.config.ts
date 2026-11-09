import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./apps/web/e2e",
  fullyParallel: false,
  workers: 1,
  outputDir: "./artifacts/smoke-checks",
  retries: 0,
  use: {
    baseURL: "http://localhost:5173",
    ...devices["Desktop Chrome"],
  },
  timeout: 30000,
  webServer: {
    command: "npm run dev -w @26/web",
    url: "http://localhost:5173",
    reuseExistingServer: true,
    timeout: 60000,
    stdout: "pipe",
    stderr: "pipe",
  },
});

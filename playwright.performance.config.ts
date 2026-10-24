import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./apps/web/e2e",
  testMatch: "performance.spec.ts",
  workers: 1,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:4174",
    ...devices["Desktop Chrome"],
    reducedMotion: "reduce",
  },
  webServer: {
    command: "npm run perf:serve",
    url: "http://127.0.0.1:4174",
    reuseExistingServer: true,
    timeout: 30_000,
  },
});

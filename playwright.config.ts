import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./apps/web/e2e",
  fullyParallel: false,
  // All host flows use the one allowlisted administrator; OTP attempts must not race.
  workers: 1,
  outputDir: "./artifacts/browser-checks",
  retries: 0,
  use: {
    baseURL: "http://localhost:4173",
    ...devices["Desktop Chrome"],
  },
  webServer: {
    command: "npm run preview -w @26/web",
    url: "http://localhost:4173",
    reuseExistingServer: false,
    // Explicit ephemeral local auth: no personal development database is changed.
    env: { LOCAL_DATABASE_ID: "browser-checks" },
    timeout: 120_000,
  },
});

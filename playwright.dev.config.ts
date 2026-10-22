import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

// Exercise source directly; no production build or deployment is needed.
export default defineConfig({
  ...base,
  reporter: "list",
  outputDir: "artifacts/browser-checks",
  webServer: {
    command: "npm run dev -w @26/web -- --port 4173",
    env: { LOCAL_DATABASE_ID: "browser-checks" },
    url: "http://localhost:4173",
    reuseExistingServer: process.env.REUSE_DEV_SERVER === "1",
    timeout: 120_000,
  },
});

import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

/** Runs the real Worker with explicit local adapters and ephemeral storage. */
export default defineConfig({
  ...base,
  webServer: {
    command: "npm run dev -w @26/web -- --port 4173",
    url: "http://localhost:4173",
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      LOCAL_DATABASE_ID: "browser-checks",
      PARTY_BROWSER_REHEARSAL: "1",
      NODE_OPTIONS: [
        process.env.NODE_OPTIONS,
        "--import=" + new URL("./scripts/kart-test-runtime.mjs", import.meta.url).href,
      ]
        .filter(Boolean)
        .join(" "),
    },
  },
});

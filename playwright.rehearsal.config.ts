import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

/** Run through npm run smoke:rehearsal, which builds solo before server startup. */
export default defineConfig({
  ...base,
  // Script budgets measure a production build: see playwright.performance.config.ts.
  testIgnore: "**/performance.spec.ts",
  webServer: {
    command: "npm run dev:rehearsal -w @26/web",
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

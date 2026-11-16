import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

/** Bundled, isolated local Worker; never a deployed room or Vite module runner. */
export default defineConfig({
  ...base,
  testDir: "./apps/web/perf",
  testMatch: ["**/kart-render-baseline.spec.ts", "**/kart-runtime-boundary.spec.ts"],
  outputDir: "./artifacts/kart-render-baseline",
  maxFailures: 1,
  metadata: { kartRuntime: "bundled-local-preview" },
  projects: [
    {
      name: "rendering",
      testMatch: "**/kart-render-baseline.spec.ts",
      metadata: { captureWorkerCPU: false },
    },
    {
      name: "profiled",
      testMatch: "**/kart-render-baseline.spec.ts",
      metadata: { captureWorkerCPU: true },
    },
    { name: "runtime", testMatch: "**/kart-runtime-boundary.spec.ts" },
  ],
  webServer: {
    ...base.webServer,
    command: "npm run preview -w @26/web",
    url: "http://localhost:4173",
    reuseExistingServer: false,
    timeout: 120_000,
    env: { LOCAL_DATABASE_ID: "browser-checks", PARTY_BROWSER_REHEARSAL: "1" },
  },
});

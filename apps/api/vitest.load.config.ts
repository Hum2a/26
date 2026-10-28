import path from "node:path";
import { fileURLToPath } from "node:url";
import { cloudflareTest } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

const here = path.dirname(fileURLToPath(import.meta.url));

/** Realtime measurements only. `npm test` does not run this; use `npm run load:realtime`. */
export default defineConfig({
  test: {
    onUnhandledError(error) {
      if ("code" in error && error.code === "ECONNRESET") {
        return false;
      }
    },
    projects: [
      {
        plugins: [
          cloudflareTest({
            wrangler: { configPath: path.join(here, "wrangler.jsonc") },
            miniflare: {
              bindings: {
                DATABASE_URL: "",
                RESEND_API_KEY: "",
                RESEND_FROM: "",
                EMAIL_TEST_RECIPIENT: "",
                LOAD_SIZES: process.env.LOAD_SIZES ?? "10,25,50,75,100",
                LOAD_KART_MS: process.env.LOAD_KART_MS ?? "6000",
                LOAD_INPUT_HZ: process.env.LOAD_INPUT_HZ ?? "10",
              },
            },
          }),
        ],
        test: {
          name: "realtime-load",
          include: ["test/realtime-load.spec.ts"],
          hookTimeout: 60_000,
          testTimeout: 240_000,
          fileParallelism: false,
        },
      },
    ],
  },
});

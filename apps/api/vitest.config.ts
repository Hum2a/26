import path from "node:path";
import { fileURLToPath } from "node:url";
import { cloudflareTest } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

const here = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    // workerd closes its socket with ECONNRESET after the harness stops.
    // Fetch failures still fail the test. This only ignores that shutdown reset.
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
                APP_ENV: "staging",
              },
            },
          }),
        ],
        test: {
          name: "worker",
          include: ["test/health.spec.ts"],
        },
      },
      {
        test: {
          name: "routing",
          include: ["test/routing.spec.ts"],
          environment: "node",
          hookTimeout: 60_000,
          fileParallelism: false,
        },
      },
      {
        plugins: [
          cloudflareTest({
            wrangler: { configPath: path.join(here, "wrangler.jsonc") },
          }),
        ],
        test: {
          name: "room",
          include: [
            "test/room.spec.ts",
            "test/phase.spec.ts",
            "test/quiz.spec.ts",
            "test/social.spec.ts",
            "test/rounds.spec.ts",
            "test/vote.spec.ts",
            "test/duel.spec.ts",
            "test/troll.spec.ts",
            "test/media.spec.ts",
            "test/stage-effects.spec.ts",
            "test/device-context.spec.ts",
            "test/stats-room.spec.ts",
            "test/archive-room.spec.ts",
            "test/results-room.spec.ts",
            "test/hardening.spec.ts",
            "test/load.spec.ts",
            "test/operations.spec.ts",
          ],
          hookTimeout: 60_000,
          testTimeout: 30_000,
          fileParallelism: false,
        },
      },
      {
        resolve: {
          alias: {
            "cloudflare:workers": path.join(here, "test/cloudflare-workers-stub.ts"),
          },
        },
        test: {
          name: "auth",
          include: [
            "test/auth.spec.ts",
            "test/credentials.spec.ts",
            "test/schedule.spec.ts",
            "test/quiz-score.spec.ts",
            "test/rounds-score.spec.ts",
            "test/vote-score.spec.ts",
            "test/duel-score.spec.ts",
            "test/troll-score.spec.ts",
            "test/media-check.spec.ts",
            "test/cue-policy.spec.ts",
            "test/device-normalise.spec.ts",
            "test/stats.spec.ts",
            "test/archive.spec.ts",
            "test/results.spec.ts",
            "test/content-preflight.spec.ts",
            "test/client-api-key.spec.ts",
          ],
          environment: "node",
          hookTimeout: 60_000,
          testTimeout: 60_000,
          fileParallelism: false,
        },
      },
    ],
  },
});

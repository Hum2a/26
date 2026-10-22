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
          include: ["test/health.spec.ts", "test/email-worker.spec.ts"],
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
            "test/wordle-room.spec.ts",
            "test/party-polish-room.spec.ts",
            "test/kart-room.spec.ts",
            "test/admin-rooms.spec.ts",
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
            "test/fun-facts-room.spec.ts",
            "test/archive-room.spec.ts",
            "test/results-room.spec.ts",
            "test/hardening.spec.ts",
            "test/load.spec.ts",
            "test/operations.spec.ts",
            "test/rate-limit-room.spec.ts",
            "test/patch-room.spec.ts",
            "test/drivers-room.spec.ts",
            "test/wall-upload.spec.ts",
            "test/wall-queue.spec.ts",
            "test/wall-moderation.spec.ts",
            "test/wall-snapshot.spec.ts",
            "test/wall-results.spec.ts",
            "test/wall-load.spec.ts",
            "test/script-errors-room.spec.ts",
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
            "test/email-design.spec.ts",
            "test/admin-rooms-auth.spec.ts",
            "test/credentials.spec.ts",
            "test/schedule.spec.ts",
            "test/quiz-score.spec.ts",
            "test/typed-score.spec.ts",
            "test/wordle-score.spec.ts",
            "test/rounds-score.spec.ts",
            "test/vote-score.spec.ts",
            "test/duel-score.spec.ts",
            "test/troll-score.spec.ts",
            "test/media-check.spec.ts",
            "test/cue-policy.spec.ts",
            "test/device-normalise.spec.ts",
            "test/device-profile.spec.ts",
            "test/wall-engine.spec.ts",
            "test/wall-loved.spec.ts",
            "test/stats.spec.ts",
            "test/fun-facts.spec.ts",
            "test/archive.spec.ts",
            "test/results.spec.ts",
            "test/content-preflight.spec.ts",
            "test/question-authoring.spec.ts",
            "test/birthday-assets-prices.spec.ts",
            "test/inflation-additions.spec.ts",
            "test/trolley-additions.spec.ts",
            "test/original-name-additions.spec.ts",
            "test/who-said-it.spec.ts",
            "test/party-concepts.spec.ts",
            "test/party-scoring.spec.ts",
            "test/kart-score.spec.ts",
            "test/kart-driving.spec.ts",
            "test/kart-powers.spec.ts",
            "test/kart-guard.spec.ts",
            "test/new-party-concepts.spec.ts",
            "test/client-api-key.spec.ts",
            "test/rate-limit.spec.ts",
            "test/database-sharing.spec.ts",
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

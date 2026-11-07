import path from "node:path";
import { fileURLToPath } from "node:url";
import { cloudflareTest } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

const here = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    // Bound the combined Node/workerd pool as well as each project's workers.
    // Cold auth and isolated room runtimes otherwise compete for desktop memory.
    maxWorkers: 1,
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
          pool: process.platform === "win32" ? "threads" : "forks",
          maxWorkers: process.platform === "win32" ? 1 : 2,
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
            // Room tests use their explicit local adapters, never a developer's
            // configured database or email provider from local secret files.
            miniflare: {
              bindings: {
                DATABASE_URL: "",
                RESEND_API_KEY: "",
                RESEND_FROM: "",
                EMAIL_TEST_RECIPIENT: "",
              },
            },
          }),
        ],
        test: {
          name: "room",
          include: [
            "test/room.spec.ts",
            "test/end-destroy.spec.ts",
            "test/push-luck-room.spec.ts",
            "test/player-control.spec.ts",
            "test/developer-room.spec.ts",
            "test/rehearsal-room.spec.ts",
            "test/wordle-room.spec.ts",
            "test/party-polish-room.spec.ts",
            "test/kart-room.spec.ts",
            "test/kart-items-room.spec.ts",
            "test/kart-lobby.spec.ts",
            "test/kart-track-selection.spec.ts",
            "test/birthday-room.spec.ts",
            "test/admin-rooms.spec.ts",
            "test/phase.spec.ts",
            "test/quiz.spec.ts",
            "test/social.spec.ts",
            "test/rounds.spec.ts",
            "test/vote.spec.ts",
            "test/duel.spec.ts",
            "test/troll.spec.ts",
            "test/media.spec.ts",
            "test/photo-bias-room.spec.ts",
            "test/stage-effects.spec.ts",
            "test/device-context.spec.ts",
            "test/stats-room.spec.ts",
            "test/fun-facts-room.spec.ts",
            "test/archive-room.spec.ts",
            "test/delivery-seq.spec.ts",
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
            "test/troll-identity.spec.ts",
            "test/troll-theatre.spec.ts",
            "test/sample-room.spec.ts",
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
          pool: process.platform === "win32" ? "threads" : "forks",
          maxWorkers: process.platform === "win32" ? 1 : 2,
          include: [
            "test/auth.spec.ts",
            "test/email-design.spec.ts",
            "test/admin-rooms-auth.spec.ts",
            "test/developer-routes.spec.ts",
            "test/local-auth-proof.spec.ts",
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
            "test/photo-preview.spec.ts",
            "test/cue-policy.spec.ts",
            "test/device-normalise.spec.ts",
            "test/device-profile.spec.ts",
            "test/wall-engine.spec.ts",
            "test/wall-loved.spec.ts",
            "test/troll-catalogue.spec.ts",
            "test/points-trolls.spec.ts",
            "test/push-luck.spec.ts",
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
            "test/kart-tracks.spec.ts",
            "test/kart-park.spec.ts",
            "test/kart-track-catalogue.spec.ts",
            "test/birthday-order.spec.ts",
            "test/kart-driving.spec.ts",
            "test/kart-laps.spec.ts",
            "test/kart-time-trial.spec.ts",
            "test/kart-recap.spec.ts",
            "test/kart-powers.spec.ts",
            "test/kart-projectiles.spec.ts",
            "test/kart-expanded.spec.ts",
            "test/kart-targeting.spec.ts",
            "test/kart-guard.spec.ts",
            "test/kart-ingress.spec.ts",
            "test/kart-events.spec.ts",
            "test/kart-opponents.spec.ts",
            "test/kart-spectator.spec.ts",
            "test/kart-asset-manifest.spec.ts",
            "test/new-party-concepts.spec.ts",
            "test/client-api-key.spec.ts",
            "test/rate-limit.spec.ts",
            "test/database-sharing.spec.ts",
            "test/award-points.spec.ts",
            "test/log.spec.ts",
            "test/archive-close.spec.ts",
            "test/read-json.spec.ts",
            "test/auth-session-cache.spec.ts",
            "test/timeout.spec.ts",
            "test/credential-lifetime.spec.ts",
            "test/runtime-estimate.spec.ts",
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

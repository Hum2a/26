import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { projectRoot } from "./env-files.ts";
import {
  assertGeneratedWorkerConfig,
  collectWorkerSecrets,
  parseJsonc,
  publicHostname,
  publicOrigin,
  requiredWorkerSecrets,
  resolveDeployableEnvironment,
  resolveMigrateEnvironment,
  resolveReleaseTargets,
  workerRelease,
} from "./release-support.ts";

const wranglerText = readFileSync(
  path.join(projectRoot(), "apps/api/wrangler.jsonc"),
  "utf8",
);

test("prod is an alias for the production Worker environment", () => {
  assert.equal(resolveDeployableEnvironment("prod"), "production");
  assert.deepEqual(resolveReleaseTargets("both"), ["staging", "production"]);
  assert.equal(resolveMigrateEnvironment("dev"), "local");
  assert.throws(() => resolveDeployableEnvironment("local"), /not deployable/);
});

test("generated config must match the requested Worker name and host", () => {
  const staging = workerRelease("staging");
  assert.equal(staging.workerName, "26-humza-website-staging");
  assert.equal(staging.hostname, "26-staging.humza.website");
  assert.equal(staging.origin, "https://26-staging.humza.website");
  assert.equal(workerRelease("production").workerName, "26-humza-website");
  assert.equal(publicHostname("production"), "26.humza.website");
  assert.equal(publicOrigin("production"), "https://26.humza.website");
  const stagingRoute = {
    pattern: "26-staging.humza.website",
    custom_domain: true,
  };
  assert.throws(
    () =>
      assertGeneratedWorkerConfig(
        {
          name: "26-humza-website-local",
          targetEnvironment: "staging",
          routes: [stagingRoute],
        },
        staging,
      ),
    /still 26-humza-website-local/,
  );
  assert.throws(
    () =>
      assertGeneratedWorkerConfig(
        { name: "26-humza-website-staging", targetEnvironment: "staging" },
        staging,
      ),
    /missing custom domain/,
  );
  assertGeneratedWorkerConfig(
    {
      name: "26-humza-website-staging",
      targetEnvironment: "staging",
      routes: [stagingRoute],
    },
    staging,
  );
});

test("only required non-empty secrets are prepared", () => {
  const required = requiredWorkerSecrets(wranglerText, "staging");
  assert.ok(required.includes("DATABASE_URL"));
  assert.ok(required.includes("EMAIL_TEST_RECIPIENT"));
  const values = Object.fromEntries(required.map((key) => [key, `value-for-${key}`]));
  const collected = collectWorkerSecrets({
    required,
    values: { ...values, EXTRA_KEY: "leave-this-out" },
    fileLabel: "apps/api/.dev.vars.staging",
  });
  assert.deepEqual(collected.keys, required);
  assert.match(collected.envText, /^ADMIN_EMAIL=value-for-ADMIN_EMAIL$/m);
  assert.doesNotMatch(collected.envText, /EXTRA_KEY/);
  assert.throws(
    () =>
      collectWorkerSecrets({
        required,
        values: { ...values, DATABASE_URL: "" },
        fileLabel: "apps/api/.dev.vars.staging",
      }),
    /DATABASE_URL/,
  );
  assert.throws(
    () =>
      collectWorkerSecrets({
        required,
        values,
        fileLabel: "apps/api/.dev.vars.staging",
        publicOrigin: publicOrigin("staging"),
      }),
    /26-staging\.humza\.website/,
  );
});

test("wrangler.jsonc attaches one custom domain per remote Worker", () => {
  const config = parseJsonc<{
    env: Record<
      string,
      {
        name: string;
        workers_dev?: boolean;
        routes?: Array<{ pattern?: string; custom_domain?: boolean }>;
        secrets?: { required?: string[] };
      }
    >;
  }>(wranglerText);
  assert.equal(config.env.staging.name, "26-humza-website-staging");
  assert.equal(config.env.production.name, "26-humza-website");
  assert.equal(config.env.staging.workers_dev, false);
  assert.equal(config.env.production.workers_dev, false);
  assert.deepEqual(config.env.staging.routes, [
    { pattern: "26-staging.humza.website", custom_domain: true },
  ]);
  assert.deepEqual(config.env.production.routes, [
    { pattern: "26.humza.website", custom_domain: true },
  ]);
  assert.deepEqual(
    config.env.staging.secrets?.required,
    config.env.production.secrets?.required,
  );
});

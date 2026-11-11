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
  retargetGeneratedWorkerConfig,
  resolveDeployableEnvironment,
  resolveMigrateEnvironment,
  resolveReleaseTargets,
  workerRelease,
  inDeployFreeze,
  assertDeployAllowed,
  releaseCheckSteps,
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
  assert.throws(
    () =>
      retargetGeneratedWorkerConfig(
        {
          name: "26-humza-website-local",
          targetEnvironment: undefined,
        },
        wranglerText,
        "production",
      ),
    /still 26-humza-website-local/,
  );
  const retargeted = retargetGeneratedWorkerConfig(
    {
      name: "26-humza-website-staging",
      targetEnvironment: "staging",
      routes: [stagingRoute],
      main: "index.js",
    },
    wranglerText,
    "production",
  );
  assertGeneratedWorkerConfig(retargeted, workerRelease("production"));
  assert.equal(retargeted.main, "index.js");
  assert.deepEqual(retargeted.vars, {
    APP_ENV: "production",
    MEDIA_BUCKET_NAME: "26-humza-media",
  });
});

test("production does not require the test recipient, so results mail reaches guests", () => {
  assert.ok(
    requiredWorkerSecrets(wranglerText, "staging").includes("EMAIL_TEST_RECIPIENT"),
  );
  const production = requiredWorkerSecrets(wranglerText, "production");
  assert.ok(!production.includes("EMAIL_TEST_RECIPIENT"));
  assert.ok(production.includes("RESEND_API_KEY"));
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
  // Workers Logs collect the room's structured error lines.
  for (const name of ["staging", "production"] as const)
    assert.deepEqual((config.env[name] as { observability?: unknown }).observability, {
      enabled: true,
    });
  assert.equal(config.env.production.workers_dev, false);
  assert.deepEqual(config.env.staging.routes, [
    { pattern: "26-staging.humza.website", custom_domain: true },
  ]);
  assert.deepEqual(config.env.production.routes, [
    { pattern: "26.humza.website", custom_domain: true },
  ]);
  // Production needs everything staging does except the test recipient,
  // which would otherwise limit results mail to one address.
  assert.deepEqual(
    config.env.staging.secrets?.required?.filter(
      (key) => key !== "EMAIL_TEST_RECIPIENT",
    ),
    config.env.production.secrets?.required,
  );
});

test("production deploys are frozen across the party weekend only", () => {
  assert.equal(inDeployFreeze(Date.parse("2026-11-19T23:59:59Z")), false);
  assert.equal(inDeployFreeze(Date.parse("2026-11-20T00:00:00Z")), true);
  assert.equal(inDeployFreeze(Date.parse("2026-11-21T19:30:00Z")), true);
  assert.equal(inDeployFreeze(Date.parse("2026-11-22T11:59:59Z")), true);
  assert.equal(inDeployFreeze(Date.parse("2026-11-22T12:00:00Z")), false);
});

test("direct production and combined deploys are allowed outside the freeze", () => {
  const options = { dryRun: false, overrideFreeze: false };
  const beforeParty = Date.parse("2026-11-05T19:00:00Z");
  assertDeployAllowed(["staging"], options, beforeParty);
  for (const targets of [["production"], ["staging", "production"]] as const) {
    assertDeployAllowed(targets, options, beforeParty);
  }
});

test("the common production freeze allows an explicit emergency override", () => {
  const duringParty = Date.parse("2026-11-21T19:00:00Z");
  const options = { dryRun: false, overrideFreeze: false };
  assert.throws(
    () => assertDeployAllowed(["production"], options, duringParty),
    /frozen/,
  );
  assertDeployAllowed(
    ["production"],
    { ...options, overrideFreeze: true },
    duringParty,
  );
});

test("non-deploying packaging dry runs need no freeze override", () => {
  assertDeployAllowed(
    ["staging", "production"],
    { dryRun: true, overrideFreeze: false },
    Date.parse("2026-11-21T19:00:00Z"),
  );
});

test("shared release checks run the normal gates once and opt into isolated API checks", () => {
  assert.deepEqual(releaseCheckSteps(false), [
    ["run", "typecheck"],
    ["run", "content:check"],
    ["run", "test:unit"],
    ["run", "lint"],
    ["run", "test:release"],
  ]);
  assert.deepEqual(releaseCheckSteps(true), [
    ...releaseCheckSteps(false),
    ["run", "test", "-w", "@26/api"],
  ]);
});

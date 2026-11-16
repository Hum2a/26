import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  formatEnvAssignment,
  projectRoot,
  type TargetEnvironment,
} from "./env-files.ts";

export const deployableEnvironments = ["staging", "production"] as const;
export type DeployableEnvironment = (typeof deployableEnvironments)[number];

export type WorkerRelease = {
  environment: DeployableEnvironment;
  cloudflareEnv: DeployableEnvironment;
  workerName: string;
  hostname: string;
  origin: string;
  generatedConfigPath: string;
};

export type GeneratedWorkerConfig = {
  name?: string;
  targetEnvironment?: string;
  routes?: Array<{ pattern?: string; custom_domain?: boolean }>;
  [key: string]: unknown;
};

export type SecretCollection = {
  keys: string[];
  envText: string;
};

const GENERATED_WORKER_DIRECTORY = "26_humza_website_local";

export function resolveDeployableEnvironment(
  value: string | undefined,
): DeployableEnvironment {
  if (value === "prod") {
    return "production";
  }
  if (value === "staging" || value === "production") {
    return value;
  }
  throw new Error(
    "Pass --env staging or --env production. The local Worker is not deployable.",
  );
}

export function resolveMigrateEnvironment(
  value: string | undefined,
): TargetEnvironment {
  if (value === "dev" || value === "local") {
    return "local";
  }
  if (value === "prod") {
    return "production";
  }
  if (value === "staging" || value === "production") {
    return value;
  }
  throw new Error("Pass --env local, --env staging, or --env production.");
}

export function resolveReleaseTargets(
  value: string | undefined,
): DeployableEnvironment[] {
  if (value === "both") {
    return ["staging", "production"];
  }
  return [resolveDeployableEnvironment(value)];
}

export function publicHostname(environment: DeployableEnvironment): string {
  return environment === "staging" ? "26-staging.humza.website" : "26.humza.website";
}

export function publicOrigin(environment: DeployableEnvironment): string {
  return `https://${publicHostname(environment)}`;
}

export function workerRelease(
  environment: DeployableEnvironment,
  root = projectRoot(),
): WorkerRelease {
  return {
    environment,
    cloudflareEnv: environment,
    workerName:
      environment === "staging" ? "26-humza-website-staging" : "26-humza-website",
    hostname: publicHostname(environment),
    origin: publicOrigin(environment),
    generatedConfigPath: path.join(
      root,
      "apps/web/dist",
      GENERATED_WORKER_DIRECTORY,
      "wrangler.json",
    ),
  };
}

export function parseJsonc<T>(text: string): T {
  const withoutComments = text
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
  return JSON.parse(withoutComments.replace(/,\s*([}\]])/g, "$1")) as T;
}

export function requiredWorkerSecrets(
  wranglerText: string,
  environment: DeployableEnvironment,
): string[] {
  const config = parseJsonc<{
    env?: Record<string, { secrets?: { required?: string[] } }>;
  }>(wranglerText);
  const required = config.env?.[environment]?.secrets?.required;
  if (!required || required.length === 0) {
    throw new Error(
      `apps/api/wrangler.jsonc has no secrets.required for ${environment}.`,
    );
  }
  return required;
}

export function collectWorkerSecrets(input: {
  required: readonly string[];
  values: Record<string, string>;
  fileLabel: string;
  publicOrigin?: string;
}): SecretCollection {
  const missing = input.required.filter((key) => !input.values[key]?.trim());
  if (missing.length > 0) {
    throw new Error(
      `Missing required Worker secrets in ${input.fileLabel}: ${missing.join(", ")}.`,
    );
  }
  if (
    input.publicOrigin &&
    input.values.BETTER_AUTH_URL?.trim() !== input.publicOrigin
  ) {
    throw new Error(
      `BETTER_AUTH_URL in ${input.fileLabel} must be ${input.publicOrigin}.`,
    );
  }
  const keys = [...input.required];
  return {
    keys,
    envText: `${keys.map((key) => formatEnvAssignment(key, input.values[key])).join("\n")}\n`,
  };
}

export function readGeneratedWorkerConfig(filePath: string): GeneratedWorkerConfig {
  if (!existsSync(filePath)) {
    throw new Error(
      `${path.relative(projectRoot(), filePath)} is missing. Run the environment build first.`,
    );
  }
  return JSON.parse(readFileSync(filePath, "utf8")) as GeneratedWorkerConfig;
}

export function retargetGeneratedWorkerConfig(
  config: GeneratedWorkerConfig,
  wranglerText: string,
  environment: DeployableEnvironment,
): GeneratedWorkerConfig {
  if (
    config.name === "26-humza-website-local" ||
    (config.targetEnvironment !== "staging" &&
      config.targetEnvironment !== "production")
  ) {
    throw new Error(
      "The generated Worker is still 26-humza-website-local. Build with CLOUDFLARE_ENV set before deploying.",
    );
  }
  const parsed = parseJsonc<{
    env?: Record<string, Record<string, unknown>>;
  }>(wranglerText);
  const envConfig = parsed.env?.[environment];
  if (!envConfig) {
    throw new Error(
      `apps/api/wrangler.jsonc has no env.${environment} configuration.`,
    );
  }
  const next: GeneratedWorkerConfig = { ...config };
  for (const sibling of Object.values(parsed.env ?? {})) {
    for (const key of Object.keys(sibling)) {
      delete next[key];
    }
  }
  return {
    ...next,
    ...envConfig,
    targetEnvironment: environment,
  };
}

export function assertGeneratedWorkerConfig(
  config: GeneratedWorkerConfig,
  release: WorkerRelease,
): void {
  if (config.name === "26-humza-website-local") {
    throw new Error(
      "The generated Worker is still 26-humza-website-local. Build with CLOUDFLARE_ENV set before deploying.",
    );
  }
  if (config.name !== release.workerName) {
    throw new Error(
      `Generated Worker name is ${config.name ?? "(missing)"}, expected ${release.workerName}.`,
    );
  }
  if (config.targetEnvironment !== release.environment) {
    throw new Error(
      `Generated targetEnvironment is ${config.targetEnvironment ?? "(missing)"}, expected ${release.environment}.`,
    );
  }
  const attached = config.routes?.some(
    (route) => route.pattern === release.hostname && route.custom_domain === true,
  );
  if (!attached) {
    throw new Error(
      `Generated config is missing custom domain ${release.hostname}. One Worker must serve that host.`,
    );
  }
}

/**
 * No production deploys across the party weekend: a deploy restarts every
 * room and drops every phone's connection. London is on UTC in November.
 */
export const deployFreeze = {
  from: Date.parse("2026-11-20T00:00:00Z"),
  until: Date.parse("2026-11-22T12:00:00Z"),
};

export function inDeployFreeze(nowMs: number): boolean {
  return nowMs >= deployFreeze.from && nowMs < deployFreeze.until;
}

/**
 * Shared by deploy/full entry points, before checks or remote changes.
 * Freeze always applies to production. Git state applies when provided;
 * `undefined` is the documented wrapper bypass after release.sh (or trusted
 * CI) has already enforced clean master. secrets-sync and migrate do not call
 * this function.
 */
export function assertDeployAllowed(
  targets: readonly DeployableEnvironment[],
  options: { dryRun: boolean; overrideFreeze: boolean },
  nowMs: number,
  gitState?: { branch: string; clean: boolean },
): void {
  // A packaging dry run does not deploy, migrate or upload secrets.
  if (options.dryRun || !targets.includes("production")) return;

  if (inDeployFreeze(nowMs) && !options.overrideFreeze)
    throw new Error(
      "Production is frozen for the party weekend (20 Nov to midday 22 Nov). Pass --override-freeze only for an emergency fix.",
    );

  if (gitState) {
    if (gitState.branch !== "master")
      throw new Error(
        `Production deploys must be from master. Current branch: ${gitState.branch}`,
      );
    if (!gitState.clean)
      throw new Error(
        "Production deploys require a clean working tree. Commit or stash changes first.",
      );
  }
}

/** Run once per invocation, including a staging + production release. */
export function releaseCheckSteps(fullChecks: boolean): string[][] {
  const steps = [
    ["run", "typecheck"],
    ["run", "content:check"],
    ["run", "test:unit"],
    ["run", "lint"],
    ["run", "test:release"],
  ];
  if (fullChecks) steps.push(["run", "test", "-w", "@26/api"]);
  return steps;
}

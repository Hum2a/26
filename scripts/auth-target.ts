import { existsSync } from "node:fs";
import path from "node:path";
import type { AuthBindings } from "../apps/api/src/auth/bindings.ts";
import {
  devVarsPath,
  projectRoot,
  readEnvValues,
  readTargetEnvironment,
  type TargetEnvironment,
} from "./env-files.ts";

const root = projectRoot();

export type AuthTarget = {
  environment: TargetEnvironment;
  bindings: AuthBindings;
  devInbox: boolean;
};

export function readAuthTarget(): AuthTarget {
  const target = readTargetEnvironment();
  if (!target) {
    console.error("Pass --env local, --env staging, or --env production.");
    console.error("npm strips --env, so use: npm run auth:migrate -- --env local");
    process.exit(1);
  }
  const file = devVarsPath(target);
  if (target !== "local" && !existsSync(file)) {
    console.error(`Missing ${path.relative(root, file)} for --env ${target}.`);
    console.error("Run npm run env:sync first, then fill in the required values.");
    process.exit(1);
  }
  const values = existsSync(file) ? readEnvValues(file) : {};
  const bindings: AuthBindings = {
    APP_ENV: target,
    ADMIN_EMAIL:
      values.ADMIN_EMAIL || (target === "local" ? "humza@localhost.test" : ""),
    BETTER_AUTH_SECRET: values.BETTER_AUTH_SECRET || "",
    BETTER_AUTH_URL: values.BETTER_AUTH_URL || "",
    DATABASE_URL: values.DATABASE_URL || "",
    RESEND_API_KEY: values.RESEND_API_KEY || "",
    RESEND_FROM: values.RESEND_FROM || "",
  };
  if (target !== "local" && !bindings.DATABASE_URL?.trim()) {
    console.error(
      `--env ${target} needs DATABASE_URL in ${path.relative(root, file)}.`,
    );
    process.exit(1);
  }
  if (target !== "local" && !bindings.ADMIN_EMAIL?.trim()) {
    console.error(`--env ${target} needs ADMIN_EMAIL in ${path.relative(root, file)}.`);
    process.exit(1);
  }
  return {
    environment: target,
    bindings,
    devInbox: target === "local",
  };
}

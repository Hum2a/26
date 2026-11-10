import path from "node:path";
import { defaultLocalAdminEmails } from "../apps/api/src/auth/bindings.ts";
import {
  devVarsExamplePath,
  devVarsPath,
  envExamplePath,
  envPath,
  mergeEnvFile,
  projectRoot,
  readTargetEnvironments,
  type TargetEnvironment,
} from "./env-files.ts";

const root = projectRoot();

const devDefaults: Record<TargetEnvironment, Record<string, string>> = {
  local: {
    ADMIN_EMAIL: defaultLocalAdminEmails,
  },
  staging: {
    BETTER_AUTH_URL: "https://26-staging.humza.website",
  },
  production: {
    BETTER_AUTH_URL: "https://26.humza.website",
  },
};

const shellDefaults: Record<TargetEnvironment, Record<string, string>> = {
  local: {},
  staging: {
    CLOUDFLARE_ENV: "staging",
  },
  production: {
    CLOUDFLARE_ENV: "production",
  },
};

function relative(filePath: string): string {
  return path.relative(root, filePath);
}

function report(result: ReturnType<typeof mergeEnvFile>) {
  const label = relative(result.path);
  if (result.created) {
    console.log(`Created ${label}`);
  } else if (result.updated) {
    console.log(`Updated ${label}`);
  } else {
    console.log(`No changes for ${label}`);
  }
  if (result.keysAdded.length > 0) {
    console.log(`  Added keys: ${result.keysAdded.join(", ")}`);
  }
}

for (const environment of readTargetEnvironments()) {
  console.log(`Environment: ${environment}`);
  report(
    mergeEnvFile(
      devVarsExamplePath(),
      devVarsPath(environment),
      devDefaults[environment],
    ),
  );
  report(
    mergeEnvFile(envExamplePath(), envPath(environment), shellDefaults[environment]),
  );
  console.log("");
}

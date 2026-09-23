import path from "node:path";
import { randomBytes } from "node:crypto";
import {
  devVarsPath,
  envPath,
  projectRoot,
  readTargetEnvironments,
  setEnvValue,
} from "./env-files.ts";

const root = projectRoot();

function generateClientApiKey(): string {
  return randomBytes(32).toString("base64url");
}

for (const environment of readTargetEnvironments()) {
  const key = generateClientApiKey();
  setEnvValue(devVarsPath(environment), "CLIENT_API_KEY", key);
  setEnvValue(envPath(environment), "VITE_CLIENT_API_KEY", key);
  console.log(`Rotated client API key for ${environment}.`);
  console.log(`  Worker: ${path.relative(root, devVarsPath(environment))}`);
  console.log(`  Web: ${path.relative(root, envPath(environment))}`);
  if (environment !== "local") {
    console.log(`  Deploy: npx wrangler secret put CLIENT_API_KEY --env ${environment}`);
  }
  console.log("  Restart dev or rebuild after rotation.");
  console.log("");
}

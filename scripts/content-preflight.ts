import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { demoQuestions } from "../apps/api/src/questions/demo-set.ts";
import {
  illustrativeStingAsset,
  preflightContent,
} from "../apps/api/src/questions/preflight.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const missingAssets = [illustrativeStingAsset].filter(
  (asset) => !existsSync(path.join(root, asset)),
);
const issues = preflightContent({ questions: demoQuestions, missingAssets });

if (issues.length === 0) {
  console.log("Content preflight passed for the illustrative demo pack.");
  process.exit(0);
}

for (const item of issues) {
  console.error(`${item.code}: ${item.message}`);
}
process.exit(1);

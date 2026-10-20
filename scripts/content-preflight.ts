import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { questionPacks } from "../apps/api/src/questions/registry.ts";
import {
  illustrativeStingAsset,
  validatePack,
  validateRuntimeEffects,
} from "../apps/api/src/questions/validate.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const missingSting = [illustrativeStingAsset].filter(
  (asset) => !existsSync(path.join(root, asset)),
);
let failed = false;

for (const item of validateRuntimeEffects()) {
  failed = true;
  console.error(`${item.code}: ${item.message}`);
}

for (const pack of questionPacks) {
  const optionImages = pack.catalogue.flatMap((question) =>
    question.kind === "choice"
      ? question.options.flatMap((option) => (option.image ? [option.image] : []))
      : [],
  );
  const missingImages = optionImages.filter(
    (image) => !existsSync(path.join(root, "apps/web/public", image)),
  );
  const assets = [
    ...(pack.profile === "illustrative" ? missingSting : []),
    ...missingImages,
  ];
  const issues = validatePack(pack, assets);
  for (const item of issues) {
    if (item.level === "incomplete") {
      console.log(`incomplete (${pack.packId}): ${item.message}`);
      continue;
    }
    failed = true;
    console.error(`${pack.packId} ${item.code}: ${item.message}`);
  }
  if (!issues.some((item) => item.level === "error")) {
    console.log(`Content preflight passed for ${pack.packId} (${pack.version}).`);
  }
}

process.exit(failed ? 1 : 0);

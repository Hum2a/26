// Explicit local browser-test adapter: share the native backend already used by
// the API tests. No installed files, dependency versions or deployed code change.
import * as module from "node:module";
import { readFileSync } from "node:fs";
import { relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

if (
  process.env.PARTY_BROWSER_REHEARSAL !== "1" ||
  process.env.LOCAL_DATABASE_ID !== "browser-checks" ||
  process.env.CLOUDFLARE_ENV
)
  throw new Error("The test runtime requires isolated local browser rehearsal.");
if (typeof module.registerHooks !== "function")
  throw new Error("The kart browser baseline requires Node 22.15 or later.");

const root = fileURLToPath(new URL("../", import.meta.url));
const fromTests = module.createRequire(
  import.meta.resolve("@cloudflare/vitest-plugin"),
);
const targetPath = fromTests.resolve("miniflare");
const target = pathToFileURL(targetPath).href;
const lock = JSON.parse(
  readFileSync(new URL("../package-lock.json", import.meta.url), "utf8"),
);
const relativeTarget = relative(root, targetPath).replaceAll("\\", "/");
const selected = Object.entries(lock.packages).find(
  ([path]) => path.endsWith("/miniflare") && relativeTarget.startsWith(path + "/"),
);
if (!selected)
  throw new Error("The test runtime must be present in the project lockfile.");
const info = selected[1];
let reported = false;
module.registerHooks({
  resolve(specifier, context, nextResolve) {
    if (
      specifier === "miniflare" &&
      /\/(?:@cloudflare\/vite-plugin|wrangler)\//.test(context.parentURL ?? "")
    ) {
      if (!reported) {
        reported = true;
        console.error(
          "KART-TEST-RUNTIME " +
            JSON.stringify({
              miniflare: info.version,
              workerd: info.dependencies.workerd,
            }),
        );
      }
      return { url: target, shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
});

import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

// Pass explicit bindings portably: shell-specific environment assignments can
// otherwise silently fall back to the legacy ring measurement on Windows.
const api = fileURLToPath(new URL("../apps/api/", import.meta.url));
const vitest = fileURLToPath(
  new URL("../node_modules/vitest/vitest.mjs", import.meta.url),
);
const extended = process.argv.includes("--extended");
const neutral = process.argv.includes("--neutral");
const idle = process.argv.includes("--idle");
const sizes = extended ? "50,80" : "1,16,21,50,80";
const duration = extended ? "20000" : "6000";
const inputHz = idle ? "0" : "10";
console.log(
  `Kart baseline: mario-circuit-v1; ${sizes} simulated racers; ${inputHz}Hz; ${duration}ms; ${neutral ? "neutral controls" : "driving controls"}.`,
);
const result = spawnSync(
  process.execPath,
  [vitest, "run", "--config", "vitest.load.config.ts"],
  {
    cwd: api,
    stdio: "inherit",
    env: {
      ...process.env,
      LOAD_SIZES: sizes,
      LOAD_TRACK: "mario-circuit-v1",
      LOAD_INPUT_HZ: inputHz,
      LOAD_NEUTRAL: neutral ? "1" : "0",
      LOAD_KART_MS: duration,
    },
  },
);
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;

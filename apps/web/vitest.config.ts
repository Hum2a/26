import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    // Windows fork bootstrap can time out before jsdom is ready. Threads keep
    // each file isolated while allowing the browser environment to initialise.
    pool: process.platform === "win32" ? "threads" : "forks",
    maxWorkers: process.platform === "win32" ? 1 : 2,
    // Node 25+ otherwise shadows jsdom's real browser Storage globals.
    execArgv:
      Number(process.versions.node.split(".")[0]) >= 25 ? ["--no-webstorage"] : [],
    css: true,
    setupFiles: ["./test/setup.ts"],
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    sequence: { concurrent: false },
  },
});

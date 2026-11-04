import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    // Isolate jsdom in processes: worker threads stall on cold route imports on Windows.
    pool: "forks",
    maxWorkers: 2,
    // Node 25+ otherwise shadows jsdom's real browser Storage globals.
    execArgv:
      Number(process.versions.node.split(".")[0]) >= 25 ? ["--no-webstorage"] : [],
    css: true,
    setupFiles: ["./test/setup.ts"],
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    sequence: { concurrent: false },
  },
});

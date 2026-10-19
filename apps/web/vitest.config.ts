import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    // Node 25+ otherwise shadows jsdom's real browser Storage globals.
    execArgv: ["--no-webstorage"],
    css: true,
    setupFiles: ["./test/setup.ts"],
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    sequence: { concurrent: false },
  },
});

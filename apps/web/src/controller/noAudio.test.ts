import { describe, expect, it } from "vitest";

const sources = import.meta.glob(
  ["./**/*.ts", "./**/*.tsx", "./**/*.css", "!**/*.test.ts", "!**/*.test.tsx"],
  { query: "?raw", import: "default", eager: true },
);

describe("phone controller audio", () => {
  it("does not construct audio in the controller", () => {
    const files = Object.entries(sources);
    expect(files.length).toBeGreaterThan(0);
    for (const [file, source] of files) {
      expect(source, file).not.toContain("new Audio");
      expect(source, file).not.toMatch(/<audio[\s>]/);
    }
  });
});

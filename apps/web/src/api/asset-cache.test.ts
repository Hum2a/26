import { expect, it } from "vitest";
import headers from "../../public/_headers?raw";

const publicFiles = Object.keys(import.meta.glob("../../public/assets/*"));

it("caches only fingerprinted build directories, leaving HTML, question images and private media revalidated", () => {
  // Blocks are a path line followed by indented headers; only cache blocks matter here.
  const blocks = headers
    .split(/\r?\n(?=\/)/)
    .map((block) => block.trim())
    .filter((block) => block.startsWith("/"));
  const patterns = blocks
    .filter((block) => block.includes("Cache-Control"))
    .map((block) => block.split(/\r?\n/)[0]);
  // Security header blocks never set long-lived caching.
  for (const block of blocks.filter((block) => !block.includes("Cache-Control")))
    expect(block).not.toMatch(/max-age=31536000, immutable/);
  expect(patterns).toEqual([
    "/assets/:file.js",
    "/assets/:file.css",
    "/assets/:file.woff2",
    "/assets/:file.woff",
    "/kart-engine/assets/:file.js",
    "/kart-engine/assets/:file.css",
  ]);
  // Public files with these extensions would share the generated-assets cache
  // rules without having a content hash. Other formats (e.g. demo audio) do not.
  expect(publicFiles.every((path) => !/\.(js|css|woff2?)$/.test(path))).toBe(true);
  expect(
    headers.match(/Cache-Control: public, max-age=31536000, immutable/g),
  ).toHaveLength(6);
});

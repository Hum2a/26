import { expect, it } from "vitest";
import { maxJsonBodyBytes, readJson } from "../src/room/routes";

it("reads small JSON bodies and refuses oversized ones unread", async () => {
  const small = new Request("http://example.com", {
    method: "POST",
    body: JSON.stringify({ action: "pause" }),
  });
  expect(await readJson(small)).toEqual({ action: "pause" });
  const declared = new Request("http://example.com", {
    method: "POST",
    headers: { "content-length": String(maxJsonBodyBytes + 1) },
    body: "{}",
  });
  expect(await readJson(declared)).toBeUndefined();
  const large = new Request("http://example.com", {
    method: "POST",
    body: JSON.stringify({ text: "x".repeat(maxJsonBodyBytes) }),
  });
  expect(await readJson(large)).toBeUndefined();
  expect(
    await readJson(new Request("http://example.com", { method: "POST", body: "{bad" })),
  ).toBeUndefined();
});

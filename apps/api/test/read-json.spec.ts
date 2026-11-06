import { expect, it, vi } from "vitest";
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
  expect(declared.bodyUsed).toBe(false);
  const large = new Request("http://example.com", {
    method: "POST",
    body: JSON.stringify({ text: "x".repeat(maxJsonBodyBytes) }),
  });
  expect(await readJson(large)).toBeUndefined();
  expect(
    await readJson(new Request("http://example.com", { method: "POST", body: "{bad" })),
  ).toBeUndefined();
});

function streamedRequest(body: ReadableStream<Uint8Array>, headers?: HeadersInit) {
  return new Request("http://example.com", {
    method: "POST",
    body,
    headers,
    duplex: "half",
  } as RequestInit);
}

it("decodes UTF-8 split across chunks and accepts exactly the byte limit", async () => {
  const payload = { text: "🙂é中" };
  const encoded = new TextEncoder().encode(JSON.stringify(payload));
  let offset = 0;
  const body = new ReadableStream<Uint8Array>(
    {
      pull(controller) {
        if (offset === encoded.length) controller.close();
        else controller.enqueue(encoded.slice(offset, ++offset));
      },
    },
    { highWaterMark: 0 },
  );
  const request = streamedRequest(body);
  expect(request.headers.has("content-length")).toBe(false);
  expect(await readJson(request)).toEqual(payload);
  expect(body.locked).toBe(false);

  const boundary = JSON.stringify({ text: "x".repeat(maxJsonBodyBytes - 11) });
  expect(new TextEncoder().encode(boundary)).toHaveLength(maxJsonBodyBytes);
  expect(
    await readJson(
      new Request("http://example.com", { method: "POST", body: boundary }),
    ),
  ).toEqual(JSON.parse(boundary));
});

it.each([undefined, "2"])(
  "cancels an oversized Unicode stream with declared length %s before another chunk",
  async (contentLength) => {
    const text = JSON.stringify({ text: "中".repeat(22_000) });
    expect(text.length).toBeLessThan(maxJsonBodyBytes);
    const encoded = new TextEncoder().encode(text);
    expect(encoded.byteLength).toBeGreaterThan(maxJsonBodyBytes);
    let pulls = 0;
    const cancel = vi.fn();
    const body = new ReadableStream<Uint8Array>(
      {
        pull(controller) {
          pulls++;
          if (pulls === 1) controller.enqueue(encoded.slice(0, maxJsonBodyBytes));
          else if (pulls === 2) controller.enqueue(encoded.slice(maxJsonBodyBytes));
          else controller.enqueue(new Uint8Array(maxJsonBodyBytes));
        },
        cancel,
      },
      { highWaterMark: 0 },
    );
    const request = streamedRequest(
      body,
      contentLength ? { "content-length": contentLength } : undefined,
    );
    expect(await readJson(request)).toBeUndefined();
    expect(pulls).toBe(2);
    expect(cancel).toHaveBeenCalledOnce();
    expect(body.locked).toBe(false);
  },
);

it("refuses a failed stream or an absent body and releases the reader", async () => {
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      controller.error(new Error("Connection interrupted"));
    },
  });
  expect(await readJson(streamedRequest(body))).toBeUndefined();
  expect(body.locked).toBe(false);
  expect(
    await readJson(new Request("http://example.com", { method: "POST" })),
  ).toBeUndefined();
});

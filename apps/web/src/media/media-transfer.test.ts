import { afterEach, beforeEach, expect, it, vi } from "vitest";

vi.mock("../api/client-key.ts", () => ({
  clientApiHeaders: (extra: Record<string, string> = {}) => ({
    "x-26-client-key": "test-key",
    ...extra,
  }),
}));

const { putWithProgress } = await import("./media-transfer");

type Sent = { url: string; headers: Record<string, string>; credentials: boolean };
let sent: Sent[] = [];

class FakeXhr {
  status = 200;
  withCredentials = false;
  upload = { onprogress: null };
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  private url = "";
  private headers: Record<string, string> = {};
  open(_method: string, url: string) {
    this.url = url;
  }
  setRequestHeader(name: string, value: string) {
    this.headers[name] = value;
  }
  send() {
    sent.push({
      url: this.url,
      headers: this.headers,
      credentials: this.withCredentials,
    });
    this.onload?.();
  }
}

beforeEach(() => {
  sent = [];
  vi.stubGlobal("XMLHttpRequest", FakeXhr);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

it("sends a presigned bucket upload without our key header or cookies", async () => {
  await putWithProgress(
    "https://0123456789abcdef0123456789abcdef.r2.cloudflarestorage.com/media/tmp/x?X-Amz-Signature=s",
    new Blob(["x"]),
    "image/jpeg",
    () => {},
  );
  expect(sent).toEqual([
    {
      url: expect.any(String),
      headers: { "content-type": "image/jpeg" },
      credentials: false,
    },
  ]);
});

it("keeps the key header and cookies on a same-origin upload", async () => {
  await putWithProgress(
    `${window.location.origin}/api/rooms/ABCDEFGH/media/temporary/id`,
    new Blob(["x"]),
    "image/jpeg",
    () => {},
  );
  expect(sent[0]).toMatchObject({
    headers: { "content-type": "image/jpeg", "x-26-client-key": "test-key" },
    credentials: true,
  });
});

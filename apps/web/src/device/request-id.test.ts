import { describe, expect, it, vi } from "vitest";
import { installRequestIdPolyfill, newRequestId } from "./request-id";

const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe("newRequestId", () => {
  it("uses randomUUID when the browser provides it", () => {
    const cryptoObj = {
      randomUUID: () => "11111111-1111-4111-8111-111111111111",
      getRandomValues: vi.fn(),
    } as unknown as Crypto;
    expect(newRequestId(cryptoObj)).toBe("11111111-1111-4111-8111-111111111111");
    expect(cryptoObj.getRandomValues).not.toHaveBeenCalled();
  });

  it("falls back to getRandomValues when randomUUID is missing (LAN HTTP)", () => {
    const cryptoObj = {
      getRandomValues(target: Uint8Array) {
        target.fill(0xab);
        return target;
      },
    } as unknown as Crypto;
    const id = newRequestId(cryptoObj);
    expect(id).toMatch(uuid);
    expect(id.charAt(14)).toBe("4");
  });
});

describe("installRequestIdPolyfill", () => {
  it("adds randomUUID when absent so join receipts work on Wi-Fi HTTP", () => {
    const cryptoObj = {
      getRandomValues(target: Uint8Array) {
        for (let i = 0; i < target.length; i += 1) target[i] = i;
        return target;
      },
    } as unknown as Crypto;
    installRequestIdPolyfill(cryptoObj);
    expect(typeof cryptoObj.randomUUID).toBe("function");
    expect(cryptoObj.randomUUID()).toMatch(uuid);
  });

  it("leaves an existing randomUUID alone", () => {
    const existing = () => "22222222-2222-4222-8222-222222222222";
    const cryptoObj = {
      randomUUID: existing,
      getRandomValues: vi.fn(),
    } as unknown as Crypto;
    installRequestIdPolyfill(cryptoObj);
    expect(cryptoObj.randomUUID).toBe(existing);
  });
});

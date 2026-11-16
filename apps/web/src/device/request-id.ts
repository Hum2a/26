/**
 * Request receipts need a UUID. Browsers only expose crypto.randomUUID in a
 * secure context (HTTPS or localhost). Phones joining over http://192.168.x.x
 * during local rehearsal are not secure, so randomUUID is missing there.
 * getRandomValues still works on those pages — use it as the fallback.
 */
function uuidFromRandomValues(cryptoObj: Crypto): string {
  if (typeof cryptoObj?.getRandomValues !== "function") {
    throw new Error("This browser cannot create a join receipt id.");
  }
  const bytes = new Uint8Array(16);
  cryptoObj.getRandomValues(bytes);
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function newRequestId(cryptoObj: Crypto = globalThis.crypto): string {
  if (typeof cryptoObj?.randomUUID === "function") {
    return cryptoObj.randomUUID();
  }
  return uuidFromRandomValues(cryptoObj);
}

/** Fill crypto.randomUUID when missing so existing call sites keep working on LAN HTTP. */
export function installRequestIdPolyfill(
  cryptoObj: Crypto = globalThis.crypto,
): void {
  if (typeof cryptoObj?.randomUUID === "function") return;
  if (typeof cryptoObj?.getRandomValues !== "function") return;
  Object.defineProperty(cryptoObj, "randomUUID", {
    configurable: true,
    value: () => uuidFromRandomValues(cryptoObj),
  });
}

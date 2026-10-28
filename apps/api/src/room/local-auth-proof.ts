import { createHmac, timingSafeEqual } from "node:crypto";

export const localAdminProofHeader = "x-26-local-admin-proof";
export function localAdminProof(secret: string, request: Request, now: number): string {
  const message = `${now}\n${request.method}\n${new URL(request.url).pathname}\n${request.headers.get("cookie") ?? ""}`;
  return `${now}.${createHmac("sha256", secret).update(message).digest("hex")}`;
}
export function validLocalAdminProof(
  secret: string | undefined,
  request: Request,
  now: number,
): boolean {
  if (!secret || secret.length < 32) return false;
  const proof = request.headers.get(localAdminProofHeader) ?? "";
  const timestamp = Number(proof.split(".")[0]);
  if (
    !Number.isSafeInteger(timestamp) ||
    timestamp > now + 1000 ||
    now - timestamp > 10_000
  )
    return false;
  const expected = localAdminProof(secret, request, timestamp);
  const actual = new TextEncoder().encode(proof),
    wanted = new TextEncoder().encode(expected);
  return actual.length === wanted.length && timingSafeEqual(actual, wanted);
}

/** Vite's HTTP bridge reads rawHeaders; update both Node header representations. */
export function replaceLocalAdminProof(
  request: {
    headers: Record<string, string | string[] | undefined>;
    rawHeaders: string[];
  },
  proof?: string,
) {
  delete request.headers[localAdminProofHeader];
  for (let i = request.rawHeaders.length - 2; i >= 0; i -= 2)
    if (request.rawHeaders[i]?.toLowerCase() === localAdminProofHeader)
      request.rawHeaders.splice(i, 2);
  if (proof) {
    request.headers[localAdminProofHeader] = proof;
    request.rawHeaders.push(localAdminProofHeader, proof);
  }
}

import { expect, it } from "vitest";
import {
  localAdminProof,
  localAdminProofHeader,
  validLocalAdminProof,
  replaceLocalAdminProof,
} from "../src/room/local-auth-proof.ts";
const key = "a".repeat(64);
const request = (method = "POST", path = "/api/rooms/play", cookie = "test-session") =>
  new Request(`http://localhost${path}`, { method, headers: { cookie } });
it("binds a short-lived local auth proof to the method, path and real session cookie", () => {
  const original = request(),
    proof = localAdminProof(key, original, 10000);
  original.headers.set(localAdminProofHeader, proof);
  expect(validLocalAdminProof(key, original, 11000)).toBe(true);
  expect(validLocalAdminProof(key, original, 21000)).toBe(false);
  expect(validLocalAdminProof(undefined, original, 11000)).toBe(false);
  for (const changed of [
    request("GET"),
    request("POST", "/api/rooms"),
    request("POST", "/api/rooms/play", "another-session"),
  ]) {
    changed.headers.set(localAdminProofHeader, proof);
    expect(validLocalAdminProof(key, changed, 11000)).toBe(false);
  }
});

it("strips untrusted proof headers and forwards a new proof through both Node representations", () => {
  const request = {
    headers: { [localAdminProofHeader]: "caller", cookie: "session" },
    rawHeaders: ["Cookie", "session", "X-26-Local-Admin-Proof", "caller"],
  };
  replaceLocalAdminProof(request);
  expect(request.headers[localAdminProofHeader]).toBeUndefined();
  expect(request.rawHeaders).toEqual(["Cookie", "session"]);
  replaceLocalAdminProof(request, "server-proof");
  expect(request.headers[localAdminProofHeader]).toBe("server-proof");
  expect(request.rawHeaders).toEqual([
    "Cookie",
    "session",
    localAdminProofHeader,
    "server-proof",
  ]);
});

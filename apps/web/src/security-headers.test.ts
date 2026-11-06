import { expect, it } from "vitest";
import headers from "../public/_headers?raw";

function block(path: string): string {
  const normalised = headers.replace(/\r\n/g, "\n");
  const start = normalised.indexOf(`\n${path}\n`);
  expect(start).toBeGreaterThanOrEqual(0);
  const rest = normalised.slice(start + path.length + 2);
  const end = rest.search(/\n\S/);
  return end === -1 ? rest : rest.slice(0, end);
}

it("sends baseline security headers on every page", () => {
  const all = block("/*");
  expect(all).toContain("X-Content-Type-Options: nosniff");
  expect(all).toContain("Referrer-Policy: strict-origin-when-cross-origin");
  expect(all).toContain("Strict-Transport-Security: max-age=31536000");
  // Photo and voice tools need the camera and microphone on this site only.
  expect(all).toContain("camera=(self)");
  expect(all).toContain("microphone=(self)");
  // HSTS stays on this subdomain; other humza.website sites are unaffected.
  expect(all).not.toContain("includeSubDomains");
});

it("allows the real same-origin admin rehearsals while refusing external framing", () => {
  const admin = block("/admin*");
  expect(admin).toContain("X-Frame-Options: SAMEORIGIN");
  expect(admin).toContain("frame-ancestors 'self'");
  // Phone and projector previews are intentionally embedded under /admin too.
  expect(admin).not.toContain("X-Frame-Options: DENY");
  expect(admin).not.toContain("frame-ancestors 'none'");
});

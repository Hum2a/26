import { expect, it } from "vitest";
import headers from "../public/_headers?raw";

function block(path: string): string {
  const start = headers.indexOf(`\n${path}\n`);
  expect(start).toBeGreaterThanOrEqual(0);
  const rest = headers.slice(start + path.length + 2);
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

it("never lets another site frame the admin console", () => {
  const admin = block("/admin*");
  expect(admin).toContain("X-Frame-Options: DENY");
  expect(admin).toContain("frame-ancestors 'none'");
});

import { expect, it } from "vitest";
import { renderPartyEmail } from "@26/emails";

it("renders the actual HTML email inside the Workers runtime without Node-only delivery assumptions", async () => {
  const html = await renderPartyEmail({
    subject: "Sign in to 26",
    text: "Your sign-in code: 123456\n\nEnter this code on the admin sign-in page.\n\nhttps://26.example/admin/confirm?token=stand-in",
  });
  expect(html).toContain("Your backstage pass.");
  expect(html).toContain("123456");
  expect(html).toContain('href="https://26.example/admin/confirm?token=stand-in"');
  expect(html).not.toContain("<script");
});

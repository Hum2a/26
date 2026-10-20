import { expect, it, vi } from "vitest";
import { renderPartyEmail, emailPresentation } from "@26/emails";
import { verificationMessage, resultsMessage } from "../src/results/messages.ts";
import { createEmail } from "../src/auth/create-email.ts";
import type { AuthBindings } from "../src/auth/bindings.ts";
import type { AppDatabase } from "../src/auth/create-database.ts";
const provider = vi.hoisted(() => ({
  send: vi.fn().mockResolvedValue({ data: { id: "fixture" }, error: null }),
}));
vi.mock("resend", () => ({
  Resend: class {
    emails = provider;
  },
}));

it("renders responsive code/link, verification and results emails with accessible live text", async () => {
  const fixtures = [
    {
      subject: "Sign in to 26",
      text: "Your sign-in code: 123456\n\nEnter this code on the admin sign-in page.\n\nConfirm sign-in for 26: https://26.example/admin/confirm?token=stand-in\n\nExpires in five minutes.",
    },
    verificationMessage({
      origin: "https://26.example",
      gameId: "fixture",
      token: "stand-in",
    }),
    resultsMessage({
      origin: "https://26.example",
      gameId: "fixture",
      token: "stand-in",
      nickname: "Amina",
      position: 2,
      points: 640,
      given: 3,
      received: 4,
    }),
  ];
  for (const fixture of fixtures) {
    const html = await renderPartyEmail(fixture);
    expect(html).toContain('lang="en-GB"');
    expect(html).toContain("@media only screen");
    expect(html).toContain("26.humza.website");
    expect(html).toContain('href="https://26.example/');
    expect(html).not.toContain("<script");
    expect(html).not.toContain("<img");
    expect(html.length).toBeLessThan(50_000);
  }
  const login = await renderPartyEmail(fixtures[0]!);
  expect(login).toContain("123456");
  expect(login).toContain("Open admin sign-in");
  expect(emailPresentation(fixtures[2]!).stats).toEqual([
    { label: "YOUR PLACE", value: "#2" },
    { label: "POINTS", value: "640" },
    { label: "TROLLS GIVEN / RECEIVED", value: "3 / 4" },
  ]);
});
it("escapes guest content and never turns unsafe protocols into action links", async () => {
  const html = await renderPartyEmail({
    subject: "<script>alert(1)</script>",
    text: "<img src=x onerror=alert(1)>\n\njavascript:alert(1)",
  });
  expect(html).not.toContain("<script>");
  expect(html).not.toContain("<img src=x");
  expect(html).not.toContain('href="javascript:');
  expect(html).toContain("&lt;img");
});
it("sends HTML and the unchanged plain-text fallback under the original provider idempotency key", async () => {
  const sender = createEmail(
    {
      APP_ENV: "production",
      RESEND_API_KEY: "test-fixture",
      RESEND_FROM: "26 <party@example.com>",
    } as AuthBindings,
    {} as AppDatabase,
  );
  const message = {
    to: "guest@example.com",
    subject: "Your party result",
    text: "Amina, you finished in position 2 with 640 points.\n\nhttps://26.example/r/fixture?recap=stand-in",
    idempotencyKey: "delivery-fixture",
  };
  await sender.send(message);
  expect(provider.send).toHaveBeenCalledWith(
    expect.objectContaining({
      to: message.to,
      text: message.text,
      html: expect.stringContaining("What a night."),
    }),
    { idempotencyKey: "delivery-fixture" },
  );
});

it("uses the final server-generated recap link even when a nickname contains a URL", async () => {
  const message = resultsMessage({
    origin: "https://26.example",
    gameId: "fixture",
    token: "stand-in",
    nickname: "https://evil.example",
    position: 2,
    points: 640,
    given: 0,
    received: 0,
  });
  const content = emailPresentation(message);
  expect(content.link).toBe("https://26.example/r/fixture?recap=stand-in");
  const html = await renderPartyEmail(message);
  expect(html).not.toContain('href="https://evil.example');
  expect(html).toContain("https://evil.example, you finished");
});

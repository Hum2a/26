import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

test("admin signs in with an emailed code and keeps the original magic-link alternative", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/admin/login?returnTo=%2Fadmin%2Frooms");
  await page.getByLabel("Administrator email").fill("humzab1711@hotmail.com");
  const inbox = page.waitForResponse(
    (response) => response.url().endsWith("/api/dev/inbox") && response.ok(),
  );
  await page.getByRole("button", { name: "Email me a code and link" }).click();
  const mail = (await (await inbox).json()) as {
    messages: { text: string; html: string }[];
  };
  const code = mail.messages[0]!.text.match(/Your sign-in code: (\d{6})/)![1]!;
  expect(mail.messages[0]!.html).toContain("Your backstage pass.");
  await expect(
    page.getByRole("link", { name: "Open the sign-in confirmation" }).first(),
  ).toBeVisible();
  const field = page.getByLabel("Six-digit sign-in code");
  await expect(field).toBeFocused();
  for (const width of [320, 390, 430]) {
    await page.setViewportSize({ width, height: 844 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: ".codex/previews/emails/code-sign-in.png",
    fullPage: true,
  });
  await field.fill(code === "000000" ? "111111" : "000000");
  await page.getByRole("button", { name: "Sign in with code" }).click();
  await expect(page.getByRole("status")).toContainText("incorrect or has expired");
  await field.fill(code);
  await page.getByRole("button", { name: "Sign in with code" }).click();
  await expect(page).toHaveURL(/\/admin\/rooms$/);
  await expect(page.getByRole("button", { name: "Create a lobby" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: "Create a lobby" })).toBeVisible();
});

test("branded email previews are readable at phone and desktop widths", async ({
  page,
}) => {
  await promisify(execFile)(process.execPath, ["scripts/email-preview.mjs"], {
    cwd: process.cwd(),
    timeout: 30_000,
  });
  for (const id of ["sign-in", "verification", "results"]) {
    const html = await readFile(`.codex/previews/emails/${id}.html`, "utf8");
    await page.setContent(html);
    for (const width of [320, 390, 900]) {
      await page.setViewportSize({ width, height: 1000 });
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      ).toBe(true);
      await expect(page.getByRole("heading")).toBeVisible();
      if (width === 390 || width === 900)
        await page.screenshot({
          path: `.codex/previews/emails/${id}-${width}.png`,
          fullPage: true,
        });
    }
  }
});

import { expect, test } from "@playwright/test";

test("Who said it sourced rounds have usable private A/B phone rehearsals", async ({
  page,
}) => {
  test.setTimeout(180_000);
  await page.goto("/admin/phone-preview/birthday-draft/who-said-it-empathy");
  await page.getByRole("link", { name: "Admin sign in →" }).click();
  await page.getByLabel("Administrator email").fill("humzab1711@hotmail.com");
  await page.getByRole("button", { name: "Email me a sign-in link" }).click();
  await page
    .getByRole("link", { name: "Open the sign-in confirmation" })
    .first()
    .click();
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  for (const slug of [
    "empathy",
    "freedom",
    "sleep",
    "salvation",
    "crying-ceo",
    "nihilism",
    "technology",
    "performance-review",
    "absolute-force",
    "grief-pipeline",
  ]) {
    await page.goto(`/admin/phone-preview/birthday-draft/who-said-it-${slug}`);
    await expect(page.getByRole("heading", { name: "Who said it?" })).toBeVisible();
    await expect(
      page.getByText(/quote and its attribution are unverified/),
    ).toHaveCount(0);
    await expect(page.locator("button.who-said-it-option")).toHaveCount(2);
    const payload = await page.request.get(
      `/api/admin/content/birthday-draft/questions/who-said-it-${slug}/preview`,
    );
    const data = await payload.json();
    for (const field of ["correctOption", "correctOptionId", "notes", "explanation"])
      expect(data.question).not.toHaveProperty(field);
    for (const width of [320, 390, 430]) {
      await page.setViewportSize({ width, height: 844 });
      await expect(page.locator("button.who-said-it-option").last()).toBeInViewport();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      ).toBe(false);
    }
    await page.getByRole("button", { name: "Pause preview" }).click();
    await expect(page.locator("button.who-said-it-option").first()).toBeDisabled();
    await page.getByRole("button", { name: "Resume preview" }).click();
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.locator("button.who-said-it-option").last().click();
    await expect(page.locator("button.who-said-it-option").last()).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await page.getByRole("button", { name: "Send choice" }).click();
    await expect(page.getByRole("button", { name: "Locked in ✓" })).toBeDisabled();
    await expect(page.getByText("Send choice", { exact: true })).toHaveCount(0);
  }
  await page.screenshot({
    path: ".codex/previews/who-said-it/phone.png",
    fullPage: true,
  });
});

test("Who said it stage keeps the quote, options and stand-in reveal legible", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/design?q=who-said-it&surface=stage&phase=collect&still=1");
  await expect(page.getByRole("heading", { name: "Who said it?" })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator(".who-said-it-option").last()).toHaveCSS("opacity", "1");
  expect(
    await page
      .locator(".who-said-it-stage")
      .evaluate((el) => el.getBoundingClientRect().bottom <= innerHeight),
  ).toBe(true);
  await expect(page.getByText(/^It was /)).toHaveCount(0);
  await page.getByRole("combobox", { name: /^Phase/ }).selectOption("reveal");
  await expect(page.getByText(/^It was /)).toBeVisible();
  await page.screenshot({
    path: ".codex/previews/who-said-it/stage-reveal.png",
    fullPage: true,
  });
});

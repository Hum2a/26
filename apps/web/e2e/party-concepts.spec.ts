import { expect, test } from "@playwright/test";

test("a large birthday catalogue retains ready rehearsals and labels concept placeholders", async ({
  page,
}) => {
  test.setTimeout(150_000);
  await page.goto("/admin/phone-preview/birthday-draft/subculture-gurners");
  await page.getByRole("link", { name: "Admin sign in →" }).click();
  await page.getByLabel("Administrator email").fill("humzab1711@hotmail.com");
  await page.getByRole("button", { name: "Email me a sign-in link" }).click();
  await page
    .getByRole("link", { name: "Open the sign-in confirmation" })
    .first()
    .click();
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  for (const id of [
    "subculture-cheese-rollers",
    "subculture-gurners",
    "subculture-puddle-stompers",
    "subculture-ranters-muggletonians",
  ]) {
    await page.goto(`/admin/phone-preview/birthday-draft/${id}`);
    await expect(page.getByRole("button", { name: "Real", exact: true })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Made up", exact: true }),
    ).toBeVisible();
    await expect(page.locator(".question-progress")).toHaveText("1 / 1");
    for (const width of [320, 390, 430]) {
      await page.setViewportSize({ width, height: 844 });
      await expect(
        page.getByRole("button", { name: "Made up", exact: true }),
      ).toBeInViewport();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      ).toBe(false);
    }
    await page.getByRole("button", { name: "Made up", exact: true }).click();
    await page.getByRole("button", { name: "Send answer", exact: true }).click();
    await expect(page.getByRole("button", { name: "Locked in ✓" })).toBeDisabled();
  }
  await page.goto("/admin/phone-preview/birthday-draft/ai-turing-test");
  await expect(page.getByText(/No genuine Humza response/)).toHaveCount(0);
  await expect(
    page.getByRole("button", {
      name: "Everything can have its own identity.",
      exact: true,
    }),
  ).toBeEnabled();
  await page.goto("/admin/phone-preview/birthday-draft/dial-pop-culture");
  await expect(page.getByRole("slider", { name: "Estimate" })).toBeEnabled();
  await page.goto(
    "/admin/phone-preview/birthday-draft/heathrow-search-query?phase=vote",
  );
  await expect(
    page.getByRole("button", { name: "Sample line 1", exact: true }),
  ).toBeEnabled();
  await expect(
    page.getByRole("button", { name: "Sample line 2", exact: true }),
  ).toBeEnabled();
  await page.goto("/admin/phone-preview/birthday-draft/guess-tab-oyster");
  await expect(page.getByLabel("Your price (£)")).toBeEnabled();
  await page.goto("/admin/phone-preview/birthday-draft/favourite-pokemon");
  await expect(page.getByRole("button", { name: "Mudkip", exact: true })).toBeVisible();
});

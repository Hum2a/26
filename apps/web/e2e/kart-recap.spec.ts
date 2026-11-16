import { expect, test } from "@playwright/test";

test("actual reducer recaps rehearse phone, stage and host results with truthful ending reasons", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/admin");
  await page.getByLabel("Administrator email").fill("humzab1711@hotmail.com");
  await page.getByRole("button", { name: "Email me a code and link" }).click();
  await page
    .getByRole("link", { name: "Open the sign-in confirmation" })
    .first()
    .click();
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.goto("/admin/kart?view=recap");
  await expect(
    page.getByRole("region", { name: "Race recap", exact: true }),
  ).toHaveCount(3);
  await page
    .getByRole("combobox", { name: "Phone driver", exact: true })
    .selectOption("stand-in-b");
  await expect(
    page
      .locator(".kart-phone")
      .getByRole("heading", { name: "Time’s up", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Rehearse host early end", exact: true })
    .click();
  await expect(
    page
      .locator(".kart-phone")
      .getByRole("heading", { name: "Race ended", exact: true }),
  ).toBeVisible();
  await expect(
    page.locator(".kart-phone").getByText("DNF — host ended race", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Rehearse recovery", exact: true }).click();
  await expect(page.getByText(/Back to track 1 time/).first()).toBeVisible();
  await page
    .getByRole("button", { name: "Rehearse all finished", exact: true })
    .click();
  await expect(page.getByText(/Every driver finished/)).toHaveCount(3);
  await page.screenshot({
    path: ".codex/previews/kart/phase6-race-recap.png",
    fullPage: true,
  });
  for (const viewport of [
    { width: 320, height: 700 },
    { width: 390, height: 844 },
    { width: 430, height: 900 },
    { width: 740, height: 360 },
  ]) {
    await page.setViewportSize(viewport);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
    ).toBe(true);
  }
  await page.getByRole("button", { name: "Rehearse older race", exact: true }).click();
  await expect(page.getByText(/not recorded for this older race/)).toHaveCount(3);
  expect(errors).toEqual([]);
});

import { expect, test } from "@playwright/test";

test("completed drafts rehearse their actual phone actions, voting beats and safe public fields", async ({
  page,
}) => {
  test.setTimeout(180_000);
  await page.goto("/admin/phone-preview/birthday-draft/common-password");
  await page.getByRole("link", { name: "Admin sign in →" }).click();
  await page.getByLabel("Administrator email").fill("humzab1711@hotmail.com");
  await page.getByRole("button", { name: "Email me a sign-in link" }).click();
  await page
    .getByRole("link", { name: "Open the sign-in confirmation" })
    .first()
    .click();
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  for (const id of [
    "common-password",
    "christianity-branches",
    "guess-tab-oyster",
    "guess-tab-car-insurance",
    "guess-tab-soho-pint",
    "guess-tab-ev-charge",
    "rank-driving-sins",
    "dial-pop-culture",
    "dial-london-geography",
    "dial-british-politics",
    "heathrow-search-query",
    "dating-exit-excuse",
  ]) {
    await page.goto(`/admin/phone-preview/birthday-draft/${id}`);
    const data = await (
      await page.request.get(
        `/api/admin/content/birthday-draft/questions/${id}/preview`,
      )
    ).json();
    expect(data.interactive).toBe(true);
    for (const field of [
      "truth",
      "correctOptionId",
      "correctOptionIds",
      "accepted",
      "notes",
      "requirements",
      "explanation",
    ])
      expect(data.question).not.toHaveProperty(field);
    for (const width of [320, 390, 430]) {
      await page.setViewportSize({ width, height: 844 });
      await expect(page.locator(".phone-prompt")).toBeVisible();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      ).toBe(false);
    }
  }
  await page.goto(
    "/admin/phone-preview/birthday-draft/christianity-branches?phase=prompt",
  );
  await expect(
    page.getByRole("button", { name: "muggletonians", exact: true }),
  ).toBeDisabled();
  await page.goto("/admin/phone-preview/birthday-draft/christianity-branches");
  for (const option of ["unorthodox", "jisraeli", "muggletonians"])
    await page.getByRole("button", { name: option, exact: true }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "3 selected" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Pause preview" }).click();
  await expect(
    page.getByRole("button", { name: "muggletonians", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Resume preview" }).click();
  await page.setViewportSize({ width: 320, height: 844 });
  await page.screenshot({
    path: ".codex/previews/draft-polish/multiple-selected.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Send selections" }).click();
  await expect(page.getByRole("button", { name: "Locked in ✓" })).toBeDisabled();

  await page.goto("/admin/phone-preview/birthday-draft/common-password");
  await page.getByLabel("Your made-up password").fill("fictional-preview");
  await page.getByRole("button", { name: "Send answer", exact: true }).click();
  await expect(page.getByRole("button", { name: "Locked in ✓" })).toBeDisabled();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/admin/phone-preview/birthday-draft/guess-tab-soho-pint");
  const price = page.getByLabel("Your price (£)");
  await expect(page.getByRole("button", { name: "Lock in price" })).toBeDisabled();
  await price.fill("4.25");
  await page.screenshot({
    path: ".codex/previews/draft-polish/price.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Lock in price" }).click();
  await expect(page.getByRole("button", { name: "Locked in ✓" })).toBeDisabled();

  await page.goto("/admin/phone-preview/birthday-draft/rank-driving-sins");
  await page
    .getByRole("button", {
      name: "Move Sitting in the middle lane of the M25 at 58 mph down",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("list", { name: "Your order" }).getByRole("listitem").first(),
  ).toContainText("Not indicating");
  await page.screenshot({
    path: ".codex/previews/draft-polish/ranking.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Send ranking" }).click();
  await expect(page.getByRole("button", { name: "Locked in ✓" })).toBeDisabled();

  for (const id of ["heathrow-search-query", "dating-exit-excuse"]) {
    await page.goto(`/admin/phone-preview/birthday-draft/${id}?phase=vote`);
    await expect(page.getByText(/Stand-in submissions only/)).toBeVisible();
    if (id === "heathrow-search-query")
      await expect(page.locator("[data-ballot] button")).toHaveCount(2);
    else
      await expect(
        page.getByRole("heading", { name: "Most Smooth", exact: true }),
      ).toBeVisible();
    await page.screenshot({
      path: `.codex/previews/draft-polish/${id}.png`,
      fullPage: true,
    });
    await page.getByRole("button", { name: "Sample line 1", exact: true }).click();
    await page.getByRole("button", { name: "Send vote", exact: true }).click();
    await expect(page.getByRole("button", { name: "Locked in ✓" })).toBeDisabled();
    await page.getByRole("button", { name: "Next rehearsal ballot" }).click();
    await expect(
      page.getByRole("button", { name: "Send vote", exact: true }),
    ).toBeDisabled();
    if (id === "dating-exit-excuse") {
      await expect(
        page.getByRole("heading", { name: "Most Brutal", exact: true }),
      ).toBeVisible();
      await page.getByRole("button", { name: "Next rehearsal ballot" }).click();
      await expect(
        page.getByRole("heading", { name: "Instantly Causes a Scene", exact: true }),
      ).toBeVisible();
    }
  }
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 740, height: 360 });
  await page.goto("/admin/phone-preview/birthday-draft/rank-driving-sins");
  await expect(page.getByRole("button", { name: "Send ranking" })).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
  ).toBe(false);
});

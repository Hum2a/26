import { expect, test } from "@playwright/test";

test("runs staged real bot connections and accepted answers without guests", async ({
  page,
}) => {
  test.setTimeout(240_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/admin");
  await page.bringToFront();
  await page.getByLabel("Administrator email").fill("humzab1711@hotmail.com");
  await page.getByRole("button", { name: "Email me a code and link" }).click();
  await page
    .getByRole("link", { name: "Open the sign-in confirmation" })
    .first()
    .click();
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.getByRole("button", { name: "Create a lobby" }).click();
  // The local Worker can still be warming after sign-in. Exercise its real retry UI.
  for (let attempt = 0; attempt < 3; attempt++) {
    const retry = page.getByRole("button", { name: "Try again", exact: true });
    await expect(page.locator(".admin-room-code").or(retry)).toBeVisible({
      timeout: 45_000,
    });
    if (await page.locator(".admin-room-code").isVisible()) break;
    await retry.click();
  }
  await expect(page.locator(".admin-room-code")).toBeVisible({ timeout: 45_000 });
  await page.getByRole("link", { name: "Developer tools", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Developer tools" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Set 10 bots" })).toBeEnabled({
    timeout: 30_000,
  });
  const results = page.getByRole("region", { name: "Rehearsal results" });
  await page.getByRole("button", { name: "Set 10 bots" }).click();
  await expect(results).toContainText("10 / 10", { timeout: 45_000 });
  await page.getByRole("button", { name: "Set 100 bots" }).click();
  await expect(results).toContainText("100 / 100", { timeout: 60_000 });
  await page.screenshot({
    path: "artifacts/browser-checks/developer-desktop.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Enable automatic answers" }).click();
  await page
    .getByRole("button", { name: "Start illustrative demo", exact: true })
    .click();
  // Ordinary server clocks open collection; no client phase or scoring shortcuts.
  await expect(
    results
      .locator("div")
      .filter({ has: page.getByText("Answers this round", { exact: true }) }),
  ).toContainText("100", { timeout: 45_000 });
  await page.getByRole("button", { name: "Pause bot answers" }).click();
  await page.getByRole("button", { name: "Reconnect all bots" }).click();
  await expect(results).toContainText("100 / 100", { timeout: 60_000 });
  await page.getByRole("button", { name: "Remove all bots" }).click();
  await expect(page.getByRole("region", { name: "Bot population" })).toContainText(
    "0 bots",
  );
  for (const width of [320, 390, 430, 740]) {
    await page.setViewportSize({ width, height: width === 740 ? 390 : 844 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
    ).toBe(true);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "artifacts/browser-checks/developer-phone.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
});

test("creates an isolated automatic rehearsal with a real phone, question reset and failure history", async ({
  page,
  context,
}) => {
  test.setTimeout(240_000);
  await page.goto("/admin");
  await page.bringToFront();
  await page.getByLabel("Administrator email").fill("humzab1711@hotmail.com");
  await page.getByRole("button", { name: "Email me a code and link" }).click();
  await page
    .getByRole("link", { name: "Open the sign-in confirmation" })
    .first()
    .click();
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.getByRole("button", { name: /Rehearse without guests/ }).click();
  await page.getByLabel("Rehearsal bot count").fill("4");
  await page.getByLabel("Pause at each reveal").check();
  await page.getByLabel("Setup name").fill("Browser rehearsal");
  await page.getByRole("button", { name: "Save setup", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Load Browser rehearsal" }),
  ).toBeVisible();
  const stagePromise = context.waitForEvent("page");
  await page.getByRole("button", { name: "Start fresh rehearsal" }).click();
  let stage = await stagePromise;
  await page.bringToFront();
  for (let attempt = 0; attempt < 3; attempt++) {
    const retry = page.getByRole("button", {
      name: "Retry fresh rehearsal",
      exact: true,
    });
    const ready = page.getByRole("heading", { name: "Developer tools", exact: true });
    await expect(ready.or(retry)).toBeVisible({ timeout: 60_000 });
    if (await ready.isVisible()) break;
    const nextStage = context.waitForEvent("page");
    await retry.click();
    stage = await nextStage;
    await page.bringToFront();
  }
  await expect(
    page.getByRole("heading", { name: "Developer tools", exact: true }),
  ).toBeVisible({ timeout: 60_000 });
  const results = page.getByRole("region", { name: "Rehearsal results" });
  await expect(results).toContainText("4 / 4", { timeout: 60_000 });
  await expect(page.getByRole("region", { name: "Rehearsal controls" })).toContainText(
    "Paused at the reveal",
    { timeout: 45_000 },
  );
  await expect(stage.locator(".is-presenting")).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "Open test phone", exact: true }).click();
  const phone = page.frameLocator('iframe[title="Live rehearsal phone"]');
  await expect(phone.locator("body")).toContainText("Phone", { timeout: 30_000 });
  await expect(
    phone.getByRole("heading", { name: "Rehearsal phone", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Repeat this question", exact: true }).click();
  await expect(results).toContainText("intro");
  await page
    .getByRole("button", { name: "Disconnect 25% of bots", exact: true })
    .click();
  await expect(results).toContainText("4 / 4", { timeout: 30_000 });
  await expect(page.getByRole("region", { name: "Rehearsal timeline" })).toContainText(
    "Disconnect 25% of bots",
  );
  await page
    .getByRole("button", { name: "Lose host for five seconds", exact: true })
    .click();
  await expect(page.getByRole("button", { name: "Run or continue show" })).toBeEnabled({
    timeout: 30_000,
  });
  await expect(results).toContainText("4 / 4");
  for (const width of [320, 390, 430, 740]) {
    await page.setViewportSize({ width, height: width === 740 ? 390 : 844 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
    ).toBe(true);
  }
  await stage.close();
});

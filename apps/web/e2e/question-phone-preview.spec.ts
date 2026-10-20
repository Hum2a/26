import { expect, test } from "@playwright/test";

test("a full-size phone preview supports signing in on another device", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await page.goto("/admin/phone-preview/birthday-draft/favourite-pokemon");
  await page.getByRole("link", { name: "Admin sign in →" }).click();
  await page.getByLabel("Administrator email").fill("humzab1711@hotmail.com");
  await page.getByRole("button", { name: "Email me a code and link" }).click();
  await page
    .getByRole("link", { name: "Open the sign-in confirmation" })
    .first()
    .click();
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(
    /\/admin\/phone-preview\/birthday-draft\/favourite-pokemon$/,
  );
  await expect(page.getByRole("region", { name: "Question experience" })).toBeVisible();
});

test("pack phone rehearsal draws real designs, isolates inputs and explains drafts", async ({
  page,
  browser,
}) => {
  test.setTimeout(180_000);
  const sockets: string[] = [];
  page.on("websocket", (socket) => {
    if (new URL(socket.url()).pathname.startsWith("/ws/")) sockets.push(socket.url());
  });
  await page.goto("/admin/content");
  const email = page.getByLabel("Administrator email");
  const retry = page.getByRole("button", { name: "Try again", exact: true });
  await expect(email.or(retry)).toBeVisible({ timeout: 20_000 });
  if (await retry.isVisible()) await retry.click();
  await email.fill("humzab1711@hotmail.com");
  await page.getByRole("button", { name: "Email me a code and link" }).click();
  await page
    .getByRole("link", { name: "Open the sign-in confirmation" })
    .first()
    .click();
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByLabel("Search questions")).toBeVisible();
  await page.getByLabel("Search questions").fill("pokemon");
  await page.locator('[data-question-id="favourite-pokemon"]').click();
  await expect(
    page.getByRole("button", { name: "Next →", exact: true }),
  ).toBeDisabled();
  await page.getByRole("link", { name: /^View / }).click();
  await page.getByRole("link", { name: /Back to question packs/ }).click();
  await expect(page.getByLabel("Search questions")).toHaveValue("pokemon");
  await expect(page.locator('[data-question-id="favourite-pokemon"]')).toHaveAttribute(
    "aria-current",
    "true",
  );
  await page.getByLabel("Search questions").fill("");
  await page.locator('[data-question-id="favourite-pokemon"]').click();
  const phone = page.frameLocator('iframe[title="Interactive phone preview"]');
  await expect(phone.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(phone.getByText("Pick one, then send your answer")).toBeVisible();
  await phone.locator(".question-choice-grid button").first().click();
  await expect(phone.getByRole("button", { name: "Send answer" })).toBeEnabled();
  await phone.getByRole("button", { name: "Send answer" }).click();
  await expect(phone.getByRole("button", { name: "Locked in ✓" })).toBeDisabled();
  await expect(phone.getByText("Locked in — watch the stage")).toBeVisible();
  await page.getByRole("button", { name: "Reset preview" }).click();
  await expect(phone.getByRole("button", { name: "Send answer" })).toBeDisabled();
  await phone.getByRole("button", { name: "Pause preview" }).click();
  await expect(phone.getByText("Paused — hang tight")).toBeVisible();
  await expect(phone.locator(".question-choice-grid button").first()).toBeDisabled();
  await page.getByRole("button", { name: "Get ready", exact: true }).click();
  await expect(phone.getByText("Get ready — listen to the question")).toBeVisible();
  await expect(phone.locator(".question-choice-grid button").first()).toBeDisabled();
  await page.getByRole("button", { name: "Answering", exact: true }).click();

  for (const width of [320, 390, 430]) {
    await page.getByLabel("Phone width").selectOption(String(width));
    await expect(phone.getByRole("heading", { level: 1 })).toBeVisible();
    const layout = await phone.locator("body").evaluate(() => ({
      overflow: document.documentElement.scrollWidth > innerWidth,
      buttons: [...document.querySelectorAll(".question-choice-grid button")].map(
        (button) => ({
          bottom: button.getBoundingClientRect().bottom,
          height: button.getBoundingClientRect().height,
        }),
      ),
      height: innerHeight,
    }));
    expect(layout.overflow).toBe(false);
    expect(
      layout.buttons.every(
        (button) => button.height >= 48 && button.bottom <= layout.height,
      ),
    ).toBe(true);
    await page
      .locator('iframe[title="Interactive phone preview"]')
      .screenshot({ path: `.codex/previews/question-experience/phone-${width}.png` });
  }
  for (const width of [320, 390, 430]) {
    await page.setViewportSize({ width, height: 844 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: ".codex/previews/question-experience/admin-preview.png",
    fullPage: true,
  });
  await page.locator('[data-question-id="favourite-genre"]').click();
  await expect(phone.locator(".design-phone")).toBeVisible();
  await page.locator('[data-question-id="christianity-branches"]').click();
  await expect(phone.getByText(/requested interaction is not implemented/)).toHaveCount(
    0,
  );
  await expect(
    phone.getByRole("button", { name: "muggletonians", exact: true }),
  ).toBeEnabled();
  await page.locator('[data-question-id="inflation-freddo"]').click();
  await expect(phone.getByRole("slider", { name: "Estimate" })).toBeVisible();
  await expect(phone.getByText(/typically 20p in 2012/)).toBeVisible();
  expect(sockets).toEqual([]);
  const anonymous = await browser.newContext();
  const denied = await anonymous.request.get(
    "http://localhost:4173/api/admin/content/birthday-draft/questions/favourite-pokemon/preview",
  );
  expect([401, 403]).toContain(denied.status());
  expect(await denied.text()).not.toContain("options");
  await anonymous.close();
});

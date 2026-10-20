import { expect, test } from "@playwright/test";

test("Wordle's development stage uses an explicit stand-in reveal", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/design?q=glyph&surface=stage&phase=collect&still=1");
  await expect(page.getByLabel("Five mystery letters")).toBeVisible();
  await expect(page.getByText(/Development sample:/)).toBeVisible();
  await expect(page.locator(".glyph-stage")).not.toContainText("VULGY");
  expect(
    await page
      .locator(".glyph-stage")
      .evaluate((el) => el.getBoundingClientRect().bottom <= innerHeight),
  ).toBe(true);
  await page.screenshot({
    path: ".codex/previews/wordle/stage-collect.png",
    fullPage: true,
  });
  await page.getByRole("combobox", { name: /^Phase/ }).selectOption("reveal");
  await expect(page.getByLabel("The word was WORDS")).toBeVisible();
  await page.screenshot({
    path: ".codex/previews/wordle/stage-reveal.png",
    fullPage: true,
  });
});

test("birthday Wordle checks guesses privately in the real phone rehearsal", async ({
  page,
  browser,
}) => {
  test.setTimeout(150_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/admin/phone-preview/birthday-draft/complete-a-wordle");
  await page.getByRole("link", { name: "Admin sign in →" }).click();
  await page.getByLabel("Administrator email").fill("humzab1711@hotmail.com");
  await page.getByRole("button", { name: "Email me a code and link" }).click();
  await page
    .getByRole("link", { name: "Open the sign-in confirmation" })
    .first()
    .click();
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("region", { name: "Wordle game" })).toBeVisible();
  const sockets: string[] = [];
  page.on("websocket", (socket) => sockets.push(socket.url()));
  const publicData = await page.request.get(
    "/api/admin/content/birthday-draft/questions/complete-a-wordle/preview",
  );
  expect(await publicData.text()).not.toContain("VULGY");
  const game = page.getByRole("region", { name: "Wordle game" });
  await game.focus();
  await page.keyboard.type("ZZZZZ");
  await page.getByRole("button", { name: "Check word" }).click();
  await expect(page.getByRole("alert")).toContainText("isn’t in the word list");
  await expect(page.locator(".glyph-cell[data-mark]")).toHaveCount(0);
  await game.focus();
  for (let i = 0; i < 5; i++) await page.keyboard.press("Backspace");
  await page.keyboard.type("APPLE");
  await page.keyboard.press("Enter");
  await expect(page.locator(".glyph-cell[data-mark]")).toHaveCount(5);
  await expect(page.getByText("Guess 2 of 6", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Pause preview" }).click();
  await expect(page.getByRole("button", { name: "V", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Resume preview" }).click();
  for (const width of [320, 390, 430]) {
    await page.setViewportSize({ width, height: 844 });
    await expect(page.getByRole("button", { name: "Check word" })).toBeVisible();
    const bounds = await page.locator(".glyph-keyboard").evaluate((el) => ({
      bottom: el.getBoundingClientRect().bottom,
      height: innerHeight,
      overflow: document.documentElement.scrollWidth > innerWidth,
    }));
    expect(bounds.overflow).toBe(false);
    expect(bounds.bottom).toBeLessThanOrEqual(bounds.height);
    await page.screenshot({
      path: `.codex/previews/wordle/phone-${width}.png`,
      fullPage: true,
    });
  }
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const letter of "VULGY")
    await page.getByRole("button", { name: new RegExp(`^${letter}(,|$)`) }).click();
  await page.getByRole("button", { name: "Check word" }).click();
  await expect(page.getByText("Solved in 2! Watch the stage.")).toBeVisible();
  await expect(page.getByRole("button", { name: /^V/ })).toBeDisabled();
  expect(sockets).toEqual([]);
  const anonymous = await browser.newContext();
  const denied = await anonymous.request.post(
    "http://localhost:4173/api/admin/content/birthday-draft/questions/complete-a-wordle/preview/wordle",
    {
      headers: { origin: "http://localhost:4173" },
      data: { history: [], word: "APPLE" },
    },
  );
  expect([401, 403]).toContain(denied.status());
  await anonymous.close();
});

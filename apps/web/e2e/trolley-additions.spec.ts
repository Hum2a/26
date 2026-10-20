import { expect, test } from "@playwright/test";

test("three escalating trolley polls rehearse with explicit consequences on phones", async ({
  page,
}) => {
  test.setTimeout(150_000);
  await page.goto("/admin/phone-preview/birthday-draft/trolley-your-mum");
  await page.getByRole("link", { name: "Admin sign in →" }).click();
  await page.getByLabel("Administrator email").fill("humzab1711@hotmail.com");
  await page.getByRole("button", { name: "Email me a sign-in link" }).click();
  await page
    .getByRole("link", { name: "Open the sign-in confirmation" })
    .first()
    .click();
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  for (const id of [
    "trolley-your-mum",
    "trolley-mamdani-africa",
    "trolley-freddo-multiverse",
  ]) {
    await page.goto(`/admin/phone-preview/birthday-draft/${id}`);
    const choices = page.locator(".trolley-choice");
    await expect(choices).toHaveCount(2);
    await expect(choices.first()).toContainText("Pull: save");
    await expect(choices.last()).toContainText("Leave: save");
    const payload = await page.request.get(
      `/api/admin/content/birthday-draft/questions/${id}/preview`,
    );
    const body = await payload.json();
    expect(body.question.outcome).toBe("poll");
    expect(body.question.points).toBe(0);
    for (const field of ["correctOptionId", "notes", "explanation"])
      expect(body.question).not.toHaveProperty(field);
    for (const width of [320, 390, 430]) {
      await page.setViewportSize({ width, height: 844 });
      await expect(choices.last()).toBeInViewport();
      await page.screenshot({
        path: `.codex/previews/trolley/${id}-${width}-answering.png`,
        fullPage: true,
      });
      const bounds = await choices.evaluateAll((buttons) =>
        buttons.map((button) => ({
          rect: button.getBoundingClientRect().toJSON(),
          dock: document.querySelector(".phone-dock")!.getBoundingClientRect().toJSON(),
        })),
      );
      await expect
        .poll(
          () =>
            choices.evaluateAll((buttons) =>
              buttons.every((button) => {
                const r = button.getBoundingClientRect();
                const dock = document
                  .querySelector(".phone-dock")!
                  .getBoundingClientRect();
                return r.top >= 0 && r.bottom <= dock.top && r.height >= 48;
              }),
            ),
          {
            message: `Both choices must fit above the dock: ${id} at ${width}px ${JSON.stringify(bounds)}`,
          },
        )
        .toBe(true);
      await expect(page.getByRole("button", { name: "Commit to it" })).toBeInViewport();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      ).toBe(false);
    }
    await page.setViewportSize({ width: 844, height: 390 });
    await expect(choices.last()).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
    ).toBe(false);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/admin/phone-preview/birthday-draft/${id}?phase=prompt`);
    await expect(choices.first()).toBeDisabled();
    await page.goto(`/admin/phone-preview/birthday-draft/${id}?phase=collect`);
    await page.getByRole("button", { name: "Pause preview" }).click();
    await expect(choices.last()).toBeDisabled();
    await page.getByRole("button", { name: "Resume preview" }).click();
    await page.emulateMedia({ reducedMotion: "reduce" });
    await choices.first().click();
    await expect(choices.first()).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "Commit to it" }).click();
    await expect(page.getByRole("button", { name: "Locked in ✓" })).toBeDisabled();
    await expect(choices.last()).toBeDisabled();
    await expect(page.getByText("Commit to it", { exact: true })).toHaveCount(0);
    await expect(
      page.getByText("Pick one, then send your answer", { exact: true }),
    ).toHaveCount(0);
    await page.screenshot({
      path: `.codex/previews/trolley/${id}.png`,
      fullPage: true,
    });
  }
});

test("the shared trolley stage keeps choices and the stand-in reveal readable", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/design?q=trolley-lever&surface=stage&phase=collect&still=1");
  await expect(page.getByLabel("Lever choices")).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator(".trolley-stage-options p").last()).toHaveCSS(
    "opacity",
    "1",
  );
  expect(
    await page
      .locator(".trolley-stage")
      .evaluate((el) => el.getBoundingClientRect().bottom <= innerHeight),
  ).toBe(true);
  await page.getByRole("combobox", { name: /^Phase/ }).selectOption("reveal");
  await expect(page.getByText(/The room (pulled|left|is split)/)).toBeVisible();
  await expect(page.locator(".trolley-stage-options p").last()).toHaveCSS(
    "opacity",
    "1",
  );
  expect(
    await page
      .locator(".trolley-stage")
      .evaluate((el) => el.getBoundingClientRect().bottom <= innerHeight),
  ).toBe(true);
  await page.screenshot({
    path: ".codex/previews/trolley/stage-reveal.png",
    fullPage: true,
  });
});

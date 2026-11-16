import { expect, test } from "@playwright/test";

test("Pokémon PNGs fit unchanged cards, and both dated inflation sliders rehearse", async ({
  page,
}) => {
  test.setTimeout(180_000);
  await page.goto("/admin/phone-preview/birthday-draft/favourite-pokemon");
  await page.getByRole("link", { name: "Admin sign in →" }).click();
  await page.getByLabel("Administrator email").fill("humzab1711@hotmail.com");
  await page.getByRole("button", { name: "Email me a code and link" }).click();
  await page
    .getByRole("link", { name: "Open the sign-in confirmation" })
    .first()
    .click();
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  const cards = page.locator(".question-choice-grid button");
  await expect(cards).toHaveCount(4);
  await expect(page.locator(".question-option-image")).toHaveCount(4);
  await expect
    .poll(() =>
      page
        .locator(".question-option-image")
        .evaluateAll((images) =>
          images.every(
            (image) =>
              (image as HTMLImageElement).complete &&
              (image as HTMLImageElement).naturalWidth > 0,
          ),
        ),
    )
    .toBe(true);
  const png = await page.request.get(
    "/assets/questions/favourite-pokemon/osama-bin-laden.png",
  );
  expect(png.headers()["content-type"]).toContain("image/png");
  expect([...(await png.body()).subarray(0, 8)]).toEqual([
    137, 80, 78, 71, 13, 10, 26, 10,
  ]);
  for (const width of [320, 390, 430]) {
    await page.setViewportSize({ width, height: 844 });
    await page.evaluate(() => document.fonts.ready);
    await expect(page.locator('fieldset[data-phase="collect"]')).toHaveCSS(
      "opacity",
      "1",
    );
    await expect(page.locator(".question-choice-tile").last()).toHaveCSS(
      "opacity",
      "1",
    );
    await expect
      .poll(() =>
        page
          .locator(".question-option-image")
          .evaluateAll((images) =>
            images.every((image) => getComputedStyle(image).opacity === "1"),
          ),
      )
      .toBe(true);
    // Entrance springs keep scaling the cards for a moment, and longer on a busy
    // machine, so measure only once two readings in a row agree.
    const measure = () =>
      cards.evaluateAll((buttons) =>
        buttons.map((button) => ({
          width: button.getBoundingClientRect().width,
          height: button.getBoundingClientRect().height,
        })),
      );
    let before = await measure();
    await expect
      .poll(async () => {
        const next = await measure();
        const settled = JSON.stringify(next) === JSON.stringify(before);
        before = next;
        return settled;
      })
      .toBe(true);
    const geometry = await page
      .locator(".question-option-image")
      .evaluateAll((images) =>
        images.map((image) => {
          const r = image.getBoundingClientRect(),
            p = image.parentElement!.getBoundingClientRect();
          return {
            inside:
              r.left >= p.left &&
              r.right <= p.right &&
              r.top >= p.top &&
              r.bottom <= p.bottom,
            visible: r.width > 0 && r.height >= 24,
            fit: getComputedStyle(image).objectFit,
          };
        }),
      );
    expect(
      geometry.every((item) => item.inside && item.visible && item.fit === "contain"),
    ).toBe(true);
    expect(
      await page
        .locator("body")
        .evaluate(() => document.documentElement.scrollWidth > innerWidth),
    ).toBe(false);
    await page.screenshot({
      path: `.codex/previews/pokemon/phone-${width}.png`,
      fullPage: true,
    });
    // Removing decorative pictures should restore the exact same card geometry.
    await page
      .locator(".question-option-image")
      .evaluateAll((images) => images.forEach((image) => image.remove()));
    const after = await cards.evaluateAll((buttons) =>
      buttons.map((button) => ({
        width: button.getBoundingClientRect().width,
        height: button.getBoundingClientRect().height,
      })),
    );
    expect(after).toHaveLength(before.length);
    for (let i = 0; i < before.length; i++) {
      // Motion transforms can introduce sub-pixel floating-point differences.
      expect(Math.abs(after[i]!.width - before[i]!.width)).toBeLessThan(0.1);
      expect(Math.abs(after[i]!.height - before[i]!.height)).toBeLessThan(0.1);
    }
    await page.reload();
    await expect(page.locator(".question-option-image")).toHaveCount(4);
    await expect
      .poll(() =>
        page
          .locator(".question-option-image")
          .evaluateAll((images) =>
            images.every(
              (image) =>
                (image as HTMLImageElement).complete &&
                (image as HTMLImageElement).naturalWidth > 0,
            ),
          ),
      )
      .toBe(true);
  }
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.getByRole("button", { name: "Mudkip", exact: true }).click();
  await page.getByRole("button", { name: "Send answer" }).click();
  await expect(page.getByRole("button", { name: "Locked in ✓" })).toBeDisabled();
  await page.setViewportSize({ width: 844, height: 390 });
  await expect(page.getByRole("button", { name: "Mudkip", exact: true })).toBeVisible();
  for (const id of ["inflation-freddo", "inflation-petrol"]) {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/admin/phone-preview/birthday-draft/${id}`);
    const slider = page.getByRole("slider", { name: "Estimate" });
    await expect(slider).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "guess the price in 2026",
    );
    await expect(
      page.getByText(id === "inflation-freddo" ? /typically 20p in 2012/ : /138.35p/),
    ).toBeVisible();
    const payload = await page.request.get(
      `/api/admin/content/birthday-draft/questions/${id}/preview`,
    );
    const body = await payload.json();
    expect(body.question).not.toHaveProperty("truth");
    expect(body.question).not.toHaveProperty("explanation");
    await slider.press("ArrowRight");
    await page.getByRole("button", { name: "Send estimate" }).click();
    await expect(page.getByRole("button", { name: "Locked in ✓" })).toBeDisabled();
  }
});

import { expect, test } from "@playwright/test";
test("solo collects a track box, uses its item and resets the inventory", async ({
  page,
}) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/kart");
  const game = page.frameLocator('iframe[title="Solo kart practice"]');
  await game.getByRole("button", { name: "Start driving", exact: true }).click();
  await expect(
    game.getByRole("button", { name: "No power-up", exact: true }),
  ).toBeVisible({ timeout: 60000 });
  expect(
    await game.locator("body").evaluate((body) => body.scrollWidth <= innerWidth),
  ).toBe(true);
  await game.locator("canvas").click({ position: { x: 190, y: 320 } });
  await page.keyboard.down("ArrowUp");
  const item = game.getByRole("button", {
    name: /^Use (Turbo|Bubble shield|Oil slick)$/,
  });
  await expect(item).toBeEnabled({ timeout: 20000 });
  await page.keyboard.up("ArrowUp");
  await item.click();
  await expect(
    game.getByText(/^(Power-up used|Shield active — blocks one slick)$/),
  ).toBeVisible();
  await expect(
    game.getByRole("button", { name: "No power-up", exact: true }),
  ).toBeDisabled();
  await game.getByRole("button", { name: "Reset kart", exact: true }).click();
  await expect(
    game.getByRole("button", { name: "No power-up", exact: true }),
  ).toBeDisabled();
  expect(errors).toEqual([]);
});

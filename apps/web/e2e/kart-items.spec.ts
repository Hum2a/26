import { expect, test } from "@playwright/test";
test("real item sandbox rehearses damage, shields, target departure and bounded cleanup without a room", async ({
  page,
}) => {
  const errors: string[] = [],
    sockets: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("websocket", (socket) => {
    if (new URL(socket.url()).pathname !== "/") sockets.push(socket.url());
  });
  await page.goto("/admin");
  await page.getByLabel("Administrator email").fill("humzab1711@hotmail.com");
  await page.getByRole("button", { name: "Email me a code and link" }).click();
  await page
    .getByRole("link", { name: "Open the sign-in confirmation" })
    .first()
    .click();
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  const workspace = page.getByRole("navigation", { name: "Admin workspace" });
  await expect(workspace).toBeVisible();
  await workspace.getByRole("link", { name: "Kart", exact: true }).click();
  await page.getByRole("button", { name: "Items sandbox", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Item physics sandbox" }),
  ).toBeVisible();
  await expect(
    page.getByText(/This rehearsal changes no room, inventory or score/),
  ).toBeVisible();
  await page.getByRole("button", { name: "Run moving two-racer sample" }).click();
  await expect(
    page.getByRole("region", { name: "Item physics rehearsal" }).getByRole("status"),
  ).toContainText("actual two-racer driving");
  await expect(
    page.getByRole("list", { name: "Item simulation history" }),
  ).toContainText("launch");
  await page.getByRole("button", { name: "Reset sandbox", exact: true }).click();
  await page.getByRole("button", { name: "Rehearse homing without a target" }).click();
  await expect(
    page.getByRole("region", { name: "Item physics rehearsal" }).getByRole("status"),
  ).toContainText("No eligible racer ahead");
  await expect(page.getByRole("list", { name: "Stand-in item state" })).toContainText(
    "Turbo active",
  );
  await expect(page.getByText(/0 \/ 64 projectiles/)).toBeVisible();
  await page.getByRole("button", { name: "Reset sandbox", exact: true }).click();
  await page.getByRole("button", { name: "Try personal Treats boost" }).click();
  await expect(page.getByRole("list", { name: "Stand-in item state" })).toContainText(
    "Turbo active",
  );
  await expect(page.getByText(/0 \/ 64 projectiles/)).toBeVisible();
  await page.getByRole("button", { name: "Advance 1 second", exact: true }).click();
  await expect(
    page.getByRole("list", { name: "Stand-in item state" }),
  ).not.toContainText("Turbo active");
  await page.getByRole("button", { name: "Reset sandbox", exact: true }).click();
  await page.getByRole("button", { name: "Launch stand-in item", exact: true }).click();
  await page.getByRole("button", { name: "Advance 1 second", exact: true }).click();
  await expect(
    page
      .getByRole("list", { name: "Stand-in item state" })
      .getByRole("listitem")
      .filter({ hasText: "Stand-in Bilal" }),
  ).toContainText("Slowed");
  await page.getByRole("button", { name: "Reset sandbox", exact: true }).click();
  await page.getByLabel("Projectile", { exact: true }).selectOption("bomb");
  await page.getByLabel("Target behind for bomb rehearsal", { exact: true }).check();
  await page.getByLabel("Target shield", { exact: true }).check();
  await page.getByRole("button", { name: "Launch stand-in item", exact: true }).click();
  await expect(page.locator('[data-projectile="bomb"] title')).toContainText(
    "1.5 seconds",
  );
  await page.getByRole("button", { name: "Advance 1 second", exact: true }).click();
  await expect(page.locator('[data-projectile="bomb"] title')).toContainText(
    "0.5 seconds",
  );
  await page.getByRole("button", { name: "Restore sample copy", exact: true }).click();
  await expect(
    page.getByRole("region", { name: "Item physics rehearsal" }).getByRole("status"),
  ).toContainText("Restored a validated copy");
  await expect(page.locator('[data-projectile="bomb"] title')).toContainText(
    "0.5 seconds",
  );
  await page.getByRole("button", { name: "Advance 1 second", exact: true }).click();
  await expect(page.getByLabel("Target shield", { exact: true })).not.toBeChecked();
  await expect(
    page.getByRole("list", { name: "Item simulation history" }),
  ).toContainText("shield");
  await page.getByRole("button", { name: "Reset sandbox", exact: true }).click();
  await page.getByLabel("Projectile", { exact: true }).selectOption("homing");
  await page.getByRole("button", { name: "Launch stand-in item", exact: true }).click();
  await page.getByLabel("Target finished", { exact: true }).check();
  await page.getByRole("button", { name: "Advance 0.2 seconds", exact: true }).click();
  await expect(page.getByText(/0 \/ 64 projectiles/)).toBeVisible();
  await page.getByRole("button", { name: "Reset sandbox", exact: true }).click();
  await page.getByRole("button", { name: "Rehearse full pool", exact: true }).click();
  await expect(page.getByText(/64 \/ 64 projectiles/)).toBeVisible();
  await page
    .getByRole("button", { name: "Stop sandbox spawning", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Launch stand-in item", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Clear sandbox projectiles", exact: true })
    .click();
  await expect(page.getByText(/0 \/ 64 projectiles/)).toBeVisible();
  for (const width of [320, 390, 430, 740]) {
    await page.setViewportSize({ width, height: width === 740 ? 390 : 844 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
  }
  await page.setViewportSize({ width: 1280, height: 900 });
  await page
    .getByRole("button", { name: "Enable sandbox spawning", exact: true })
    .click();
  await page.getByLabel("Projectile", { exact: true }).selectOption("tennis");
  await page.getByRole("button", { name: "Launch stand-in item", exact: true }).click();
  await page.screenshot({
    path: ".codex/previews/kart/phase7-items-sandbox.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
  expect(sockets).toEqual([]);
});

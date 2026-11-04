import { expect, test } from "@playwright/test";

test("admin verifies actual asset hashes, reports a missing decoder, retries and drives the real circuit", async ({
  page,
}) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/admin");
  await page.getByLabel("Administrator email").fill("humzab1711@hotmail.com");
  await page.getByRole("button", { name: "Email me a code and link" }).click();
  await page
    .getByRole("link", { name: "Open the sign-in confirmation" })
    .first()
    .click();
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "You are signed in as" }),
  ).toBeVisible();
  await page.goto("/admin/kart");
  await page.getByRole("button", { name: "Files & limits", exact: true }).click();
  const panel = page.getByRole("region", { name: "Kart asset readiness" });
  // A labelled section maps to region, and the real authenticated read supplies all metadata.
  await expect(panel.getByText(/kart-assets-v1/)).toBeVisible();
  const check = panel.getByRole("button", { name: "Check kart files" });
  await check.click();
  await expect(panel.getByText(/5\/5 files verified on this browser/)).toHaveCount(1, {
    timeout: 35_000,
  });
  await page.route("**/kart-engine/draco/draco_decoder.wasm", (route) => route.abort());
  await check.click();
  await expect(panel.getByText(/4\/5 files verified on this browser/)).toBeVisible({
    timeout: 35_000,
  });
  await expect(
    panel.getByText("Unavailable or changed — use the map or retry the circuit"),
  ).toBeVisible();
  await page.unroute("**/kart-engine/draco/draco_decoder.wasm");
  await check.click();
  await expect(panel.getByText(/5\/5 files verified on this browser/)).toHaveCount(2, {
    timeout: 35_000,
  });
  await page.screenshot({
    path: ".codex/previews/kart/phase1-assets-phone.png",
    fullPage: true,
  });
  const game = page.frameLocator('iframe[title="Solo kart practice"]');
  await game.getByRole("button", { name: "Start driving", exact: true }).click();
  await expect(
    game.getByRole("button", { name: "Accelerate", exact: true }),
  ).toBeEnabled({ timeout: 60_000 });
  await expect(
    game.locator('canvas[aria-label="Mario Kart 3.js driving view"]'),
  ).toBeVisible();
  await page.getByRole("button", { name: "Multiplayer", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Race with phones" })).toBeVisible();
  await expect(page.getByTitle("Solo kart practice")).toHaveCount(0);
});

import { expect, test } from "@playwright/test";

test("actual failed circuit releases controls, map works and a real retry recovers without a room", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const errors: string[] = [],
    sockets: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("websocket", (socket) => sockets.push(socket.url()));
  let blockCircuit = true;
  await page.route(
    "**/kart-engine/models/mario-circuit-test-transformed.glb",
    (route) => (blockCircuit ? route.abort() : route.continue()),
  );
  await page.goto("/admin");
  await page.getByLabel("Administrator email").fill("humzab1711@hotmail.com");
  await page.getByRole("button", { name: "Email me a code and link" }).click();
  await page
    .getByRole("link", { name: "Open the sign-in confirmation" })
    .first()
    .click();
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.goto("/admin/kart?view=start");
  await page.getByRole("button", { name: "Rehearse GO", exact: true }).click();
  await expect(
    page.locator('.kart-driver-view[data-readiness="failed"]'),
  ).toBeVisible();
  const gas = page.getByRole("button", { name: "Accelerate", exact: true });
  await expect(gas).toBeDisabled();
  await page.getByRole("button", { name: "Use lightweight map" }).click();
  await expect(gas).toBeEnabled();
  await page.keyboard.down("w");
  await expect(page.getByLabel("Start rehearsal input")).toContainText("Accelerate on");
  await page.getByRole("button", { name: "Disconnect rehearsal", exact: true }).click();
  await expect(gas).toBeDisabled();
  await expect(page.getByLabel("Start rehearsal input")).toContainText(
    "Accelerate off",
  );
  await expect(page.locator('.kart-countdown[data-active="false"]')).toHaveAttribute(
    "aria-hidden",
    "true",
  );
  await page.keyboard.up("w");
  await page.getByRole("button", { name: "Reconnect rehearsal", exact: true }).click();
  await expect(gas).toBeEnabled();
  await page.getByRole("button", { name: "Use 3D driving view" }).click();
  await expect(gas).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Retry circuit", exact: true }),
  ).toBeVisible();
  blockCircuit = false;
  await page.getByRole("button", { name: "Retry circuit", exact: true }).click();
  await expect(page.locator('.kart-driver-view[data-readiness="usable"]')).toBeVisible({
    timeout: 15_000,
  });
  await expect(gas).toBeEnabled();
  await page.getByRole("button", { name: "Show small map", exact: true }).click();
  await expect(page.locator('.kart-driver-viewport[data-inset="true"]')).toBeVisible();
  await expect(page.locator(".kart-driver-map svg")).toHaveCount(1);
  await expect(page.getByLabel("Next sector: 1", { exact: true })).toBeVisible();
  await page.getByLabel("Sample accepted sector", { exact: true }).selectOption("7");
  await expect(
    page.getByLabel("Next sector: finish line", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Turn sample kart around", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Turn sample kart around", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  for (const width of [320, 390, 430, 740]) {
    await page.setViewportSize({ width, height: width === 740 ? 390 : 844 });
    const inset = await page.locator(".kart-driver-map").boundingBox();
    const viewport = await page.locator(".kart-driver-viewport").boundingBox();
    expect(inset).not.toBeNull();
    expect(viewport).not.toBeNull();
    expect(inset!.x).toBeGreaterThanOrEqual(viewport!.x);
    expect(inset!.x + inset!.width).toBeLessThanOrEqual(
      viewport!.x + viewport!.width + 1,
    );
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBe(true);
  }
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.screenshot({
    path: ".codex/previews/kart/phase6-navigation.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Hide small map", exact: true }).click();
  await page
    .getByLabel("Sample navigation track", { exact: true })
    .selectOption("party-ring-v1");
  await page.getByRole("button", { name: "Use lightweight map", exact: true }).click();
  await expect(
    page.getByLabel("Next sector: finish line", { exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Sample navigation track", { exact: true })
    .selectOption("mario-circuit-v1");
  await expect(page.locator('.kart-driver-view[data-readiness="usable"]')).toBeVisible({
    timeout: 15_000,
  });
  await page
    .getByRole("button", { name: "Rehearse 3D interruption event", exact: true })
    .click();
  await expect(gas).toBeDisabled();
  await page.getByRole("button", { name: "Use lightweight map" }).click();
  await expect(gas).toBeEnabled();
  await page.screenshot({
    path: ".codex/previews/kart/phase6-start-recovery.png",
    fullPage: true,
  });
  expect(sockets.filter((url) => new URL(url).pathname !== "/")).toEqual([]);
  expect(errors).toEqual([]);
});

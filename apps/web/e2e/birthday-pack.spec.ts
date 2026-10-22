import { expect, test, type BrowserContext } from "@playwright/test";
test("edits the birthday order and starts the imported room race on a phone", async ({
  browser,
}) => {
  test.setTimeout(180000);
  const host = await browser.newContext({
    baseURL: "http://localhost:4173",
    viewport: { width: 1440, height: 1000 },
  });
  const admin = await host.newPage();
  let phone: BrowserContext | undefined;
  const errors: string[] = [];
  admin.on("pageerror", (e) => errors.push(e.message));
  await admin.goto("/admin");
  const email = admin.getByLabel("Administrator email"),
    retry = admin.getByRole("button", { name: "Try again", exact: true });
  await expect(email.or(retry)).toBeVisible({ timeout: 30000 });
  if (await retry.isVisible()) await retry.click();
  await email.fill("humzab1711@hotmail.com");
  await admin.getByRole("button", { name: "Email me a code and link" }).click();
  await admin
    .getByRole("link", { name: "Open the sign-in confirmation" })
    .first()
    .click();
  await admin.getByRole("button", { name: "Sign in", exact: true }).click();
  await admin.getByRole("link", { name: "Question packs", exact: true }).click();
  const original = await admin.evaluate(async () => {
    const modulePath = "/src/admin/sections-api.ts";
    const { readContent } = await import(/* @vite-ignore */ modulePath);
    const content = await readContent();
    return content.packs.find((p: { id: string }) => p.id === "birthday").runningOrder
      .ids as string[];
  });
  let cleanupFailure: unknown;
  try {
    const order = admin.getByRole("region", { name: "Birthday running order" });
    await expect(order).toBeVisible();
    const rows = order.locator(".running-order-row");
    while ((await rows.count()) > 1) {
      const first = rows.first();
      const title = await first.locator(".order-title strong").textContent();
      if (title?.includes("Grand Prix")) {
        await first.getByRole("button", { name: /to end/ }).click();
      } else await first.getByRole("button", { name: /Remove/ }).click();
    }
    if (await order.getByRole("button", { name: "Save running order" }).isEnabled()) {
      const saved = admin.waitForResponse(
        (response) =>
          response.url().endsWith("/api/admin/content/birthday/order") &&
          response.request().method() === "POST",
      );
      await order.getByRole("button", { name: "Save running order" }).click();
      expect((await saved).status()).toBe(200);
    }
    await expect(
      order.getByRole("button", { name: "Save running order" }),
    ).toBeDisabled();
    await expect(order.locator(".running-order-row")).toHaveCount(1);
    await admin.getByRole("link", { name: "Home", exact: true }).click();
    await admin.getByRole("button", { name: "Create a lobby" }).click();
    const roomCode = admin.locator(".admin-room-code");
    const retryRoom = admin.getByRole("button", { name: "Try again", exact: true });
    await expect(roomCode.or(retryRoom)).toBeVisible({ timeout: 45000 });
    if (await retryRoom.isVisible()) await retryRoom.click();
    const code = (await roomCode.textContent({ timeout: 20000 }))!.trim();
    await admin.getByRole("link", { name: "Live controls", exact: true }).click();
    phone = await browser.newContext({
      baseURL: "http://localhost:4173",
      viewport: { width: 390, height: 844 },
    });
    const driver = await phone.newPage();
    driver.on("pageerror", (e) => errors.push(e.message));
    await driver.goto("/join");
    await driver.getByLabel("Join code").fill(code);
    await driver.getByLabel("Nickname").fill("Circuit guest");
    await driver.getByRole("button", { name: "Join", exact: true }).click();
    await expect(
      driver.getByText("You are in. This phone is Circuit guest.", { exact: true }),
    ).toBeVisible({ timeout: 20000 });
    const model = driver.waitForResponse(
      (r) => r.url().includes("mario-circuit-test-transformed.glb") && r.ok(),
    );
    await admin.bringToFront();
    await admin.getByRole("button", { name: "Start birthday game" }).click();
    await expect(driver.getByText(/Starting grid/)).toBeVisible({ timeout: 20000 });
    await model;
    for (let i = 0; i < 2; i++) {
      await admin.getByRole("button", { name: "Advance", exact: true }).click();
      await admin.waitForTimeout(500);
    }
    await expect(driver.getByRole("button", { name: "Accelerate" })).toBeEnabled();
    await expect(driver.getByText("ONE LAP", { exact: false })).toContainText(
      "3 MINUTES",
    );
    await expect(driver.getByLabel("Your driving view", { exact: true })).toBeVisible();
    await driver.waitForTimeout(3000);
    await driver.screenshot({ path: "artifacts/browser-checks/birthday-phone.png" });
    expect(errors).toEqual([]);
  } finally {
    try {
      await admin.evaluate(async (ids) => {
        const modulePath = "/src/admin/sections-api.ts";
        const { readContent, saveRunningOrder } = await import(
          /* @vite-ignore */ modulePath
        );
        const content = await readContent();
        const current = content.packs.find(
          (p: { id: string }) => p.id === "birthday",
        ).runningOrder;
        const result = await saveRunningOrder({
          requestId: crypto.randomUUID(),
          expectedRevision: current.revision,
          ids,
        });
        if ("error" in result) throw new Error(result.error);
      }, original);
    } catch (error) {
      cleanupFailure = error;
      test.info().annotations.push({
        type: "cleanup",
        description:
          error instanceof Error ? error.message : "Order restoration failed",
      });
    } finally {
      await host.close();
      await phone?.close();
    }
  }
  if (cleanupFailure) throw cleanupFailure;
});

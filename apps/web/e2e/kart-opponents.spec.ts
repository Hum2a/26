import { expect, test, type Page } from "@playwright/test";

const runtimeErrors = new WeakMap<Page, string[]>();
test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  runtimeErrors.set(page, errors);
  page.on("pageerror", (error) => {
    if (errors.length < 20) errors.push(error.message);
  });
});
test.afterEach(async ({ page }) => {
  expect(runtimeErrors.get(page)).toEqual([]);
});

async function signIn(page: Page) {
  await page.goto("/admin");
  await page.getByLabel("Administrator email").fill("humzab1711@hotmail.com");
  await page.getByRole("button", { name: "Email me a code and link" }).click();
  await page
    .getByRole("link", { name: "Open the sign-in confirmation" })
    .first()
    .click();
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}

test("80-driver vehicle rehearsal renders bounded detailed neighbours and honours reduced motion and quality", async ({
  page,
}) => {
  await signIn(page);
  await page.goto("/admin/kart?view=vehicles");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(
    page.getByText("Stand-in drivers — isolated rendering rehearsal", { exact: true }),
  ).toBeVisible();
  const viewport = page.locator('canvas[aria-label="Your driving view"]');
  await page.getByLabel("Graphics", { exact: true }).selectOption("high");
  await expect(viewport).toHaveAttribute("data-karts", "9");
  await expect(viewport).toHaveAttribute("data-vehicle-detail", "detailed");
  expect(
    await page.locator(".kart-driver-viewport").evaluate((element) => {
      const frame = element.getBoundingClientRect();
      const canvas = element.querySelector("canvas")!.getBoundingClientRect();
      return (
        frame.height >= 150 &&
        frame.height <= 232 &&
        canvas.width <= frame.width &&
        canvas.height <= frame.height
      );
    }),
  ).toBe(true);
  await page.getByLabel("Sample kart pose").selectOption("turn");
  await page.getByLabel("Rehearsal driver").selectOption("royal");
  await expect(viewport).toHaveAttribute("data-vehicle-detail", "detailed");
  await page.screenshot({
    path: ".codex/previews/kart/phase2-nearby-detailed.png",
    fullPage: true,
  });
  await page.getByLabel("Graphics", { exact: true }).selectOption("low");
  await expect(viewport).toHaveAttribute("data-karts", "3");
  await expect(viewport).toHaveAttribute("data-vehicle-detail", "simple");
  await page.getByRole("button", { name: "Use lightweight map" }).click();
  await expect(viewport).toHaveCount(0);
  await expect(page.locator("[data-map-player]")).toHaveCount(9);
});

test("failed detailed kart remains simple and can retry without a room", async ({
  page,
}) => {
  await signIn(page);
  await page.route("**/kart-engine/models/kart.glb", (route) => route.abort());
  await page.goto("/admin/kart?view=vehicles");
  await page.getByLabel("Graphics", { exact: true }).selectOption("high");
  const viewport = page.locator('canvas[aria-label="Your driving view"]');
  await expect(
    page.getByRole("button", { name: "Retry detailed karts" }),
  ).toBeVisible();
  await expect(viewport).toHaveAttribute("data-karts", "9");
  await expect(viewport).toHaveAttribute("data-vehicle-detail", "simple");
  await page.unroute("**/kart-engine/models/kart.glb");
  await page.getByRole("button", { name: "Retry detailed karts" }).click();
  await expect(viewport).toHaveAttribute("data-vehicle-detail", "detailed");
  await expect(viewport).toHaveAttribute("data-karts", "9");
});

test("solo rehearsal carries the chosen driver and local image, then removes the face without a room", async ({
  page,
}) => {
  await signIn(page);
  await page.goto("/admin/kart?view=vehicles");
  await page.getByLabel("Rehearsal driver").selectOption("royal");
  const samplePng = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 16;
    const context = canvas.getContext("2d")!;
    context.fillStyle = getComputedStyle(document.documentElement).getPropertyValue(
      "--accent",
    );
    context.fillRect(0, 0, 16, 16);
    return canvas.toDataURL("image/png").split(",")[1]!;
  });
  await page.getByLabel("Local sample face").setInputFiles({
    name: "local-sample.png",
    mimeType: "image/png",
    buffer: Buffer.from(samplePng, "base64"),
  });
  await page.getByRole("button", { name: "Open solo driver rehearsal" }).click();
  const frame = page.frameLocator('iframe[title="Solo kart practice"]');
  expect(
    await page
      .locator('iframe[title="Solo kart practice"]')
      .evaluate((element) => element.getBoundingClientRect().height),
  ).toBeGreaterThanOrEqual(420);
  await expect(frame.getByLabel("Practice driver")).toHaveValue("royal");
  await frame.getByRole("button", { name: "Start driving" }).click();
  const canvas = frame.locator("canvas");
  await expect(canvas).toHaveAttribute("data-driver-instances", "1");
  await expect(canvas).toHaveAttribute("data-three-revision", "176");
  await expect(canvas).toHaveAttribute("data-driver-native", "true");
  await expect(canvas).toHaveAttribute("data-driver-style", "royal");
  await expect(canvas).toHaveAttribute("data-driver-faces", "1");
  await page.getByRole("button", { name: "Clear sample face" }).click();
  await expect(canvas).toHaveAttribute("data-driver-faces", "0");
  await frame.getByText("Course set-up", { exact: true }).click();
  await frame.getByLabel("Practice driver").selectOption("dj");
  await frame.getByText("Course set-up", { exact: true }).click();
  await expect(canvas).toHaveAttribute("data-driver-style", "dj");
  await page.screenshot({
    path: ".codex/previews/kart/phase2-solo-driver.png",
    fullPage: true,
  });
  expect(
    await page.locator('iframe[title="Solo kart practice"]').getAttribute("src"),
  ).toBe("/kart-engine/index.html");
});

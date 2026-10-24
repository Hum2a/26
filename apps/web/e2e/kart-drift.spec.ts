import { expect, test } from "@playwright/test";

test("graphics scale the real renderer and keep driving through manual overrides", async ({
  page,
}) => {
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/kart-engine/index.html");
  await page.getByText("Course set-up", { exact: true }).click();
  const graphics = page.getByLabel("Graphics", { exact: true });
  const players = page.getByLabel("Graphics rehearsal room size");
  await players.fill("16");
  await expect(page.getByRole("status").filter({ hasText: "Balanced" })).toBeVisible();
  await players.fill("21");
  await expect(
    page.getByRole("status").filter({ hasText: "Low detail" }),
  ).toBeVisible();
  await graphics.selectOption("high");
  await expect(
    page.getByRole("status").filter({ hasText: "High detail" }),
  ).toBeVisible();
  await page.getByText("Course set-up", { exact: true }).click();
  await page.getByRole("button", { name: "Start driving" }).click();
  await expect(
    page.getByRole("button", { name: "Accelerate", exact: true }),
  ).toBeEnabled({ timeout: 60_000 });
  const canvas = page.locator("canvas");
  const original = await canvas.elementHandle();
  const ratio = () =>
    canvas.evaluate((node: HTMLCanvasElement) => node.width / node.clientWidth);
  await expect.poll(ratio).toBeGreaterThan(1.4);
  await page.getByText("Course set-up", { exact: true }).click();
  await graphics.selectOption("auto");
  await expect.poll(ratio).toBeLessThan(0.8);
  expect(await canvas.evaluate((node, previous) => node === previous, original)).toBe(
    true,
  );
  await graphics.selectOption("high");
  await expect.poll(ratio).toBeGreaterThan(1.4);
  await page.setViewportSize({ width: 390, height: 844 });
  await graphics.scrollIntoViewIfNeeded();
  await expect(graphics).toBeInViewport();
  await page.screenshot({
    path: "artifacts/browser-checks/performance/kart-graphics-phone.png",
  });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBe(true);
  await page.getByText("Course set-up", { exact: true }).click();
  await canvas.click({ position: { x: 150, y: 180 } });
  await page.keyboard.down("ArrowUp");
  await expect
    .poll(async () =>
      Number.parseInt((await page.getByLabel("Speed", { exact: true }).textContent())!),
    )
    .toBeGreaterThan(20);
  await page.keyboard.up("ArrowUp");
  expect(errors).toEqual([]);
});

test("real solo engine banks a neutral-steering drift and accelerates on release", async ({
  page,
}) => {
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/kart-engine/index.html");
  await page.getByRole("button", { name: "Start driving" }).click();
  await expect(
    page.getByRole("button", { name: "Accelerate", exact: true }),
  ).toBeEnabled({ timeout: 60_000 });
  await page.locator("canvas").click({ position: { x: 200, y: 180 } });
  // Record painted turbo speed in the page so a brief burst cannot fall
  // between automation polling intervals on a slow software renderer.
  await page.locator(".solo-telemetry").evaluate((element) => {
    let peak = 0;
    new MutationObserver(() => {
      if (
        element
          .querySelector("output[aria-label='Drift charge level']")
          ?.textContent?.includes("turbo active") !== true
      )
        return;
      peak = Math.max(
        peak,
        Number.parseInt(
          element.querySelector("output[aria-label='Speed']")?.textContent ?? "0",
        ),
      );
      element.setAttribute("data-turbo-peak", String(peak));
    }).observe(element, { childList: true, subtree: true, characterData: true });
  });
  await page.keyboard.down("ArrowUp");
  const speed = async () =>
    Number.parseInt((await page.getByLabel("Speed", { exact: true }).textContent())!);
  await expect.poll(speed).toBeGreaterThan(60);
  await page.keyboard.down("Space");
  const steering = page.getByLabel("Steering", { exact: true });
  const box = (await steering.boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.58, box.y + box.height / 2);
  await page.mouse.down();
  await expect(page.getByLabel("Drift charge level")).toContainText("turbo ready");
  await page.mouse.up();
  await expect(page.getByLabel("Drift charge level")).toContainText("turbo ready");
  await page.keyboard.up("Space");
  await expect(page.getByText("Boost!", { exact: true })).toBeVisible();
  await expect
    .poll(async () =>
      Number(await page.locator(".solo-telemetry").getAttribute("data-turbo-peak")),
    )
    .toBeGreaterThan(100);
  await page.keyboard.up("ArrowUp");
  await page.getByRole("button", { name: "Back to track", exact: true }).click();
  await expect.poll(speed).toBe(0);
  expect(errors).toEqual([]);
});

test("real course rehearsals launch, glide, land and can clear every track feature", async ({
  page,
}) => {
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/kart-engine/index.html");
  await page.getByText("Course set-up", { exact: true }).click();
  await page.getByRole("button", { name: "Rehearse ramp and glide" }).click();
  await page.getByText("Course set-up", { exact: true }).click();
  await page.getByRole("button", { name: "Start driving" }).click();
  await expect(
    page.getByRole("button", { name: "Accelerate", exact: true }),
  ).toBeEnabled({ timeout: 60_000 });
  await page.locator("canvas").click({ position: { x: 200, y: 180 } });
  await page.keyboard.down("ArrowUp");
  await expect(page.getByLabel("Track feedback")).toContainText("Gliding", {
    timeout: 20_000,
  });
  await page.screenshot({ path: "artifacts/kart-glide.png" });
  await page.keyboard.down("ArrowDown");
  await expect(page.getByLabel("Track feedback")).toContainText("Landed", {
    timeout: 10_000,
  });
  await page.keyboard.up("ArrowDown");
  await page.keyboard.up("ArrowUp");
  await page.getByText("Course set-up", { exact: true }).click();
  await page.getByRole("button", { name: "Clear track", exact: true }).click();
  for (const name of ["Floor boosts", "Ramps and gliding", "Moving sweepers"])
    await expect(page.getByRole("checkbox", { name })).not.toBeChecked();
  await page.getByRole("button", { name: "Restore course" }).click();
  for (const name of ["Floor boosts", "Ramps and gliding", "Moving sweepers"])
    await expect(page.getByRole("checkbox", { name })).toBeChecked();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "artifacts/kart-course-phone.png" });
  await page.getByText("Course set-up", { exact: true }).click();
  await page.getByRole("button", { name: "Keep driving" }).click();
  await expect(page.getByRole("button", { name: "Accelerate", exact: true })).toHaveCSS(
    "opacity",
    "1",
  );
  await expect(page.locator(".solo-course-options")).toHaveCSS("opacity", "0");
  await page.screenshot({ path: "artifacts/kart-phone-driving.png" });
  await page.setViewportSize({ width: 844, height: 390 });
  await page.screenshot({ path: "artifacts/kart-landscape.png" });
  expect(errors).toEqual([]);
});

for (const [name, feedback] of [
  ["floor boost", "Floor boost"],
  ["sweeper", "Sweeper hit"],
])
  test(`real ${name} rehearsal applies the course interaction`, async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto("/kart-engine/index.html");
    await page.getByText("Course set-up", { exact: true }).click();
    await page.getByRole("button", { name: `Rehearse ${name}`, exact: true }).click();
    await page.getByText("Course set-up", { exact: true }).click();
    await page.getByRole("button", { name: "Start driving" }).click();
    await expect(
      page.getByRole("button", { name: "Accelerate", exact: true }),
    ).toBeEnabled({ timeout: 60_000 });
    await page.locator("canvas").click({ position: { x: 200, y: 180 } });
    await page.keyboard.down("ArrowUp");
    await expect(page.getByLabel("Track feedback")).toContainText(feedback, {
      timeout: 15_000,
    });
    await page.keyboard.up("ArrowUp");
  });

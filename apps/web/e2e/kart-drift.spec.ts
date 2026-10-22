import { expect, test } from "@playwright/test";

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
        element.querySelector("output[aria-label='Drift charge level']")
          ?.textContent !== "Turbo active"
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

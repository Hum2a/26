import { expect, test } from "@playwright/test";

test("solo kart loads the real circuit and drives, drifts, pauses and resets without a room", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const errors: string[] = [],
    sockets: string[] = [],
    assets: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("websocket", (socket) => sockets.push(socket.url()));
  page.on("response", (response) => {
    if (response.url().includes("/kart-engine/") && response.ok())
      assets.push(response.url());
  });
  // Match the actual phone driving surface; desktop render quality has its own test.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/kart");
  const game = page.frameLocator('iframe[title="Solo kart practice"]');
  await expect(
    game.getByRole("heading", { name: "Your own starting grid." }),
  ).toBeVisible();
  expect(assets.some((url) => url.endsWith("kart.glb"))).toBe(false);
  // Keep the drift/recovery scenario separate from course hazard interactions.
  await game.getByText("Course set-up", { exact: true }).click();
  await game.getByRole("button", { name: "Clear track", exact: true }).click();
  for (const name of ["Floor boosts", "Ramps and gliding", "Moving sweepers"])
    await expect(game.getByRole("checkbox", { name })).not.toBeChecked();
  await game.getByText("Course set-up", { exact: true }).click();
  await game.getByRole("button", { name: "Start driving" }).click();
  await expect(game.getByRole("button", { name: "Pause", exact: true })).toBeVisible({
    timeout: 60_000,
  });
  await expect(
    game.locator('canvas[aria-label="Mario Kart 3.js driving view"]'),
  ).toBeVisible();
  expect(assets.some((url) => url.endsWith("/models/kart.glb"))).toBe(true);
  expect(
    assets.some((url) => url.endsWith("/models/mario-circuit-test-transformed.glb")),
  ).toBe(true);
  expect(assets.some((url) => url.includes("/draco/") && url.endsWith(".wasm"))).toBe(
    true,
  );
  const distance = () =>
    game
      .getByLabel("Distance from start")
      .textContent()
      .then((value) => Number.parseInt(value!));
  const speed = () =>
    game
      .getByLabel("Speed", { exact: true })
      .textContent()
      .then((value) => Number.parseInt(value!));
  await game.locator("canvas").click({ position: { x: 200, y: 180 } });
  await page.keyboard.down("ArrowUp");
  // Start the drift as soon as we reach speed; check distance after release
  // so browser input latency cannot carry us into turn one first.
  await expect.poll(speed, { timeout: 30_000 }).toBeGreaterThan(80);
  await page.keyboard.down("Space");
  // Hold a gentle drift on the actual road rather than a tight circle into the barriers.
  const steering = game.getByLabel("Steering", { exact: true });
  const steeringBox = (await steering.boundingBox())!;
  await page.mouse.move(
    steeringBox.x + steeringBox.width * 0.58,
    steeringBox.y + steeringBox.height / 2,
  );
  await page.mouse.down();
  await expect(game.getByText("Release drift to boost")).toBeVisible({
    timeout: 20_000,
  });
  // Straightening before releasing used to silently erase the banked turbo.
  await page.mouse.up();
  await expect(game.getByLabel("Drift charge level")).toContainText("turbo ready");
  await page.keyboard.up("Space");
  await expect(game.getByText("Boost!", { exact: true })).toBeVisible();
  await expect.poll(distance).toBeGreaterThan(15);
  await page.keyboard.up("ArrowUp");
  await page.mouse.up();
  await steering.evaluate((input) => (input as HTMLElement).blur());
  await game.getByRole("button", { name: "Back to track", exact: true }).click();
  await expect(game.getByText("Back on track — controls released")).toBeVisible();
  await expect.poll(speed).toBe(0);
  await game.getByRole("button", { name: "Pause", exact: true }).click();
  const parked = await distance();
  await page.waitForTimeout(700); // Prove simulation stops while the solo game is paused.
  expect(await distance()).toBe(parked);
  await expect(
    game.getByRole("button", { name: "Accelerate", exact: true }),
  ).toBeDisabled();
  await game.getByRole("button", { name: "Reset kart" }).click();
  await expect.poll(distance).toBe(0);
  await expect.poll(speed).toBe(0);
  await expect(game.getByRole("button", { name: "Pause", exact: true })).toBeVisible();
  await game.locator("canvas").evaluate((canvas) => {
    canvas.dispatchEvent(new Event("webglcontextlost", { cancelable: true }));
  });
  await expect(game.getByRole("alert")).toContainText("The circuit could not load");
  await expect(game.getByRole("button", { name: "Retry circuit" })).toBeVisible();
  expect(errors).toEqual([]);
  // The site development server has its own HMR socket; the game has no room socket.
  expect(sockets.filter((url) => new URL(url).pathname !== "/")).toEqual([]);
});

test("solo practice fits phones and landscape, with held touch input and clean release", async ({
  browser,
}) => {
  test.setTimeout(180_000);
  for (const viewport of [
    { width: 320, height: 740 },
    { width: 390, height: 844 },
    { width: 430, height: 900 },
    { width: 780, height: 390 },
  ]) {
    const context = await browser.newContext({ viewport, hasTouch: true });
    const page = await context.newPage();
    await page.goto("/kart");
    const game = page.frameLocator('iframe[title="Solo kart practice"]');
    await game.getByRole("button", { name: "Start driving" }).click();
    const drift = game.getByRole("button", { name: "Drift / boost", exact: true });
    await expect(drift).toBeEnabled({ timeout: 60_000 });
    expect(
      await game.locator("body").evaluate((body) => body.scrollWidth <= innerWidth),
    ).toBe(true);
    // Sideways phones steer and work the pedals from the thumb pad; upright
    // phones keep the slider and its own Accelerate button.
    const sideways = viewport.width > viewport.height;
    const thumbPad = game.locator(".kart-thumb-pad");
    const gas = game.getByRole("button", { name: "Accelerate", exact: true });
    await expect(gas).toHaveCount(sideways ? 0 : 1);
    const target = sideways ? thumbPad : gas;
    const box = (await target.boundingBox())!;
    expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
    expect(box.height).toBeGreaterThanOrEqual(44);
    expect((await drift.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    const client = await context.newCDPSession(page);
    const x = box.x + box.width / 2,
      y = box.y + box.height / 2;
    await client.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x, y, id: 1 }],
    });
    if (sideways) {
      // Landing alone coasts; pushing up from there holds the throttle.
      await expect(thumbPad).toHaveAttribute("data-pedal", "none");
      await client.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x, y: y - box.height * 0.35, id: 1 }],
      });
      await expect(thumbPad).toHaveAttribute("data-pedal", "gas");
    } else await expect(gas).toHaveAttribute("aria-pressed", "true");
    const distance = async () =>
      Number.parseInt((await game.getByLabel("Distance from start").textContent())!);
    await expect.poll(distance, { timeout: 20_000 }).toBeGreaterThan(2);
    if (sideways) {
      // A second thumb drifts while the first keeps the throttle held.
      const driftBox = (await drift.boundingBox())!;
      await client.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [
          { x, y: y - box.height * 0.35, id: 1 },
          {
            x: driftBox.x + driftBox.width / 2,
            y: driftBox.y + driftBox.height / 2,
            id: 2,
          },
        ],
      });
      await expect(drift).toHaveAttribute("aria-pressed", "true");
      await expect(thumbPad).toHaveAttribute("data-pedal", "gas");
      // Lifting both thumbs releases the drift and the throttle.
      await client.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      await expect(drift).toHaveAttribute("aria-pressed", "false");
      await expect(thumbPad).toHaveAttribute("data-pedal", "none");
      // A fresh touch pulled down past its landing point brakes.
      await client.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [{ x, y, id: 3 }],
      });
      await client.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x, y: y + box.height * 0.35, id: 3 }],
      });
      await expect(thumbPad).toHaveAttribute("data-pedal", "brake");
    }
    await client.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    if (sideways) await expect(thumbPad).toHaveAttribute("data-pedal", "none");
    else await expect(gas).toHaveAttribute("aria-pressed", "false");
    await game.getByRole("button", { name: "Swap sides" }).click();
    await expect(game.getByRole("button", { name: "Swap sides" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await page.screenshot({ path: `.codex/solo-${viewport.width}.png` });
    await context.close();
  }
});

test("a failed model download gives an honest retry instead of a pretend race", async ({
  page,
}) => {
  await page.route("**/kart-engine/models/*.glb", (route) => route.abort());
  await page.goto("/kart");
  const game = page.frameLocator('iframe[title="Solo kart practice"]');
  await game.getByRole("button", { name: "Start driving" }).click();
  await expect(game.getByRole("alert")).toContainText("The circuit could not load");
  await expect(game.getByRole("button", { name: "Retry circuit" })).toBeVisible();
  await expect(
    game.getByRole("button", { name: "Accelerate", exact: true }),
  ).toHaveCount(0);
});

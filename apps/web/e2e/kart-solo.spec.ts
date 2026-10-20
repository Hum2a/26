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
  await page.goto("/kart");
  const game = page.frameLocator('iframe[title="Solo kart practice"]');
  await expect(
    game.getByRole("heading", { name: "Your own starting grid." }),
  ).toBeVisible();
  expect(assets.some((url) => url.endsWith("kart.glb"))).toBe(false);
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
  await expect.poll(distance, { timeout: 30_000 }).toBeGreaterThan(15);
  await expect.poll(speed, { timeout: 30_000 }).toBeGreaterThan(80);
  await page.keyboard.down("ArrowRight");
  await page.keyboard.down("Space");
  await expect(game.getByText("Release drift to boost")).toBeVisible({
    timeout: 20_000,
  });
  await page.keyboard.up("Space");
  await page.keyboard.up("ArrowRight");
  await page.keyboard.up("ArrowUp");
  await expect(game.getByText("Boost!", { exact: true })).toBeVisible();
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
    await expect(
      game.getByRole("button", { name: "Accelerate", exact: true }),
    ).toBeEnabled({ timeout: 60_000 });
    expect(
      await game.locator("body").evaluate((body) => body.scrollWidth <= innerWidth),
    ).toBe(true);
    const gas = game.getByRole("button", { name: "Accelerate", exact: true });
    const box = (await gas.boundingBox())!;
    expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
    expect(box.height).toBeGreaterThanOrEqual(44);
    const client = await context.newCDPSession(page);
    await client.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x: box.x + box.width / 2, y: box.y + box.height / 2, id: 1 }],
    });
    await expect(gas).toHaveAttribute("aria-pressed", "true");
    await expect
      .poll(
        async () =>
          Number.parseInt(
            (await game.getByLabel("Distance from start").textContent())!,
          ),
        { timeout: 20_000 },
      )
      .toBeGreaterThan(2);
    await client.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await expect(gas).toHaveAttribute("aria-pressed", "false");
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

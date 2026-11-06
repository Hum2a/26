import { expect, test, type Page } from "@playwright/test";

async function openSettings(page: Page) {
  await page.getByRole("button", { name: "Course set-up", exact: true }).click();
}

test("denied browser storage keeps native trial practice playable", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() =>
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get() {
        throw new Error("Storage denied by this test");
      },
    }),
  );
  await page.goto("/kart-engine/index.html");
  await openSettings(page);
  await expect(
    page.getByText("Local records unavailable — driving still works", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("combobox", { name: "Graphics", exact: true })
    .selectOption("low");
  await page
    .getByRole("combobox", { name: "Practice mode", exact: true })
    .selectOption("trial-3");
  await page.getByRole("checkbox", { name: "Save best times on this browser" }).check();
  await expect(
    page.getByText("Could not save local records — your result is still shown", {
      exact: true,
    }),
  ).toBeVisible();
  await openSettings(page);
  await page.getByRole("button", { name: "Start driving", exact: true }).click();
  await page.waitForFunction(() =>
    document.querySelector('.solo-game[data-ready="true"]'),
  );
  await expect(
    page.getByRole("button", { name: "Accelerate", exact: true }),
  ).toBeEnabled();
  await expect(page.getByLabel("Trial time", { exact: true })).toHaveText("0:00.00");
  expect(errors).toEqual([]);
});

test("native trial starts at a real forward crossing, freezes on pause, marks recovery and resets modes", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const errors: string[] = [],
    sockets: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("websocket", (socket) => sockets.push(socket.url()));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/kart-engine/index.html");
  await openSettings(page);
  await page
    .getByRole("combobox", { name: "Graphics", exact: true })
    .selectOption("low");
  await page
    .getByRole("combobox", { name: "Practice mode", exact: true })
    .selectOption("trial-1");
  await page.getByRole("button", { name: "Clear track", exact: true }).click();
  await page.getByRole("checkbox", { name: "Item boxes in practice" }).uncheck();
  await page.getByRole("checkbox", { name: "Save best times on this browser" }).check();
  await expect
    .poll(() =>
      page.evaluate(
        () => JSON.parse(localStorage.getItem("26-kart-trials-v1") ?? "null")?.enabled,
      ),
    )
    .toBe(true);
  await openSettings(page);
  await page.getByRole("button", { name: "Start driving", exact: true }).click();
  await page.waitForFunction(() =>
    document.querySelector('.solo-game[data-ready="true"]'),
  );
  await expect(page.getByLabel("Trial time", { exact: true })).toHaveText("0:00.00");
  await page.bringToFront();
  await page.keyboard.down("w");
  await expect(
    page.getByText("Trial started — follow all eight sectors", { exact: true }),
  ).toBeVisible({ timeout: 15_000 });
  await expect
    .poll(async () => await page.getByLabel("Trial time", { exact: true }).innerText())
    .not.toBe("0:00.00");
  await page.keyboard.up("w");
  await page.screenshot({
    path: ".codex/previews/kart/phase6-trial-driving.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  const paused = await page.getByLabel("Trial time", { exact: true }).innerText();
  await page.waitForTimeout(250);
  await expect(page.getByLabel("Trial time", { exact: true })).toHaveText(paused);
  await page.screenshot({
    path: ".codex/previews/kart/phase6-trial-paused.png",
    fullPage: true,
  });
  for (const viewport of [
    { width: 320, height: 700 },
    { width: 430, height: 900 },
    { width: 740, height: 360 },
  ]) {
    await page.setViewportSize(viewport);
    const rect = await page
      .getByRole("region", { name: "Time trial", exact: true })
      .boundingBox();
    expect(rect).not.toBeNull();
    expect(rect!.x).toBeGreaterThanOrEqual(0);
    expect(rect!.y).toBeGreaterThanOrEqual(0);
    expect(rect!.x + rect!.width).toBeLessThanOrEqual(viewport.width + 1);
    expect(rect!.y + rect!.height).toBeLessThanOrEqual(viewport.height + 1);
  }
  await page.getByRole("button", { name: "Keep driving", exact: true }).click();
  await page.getByRole("button", { name: "Back to track", exact: true }).click();
  await expect(page.getByText("Assisted run", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Reset kart", exact: true }).click();
  await expect(page.getByLabel("Trial time", { exact: true })).toHaveText("0:00.00");
  await expect(page.getByText("Clean run", { exact: true })).toBeVisible();
  await openSettings(page);
  await page
    .getByRole("combobox", { name: "Practice mode", exact: true })
    .selectOption("trial-3");
  await expect(
    page.getByText("Lap 1 / 3 · Sector 1 / 8", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Taking a pit stop." })).toBeVisible();
  await page
    .getByRole("combobox", { name: "Practice mode", exact: true })
    .selectOption("free");
  await expect(page.getByLabel("Trial time", { exact: true })).toHaveCount(0);
  await page
    .getByRole("checkbox", { name: "Save best times on this browser" })
    .uncheck();
  expect(
    await page.evaluate(() => localStorage.getItem("26-kart-trials-v1")),
  ).toBeNull();
  await page.screenshot({
    path: ".codex/previews/kart/phase6-native-trials.png",
    fullPage: true,
  });
  expect(sockets.filter((url) => new URL(url).pathname !== "/")).toEqual([]);
  expect(errors).toEqual([]);
});

test("admin rehearses real trial states, splits, pause and restart without writing local records", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await page.goto("/admin");
  await page.getByLabel("Administrator email").fill("humzab1711@hotmail.com");
  await page.getByRole("button", { name: "Email me a code and link" }).click();
  await page
    .getByRole("link", { name: "Open the sign-in confirmation" })
    .first()
    .click();
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.goto("/admin/kart?view=trials");
  await page.getByRole("button", { name: "Rehearse invalid", exact: true }).click();
  await expect(
    page.getByText("Invalid run — no record", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Rehearse assisted", exact: true }).click();
  await expect(page.getByText("Assisted run", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Pause trial preview", exact: true }).click();
  await expect(
    page.getByText("Paused — trial clock stopped", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Rehearse finished", exact: true }).click();
  await expect(page.getByLabel("Lap splits").locator(":scope > li")).toHaveCount(3);
  await expect(page.getByText("Trial complete", { exact: true })).toBeVisible();
  await page.screenshot({
    path: ".codex/previews/kart/phase6-trial-results.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Restart trial", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Resume trial preview", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => localStorage.getItem("26-kart-trials-v1")),
  ).toBeNull();
});

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

test("80-driver stage rehearsal supports every 3D mode and immediate complete-map return", async ({
  page,
}) => {
  await signIn(page);
  await page.goto("/admin/kart?view=stage");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator("[data-map-player]")).toHaveCount(80);
  const canvas = page.locator('canvas[aria-label="Live kart circuit"]');
  await expect(canvas).toHaveCount(0);
  for (const mode of ["overview", "follow", "director"]) {
    await page.getByRole("button", { name: `Rehearse ${mode}`, exact: true }).click();
    await expect(canvas).toHaveAttribute("data-karts", "80");
    if (mode !== "overview")
      await expect(canvas).toHaveAttribute("data-player-id", /stand-in-/);
    await expect(
      page.getByRole("button", { name: "Return to full-field map" }),
    ).toBeVisible();
  }
  await page.screenshot({
    path: ".codex/previews/kart/phase2-stage-director.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Return to full-field map" }).click();
  await expect(canvas).toHaveCount(0);
  await expect(page.locator("[data-map-player]")).toHaveCount(80);
  await page.getByRole("button", { name: "Rehearse full-field map" }).click();
  await expect(page.getByRole("button", { name: "Use host stage view" })).toHaveCount(
    0,
  );
});

test("local room host controls nearby opponents and stage modes on the existing connection", async ({
  browser,
  page,
}) => {
  test.setTimeout(180_000);
  await signIn(page);
  await page.goto("/admin/kart");
  const creation = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/api/rooms" &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Create kart lobby" }).click();
  expect((await creation).ok()).toBe(true);
  await expect(page).toHaveURL(/\/admin\/rooms\/[^/]+\/live$/);
  const code = (
    await page.locator(".admin-live-side .admin-side-code").innerText()
  ).trim();
  const contexts = await Promise.all([
    browser.newContext({ viewport: { width: 390, height: 844 } }),
    browser.newContext({ viewport: { width: 430, height: 844 } }),
  ]);
  try {
    const phones = await Promise.all(contexts.map((context) => context.newPage()));
    for (const phone of phones)
      phone.on("pageerror", (error) => {
        const errors = runtimeErrors.get(page)!;
        if (errors.length < 20) errors.push(error.message);
      });
    for (const [index, phone] of phones.entries()) {
      await phone.goto(`/j/${code}`);
      await phone.getByLabel("Nickname").fill(index ? "Chen" : "Amina");
      await phone.getByRole("button", { name: "Join", exact: true }).click();
      await expect(phone.getByRole("heading", { name: "In the lobby" })).toBeVisible();
    }
    const stage = await page.context().newPage();
    stage.on("pageerror", (error) => {
      const errors = runtimeErrors.get(page)!;
      if (errors.length < 20) errors.push(error.message);
    });
    await stage.goto(`/host?code=${code}`);
    await stage.getByRole("button", { name: "Connect room" }).click();
    await stage.getByRole("button", { name: "Present on this screen" }).click();
    await page.getByRole("button", { name: "Start kart race", exact: true }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Start kart race", exact: true })
      .click();
    await page.getByRole("button", { name: "Switch new kart effects on" }).click();
    await expect(
      page.getByText("New kart effects are on.", { exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Show nearby racers", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Hide nearby racers" }),
    ).toBeVisible();
    for (const phase of ["prompt", "collect"]) {
      await page.getByRole("button", { name: "Advance", exact: true }).click();
      await expect(stage.locator("[data-phase-motion]")).toHaveAttribute(
        "data-phase",
        phase,
      );
    }
    const phone = phones[0]!;
    await expect(phone.locator("canvas")).toHaveAttribute("data-karts", "2");
    await page.getByRole("button", { name: "Use warm kart look", exact: true }).click();
    await expect(phone.locator("canvas")).toHaveAttribute("data-room-look", "warm");
    await expect
      .poll(async () =>
        Number(await phone.locator("canvas").getAttribute("data-vfx-particles")),
      )
      .toBeGreaterThan(0);
    await page.getByRole("button", { name: "Switch kart decoration off" }).click();
    await expect(phone.locator("canvas")).toHaveAttribute("data-vfx-particles", "0");
    await expect(phone.locator("canvas")).toHaveAttribute("data-vfx-skids", "0");
    await page.getByRole("button", { name: "Switch new kart effects on" }).click();
    await page.getByRole("button", { name: "Hide nearby racers" }).click();
    await expect(phone.locator("canvas")).toHaveAttribute("data-karts", "1");
    await page.getByRole("button", { name: "Follow race leader", exact: true }).click();
    const stageCanvas = stage.locator('canvas[aria-label="Live kart circuit"]');
    await expect(stageCanvas).toHaveAttribute("data-karts", "2");
    await expect(stageCanvas).toHaveAttribute("data-player-id", /.+/);
    await expect(stageCanvas).toHaveAttribute("data-room-look", "warm");
    await expect(
      stage.getByText("Loading circuit model… Race timing follows the room."),
    ).toHaveCount(0);
    await expect(stageCanvas).toHaveAttribute("data-vehicle-detail", "detailed");
    await stage.screenshot({ path: ".codex/previews/kart/phase4-live-stage-look.png" });
    await page
      .getByRole("button", { name: "Use original kart look", exact: true })
      .click();
    await expect(phone.locator("canvas")).toHaveAttribute("data-room-look", "off");
    await expect(stageCanvas).toHaveAttribute("data-room-look", "off");
    await expect
      .poll(async () => Number(await stageCanvas.getAttribute("data-vfx-particles")))
      .toBeGreaterThan(0);
    expect(await stageCanvas.getAttribute("data-vfx-calls")).toBeNull();
    await page.getByRole("button", { name: "3D stage overview", exact: true }).click();
    await expect(stageCanvas).toHaveAttribute("data-player-id", "");
    await page
      .getByRole("button", { name: "Start stage director", exact: true })
      .click();
    await expect(stageCanvas).toHaveAttribute("data-player-id", /.+/);
    await page.getByRole("button", { name: "Pause", exact: true }).click();
    await expect(phone.getByRole("button", { name: "Accelerate" })).toBeDisabled();
    await expect(stageCanvas).toHaveAttribute("data-vfx-paused", "true");
    const frozen = await stageCanvas.getAttribute("data-vfx-particles");
    await stage.waitForTimeout(150); // Check actual scene history is frozen by the accepted pause.
    await expect(stageCanvas).toHaveAttribute("data-vfx-particles", frozen!);
    await stage.emulateMedia({ reducedMotion: "reduce" });
    await expect(stageCanvas).toHaveAttribute("data-vfx-particles", "0");
    await page
      .getByRole("button", { name: "Return stage to map", exact: true })
      .click();
    await expect(stageCanvas).toHaveCount(0);
    await expect(stage.locator("[data-map-player]")).toHaveCount(2);
    await stage.close();
  } finally {
    await Promise.all(contexts.map((context) => context.close()));
  }
});

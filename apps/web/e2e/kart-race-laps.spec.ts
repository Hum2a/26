import { expect, test } from "@playwright/test";

/**
 * A real two-lap race on the ring: the host chooses laps, a phone laps the
 * circuit with a steady steer, and the phone and projector call the laps and
 * the finish from the room's own frames.
 */
test("a two-lap ring race counts laps, calls the final lap and finishes on the phone and stage", async ({
  page,
  browser,
}) => {
  test.setTimeout(240_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/admin");
  await page.getByLabel("Administrator email").fill("humzab1711@hotmail.com");
  await page.getByRole("button", { name: "Email me a code and link" }).click();
  await page
    .getByRole("link", { name: "Open the sign-in confirmation" })
    .first()
    .click();
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.goto("/admin/kart");
  await page.getByRole("button", { name: "Create kart lobby", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/rooms\/[A-Z0-9]+\/live/);
  const region = page.getByRole("region", { name: "Kart course selection" });
  await region.getByLabel("Course for this race").selectOption("party-ring-v1");
  await region.getByLabel("Laps").selectOption("2");
  const choice = page.waitForRequest(
    (request) =>
      new URL(request.url()).pathname === "/api/rooms/play" &&
      request.postDataJSON()?.action === "kart-track",
  );
  await region.getByRole("button", { name: "Save course" }).click();
  expect((await choice).postDataJSON()).toMatchObject({
    kartTrack: "party-ring-v1",
    kartLaps: 2,
  });
  await expect(region).toContainText("Saved course: Party ring · 2 laps · 90 seconds");
  const code = (
    await page.locator(".admin-live-side .admin-side-code").innerText()
  ).trim();
  const context = await browser.newContext({
    baseURL: new URL(page.url()).origin,
    viewport: { width: 390, height: 844 },
  });
  const phone = await context.newPage();
  phone.on("pageerror", (e) => errors.push(e.message));
  const stage = await page.context().newPage();
  stage.on("pageerror", (e) => errors.push(e.message));
  let rivalContext: Awaited<ReturnType<typeof browser.newContext>> | undefined;
  try {
    await phone.goto(`/j/${code}`);
    await phone.getByLabel("Nickname").fill("Amina");
    await phone.getByRole("button", { name: "Join", exact: true }).click();
    await expect(phone.getByRole("heading", { name: "In the lobby" })).toBeVisible();
    // A second racer who stays on the grid keeps the race open after the win,
    // as at a real party, so the projector can call the winner.
    // Its own context: phones in one context share the guest credential.
    rivalContext = await browser.newContext({
      baseURL: new URL(page.url()).origin,
      viewport: { width: 390, height: 844 },
    });
    const rival = await rivalContext.newPage();
    await rival.goto(`/j/${code}`);
    await rival.getByLabel("Nickname").fill("Chen");
    await rival.getByRole("button", { name: "Join", exact: true }).click();
    await expect(rival.getByRole("heading", { name: "In the lobby" })).toBeVisible();
    await stage.goto(`/host?code=${code}`);
    await stage.getByRole("button", { name: "Connect room" }).click();
    await stage.getByRole("button", { name: "Present on this screen" }).click();
    await page.getByRole("button", { name: "Start kart race", exact: true }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Start kart race", exact: true })
      .click();
    for (let i = 0; i < 2; i++)
      await page.getByRole("button", { name: "Advance", exact: true }).click();
    const gas = phone.getByRole("button", { name: "Accelerate", exact: true });
    await expect(gas).toBeEnabled();
    // The racing layout hides this heading so the controls fit; the words still change.
    await expect(phone.locator(".kart-eyebrow")).toHaveText("2 LAPS · 90 SECONDS");
    const hud = phone.getByLabel("Race position");
    await expect(hud).toContainText(/1st|2nd/);
    await expect(hud.getByText("Lap 1/2")).toBeVisible();
    await phone.bringToFront();
    await phone.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        ),
    );
    // The same steady line the main kart spec uses to lap the ring.
    const steering = phone.getByLabel("Steering");
    await steering.focus();
    await steering.press("End");
    for (let i = 0; i < 76; i++) await steering.press("ArrowLeft");
    await expect(steering).toHaveValue("0.24");
    const box = (await gas.boundingBox())!;
    await phone.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await phone.mouse.down();
    await expect(gas).toHaveAttribute("aria-pressed", "true");
    // Lap two is the final lap: the phone counter, its banner and the projector call.
    await expect(hud.getByText("Lap 2/2")).toBeVisible({ timeout: 70_000 });
    await expect(stage.getByText("Final lap!")).toBeVisible({ timeout: 10_000 });
    await phone.screenshot({ path: "artifacts/kart-race-laps-final-lap.png" });
    // Sideways, the race numbers sit over the driving view, clear of the pad and Drift.
    const rivalPage = rivalContext!.pages()[0]!;
    await rivalPage.setViewportSize({ width: 844, height: 390 });
    const rivalHud = rivalPage.getByLabel("Race position");
    await expect(rivalHud).toBeInViewport();
    await expect(rivalHud.getByText("Lap 1/2")).toBeVisible();
    const hudBox = (await rivalHud.boundingBox())!;
    for (const control of [
      rivalPage.locator(".kart-thumb-pad"),
      rivalPage.getByRole("button", { name: "Drift / boost" }),
    ]) {
      const box = (await control.boundingBox())!;
      expect(
        hudBox.x < box.x + box.width &&
          hudBox.x + hudBox.width > box.x &&
          hudBox.y < box.y + box.height &&
          hudBox.y + hudBox.height > box.y,
      ).toBe(false);
    }
    await rivalPage.screenshot({ path: "artifacts/kart-race-laps-landscape.png" });
    await stage.screenshot({ path: "artifacts/kart-race-laps-stage.png" });
    // The finish: total race time, both lap times and the winner on stage.
    await expect(phone.getByText("You finished 1st!")).toBeVisible({ timeout: 70_000 });
    await expect(phone.getByLabel("Your lap times").getByRole("listitem")).toHaveCount(
      2,
    );
    await expect(phone.getByText(/^Race time \d+\.\d{2}s$/)).toBeVisible();
    await expect(phone.getByRole("heading", { name: "Race complete" })).toBeVisible();
    await expect(stage.getByText("Amina wins!")).toBeVisible({ timeout: 10_000 });
    await stage.screenshot({ path: "artifacts/kart-race-laps-winner.png" });
    // The race board shows the rival still racing on lap one.
    await expect(
      stage.getByRole("complementary", { name: "Race leaderboard" }),
    ).toContainText("Lap 1/2");
    await phone.mouse.up();
    await phone.screenshot({ path: "artifacts/kart-race-laps-finish.png" });
    expect(errors).toEqual([]);
  } finally {
    await context.close();
    await rivalContext?.close();
    await stage.close();
  }
});
